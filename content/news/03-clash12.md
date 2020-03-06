---
title: "Clash 1.2 released"
date: "2020-03-05"
description: "A lot of bug fixes"
disable_comments: false
author: "martijnbastiaan"
authorbox: true # Optional, enable authorbox for specific post
toc: false
mathjax: true
---

As promised when releasing 1.0, we've tried our best to keep the API stable. We
think most designs will continue to compile with this new version, although special
care needs to be taken when using:

  * ..inline blackboxes. Instead of taking a single HDL, inline primitives now
    take multiple. For example, `InlinePrimitive VHDL ".."` must now be written
    as `InlinePrimitive [VHDL] ".."`.

  * ..the `Enum` instance for `BitVector`, `Index`, `Signed`, or `Unsigned`, as
    they now respect their `maxBound`. See [#1089](https://github.com/clash-lang/clash-compiler/issues/1089).

On top of that, we've added a number of new features:

  * `makeTopEntity`: Template Haskell function for generating TopEntity annotations. See [the documentation on Haddock](http://hackage.haskell.org/package/clash-prelude-1.2.0/docs/Clash-Annotations-TH.html) for more information.

  * `Clash.Explicit.SimIO`: ((System)Verilog only) I/O actions that can be translated to HDL I/O. See [the documentation on Haddock](http://hackage.haskell.org/package/clash-prelude-1.2.0/docs/Clash-Explicit-SimIO.html) for more information.

  * `Clash.Class.AutoReg`: A smart register that improves the chances of synthesis tools inferring clock-gated registers. See [the documentation on Haddock](http://hackage.haskell.org/package/clash-prelude-1.2.0/docs/Clash-Class-AutoReg.html) for more information.

View all the changes in [the CHANGELOG](https://github.com/clash-lang/clash-compiler/blob/ca0a7fc0f3ab65f465c3514d75e2c9d74a4795ae/CHANGELOG.rst#120). Happy hacking!
