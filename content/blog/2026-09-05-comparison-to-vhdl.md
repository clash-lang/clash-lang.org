---
title: "What makes Clash more powerful than VHDL?"
description: ""
disable_comments: false
author: "martijnbastiaan"
authorbox: true # Optional, enable authorbox for specific post
summary: ""
toc: true
mathjax: false
categories:
  - "Tutorial"
tags:
  - "Design"
---

My colleague at [QBayLogic](https://qbaylogic.com/), Maarten Kuper, recently [posted on LinkedIn](https://www.linkedin.com/feed/update/urn:li:activity:7501164776832774145/) promoting the idea of applying functional programming to hardware design. One of the comments critically asked what Clash offers over VHDL. After all, both are proper languages (not eDSLs), are statically typed, and support custom data types, higher order functions, and generics. And VHDL has been doing this since 1987! Put that way, it checks out. Yet I think Clash -- to put it humbly -- completely blows VHDL out of the water in terms of development and safety features, and we don't do a good job of explaining why. In this post I'll go over a few of my favorites. It almost doesn't need saying, but this post is highly opinionated. If you've got comments, corrections, or want to otherwise duke it out: come find me on [Clash's Discord server](https://discord.gg/rebGq25FB4).

## What is Clash
If you've come to this post there is a good chance you know VHDL, but don't know Clash. Very abstractly, Clash is a hardware description language much like VHDL. More specifically, it is a backend for GHC, the most commonly used compiler for Haskell: a high level general purpose programming language, typically used in settings where safety matters.

{{< inline-svg "Clash_GHC_Pipeline.drawio.svg" "The Clash compiler pipeline. Green stages are Clash specific, all other stages are plain GHC." >}}

Clash hijacks GHC's normal compilation path to produce HDL, so any valid Clash is valid Haskell<sup><a href="#footnote-1-back" id="footnote-1">1</a></sup>. Your designs are checked by Haskell's type checker, can be executed ("simulated") on your CPU like any other Haskell program, and can use any package in Haskell's ecosystem for testing and design alike.

## An example
Let's start on neutral ground: the "hello world" of hardware, an 8-bit counter with a reset and enable line. I've tried my best to be idiomatic in both languages. The VHDL uses VHDL-2008: it reads from `out` ports and uses `std_logic` directly in conditions.

{{< side-by-side >}}
```haskell
import Clash.Prelude

counter ::
  HiddenClockResetEnable dom =>
  Signal dom (Unsigned 8)
counter = q
 where
  q = register 0 (q + 1)
```
<--->
```vhdl
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity counter is
  port (
    clk    : in  std_logic;
    rst    : in  std_logic;
    en     : in  std_logic;
    result : out unsigned(7 downto 0) := (others => '0')
  );
end entity;

architecture rtl of counter is
begin
  process (clk) is
  begin
    if rising_edge(clk) then
      if rst then
        result <= (others => '0');
      elsif en then
        result <= result + 1;
      end if;
    end if;
  end process;
end architecture;
```
{{< /side-by-side >}}

The obvious difference is length. This is a bit unfair: VHDL requires some `library`, `entity`, and `architecture` boilerplate that is a small part of a realistic design. But it also reflects that Clash encourages small and reusable components: we can write the counter this compactly because small functions like `register` are idiomatic to define and use.

The other thing to notice is that components operating on a single clock domain don't route their clock, reset, and enable lines explicitly. `HiddenClockResetEnable` is routed automatically to other components that need it. It *is* still possible to route these wires by hand, through `Clash.Explicit.Prelude`.

## Features
From the example you should have a bit of a feeling for Clash: a terse language that emphasizes reusable components. Let's look at what it offers beyond that.

### Safety: no accidental clock domain crossings
The counter's type mentions `Signal dom (Unsigned 8)`. A signal is the equivalent of a wire, modelled as an infinite stream of values (the [signal abstraction]({{< relref "/blog/2025-02-07-signals" >}})). This one carries 8-bit unsigned values on clock domain `dom`. Combinational logic has no signals at all: an ALU is a plain function from opcode and operands to a result. Signals only show up once state is involved, and then every wire says which clock domain it belongs to. A domain defines many properties (reset synchronicity, whether it supports initial values, clock frequency, etc.), but is referred to by a single name. The big thing is that domains cannot be mixed accidentally. Say we define a multiply accumulate circuit:

```haskell
multiplyAccumulate ::
  HiddenClockResetEnable dom =>
  Signal dom (Unsigned 8) ->
  Signal dom (Unsigned 8) ->
  Signal dom (Unsigned 32)
```

then we cannot feed it signals from different domains:

```haskell
>>> x = pure 3 :: Signal Core (Unsigned 8)
>>> y = pure 5 :: Signal NonCore (Unsigned 8)
>>> z = multiplyAccumulate x y
<interactive>: error: [GHC-83865]
    • Couldn't match type ‘NonCore’ with ‘Core’
      Expected: Signal Core (Unsigned 8)
        Actual: Signal NonCore (Unsigned 8)
    • In the second argument of ‘multiplyAccumulate’, namely ‘y’
```

This simple fact almost completely eliminates accidental clock domain crossings. Escape hatches exist to force Clash to accept an (unsafe) crossing, but like `unsafe` blocks in Rust, these parts of the code stick out like a sore thumb.

### Algebraic data types
Both languages have enumerations and records: `type Color is (Red, Amber, Green)` and `record` in VHDL, `data Color = Red | Amber | Green` and record syntax in Haskell. But Haskell (like other modern languages such as Rust) offers something in between: sum-of-product types. VHDL has no equivalent: a record cannot say "this field only exists when that other field has this value". The canonical example is `Maybe`:

```haskell
data Maybe a = Nothing | Just a
```

A value of type `Maybe (Unsigned 8)` encodes the absence of a value (`Nothing`) or the presence of one (`Just 4`). Because this is known to the compiler, you cannot access the data inside the `Just` without first having matched on it. The VHDL idiom is a `valid` bit next to a `data` field, where `data` is don't-care whenever `valid` is low -- and nothing stops you from reading `data` anyway. Clash completely eliminates this class of bugs: there simply is no data to read unless the "valid" bit is set.

### Type arithmetic
Both languages let you write components that are generic in their widths. VHDL uses generics, Clash uses type variables. Take an adder that keeps its carry:

{{< side-by-side >}}
```haskell
add ::
  KnownNat n =>
  Unsigned n ->
  Unsigned n ->
  Unsigned (n + 1)
add a b = extend a + extend b
```
<--->
```vhdl
library ieee;
use ieee.numeric_std.all;

entity add is
  generic (n : natural);
  port (
    a, b   : in  unsigned(n - 1 downto 0);
    result : out unsigned(n downto 0)
  );
end entity;

architecture rtl of add is
begin
  result <= resize(a, n + 1) + resize(b, n + 1);
end architecture;
```
{{< /side-by-side >}}

Both say "the result is one bit wider than the inputs". The difference is when that claim is checked. In Clash the widths are types and the relation between them is part of the signature, so the body is checked against it when `add` is compiled, whether or not anyone ever instantiates it. In VHDL the widths are expressions over generics that only become concrete during elaboration, and so do the mismatches.

Because sizes are types, the compiler can compute with them. Most of `Vec`'s API is written this way (some constraints elided):

```haskell
(++)     :: Vec n a -> Vec m a -> Vec (n + m) a
concat   :: Vec n (Vec m a) -> Vec (n * m) a
splitAtI :: Vec (m + n) a -> (Vec m a, Vec n a)
```

These relations compose. Wire a handful of such components together and the compiler works out whether the widths line up, without you writing a single length expression yourself.

Where this really pays off is that requirements propagate through your own abstractions. `fold` combines the elements of a vector using a binary function and needs at least one element to work with. Its type says so:

```haskell
fold :: (a -> a -> a) -> Vec (n + 1) a -> a
```

There is no `n` for which `Vec (n + 1) a` is empty. Now suppose you build on it and forget about that requirement:

```haskell
reduce :: Num a => Vec n a -> a
reduce = fold (+)
```

```
Reduce.hs:5:10: error: [GHC-25897]
    • Couldn't match type ‘n’ with ‘n0 + 1’
      Expected: Vec n a -> a
        Actual: Vec (n0 + 1) a -> a
```

You have to write `Vec (n + 1) a` in `reduce`'s signature too, and so on up the stack. Every layer of your design states exactly the requirements it has, and a violation is reported at the layer where it is introduced. In VHDL the equivalent is an assertion in the body of the innermost component, and everything built on top of it only finds out at elaboration -- much like a mistake at the top of a C++ template stack produces an error deep inside a library.

### Higher order functions
Functions (components) taking other functions as arguments ("ports") are commonplace in Clash. This doesn't seem all that useful at first, but what it enables is expressing *structure* separately from computation. Take `fold` again: given a component that takes two inputs, it constructs a binary tree of them. As a diagram:

{{< inline-svg "fold.drawio.svg" "The function `fold` as a diagram, where `f` is the function it takes. Notably, `fold` only encodes the *structure* of the computation, but doesn't say anything about its functionality otherwise." >}}

Clash developers know these functions by heart, making it very easy to see (and swap out) structure in code. VHDL-2008 does let you pass functions around, through generic subprograms. It stops at functions though: you cannot pass an *entity* or a process, so nothing with state can go in, and there are no closures or partial application to build one from. In Clash, `fold (\a b -> register 0 (a + b))` is an adder tree with a register after every adder (for a power-of-two number of inputs; otherwise the tree is unbalanced and its paths have different latencies). It is a one-liner because `register` is just another function, and `fold` doesn't care what kind of function it is handed.

### Package management
The best code is code that you don't write -- and I don't mean this in an LLM sense. Existing code is often better tested than anything you can quickly write yourself. As a part of the Haskell ecosystem, Clash enjoys the effort that went into the build tool [Cabal](https://www.haskell.org/cabal/) and its package index [Hackage](https://hackage.haskell.org/). Any of the 18,000 packages on Hackage are a one-line edit away from being used in your project, for test code and designs alike. Need a hash map in your test code? Add `unordered-containers`. A well-tested RISC-V core? `clash-vexriscv`. And so on.

To be fair, the VHDL world has not stood still. [FuseSoC](https://github.com/olofk/fusesoc) does package management for HDL projects, and [VUnit](https://vunit.github.io/) and [OSVVM](https://osvvm.org/) bring proper test frameworks. Depending on other people's code just isn't part of the VHDL zeitgeist though: the typical VHDL project vendors its dependencies by copying files into the repository, if it depends on anything at all. In Clash, virtually all developers package their code.

This extends to the language itself. Clash-the-compiler needs to know very little about Haskell to do its job, so users extend the language through ordinary libraries and plugins. [`clash-protocols`](https://github.com/clash-lang/clash-protocols) and [`circuit-notation`](https://github.com/cchalmers/circuit-notation) standardize the syntax and definition of bidirectional protocols, [`checked-literals`](https://github.com/clash-lang/checked-literals) guarantees at compile time that literals fit their target types, and [`clash-slice-syntax`](https://github.com/martijnbastiaan/clash-slice-syntax) adds Verilog-like array slicing syntax.

### One language to rule them all
For one of QBayLogic's projects we had to process images from a (very) high speed camera. Many configuration values had to be settable at runtime, and because of their complexity we decided that the execution plan (what to do to which pixels, and when) should be computed offline. The FPGA design became a set of specialized CPUs running in parallel, driven by a small *instruction compiler* running on the host.

The mathematics of the problem weren't hard to grasp. All complexity came from having to do the computation in a streaming fashion within a very tight time budget. So we started with a software model that could [read PNG images](https://hackage.haskell.org/package/hip), run them through the model, and write the results out [as JSON files](https://hackage.haskell.org/package/aeson). We fuzz-tested it with [Hedgehog](https://hedgehog.qa/), compiled it into an executable, and shipped it to the client to try out. Two weeks into a 24 week project we had a client-approved behavioral model that we had a lot of confidence in. It served as the golden model all the way through:

{{< inline-svg "drilling_down.drawio.svg" "Designs can often start out with a software-only model that's much easier to write than a full-fledged FPGA one. Writing such a software-only model buys tremendous value, as long as you can equivalence check this all the way through your design process." >}}

Doing all of this in one language is what made it work. The data types describing the instructions were defined once, in the instruction compiler, and imported by the hardware design, guaranteeing a one-to-one mapping between the two. The random generators written for the software model were reused to test the scheduled model, the FPGA design in simulation, *and* hardware in the loop. The core property was as simple as<sup><a href="#footnote-2-back" id="footnote-2">2</a></sup>:

```haskell
prop_designMatchesModel :: Property
prop_designMatchesModel = property $ do
  program <- forAll genProgram
  pixels  <- forAll (Gen.list (Range.linear 1 64) genPixel)
  catMaybes (simulateN (length pixels) (design program) pixels) === model program pixels
```

When such a property fails, Hedgehog doesn't just report the random input that broke it. It *shrinks* the input first, searching for the smallest program and image that still fail, and shows you exactly where the two sides disagree:

```
✗ prop_designMatchesModel failed after 83 tests and 19 shrinks.

    ┃ program <- forAll genProgram
    ┃ │ [ Shift 7 ]
    ┃ pixels  <- forAll (Gen.list (Range.linear 1 64) genPixel)
    ┃ │ [ 128 ]
    ┃ simulateN (length pixels) (design program) pixels === model program pixels
    ┃ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    ┃ │ ━━━ Failed (- lhs) (+ rhs) ━━━
    ┃ │ - [ 0 ]
    ┃ │ + [ 1 ]
```

A one-instruction program on a single pixel is a lot easier to debug than a 64-pixel image processed by a randomly generated program. Half a year after shipping the final firmware to the client, we have found a grand total of **zero** bugs in it. I strongly believe this is due to the way we approached the project, and that we could only realistically have done this with Clash in this time frame.

In conclusion, I'm pretty excited about Clash. I think it offers a much better way of designing digital circuits than the traditional way of doing things. It's not just the language itself, but also the ecosystem it is sitting in. In its draft, this post had five more features I wanted to show off, but it is already long enough. Maybe I'll start a series highlighting features individually!

## Footnotes
<sup id="footnote-1-back"><a href="#footnote-1">1</a></sup> Clash is more restricted in what it sees as valid "programs" than Haskell. Clash designs need to translate to a static number of wires / memory elements, while Haskell -- as do almost all software programming languages -- assumes an infinite amount of memory.

<sup id="footnote-2-back"><a href="#footnote-2">2</a></sup> This is illustrative. The original source code looks a bit more complicated due to the various generators (static config, dynamic config, etc.).