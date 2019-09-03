---
title: "Undefined values, how do they work?"
date: "2019-06-10"
description: "What it says on the tin"
disable_comments: false
author: "martijnbastiaan"
authorbox: true # Optional, enable authorbox for specific post
summary: Clash uses Haskell's _bottom_ to represent undefined values. Traditionally, _bottoms_ are used to represent exceptional situations which, if evaluated and not explicitly handled, should halt program execution. Due to the nature of circuits, Clash programs have to deal with these situations much more often (and more explicitly) than normal Haskell programs. In this blogpost we'll go over the common pitfalls of undefined values, and what tooling is available to deal with them.
toc: false
mathjax: false
---

**Note**: This blogpost was written with the upcoming _Clash 1.0_ in mind. Many of the features discussed here are not available in _Clash 0.99_!

--------

Clash uses Haskell's _bottom_ to represent undefined values. Traditionally, _bottoms_ are used to represent exceptional situations
which, if evaluated and not explicitly handled, should halt program execution. Due to the nature of circuits, Clash programs have to deal with these situations much more often (and more explicitly) than normal Haskell programs. In this blogpost we'll go over the common pitfalls
 of undefined values, and what tooling is available to deal with them.

# Two of a kind

Generally, Clash distinguishes two types of (useful) _bottoms_:

1. _Programmer errors_. Triggered using `throw` or `error`.
2. _Undefined values_. Triggered using `errorX` or `deepErrorX`.

**The first** is what Haskell programmers will be familiar with. It represents a case that was triggered due to violated invariants. For example, `head` requires its argument to be list with at least one element. Similarly, `quot` requires its second argument to be non-zero. When used on an empty list or zero, you'll get an exception:

```
>>> head []
*** Exception: Prelude.head: empty list
>>> quot 3 0
*** Exception: divide by zero
```

We still consider these programmer errors in Clash. If the Clash synthesizer encounters such a value it will still render `X`s in the target HDL, but Clash simulation will stop if it evaluates one and it has no tools to keep running anyway.

**The second** is a kind of bottom more prevalent in hardware design: an undefined value. Not all signals will carry useful or defined values at all time. The most common situation is a pair of signals, one carrying a `valid` bit and the other the actual `data`. Whenever the valid bit is deasserted, the data lines do not carry useful values.

We'd still like to be able to sample/print these undefined values of the second kind. Luckily, we can. Consider the following circuit:

{{< highlight haskell >}}
split :: Maybe a -> (Bool, a)
split a =
  ( isJust a
  , fromMaybe (errorX "split: Nothing") )

splitS :: Signal tag (Maybe a) -> Signal tag (Bool, a)
splitS = fmap split
{{< / highlight >}}

where `splitS` is the same as `split` but "lifted" into being defined over `Signal`s.

```
> let dat = [Just 3, Just 5, Nothing, Nothing, Just 7]
> printX $ P.take 5 $ simulate @System splitS dat
[(True,3),(True,5),(False,X),(False,X),(True,7)]
```


`printX` will make sure any undefined value is expressed with an `X` and simulation carries on. Consider a variant of `splitS` where `errorX` is replaced with a call to `error`: `splitSWithError`. With this variant sample would stop simulating upon encountering the undefined value:


```
> printX $ P.take 5 $ simulate @System splitSWithError dat
[(True,3),(True,5)*** Exception: split: Nothing
```


# Using partially undefined values
Depending on your background, you might be surprised to learn that the following circuit won't produce any useful values, even after shifting in values for more than five cycles:

{{< highlight haskell >}}
-- | Shift given values into a vector of length 5 from the right,
-- while continuously yielding the leftmost element.
shiftIn
  :: SystemClockResetEnable
  => Signal System Int
  -> Signal System Int
shiftIn a = head <$> vec
 where
  vecInit = errorX "Initial vector undefined" :: Vec 5 Int
  vec     = register vecInit (liftA2 (<<+) vec a)
{{< / highlight >}}

See:

```
printX $ simulate shiftIn [20,30,40,50,60,70,80,90]
[X,X,X,X,X,X,X,X,X,X,..
```

However, replacing the definition of `vecInit` with:

{{< highlight haskell >}}
vecInit = repeat (errorX "Initial vector undefined") :: Vec 5 Int
{{< / highlight >}}

does yield results:

```
printX $ simulate shiftIn [20,30,40,50,60,70,80,90]
[X,X,X,X,X,20,30,40,50,60,..
```

This is because in order for `<<+` to work, it needs the _spine_ or _structure_ of the vector, even though it doesn't use the values of the elements themselves. Using bombs as an abbreviation for undefined values, we need `💣 :> 💣 :> 💣 :> 💣 :> 💣 :> Nil` instead of simply `💣`! This is not only true for `<<+`, but for `map`, `fold`, and many more.

What if we're not using `Int`, but again a `Vec`? We'd need to apply repeat twice:

{{< highlight haskell >}}
shiftInVec
  :: SystemClockResetEnable
  => Signal System (Vec 5 Int)
  -> Signal System (Vec 5 Int)
shiftInVec a = head <$> vec
 where
  vecInit = repeat (repeat (errorX "Initial vector undefined")) :: Vec 5 (Vec 5 Int)
  vec     = register vecInit (liftA2 (<<+) vec a)
{{< / highlight >}}

What if we're not using `Vec 5 Int`, but `a`? This is where the class `NFDataX` comes in.


{{< highlight haskell >}}
shiftInA
  :: forall a
   . ( SystemClockResetEnable
     , NFDataX a )
  => Signal System a
  -> Signal System a
shiftInA a = head <$> vec
 where
  vecInit = deepErrorX "Initial vector undefined" :: Vec 5 a
  vec     = register vecInit (liftA2 (<<+) vec a)
{{< / highlight >}}

`deepErrorX` will recursively define the spine of whatever type has an instance for `NFDataX`.

A similar problem exists when evaluating data structures to [Normal Form](https://medium.com/@aleksandrasays/brief-normal-forms-explanation-with-haskell-cd5dfa94a157). For memory/performance reasons you sometimes want to deeply evaluate a structure. We'd like:

```
rnf (e1 :> e2 :> 💣 :> e3 :> Nil) = ()
```

with `e1`, `e2`, and `e3` fully evaluated. Instead, only `e1` and `e2` will get evaluated to normal form, and the equation turns out to be:

```
rnf (e1 :> e2 :> 💣 :> e3 :> Nil) = 💣
```

Again, `NFDataX` to the rescue. It defined `rnfX`, which does behave as we'd like:

```
rnfX (e1 :> e2 :> 💣 :> e3 :> Nil) = ()
```

Clash also exports the `forceX` and `deepseqX`, the `NFDataX` versions of [`force`](http://hackage.haskell.org/package/deepseq-1.4.4.0/docs/Control-DeepSeq.html#v:force) and [`deepseq`](http://hackage.haskell.org/package/deepseq-1.4.4.0/docs/Control-DeepSeq.html#v:deepseq)

That's all for now. Thanks for reading!
