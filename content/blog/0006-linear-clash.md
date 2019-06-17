---
title: "Clash's case for linear types in Haskell"
date: "2019-06-11"
description: "What it says on the tin"
disable_comments: false
author: "christiaanbaaij"
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

# Synthesis of higher-order functions

Given a function:

{{< highlight haskell >}}
f :: Int32 -> Int32 -> Bool
{{< / highlight >}}

Clash will convert this to a circuit with two 32-bit input ports, corresponding to the two `Int32` arguments, and a 1-bit output port, corresponding to the `Bool` result.
That is, Clash will create a circuit from a function where the function's arguments are transformed to input ports, and the result of the function is mapped to an output port.
And then when a function is called, the circuits corresponding to the applied arguments are connected to the input ports, and the output port is connected to the circuits corresponding to the expressions using the result of the (fully) applied circuit.

In many situations this is a straightforwared prcoess, but what happens when one of the arguments has a function type?

{{< highlight haskell >}}
f :: (Int32 -> Int32) -> Int32 -> Bool
f h y = (h y) < 10

k :: Int32 -> Int32

topEntity :: Int32 -> Bool
topEntity x = f k x
{{< / highlight >}}

How many bits are needed for a port of type `(Int32 -> Int32)`? How would the input port `y` corresponding to hook up to the input port corresponding to `h`? How, inside `g`, do we hook up the input ports of `k` to the input port to the input port `h`?
Clearly this idea of mapping arguments to input ports, and results to output ports, doesn't work when our arguments have a function type. So how does Clash handle this? Well, before converting the expressions to a circuit, uses a process called specialisation to transform the above code to:

{{< highlight haskell >}}
fK :: Int32 -> Bool
fK y = (k y) < 10

k :: Int32 -> Int32

topEntity :: Int32 -> Bool
topEntity x = fK x
{{< / highlight >}}

resulting in a collection of functions where none of them have an argument with a function type; and so the idea of mapping arguments to input ports, and results to output works, will work again.
This specialisation process will always succeed as long as `topEntity` doesn't have any arguments with a function type.
And in the case that `topEntity` does have arguments with a function type, Clash gives up immediately and reports to the user that their code cannot be translated into a circuit. 
