---
title: "Shockwaves: Typed waveforms for Clash"
date: "2026-04-18"
description: ""
disable_comments: false
author: "marijnadriaanse"
authorbox: true # Optional, enable authorbox for specific post
summary: "For years, debugging Clash designs in a waveform viewer has been a massive pain. After all, the waveform viewers we have were not designed with Clash in mind, and glady present us with unintelligible binary values. But those times are now over! I've spent the last months working on Shockwaves, a system that lets you show typed waveforms in (Surfer)[https://surfer-project.org/], and after many, *many* changes, tests, bug fixes and rewrites, we have finally reached the point of an official release!"
toc: true
mathjax: false
# categories:
#   - "Tutorial"
tags:
  - "Shockwaves"
  - "Debugging"
  - "Waveform viewer"
---

<center><img style="min-width:25%" src="shockwaves_logo.svg"></img></center>

## Typed waveforms with Shockwaves

For years, debugging Clash designs in a waveform viewer has been a massive pain.
After all, the waveform viewers we have were not designed with Clash in mind,
and glady present us with unintelligible binary values.
But those times are now over! I've spent the last months working on Shockwaves,
a system that lets you show typed waveforms in [Surfer](https://surfer-project.org/),
and after many, *many* changes, tests, bug fixes and rewrites, we have finally reached
the point of an official release!


## What do we even want to show?

Haskell, and thus Clash, heavily relies on the notion of _algebraic data types_.
These consist of sum and product types.

In Haskell terms, these are the equivalents of a data type having multiple constructors,
and those constructors having fields respectively.

For example, a tuple is probably the most basic form of a product type.
`(Bool,Int)` is a type for which each value contrains _both_ a `Bool` and an `Int` value.
`Bool` itself is a sum type: it has the two constructors `True` and `False`,
and a value is _either_ `True` _or_ `False`.
If we look at `Maybe a` (rustaceans will know this as `Option<a>`),
it is both: `Maybe` is _either_ `Nothing`, or `Just`, and `Just` contains a
field of type `a`.

In the waveform viewer, we want to be able to take our algebraic values and translate them to their textual
Haskell representation, but we also want to _deconstruct_ these values into their
parts recursively, so we can add them as subsignals.

For example, if we have a type `data Point = Point{x::Int, y::Int}`, we'd like
the signal for our `Point` type to have subsignals for the `x` and `y` values.
Similarly, if we have a type that has multiple constructors, we want subsignals
for each, so we can look at their values.


## A short introduction to Shockwaves

Clash designs can be simulated to create VCD files, but in doing so, all type information
is lost. The VCD files that get generated simply contain the signal values in binary form.
Shockwaves tells the waveform viewer how these binary values can be displayed as proper
Haskell values again.

The Shockwaves system consists of two parts that work together to reconstruct
this type information inside the waveform viewer:

- The `Clash.Shockwaves` Haskell library, which exports translation information in addition to
  the standard VCD file.
- The Shockwaves extension for Surfer, which uses this information
  to translate the values inside the VCD file back into the Haskell representation.

Shockwaves uses a collection of highly configurable translator modules to build up the
best representations of Haskell types. And, if no good representation is available, it can
also just store the translations in lookup tables! Add some flexible styles and
configuration options, and you've got yourself a very powerful debugging tool.

## Using Shockwaves

Using Shockwaves is quite simple. When the Surfer extension is installed, all you need to
do is give your types an instance of the `Waveform` class, which defines how the type
should be translated, and then simulating your design using Shockwaves' `Trace` library.

Adding `Waveform` instances is easy - they can just be derived!

```hs
import Clash.Prelude
import GHC.Generics
import Data.Typeable
import Clash.Shockwaves

data MyColor = Red | Green | Blue
  deriving (BitPack,Generic,Typeable,NFDataX,Waveform)
```

The tracing functions are designed to be a drop-in replacement for Clash's `Signal.Trace`.
The most important change is that Shockwaves' `dumpVCD` produces _two_ files: the original
VCD file, as well as a JSON file containing translator information. All you need to do is
store this file under the same base name:

```hs
import qualified Clash.Shockwaves.Trace as T

main :: IO ()
main = do
  let signal = T.traceSignal @System "color"
        $ fromList $ L.cycle [undefined, Red, Green, Blue]
  vcd <- T.dumpVCD (0, 100) signal ["color"]
  case vcd of
    Left msg ->
      error msg
    Right (vcd, meta) -> do
      writeFile     "waveform.vcd"  $ Text.unpack vcd
      writeFileJSON "waveform.json" meta
```

If you now open `waveform.vcd` in Surfer, the Shockwaves extension will detect the JSON
file and automatically start translating the data! The result should look like this:

<center><img style="min-width:25%" src="rgb_simple.png"></img></center>

## Adding a splash of color

Surfer is not limited to just showing Haskell values as text; it also has a handy
style system. As you've already seen above, `undefined` values show up in red,
but there's so much more you can do! Shockwaves supports Surfer's builtin styles,
but also allows you to create colors of your own, and even add style variables that
let you change the colors of values post-simulation via configuration files.

For example, it is very easy to change the colors of your constructors by adding
a slightly customized `Waveform` instance, instead of deriving it:

```hs
instance Waveform MyColor where
  styles = [WSWarn, "green", "#08f"]
```

If we run our code again, we now see that our signals have taken on color!


<center><img style="min-width:25%" src="rgb_color.png"></img></center>


Let's have a quick look at the style variables too! Let's change our styles like this:

```hs
instance Waveform MyColor where
  styles = ["$red", "$green", "$blue"]
```

If we run our simulation again, the colors have disappeared, and Surfer is reporting a
bunch of warnings about style variables not being found.

But now we add a file called `shockwaves.toml` in the same directory as our VCD
file, containing the following:

```toml
[style]
red = "#f33"
green = "#3f3"
blue = "#08f"
```

If we then reload Surfer (press `r`), we can suddenly see our colors show up!
We can also use these style variiables to, for example, give `True` and `False`
different styles.

<center><img style="min-width:25%" src="rgb_vars.png"></img></center>

## Going beyond the basics

Shockwaves was designed to be highly configurable and modular.
For each Haskell type, it defines a `Translator` that determines how the binary
value of a signal is turned into a waveform viewer translation -
a textual representation, style, and any number of (nested) translations of subsignals.
In a way, they represent a combination of `unpack` and `show`, applied recursively.

The translators are fairly granular and have almost no hardcoded limitations on
how values are displayed.
Most translators are composed of other translators.
This lets you represent your type in virtually any form you
want though custom `Waveform` instances.

And if the standard modules do not work for you, there's always
the option to switch to using lookup tables. While these are a little less performant,
they give you absolutely full control from within Haskell! You can do things like:

- creating colors on the fly
- adding debug signals that are computed from the original values
  (for example, you could display the modulus of a geometric vector type)
- show your custom floating point numbers
- and much, much more!

And on top of all that, the Surfer extension has extensive configuration options that
let you:

- override number formatting styles
- create style configurations and themes
- override default styles of some builtin types like `Either` and `Maybe`
- turn on and off error propagation
- and set all these globally or locally!

<center><img style="min-width:25%" src="luts.png"></img></center>

## Want to try for yourself?

You can find the `clash-shockwaves` repository [here](https://github.com/clash-lang/clash-shockwaves).
Shockwaves has been documented in a collection of [HOWTO guides](https://github.com/clash-lang/clash-shockwaves/tree/main/docs/howto). 
To get started with Shockwaves yourself, have a look at the HOWTOs on
[setting up Shockwaves](https://github.com/clash-lang/clash-shockwaves/blob/main/docs/howto/SETUP.md)
and [getting started](https://github.com/clash-lang/clash-shockwaves/blob/main/docs/howto/START.md).

If you have any feedback, we'd love to hear it!


## Closing words

I've been working on Shockwaves for a long time now, and I'm proud to finally show what I've
created. I hope this will make debugging a lot easier. For future versions, we are
working on improving Clash simulation as a whole, and integrating Shockwaves with
Clash-ILA.
