---
title: "`NumConvert`: Type-safe number conversions in Clash 1.10"
date: 2026-02-08
description: ""
disable_comments: false
author: "martijnbastiaan"
authorbox: true # Optional, enable authorbox for specific post
summary: "Starting from Clash 1.10, converting between number types becomes easier and safer. Instead of reaching for `fromIntegral` and hoping for the best, you can use `numConvert` and `maybeNumConvert`. This post will show you how to use it and how it was designed."
toc: true
mathjax: false
categories:
  - "Tutorial"
tags:
  - "Clash internals"
  - "Design"
---

Starting from Clash 1.10, converting between number types becomes easier and safer. Instead of reaching for `fromIntegral` and hoping for the best, you can use `numConvert` and `maybeNumConvert`.

```haskell
>>> numConvert (5 :: Word32) :: Signed 64
5

>>> maybeNumConvert (2 :: Unsigned 4) :: Unsigned 2
Just 2

>>> maybeNumConvert (15 :: Unsigned 4) :: Unsigned 2
Nothing

>>> numConvert (15 :: Unsigned 4) :: Unsigned 2
TypeError ...
```

The compiler won't let you write conversions that aren't guaranteed to be safe. If you try to convert an `Index 8` to an `Unsigned 2`, the type checker will reject it as there's no way to represent all values `[0..7]` in a 2-bit unsigned number.

If you want to use it, upgrade to Clash 1.10 and get hacking! The rest of this blog post will walk through the problems with `fromIntegral` in a Clash context, ad-hoc number conversions in general, and the design challenges seen while building this API.

## `fromIntegral` and Clash
When converting between number types in Haskell, the standard approach is `fromIntegral`. It's in `Prelude`, it works everywhere, and it's what everyone knows. But for Clash, it has two problems.

First, it goes through `Integer`:

```haskell
fromIntegral :: (Integral a, Num b) => a -> b
fromIntegral = fromInteger . toInteger
```

In simulation, this will always work as expected. In the HDL produced by clash-the-compiler, `Integer` becomes a 64-bit value<sup>1,2</sup>. This makes the following code:

```haskell
widen :: Unsigned 8 -> Unsigned 16
widen = fromIntegral
```

translate to hardware that converts 8 bits to 64 bits, then back to 16 bits. This is fine, 64 bits is more than enough to store both the source and target type. The conversion through 64 bits won't even show up in the resulting hardware, it will likely be optimized out entirely by synthesis software. If we apply it to larger types, `fromIntegral` stops working as intended:

```haskell
widen2 :: Unsigned 96 -> Unsigned 128
widen2 = fromIntegral
```

This invocation will truncate `Unsigned 96` to `Unsigned 64`, only to stretch it to `Unsigned 128`. In other words, it will lose 32 bits of its input. Worse still, this *does* work as expected in simulation.

Second, even if we ignore the 64-bit artifact imposed by the Clash compiler, `fromIntegral` fails silently when values in the source type cannot be represented in the target type:

```haskell
oops :: Signed 8 -> Unsigned 8
oops = fromIntegral
```

For the value `-1`, this returns `255`. For `-128`, it returns `128`. The conversion "works", i.e. no error or warning. Of course, if you're careful enough, this doesn't have to bite you. Still, between deadlines and AI-powered refactors I think everyone will be bitten by it at some point.

## Conversion classes
Ideally, we'd introduce two classes: one for number conversions that are proven to be safe at compile time and another for conversions that can fail. E.g., an `Index 8` has values `[0..7]`. An `Unsigned 3` can represent `[0..7]`. The conversion always succeeds. But converting an `Unsigned 8` `[0..255]` to an `Index 8` fails for most values.

We can express this distinction with two type classes:

```haskell
class NumConvert a b where
  numConvert :: a -> b

class MaybeNumConvert a b where
  maybeNumConvert :: a -> Maybe b
```

The `NumConvert` instance for `Unsigned n` to `Unsigned m` requires a constraint: `n <= m`. The type checker enforces this. Write a conversion that violates it and compilation fails:

```haskell
-- Type error: can't prove 8 <= 2
broken :: Unsigned 8 -> Unsigned 2
broken = numConvert
```

For conversions that might fail, `MaybeNumConvert` returns `Nothing` instead of producing garbage:

```haskell
>>> maybeNumConvert (5 :: Unsigned 8) :: Maybe (Index 8)
Just 5
>>> maybeNumConvert (10 :: Unsigned 8) :: Maybe (Index 8)
Nothing
```

This gives you a choice: prove your conversion is safe with types, or handle failure explicitly with `Maybe`. Either way, the bug surface shrinks.

## O(n<sup>2</sup>) instances

We have many number types in Clash:
- The sized types: `Index n`, `Unsigned n`, `Signed n`, `BitVector n`
- The Haskell types: `Word`, `Word8`, `Word16`, `Word32`, `Word64`, `Int`, `Int8`, `Int16`, `Int32`, `Int64`
- Special cases: `Bit`

And probably more. A naive implementation would write instances for every pair: `Index` to `Unsigned`, `Index` to `Signed`, `Word8` to `Unsigned`, `Word8` to `Signed`, and so on. For 15 types, that's 225 instances. Worse yet, this doesn't scale beyond `clash-prelude`. Packages that depend on the prelude can define instances for their number types, but probably can't for other reverse dependencies.

