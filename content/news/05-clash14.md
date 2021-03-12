---
title: "Clash 1.4 released"
date: "2021-03-12"
description: ""
disable_comments: false
author: "martijnbastiaan"
authorbox: true # Optional, enable authorbox for specific post
summary: We've just released Clash 1.4 to the world. We've summarized the most important changes in this blogpost.
toc: false
mathjax: false
---

Hi everyone!

Although this release includes many small bug fixes and a few API changes, it mostly consists of internal changes to Clash. [As promised when releasing v1.2.2](https://clash-lang.org/news/04-clash122/) we've put a lot of effort in laying the groundwork for a partial evaluator. We believe this would make Clash an order of magnitude faster as well as more reliable when released. We've also refactored the way Clash generates unique identifiers which works around a number of issues with EDA tools our users have observed. Sadly, we haven't been able to make progress with Shake rules for Clash, promised in the same blog post.

Apart from changes to Clash itself, we've continued to build the ecosystem itself:

* [Clash starters](https://github.com/clash-lang/clash-starters) is now hosted in its own repository. It now has built-in support for Stack, allowing users to start a new project with a single command.
* [Clash protocols](https://github.com/clash-lang/clash-protocols) is an experimental project making it easier to write Clash circuits with bidirectional communication.

As said, most changes in this release have been internal to Clash - setting the stage for a faster and even more reliable Clash. Still, we expect a number of issues to impact users upgrading to 1.4:

  * Clash no longer disables the monomorphism restriction. See [#1270](https://github.com/clash-lang/clash-compiler/issues/1270), and mentioned issues, as to why. This can cause, among other things, certain eta-reduced descriptions of sequential circuits to no longer type-check. See [#1349](https://github.com/clash-lang/clash-compiler/pull/1349) for code hints on what kind of changes to make to your own code in case it no longer type-checks due to this change.
  * Type arguments of `Clash.Sized.Vector.fold` swapped: before `forall a n . (a -> a -> a) -> Vec (n+1) a -> a`, after `forall n a . (a -> a -> a) -> Vec (n+1) a`. This makes it easier to use `fold` in a `1 <= n` context so you can "simply" do `fold @(n-1)`
  * `Fixed` now obeys the laws for `Enum` as set out in the Haskell Report, and it is now consistent with the documentation for the `Enum` class on Hackage. As `Fixed` is also `Bounded`, the rule in the Report that `succ maxBound` and `pred minBound` should result in a runtime error is interpreted as meaning that `succ` and `pred` result in a runtime error whenever the result cannot be represented, not merely for `minBound` and `maxBound` alone.
 * To ease integration with external tools, Clash will now create a separate directory for each top entity under their fully qualified name. For example, a single module `A` containing two top entities `foo` and `bar` will produce an HDL folder with two folders in it: `A.foo` and `A.bar`. Fully qualified names are not influenced by top entity annotations; instead, the Haskell name of the function is used. Files within their respective directories will be affected by names set in annotations.

Thanks to all our contributors, issue reporters, and mailing list users - you make this possible.

View all the changes in [the CHANGELOG](https://github.com/clash-lang/clash-compiler/blob/1.4/CHANGELOG.md#140-march-12th-2020).
