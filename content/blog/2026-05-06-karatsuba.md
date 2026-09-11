---
title: "Type-directed Circuit Design: Karatsuba's Algorithm"
date: "2026-05-06"
description: "A demonstration of type-level templating"
disable_comments: true
author: "diegodiv"
authorbox: true # Optional, enable authorbox for specific post
toc: true
mathjax: true
categories:
  - "Tutorial"
tags:
  - "Clash"
  - "Design"
---

When writing certain classes of algorithms, for example, cryptographic primitives,
you might be confronted to the Behemoth of arithmetical operations on large
numbers. Subtraction, addition, modulo, multiplication, all of these might
be needed. In this article, we'll focus on implementing 256-bits
multiplication on an FPGA with Clash.

While this article is meant to be relatively accessible, I'll assume the reader
has some knowledge of Haskell and Clash.

## Potential Designs

Before getting into the nitty-gritty of a specific implementation, let's
survey some potential designs and their pitfalls.

### Combinational Designs

Combinational designs are implementations that respect this specification:
```haskell
multiplication :: Unsigned 256 -> Unsigned 256 -> Unsigned 512
```

A point of detail: you probably never want to have a one-cycle 256-bit
multiplication in your design, but it's interesting to take a look at it anyway
since it is allowed to write such a signature.

The most basic design would be
```haskell
multiplication = (*)
```

However, such an implementation leaves all the details to the subsequent
synthesis tools since Clash will simply output the corresponding `*` in Verilog.

### Sequential Designs

Let's have a look at sequential designs, as they enable us to run a
multiplication over multiple cycles, thus saving space and getting a shorter
critical path.

Sequential designs are implementations that respect this specification or a
similar one (e.g. using `Maybe ...` for starting/restarting the circuit and
announcing when the output is ready):

```haskell
multiplication :: Signal dom (Unsigned 256) -> Signal dom (Unsigned 256) -> Signal dom (Unsigned 512)
-- Or potentially something like
multiplication :: Signal dom (Maybe (Unsigned 256, Unsigned 256)) -> Signal dom (Maybe (Unsigned 512))
```

These signatures will generate relatively big buses, so you might want to
implement something streaming, or more granular, depending on resource usage,
however that's not the focus of this article.