To side-step this quadratic explosion, we can think of the Clash types as "canonical" types. Every other type should define an instance that can convert to a canonical type. Through this, we only need to define two instances for a foreign type, instead of _n_. For example, for `Word32` this would look like:

```haskell
instance (NumConvert (Unsigned 32) a) => NumConvert Word32 a where
  numConvert a = numConvert (bitCoerce a :: Unsigned 32)

instance (NumConvert a (Unsigned 32)) => NumConvert a Word32 where
  numConvert = bitCoerce @(Unsigned 32) . numConvert
```

As it turns out, this doesn't quite work. The following code:

```haskell
f :: Word32 -> Word64
f = numConvert
```

fails to compile with:

```
Overlapping instances for NumConvert Word32 Word64
  Matching instances:
    instance NumConvert a (Unsigned 64) => NumConvert a Word64
    instance NumConvert (Unsigned 32) a => NumConvert Word32 a
```

So either it will:

* Pick `NumConvert a Word64`
* Now it needs to prove `NumConvert Word32 (Unsigned 64)`
* It will find: `NumConvert (Unsigned 32) a => NumConvert Word32 a`
* Now it needs to prove: `NumConvert (Unsigned 32) (Unsigned 64)`
* It will find `(a <= b) => NumConvert (Unsigned a) (Unsigned b)`
* (Let type checkers handle `(32 <= 64)`)

or:

* Pick `NumConvert Word32 a`
* Now it needs to prove `NumConvert (Unsigned 32) Word64`
* It will find: `NumConvert a (Unsigned 64) => NumConvert a Word64`
* Now it needs to prove: `NumConvert (Unsigned 32) (Unsigned 64)`
* It will find `(a <= b) => NumConvert (Unsigned a) (Unsigned b)`
* (Let type checkers handle `(32 <= 64)`)

In this, either `NumConvert Word32 a` or `NumConvert a Word64` does the work. That is to say, either you proof that you input is convertable to a "known Clash type", or you do it for the output. In the face of ambiguity, GHC refuses to guess (like the Python Zen told it to). This is good, but there is no way of telling it to "just pick one"<sup>3</sup>.


## `Canonical`
To fix this, we settled on a level of indirection through type families. Instead of expecting GHC find a path through arbitrary intermediate types, we explicitly define a canonical form for each type:

```haskell
type family Canonical a

type instance Canonical Word32 = Unsigned 32
type instance Canonical Word64 = Unsigned 64
type instance Canonical Int16 = Signed 16
type instance Canonical (Unsigned n) = Unsigned n
type instance Canonical (Index n) = Index n
```

Now `NumConvert` isn't a class with instances. It's a constraint synonym that describes a three-step conversion:

```haskell
type NumConvert a b =
  ( NumConvertCanonical a (Canonical a)
  , NumConvertCanonical (Canonical a) (Canonical b)
  , NumConvertCanonical (Canonical b) b
  )

numConvert :: forall a b. NumConvert a b => a -> b
numConvert =
    numConvertCanonical @(Canonical b) @b
  . numConvertCanonical @(Canonical a) @(Canonical b)
  . numConvertCanonical @a @(Canonical a)
```

To convert `Word32` to `Word64`:
1. Convert `Word32` to its canonical form: `Unsigned 32`
2. Convert between canonical forms: `Unsigned 32` to `Unsigned 64`
3. Convert from canonical form to `Word64`

Similarly, `maybeNumConvert`  is now defined as:

```haskell
maybeNumConvert :: forall a b. MaybeNumConvert a b => a -> Maybe b
maybeNumConvert a =
    fmap (numConvertCanonical @(Canonical b) @b)
  $ maybeNumConvertCanonical @(Canonical a) @(Canonical b)
  $ numConvertCanonical @a @(Canonical a) a
```

Note that `maybeNumConvert` use `numConvertCanonical` to translate to and from canonical forms. This makes it that new "foreign" types only have to implement `NumConvertCanonical`, not `MaybeNumConvertCanonical`.

In any case, by going through cannoical types there is no ambiguity for GHC to solve.

The actual class, `NumConvertCanonical`, only needs instances for conversions between canonical forms and conversions to/from canonical forms:

```haskell
-- Conversion for canonical types:
instance (KnownNat n, KnownNat m, n <= m) =>
  NumConvertCanonical (Unsigned n) (Unsigned m) where
  numConvertCanonical = resize

-- ..and many more
```

A foreign type requires exactly three things:

```haskell
-- 1. Declare the canonical form
type instance Canonical MyWord = Unsigned 16

-- 2. Convert to canonical form
instance NumConvertCanonical MyWord (Unsigned 16) where
  numConvertCanonical = bitCoerce

-- 3. Convert from canonical form
instance NumConvertCanonical (Unsigned 16) MyWord where
  numConvertCanonical = bitCoerce
```

That's it. Your type now converts to and from everything else automatically. The canonical form infrastructure handles the rest.

## Wrapping up
The final design is simple from a user's perspective: call `numConvert` for safe conversions, `maybeNumConvert` for potentially failing ones. The machinery makes sure you get compile-time safety, synthesizable hardware, and an $O(n)$ instance count.
