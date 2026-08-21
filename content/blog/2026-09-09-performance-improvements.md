---
title: Clash 1.12 will be 10 times faster
description: "This blogpost covers what performance optimizations "
disable_comments: false
author: "martijnbastiaan"
authorbox: true # Optional, enable authorbox for specific post
summary: "We've been hard at work to make Clash a lot faster in the upcoming release. Though it depends on your design, you can expect Clash to translate your design to HDL anywhere from 2 to 10 times faster. Let's have a look at a few optimizations we did, what we expect to do in the future, and how a large chunk of this work was automated."
toc: true
mathjax: false
categories:
  - "News"
tags:
  - "Clash internals"
---

We've been hard at work to make Clash a lot faster in the upcoming release. Though it depends on your design, you can expect Clash to translate your design to HDL anywhere from 2 to 10 times faster. In this post I pick out a few optimizations I think are ~~interesting~~ a great excuse to talk about Clash internals. Most of these changes have already made it into `v1.10.2`, so you can enjoy it now!

{{< inline-svg "clash-bench-wire-demo-oele-1-10-2026-09-08.svg" >}}

<!-- This is how we do markup, right? -->
<br/>
<br/>

<!-- ## Bla bla
Haskell Core, also called _unfoldings_ in the context of Haskell Interface files, is important to Clash too. It serves as the input to the compiler, which is coincidentally why [all starter projects set `-fexpose-all-unfoldings`](https://github.com/clash-lang/clash-starters/blob/e59a2529f10ec09c2c7f2a9735966b3926bc6cf0/simple/simple.cabal#L56-L57). When given to the Clash compiler, these definitions aren't executable code at all: more often than not, it is polymorphic and full of constructs that cannot be natively expressed in languages like VHDL or Verilog. As a concrete example, take:


```haskell
applyTwice :: (a -> a) -> a -> a
applyTwice False f a = a
applyTwice True  f a = f (f a)

topEntity :: Unsigned 8 -> Unsigned 8
topEntity i = applyTwiceIf True (+1) i
```

Higher-order functions and polymorphism like this isn't supported in Clash's target languages. If you're used to Haskell/Clash syntax, you most likely recognize that this simplifies down to:

```haskell
topEntity :: Unsigned 8 -> Unsigned 8
topEntity i = i + 2
```

This is much more like something we can readily represent in any other HDL. Though you've probably arrived at this conclusion in a somewhat fuzzy way, Clash has to do it by hard rules. It detects the higher order function, inlines the definition of `applyTwice` into `topEntity`'s RHS, resolved its polymorphism, optimized away the conditional, and simplified `+1+1` to `+2`. Within the compiler, we call this process "normalization". After doing all the work, the Core should <small><sup>mostly</sup></small> be void of higher order functions, polymorphism, and GADTs.

Normalization in its current form is implemented as a [series of repeated transformations](https://github.com/clash-lang/clash-compiler/blob/aa6cab33f1bc1da3c1fb62f3694e8ccb3d5f26de/clash-lib/src/Clash/Normalize/Strategy.hs#L33-L63) on the input Core. The idea is that transformations are applied until none apply any more (a fixed point). This was originally described in [Baaij, C.P.R. (2015); Digital Circuits in CλaSH](https://research.utwente.nl/files/6033334/thesis_C_Baaij.pdf). Over the years, this has grown a lot more complex than the thesis originally described, mostly due to an annoying thing called the "real world". Synthesis tooling didn't accept anything other than literals for register reset values, users wanted prettier HDL, industry wanted more features, and so forth. At the same time, users started writing bigger designs and many more abstractions, making compile times slow down to a crawl.

If we skip over a bunch of details, Clash normalization consists of a few things:

1. A rewrite system. Tooling to write down in which order to execute transformations (`a` after `b`, or `b` but only if `a` doesn't apply) and in what overarching traversal (e.g., `topDown`, `bottomUp`).
2. Many, many small transformations. For example, application propagation, i.e., rewriting `(\x -> x + 1) a` to `a + 1`.
3.  An evaluator. This is a small-step evaluator based on [Jones, S.P. (2010); Supercompilation by evaluation](https://dl.acm.org/doi/10.1145/1863523.1863540). It is used to evaluate arbitrary expressions to [WHNF](https://wiki.haskell.org/index.php?title=Weak_head_normal_form), in order to optimize out `case` expressions.
4. A _primitive_ evaluator. Some expressions do not have Core unfoldings. This currently applies to everything in `base`, but more fundamentally, this applies to everything in `ghc-prim`. That is, addition on `Int` is hardwired to assembly instructions in GHC. If Clash encounters these primitives, it will insert a hardcoded bit of HDL. Still, sometimes we want to just execute it on two constants, which is what the primitive evaluator is for.

With that out of the way, we should have a good enough understanding to dive into a few optimizations. -->

## Optimizations
### Implement specialized `topdownFixR` that avoid redundant root restarts
TBA

### Execute transformations based on node constructor
TBA

### Add concurrent normalization
TBA

### Evaluator: peel literal `unconcatBitVector#` without residual `split#` calls
TBA -- maybe drop, not that interesting?

### Use `HashMap` for name lookups in `clash-ghc`'s evaluator
TBA -- maybe drop, not that interesting?

## Instrumentation and LLMs
TBA

## Looking ahead: another order of magnitude?