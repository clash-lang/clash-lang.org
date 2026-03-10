---
title: "Shockwaves: Typed waveforms for Clash"
date: "2026-03-10"
description: ""
disable_comments: false
author: "marijnadriaanse"
authorbox: false # Optional, enable authorbox for specific post
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


## Typed waveforms with Shockwaves

For years, debugging Clash designs in a waveform viewer has been a massive pain.
After all, the waveform viewers we have were not designed with Clash in mind,
and glady present us with unintelligible binary values.
But those times are now over! I've spent the last months working on Shockwaves,
a system that lets you show typed waveforms in [Surfer](https://surfer-project.org/),
and after many, *many* changes, tests, bug fixes and rewrites, we have finally reached
the point of an official release!


## A short introduction to Shockwaves

Clash designs can be simulated to create VCD files, but in doing so, all type information
is lost. The VCD files that get generated simply contain the signal values in binary form.
Shockwaves tells the waveform viewer how these binary values can be displayed as proper
Haskell values again.

The Shockwaves system consists of two parts that work together to reconstruct
this type information inside the waveform viewer:

- The `Clash.Shockwaves` Haskell library, which exports translation information on top of
  the standard VCD file.
- The Shockwaves extension for Surfer, which uses this information
  to translate the values inside the VCD file back into the Haskell representation.

Shockwaves uses a collection of highly configurable translator modules to build up the
best representations of Haskell types. And if no good representation is available, it can
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

data MyColor = Red | Green | Blue Int
  deriving (BitPack,Generic,Typeable,Waveform)
```

The tracing functions are designed to be a drop-in replacement for Clash's `Signal.Trace`.
The most important change is that Shockwaves' `dumpVCD` produces _two_ files: the original
VCD file, as well as a JSON file containing translator information. All you need to do is
store this file under the same base name:

```hs
import qualified Clash.Shockwaves.Trace as T

... T.traceSignal mySignal

... T.dumpVCD ...

(vcd,json) -> do
  writeFile     "waveform.vcd" $ Text.pack vcd
  writeFileJSON "waveform.json" json

```

If you now open `waveform.vcd` in Surfer, the Shockwaves extension will detect the JSON
file and automatically start translating the data!

TODO image


## Adding a splash of color

Surfer is not limited to just showing Haskell values as text; it also has a powerful
style system. As you've already seen above, `undefined` values show up in red,
but there's so much more you can do! Shockwaves supports Surfer's builtin styles,
but also allows you to create colors of your own, and even add style variables that
let you change the colors of values post-simulation via configuration files.

For example, it is very easy to change the colors of your constructors by adding
a slightly customized `Waveform` instance, instead of deriving it:

```hs
instance Waveform MyColor where
  style = [WSWarn, "geen", "#08f"]
```

If we run our code again, we now see that our signals have taken on color!

TODO


And if we add a file called `shockwaves.toml` in the same directory as our VCD
file, containing the following:

```
bool_true = "#afa"
bool_false = "#b88"
```

We can now see that our booleans have changed color:

TODO


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

TODO image of point with modulus? and color?

## Want to try for yourself?

You can find the `clash-shockwaves` repository [here](TODO).
Shockwaves has been documented in a collection of [HOWTO guides](TODO). 
To get started with Shockwaves yourself, have a look at the HOWTO on
[setting up Shockwaves](TODO) and [getting started](TODO).

If you have any feedback, we'd love to hear it!


## Closing words

I've been working on Shockwaves for a long time now, and I'm proud to show what I've
achieved. I hope this will make debugging a lot easier. For future versions, we are
working on improving Clash simulation as a whole, and integrating Shockwaves with
Clash-ILA.
