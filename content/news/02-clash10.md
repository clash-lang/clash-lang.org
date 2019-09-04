---
title: "Clash 1.0 released!"
date: "2019-09-04"
description: "10 years after the first public demonstration we finally release Clash 1.0"
disable_comments: false
author: "christiaanbaaij"
authorbox: true # Optional, enable authorbox for specific post
toc: false
mathjax: true
---

It's here! **Clash 1.0** is finally released! And it has a binary release for the very first time!
Check out the [install instructions]({{< ref "/install" >}}) instructions on how to get it!

# 10 years old

First a short retrospective: the very first demonstration of the Clash compiler was given on the 3rd of September 2009 at the Haskell'09 Symposium in Edinburgh: {{< vimeo 6680861 >}}
We were planning the 1.0 release of Clash for some time now, but decided that such a momentous occasion should coincide with the 10 year anniversary of Clash (+1 day due to release engineering mishaps).
We really want to thank all of our contributors for their continued support of Clash.
The [code contributors](https://github.com/clash-lang/clash-compiler/graphs/contributors) that invest their time to create new features and fix bugs, and the [financial contributors](https://github.com/clash-lang/clash-compiler/blob/master/LICENSE) that enable the core Clash developers to work on Clash as their day job.
Much praise for our users as well, who've struggled through our API changes over the years (which should happen much, much, less from now on), who helped us pinpoint many bugs and thus making Clash a more stable piece of software.

Thanks everyone!

# New features

*Clash 1.0* has some cool new features over 0.99 such as:

* 10x - 50x faster compile times
* All memory elements now have an (implicit) enable line; "Gated" clocks have
  been removed as the clock wasn't actually gated, but implemented as an
  enable line.

  * Check the [migration guide](http://hackage.haskell.org/package/clash-prelude-1.0.0/docs/Clash-Tutorial.html#g:21)
  on how to move to the new API.
* Circuit domains are now configurable in:
  * (old) The clock period
  * (new) Clock edge on which memory elements latch their inputs
    (rising edge or falling edge)
  * (new) Whether the reset port of a memory element is level sensitive
    (asynchronous reset) or edge sensitive (synchronous reset)
  * (new) Whether the reset port of a memory element is active-high or
    active-low (negated reset)
  * (new) Whether memory element power on in a configurable/defined state
    (common on FPGAs) or in an undefined state (ASICs)

  * See the [blog post](https://clash-lang.org/blog/0005-synthesis-domain/) on this new feature
* Data types can now be given custom bit-representations: http://hackage.haskell.org/package/clash-prelude/docs/Clash-Annotations-BitRepresentation.html
* Annotate expressions with attributes that persist in the generated HDL,
  e.g. synthesis directives: http://hackage.haskell.org/package/clash-prelude/docs/Clash-Annotations-SynthesisAttributes.html
* Control (System)Verilog module instance, and VHDL entity instantiation names
  in generated code: http://hackage.haskell.org/package/clash-prelude/docs/Clash-Magic.html
* Much improved infrastructure for handling of unknown values: defined spine,
  but unknown leafs: http://hackage.haskell.org/package/clash-prelude/docs/Clash-XException.html#t:NFDataX
* Experimental: Multiple hidden clocks. Can be enabled by compiling
  `clash-prelude` with `-fmultiple-hidden`
* Experimental: Limited GADT support (pattern matching on vectors, or custom
  GADTs as longs as their usage can be statically removed; no support of
  recursive GADTs)
* Experimental: Use regular Haskell functions to generate HDL black boxes for
  primitives (in an addition to existing string templates for HDL black boxes)
  See for example: http://hackage.haskell.org/package/clash-lib/docs/Clash-Primitives-Intel-ClockGen.html
* We also fixed a lot of bugs: http://hackage.haskell.org/package/clash-prelude-1.0.0/changelog

# The future

With the release of version 1.0 we strive to keep our API stable, trying to make sure that "old" code will keep on working with new versions.
Long-time users will know that we changed the API for (implicit) clock lines from 0.7 to 0.99, and will now have to update their code again if they want to upgrade to 1.0 and beyond.
Basically, API design is hard; and we think we have it right this time.
From now on, we will strive very hard to handle changes like the above through better documentation for new users, educating them to use the improved API, and keeping the old API around with deprecation warnings.

This is the reason that multiple implicit clocks is still an experimental feature not enabled by default in the stable version (note that multiple explicit clocks have been a stock feature of Clash since version 0.5): there are some cases where both type inference and constraint pretty printing fall short of what we consider a user friendly API.

With a stable API, we can now also focus on improved documentation and other educational material, knowing that any new user can pick up the material even as it hasn't been updated yet to the latest version of the Clash API.

Finally, we'll of course be adding many more helpful features to Clash, fix bugs, make the compiler faster, etc. and generally try to make Clash the best and most rewarding circuit design experience out there!

Thanks for reading, and have fun creating your circuits in Clash!
