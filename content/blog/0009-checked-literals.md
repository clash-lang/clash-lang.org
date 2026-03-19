---
title: "Introducing checked-literals: compile-time bounds checking for numeric literals"
date: "2026-04-07"
description: "A GHC plugin that turns out-of-range numeric literals into type errors"
disable_comments: false
author: "martijnbastiaan"
authorbox: true
summary: "GHC's builtin overflow warnings are easy to bypass and don't work for custom numeric types. We wrote a GHC source plugin, `checked-literals`, that rewrites numeric literals so that out-of-range values are rejected at compile time. It works in monomorphic and polymorphic contexts, supports integer and rational literals, and produces actionable error messages -- including suggested type-level constraints."
toc: true
mathjax: false
categories:
  - "Tutorial"
tags:
  - "Clash internals"
  - "Design"
---

## Problem

GHC has a builtin warning, `-Woverflowed-literals`, that catches some out-of-range numeric literals:

```
ghci> -5 :: Word
<interactive>:0:2: warning: [GHC-97441] [-Woverflowed-literals]
    Literal -5 is out of the Word range 0..18446744073709551615

18446744073709551611
```

Unfortunately, it's trivially bypassed by introducing polymorphism:

```
ghci> let x = -5 :: Num a => a in x :: Word
18446744073709551611
```

No warning at all, yet we still get unexpected wrapping behavior. This is the kind of thing that's easy to do accidentally, especially in a larger codebase where definitions and their use sites are in different modules. The chances of hitting this in standard Haskell programs is pretty low, because typical literals don't often come close to the boundaries of typical numeric types. In Clash programs this is different though, as sizes for its numeric types (`Unsigned`, `Signed,` `Index`, etc.) are often picked a low as possible to not waste silicon area. Wouldn't it be nice if we could pick out literals that don't fit?

## `checked-literals`

