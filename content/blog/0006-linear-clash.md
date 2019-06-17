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

__TL;DR Consuming a function linearly means consuming the function's argument linearly, which in a circuit context means that the output port of a higher-order argument is only driven/written by a single source. This means we need linear arrows to correctly translate non-duplicable functions, e.g. higher-order arguments corresponding to components peripheral to the circuit.__

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

# Synthesis of higher order functions, take 2
So what if we really wanted a higher-order `topEntity`, how could we then proceed?
Now the following concept is exactly described in the Geometry of Synthesis papers, for any argument with a function type:

* The function arguments become output ports,
* and the function result becomes an output port,
* and if any of the arguments are themself higher-order then the "polarity" inside of them will be switched again.

So in:

{{< highlight haskell >}}
f :: (Int32 -> Int32) -> Int32 -> Bool
f h y = (h y) < 10

k :: Int32 -> Int32

topEntity :: Int32 -> Bool
topEntity x = f k x
{{< / highlight >}}

the component for `f` would get: 

* an additional `Int32` input port corresponding to the result of the `h` argument, 
* and an additional `Int32` output port corresponding to the argument of `h`.

Inside the component for `f` we would then:

* connect the input port corresponding to `y` to the output port corresponding to `h`s argument,
* and connect the input port corresponding to `h`s result to the left input of the `<` component.

Inside `topEntity`, we would then:

* Connect the input port of `k` to the output port of `f` that corresponds to the argument of `h`,
* and connect the ouptput port of `k` to the input port of `f` that corresponds to the result of `h`.

_TODO: create a picture making the above more intuiative._

# Consuming functions linearly

Now let's say we change our definition of `f` to:

{{< highlight haskell >}}
f :: (Int32 -> Int32) -> Int32 -> Int -> Bool
f h x y = (h x + h y) < 10
{{< / highlight >}}

i.e. apply the function `h` twice to different arguments.
If we would keep the same translation, then the input port corresponding the the result of `h` would be connected to the input ports of the `+` component.
There are no issues here, a source can drive/write multiple sinks.
The catastropic issue is that the output port corresponding to the argument of `h` is now being driven/written by the input ports corresponding to `x` and `y`: a sink should only be driven/written by a single source!

_TODO: create a picture making the above more intuiative._

# Synchronisation and the case for higher-order top-level functions
You might argue that a first-order top-level function (`topEntity`) is a sensible restriction, after all, it's kind of the "entry point" into your entire circuit (much like `main :: IO ()` in regular Haskell program).
So what use would we have for a higher-order `topEnity`?

One such case is when your circuit is communicating with peripherals that have an explicit synchronisation, whether it be an _acknowledge_, _ready_, or _wait_ signal, and both in case your circuit is producing that synchronisation signal or consuming that synchronistation signal.
In these cases, when you're producing data, then this data is part of the result of your `topEntity`, corresponding to an output port, and the synchronistation channel becomes an argument, corresponding to an input.
When you're consuming data, then this data becomes an argument, corresponding to an output port, and the synchronistation channel becomes part of the result, corresponding to an output port.
Now imagine that your circuit is communicating with four peripherals, with 3 peripherals producing data, and 1 consuming data.
With a first-order restriction on your `topEntity`, the only way to implement this is to have something like:

{{< highlight haskell >}}
topEntity :: Data1 -> Data2 -> Sync3 -> Data4 -> (Sync1, Sync2, Data3, Sync4)
topEntity d1 d2 s3 d4 = (s1, s2, d3, s4)
 where
  ...
{{< / highlight >}}

where the data and synchronisation part of a channel become syntactically seperated, and you'll quickly use the overview of what's going on.
It becomes worse when you get to protocols like AXI4, where you're the consumer of some data, and the producer of some other data.

The interface just becomes so much nicer if you could simply write:

{{< highlight haskell >}}
type DataProducer1 = Sync1 -> Data1
type DataProducer2 = Sync2 -> Data2
type DataConsumer3 = Data3 -> Sync3
type DataProducer4 = Sync4 -> Data4

topEntity :: DataProducer1 -. DataProducer2 -. DataConsumer3 -. DataConsumer4
topEntity c1 c2 p3 = c4
 where
  ...
{{< / highlight >}}

Also note that it's impossible to convert between the two, and so we really need linear types for the above API to work safely.
