---
title: "Clash's case for linear types in Haskell"
date: "2019-06-11"
description: "What it says on the tin"
disable_comments: false
author: "martijnbastiaan"
authorbox: true # Optional, enable authorbox for specific post
summary: Linear types are hopefully to hit GHC imminent, here we present Clash's use case for them. 
toc: false
mathjax: false
---

I'm writing this post on the train on my way back from an amazing ZuriHac 2019, where I got to meet a lot of new people, many of them really excited about Clash!
I also got to talk with some about the linear types feature that will hopefully hit GHC HEAD very soon.
There were some thoughts floating around in my head on how to use linear types (not "original" thoughts, but I'll get to that later) for Clash, but wasn't really sure how the linear arrows approach would actually fit.
But thanks to the helpful explanations of Araud, Csongor, Krzysztof, and Simon, I finally understand how linear arrows work, and _why_ they would work for Clash!
Getting back to the 'not original thoughts', it was actually the work of [Dan Ghica](http://www.cs.bham.ac.uk/~drg/papers.html) on "Geometry of Synthesis (GoS)" that introduced me to the idea of how linear types (GoS actually uses affine types) and hardware fit together, and so many of the concepts in this blog post can be found in the GoS papers ([1](http://www.cs.bham.ac.uk/~drg/papers/popl07x.pdf), [2](http://www.cs.bham.ac.uk/~drg/papers/mfps10.pdf), [3](http://www.cs.bham.ac.uk/~drg/papers/popl11.pdf), [4](http://www.cs.bham.ac.uk/~drg/papers/icfp11.pdf), [5](http://www.cs.bham.ac.uk/~drg/papers/lics09tut.pdf), [6](http://www.cs.bham.ac.uk/~drg/papers/memocode11.pdf)) in one shape or form.