[`checked-literals`](https://hackage.haskell.org/package/checked-literals) is a GHC source plugin that turns out-of-range numeric literals into compile-time type errors. Enable it with a single line of configuration, no code changes required:

```yaml
library
  build-depends:
    checked-literals

  ghc-options:
    -fplugin=CheckedLiterals
```

The plugin works for both integer and rational literals, in both monomorphic and polymorphic contexts.

## Standard Haskell types

Before getting to Clash types, let's see what the plugin does for standard Haskell types.

### Out-of-bounds integer on `Word8`

```haskell
x :: Word8
x = 259
```

```
error: [GHC-64725]
    • Literal 259 is out of bounds.
      Word8 has bounds: [0 .. 255].
      Possible fix: use 'uncheckedLiteral' from 'CheckedLiterals' to bypass this check.
  |
8 | x = 259
  |     ^^^
```

Instead of silently wrapping, this is now a hard type error. The message tells you exactly what the valid range is.

### Negative literal on unsigned type

```haskell
x :: Word8
x = -1
```

```
error: [GHC-64725]
    • Literal -1 is out of bounds.
      Word8 has bounds: [0 .. 255].
      Possible fix: use 'uncheckedLiteral' from 'CheckedLiterals' to bypass this check.
  |
8 | x = -1
  |     ^^
```

### Rounding detection for `Data.Fixed`

The plugin also works for rational literals. For example, Haskell's `Milli` type (from `Data.Fixed`) has a resolution of 1/1000. Assigning a literal that requires more precision than that is now caught:

```haskell
x :: Milli
x = 3.1415
```

```
error: [GHC-64725]
    • Literal "3.1415" requires rounding for Fixed E3 (resolution 1/1000).
      The literal cannot be represented exactly without rounding.
      Possible fix: use 'uncheckedLiteral' from 'CheckedLiterals' to bypass this check.
  |
6 | x = 3.1415
  |     ^^^^^^
```

## Clash types: `Unsigned`

Now for the types that motivated this plugin in the first place.

### Monomorphic: `Unsigned 8` out of bounds

```haskell
x :: Unsigned 8
x = 259
```

```
error: [GHC-64725]
    • Literal 259 is (potentially) out of bounds.
      Unsigned 8 has bounds: [0 .. 255].
      Possible fix: use 'uncheckedLiteral' from 'CheckedLiterals' to bypass this check.
   |
12 | x = 259
   |     ^^^
```

### Negative literal on `Unsigned`

```haskell
x :: Unsigned 8
x = -1
```

```
error: [GHC-64725]
    • Literal -1 is out of bounds.
      Unsigned 8 has bounds: [0 .. 255].
      Possible fix: use 'uncheckedLiteral' from 'CheckedLiterals' to bypass this check.
   |
12 | x = -1
   |     ^^
```

### Polymorphism

This is where `checked-literals` really shines. When the bit width is a type variable, the plugin still catches the problem _and suggests the right constraint_:

```haskell
x :: (4 <= n, KnownNat n) => Unsigned n
x = 255
```

```
error: [GHC-64725]
    • Literal 255 is (potentially) out of bounds.
      Unsigned n has bounds: [0 .. (2 ^ n) - 1].
      Possible fix: add a constraint: 8 <= n.
      Possible fix: use 'uncheckedLiteral' from 'CheckedLiterals' to bypass this check.
   |
12 | x = 255
   |     ^^^
```

The error tells you that `n` needs at least 8 bits to hold the value 255. Adding `8 <= n` to the context makes it compile. This is the kind of thing that would previously only show up as incorrect simulation results or, worse, as a subtle hardware bug.

## Clash types: `UFixed`

Fixed-point types add another dimension to the problem: the fractional part must also be representable.

### Not enough fractional bits

```haskell
x :: (KnownNat f, 1 <= f) => UFixed 0 f
x = 0.75
```

```
error: [GHC-64725]
    • Literal 0.75 cannot be represented exactly by Fixed Unsigned 0 f.
      The fractional part needs at least 2 bit(s).
      Possible fix: add a constraint: 2 <= f.
      Possible fix: use 'uncheckedLiteral' from 'CheckedLiterals' to bypass this check.
   |
12 | x = 0.75
   |     ^^^^
```

The fix is actionable: `2 <= f`. Adding it makes this compile. Changing it from `1 <= f` to `2 <= f` is all you need.

### Non-representable denominator

```haskell
x :: UFixed 0 1
x = 0.1
```

```
error: [GHC-64725]
    • Literal 0.1 cannot be represented exactly by Fixed Unsigned 0 1.
      The reduced denominator 10 is not a power of 2.
      Possible fix: use 'uncheckedLiteral' from 'CheckedLiterals' to bypass this check.
   |
12 | x = 0.1
   |     ^^^
```

This catches a genuinely subtle bug: `0.1` can never be exactly represented in _any_ binary fixed-point format, regardless of how many bits you have. The reduced fraction is 1/10, and 10 is not a power of 2.

### Polymorphic integer overflow

Even the integer part of a fixed-point literal is checked:

```haskell
x :: (KnownNat f, KnownNat n) => UFixed n f
x = 1.0
```

```
error: [GHC-64725]
    • Literal 1.0 is (potentially) out of bounds.
      Note: integer part needs at least 1 bit(s).
      Possible fix: add a constraint: 1 <= n.
      Possible fix: use 'uncheckedLiteral' from 'CheckedLiterals' to bypass this check.
   |
12 | x = 1.0
   |     ^^^
```

## How it works

The plugin operates at parse time, before type checking. It rewrites every numeric literal into a call to a checked wrapper function:

- `259` becomes `checkedPositiveIntegerLiteral @259 259`
- `-1` becomes `checkedNegativeIntegerLiteral @1 (-1)`
- `0.75` becomes `checkedPositiveRationalLiteral @"0.75" @3 @4 0.75`

These functions are the identity at runtime, but each carries a type class constraint. For example, `checkedPositiveIntegerLiteral` requires `CheckedPositiveIntegerLiteral lit a`, where `lit` is the literal value lifted to the type level and `a` is the target type. Instance authors provide the bounds logic using type-level arithmetic. For example, the instance for `Word8` looks like:

```haskell
instance (Assert (lit <=? 255) (..error message..))
  => CheckedPositiveIntegerLiteral lit Word8
```

GHC's type checker does the rest. This design means the plugin itself is small and generic -- all the smarts live in the type class instances, which library authors can write for their own numeric types.

## Escape hatch

Sometimes you really do want to use a literal that doesn't fit the target type. The `uncheckedLiteral` function bypasses the plugin's checks:

```haskell
x :: Word8
x = uncheckedLiteral 259  -- compiles!
```

The name is intentionally loud -- it should stand out in code review.

## FAQ

### Why not a core-to-core plugin?

By the time a core-to-core plugin runs, type checking has already happened. You can't insert constraints anymore. Yes, you could write your own solvers, but that would balloon the plugin's complexity and bypass GHC's usual type checking behavior.

### Why not a type-checker plugin?

Type-checker plugins don't have access to term-level literals. They see types and constraints, but not the expressions that produced them. You'd need additional passes to bridge that gap.

### Why an error, not a warning?

Because GHC doesn't have `TypeWarning` (yet). Once it does, offering a warning mode would make sense.

## Status

`checked-literals` is [available on Hackage](https://hackage.haskell.org/package/checked-literals). It ships with instances for all standard numeric types (`Word`, `Word8`, ..., `Int`, `Int8`, ..., `Integer`, `Natural`, `Float`, `Double`, `Data.Fixed`, `Ratio`). If you maintain a library with custom numeric types, writing instances is straightforward -- the `Unsigned` and `UFixed` instances in Clash serve as good examples.

We're working on integrating `checked-literals` into `clash-prelude` so that Clash users can get compile-time literal checking just by enabling the plugin.