There's a lot of potential designs on the table for this, including (but not
limited to):
- [Long multiplication](https://en.wikipedia.org/wiki/Multiplication_algorithm#Long_multiplication),
  computing the additions over time, and potentially multiple multiplications per cycle.
- Breadth-first multiplication, splitting the number in two recursively.
- The [Karatsuba algorithm](https://en.wikipedia.org/wiki/Karatsuba_algorithm), presented in the next section.

We chose to use the latter, with a mix of both sequential and
combinational operations. The idea is that you can control the time/space
tradeoff according to your needs.

## Karatsuba Algorithm

Karatsuba's algorithm is a multiplication algorithm that relies on a simple
arithmetical trick to trade one multiplication for a few simpler operations.

Let's assume we want to get the sum \( x * y \) with
$$ x = x_1 * 2 ^ {128} + x_0 $$
$$ y = y_1 * 2 ^ {128} + y_0 $$

The common approach would be to compute the result as such:

$$ x * y = x_1 y_1 * 2 ^ {256} + (x_1 y_0 + x_0 y_1) * 2 ^ {128} + x_0 y_0 $$

using four multiplications, three additions (and some shifts).

Karatsuba uses a neat trick to shave off one multiplication (at the cost of some
more additions and subtractions) which ends up computing four numbers
$$ z_3 = (x_1 + x_0)(y_1 + y_0) $$
$$ z_2 = x_1 y_1 $$
$$ z_0 = x_0 y_0 $$
and (that's where the magic happens)
$$ z_1 = z_3 - z_2 - z_0 \space(= x_1 y_0 + x_0 y_1) $$
leading to
$$ x * y = z_2 * 2 ^ {256} + (z_3 - z_2 - z_0) * 2 ^ {128} + z_0 $$

This is a very short presentation and you can find a more thorough explanation
on [Wikipedia](https://en.wikipedia.org/wiki/Karatsuba_algorithm). The algorithm
also works with other bases, and you can split the number however you want.
For simplicity, I split them in half, and use base 2.

## Type-directed Circuit Design

Our aim here is to write code one time and make it fit the requirements of
different FPGAs. Let's leverage the power of Haskell's type system and dive
into the signatures!

### Combinational

For the combinational version, we'd like to be able to control how deep the
recursion goes using type arguments. In the case of Clash, the actual recursion
takes place when generating the layout, and that's why we need to know the
recursion depth at compile-time.

We could choose to directly state the depth as the type argument, but in the
end, we instead relied on using the size of the smallest multiplication on the
board. It has the advantage of scaling automatically if you change the size of
the inputs.

Our combinational circuit has the following signature:
```haskell
karatsuba ::
  forall (n :: Nat) (m :: Nat). (KnownNat n, KnownNat m) =>
  forall regBound -> KnownNat regBound =>
  Unsigned n -> Unsigned m -> Unsigned (n + m)
```
The [visible type quantifier](https://ghc.gitlab.haskell.org/ghc/doc/users_guide/exts/required_type_arguments.html)
`regBound` enables parametrizing how deep the combinational Karatsuba circuit will
be by setting the size of the smaller multiplication circuit - which depends
on the hardware that's available to you, e.g., 36 (18 + 18) in the case of an ECP5
Lattice FPGA. The reality is a bit more complex, as the DSP supports
different multiplications with different size. You can take a look at [page 32 of the ECP5 Family Datasheet](https://www.latticesemi.com/-/media/LatticeSemi/Documents/DataSheets/ECP5/FPGA-DS-02012-3-4-ECP5-ECP5G-Family-Data-Sheet.ashx).

Haskell doesn't fully support dependent types (yet?), so we use primitives and types
from `clash-prelude` in order to bridge the gap between term-level et type-level
values:
[`compareSNat`](https://hackage-content.haskell.org/package/clash-prelude-1.8.4/docs/Clash-Promoted-Nat.html#v:compareSNat),
[`SNat`](https://hackage-content.haskell.org/package/clash-prelude-1.8.4/docs/Clash-Promoted-Nat.html#t:SNat)
and [`SNatLE`](https://hackage-content.haskell.org/package/clash-prelude-1.8.4/docs/Clash-Promoted-Nat.html#t:SNatLE).

`SNat` is a particularly important type as it enables us to reify type-level
values (specifically [`Nat`](https://hackage-content.haskell.org/package/clash-prelude-1.8.4/docs/Clash-Prelude.html#t:Nat))
and use them at term-level.

A small example to demonstrate `snatToInteger` and `SNat`:
```haskell
-- Could be any Nat defined in a more complex way.
type Length = 6

-- Will always return `Length` but as a term-level value, 6 in this example.
length :: Unsigned 32
length = fromInteger (snatToInteger (SNat :: SNat Length))
```

But `compareSNat` lends itself to model more complex behaviours:
```haskell
circuit :: Unsigned n -> Unsigned n
circuit x = case compareSNat (SNat :: SNat Length) (SNat :: SNat 8) of
  SNatLE -> x * x
  _      -> x + x
```
`circuit` will behave like multiplication if `Length < 8`, and like addition
otherwise.

In our implementation, this `case` block enables us to control recursion:
```haskell
  = case ( compareSNat (SNat :: SNat (n + m)) (SNat :: SNat regBound)
         , compareSNat (SNat :: SNat 4) (SNat :: SNat s)
         ) of
      (SNatGT, SNatLE) -> ... -- Actual Karatsuba stuff with recursive calls.
      _                -> extend x * extend y
```

If the sum of the sizes is bigger than `regSize` and the maximum of both
sizes is more than 4, Clash generates the circuit for Karatsuba's algorithm,
otherwise it simply generates the circuit for `(*)`.

All of these functions and values are evaluated at compile time: you
can see `compareSNat` as an instruction for Clash describing how to handle
circuit generation.

It is worth mentioning that, because of the absence of dependent type machinery,
we have to resort to using constraints like `KnownNat` in order for the compiler
(and the plugins you commonly use with Clash) to work.

The complete body of the function:
```haskell
-- | The number of bits of the low part.
type Low  n = n `Div` 2
-- | The number of bits of the high part.
type High n = n - n `Div` 2

karatsuba regBound x y
  | SNat @s <- (SNat :: SNat (Max n m))
  , Rewrite <- using @(HalfIsLess s) -- A nifty use of `ghc-typelits-proof-assist`.
  = case ( compareSNat (SNat :: SNat (n + m)) (SNat :: SNat regBound)
         , compareSNat (SNat :: SNat 4) (SNat :: SNat s)
         ) of
      (SNatGT, SNatLE)
        -> resize z₀
        + resize (extendRight @(Low s) z₁)
        + resize (extendRight @(Low s + Low s) z₂)
       where
        xₗₒ, yₗₒ :: Unsigned (Low s)
        xₕᵢ, yₕᵢ :: Unsigned (High s)
        (xₕᵢ, xₗₒ) = bitCoerce $ resize x
        (yₕᵢ, yₗₒ) = bitCoerce $ resize y

        xₛ, yₛ :: Unsigned (High s + 1)
        xₛ = resize xₕᵢ + resize xₗₒ
        yₛ = resize yₕᵢ + resize yₗₒ

        -- Here are the recursive calls to the circuit.
        -- These calls act on strictly smaller Nats than n and m.
        z₀, z₁, z₂ :: Unsigned ((High s + 1) + (High s + 1))
        z₀ = resize $ karatsuba regBound xₗₒ yₗₒ
        z₂ = resize $ karatsuba regBound xₕᵢ yₕᵢ
        z₃ = karatsuba regBound xₛ yₛ
        z₁ = z₃ - z₂ - z₀

      -- The base case for the recursion, for when we've reached the final size.
      _ -> extend x * extend y
```

### Sequential

Same as for the combinational version, we'd like to be able to parametrize over
the recursion depth. However, in this case, we'll have to take care of how we
handle temporal behaviour.

Our sequential circuit has the following signature:
```haskell
karatsubaSequential ::
  forall (n :: Nat) (m :: Nat) (dom :: Domain).
  (KnownNat n, KnownNat m, HiddenClockResetEnable dom) ->
  forall stages   -> KnownNat stages =>
  forall regBound -> KnownNat regBound =>
  Channel dom (Unsigned n, Unsigned m) ->
  Channel dom (Unsigned (n + m))
```

[`Channel`](https://github.com/clash-lang/clash-crypto/blob/main/src/Clash/Signal/Channel.hs#L113)
is an extension of `Signal` that enables us to track when a circuit has finished
computing (also maintaining the output stable). Here, it helps us orchestrate
the inputs and outputs to the subcircuits, by knowing when one of them
terminates. It is meant to be interacted with through the primitives defined in
the `Clash.Signal.Channel` module in `clash-crypto`.

Apart from the input sizes, we make use of two type variables:
- `stages` sets the depth of the sequential recursion.
- `regBound` sets the maximum base multiplication size for the combinational
 circuit. That's the same one we saw last section.

In this case, we'd like to have Peano-like numbers to model recursion.
`SNat` doesn't allow us to *structurally* recurse over it, but
there's a type that does: `UNat`.

Let's have a look at the `case` statement:
```haskell
  = case toUNat (SNat @stages) of
      UZero   -> uncurry (karatsuba k) <$> input -- The call to combinational Karatsuba
      USucc _ -> ... -- Sequential Karatsuba calls
```

`toUNat` makes a `UNat` out of an `SNat`, enabling us to pattern-match
on its constructors. If `stages = 0`, `toUNat (SNat @stages) = toUNat (SNat @0) = UZero`
and we're done with the sequential circuit generation. Otherwise, we can go on and
recursively call `karatsubaSequential` with `stages - 1`.

Combining both implementations, we get full control on how to manage the
time/space tradeoff in our circuit.

This technique is applicable to various problems, potentially pipelining, and
other depth-based algorithms.

The implementations discussed in this article are
available in [clash-crypto](https://github.com/clash-lang/clash-crypto/blob/665422107b13b98a8318e7eea070cd312b88d1d9/src/Clash/Crypto/Calculator/Karatsuba.hs).
