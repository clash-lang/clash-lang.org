---
identifier: home
title: Home
weight: -50
---

**Clash** is a functional hardware description language that borrows both its syntax and semantics from the functional programming language **Haskell**. It provides a familiar structural design approach to both combinational and synchronous sequential circuits. The Clash compiler transforms these high-level descriptions to low-level synthesizable **VHDL**, **Verilog**, or **SystemVerilog**.

Clash is an [open-source](https://github.com/clash-lang/clash-compiler) project, licensed under the permissive [BSD2](https://github.com/clash-lang/clash-compiler/LICENSE) license, and actively maintained by [QBayLogic](https://qbaylogic.com/).

[![Build Status](https://travis-ci.org/clash-lang/clash-compiler.svg?branch=master)](https://travis-ci.org/clash-lang/clash-compiler)
[![Hackage](https://img.shields.io/hackage/v/clash-ghc.svg)](https://hackage.haskell.org/package/clash-ghc)

# Features
<div class="cards250">
    <div class="card">
        <h2>Strongly typed</h2>
        <p>Clash is built on Haskell which provides an excellent foundation for well-typed code. Together with Clash's standard library it is easy to build scalable and reusable hardware designs.</p>
    </div>
    <div class="card">
        <h2>Interactive REPL</h2>
        <p>Load your designs in an interpreter and easily test all your component without needing to setup a test bench.</p>
    </div>
    <div class="card">
        <h2>Low-level access</h2>
        <p>Although Clash offers many features, you sometimes need to directly access VHDL, Verilog, or SystemVerilog directly. Clash allows you to do this with its own templating system.</p>
    </div>
</div>

# Examples
<div class="cards350">
    <div class="card">
        <h2>FIR Filter</h2>
        <p>Clash allows programmers to write function without hardcoded length or element type information, such as this FIR filter:</p>
        <p>
{{< highlight haskell >}}
fir coeffs x = dotp coeffs (window x)
  where
    dotp as bs = sum (zipWith (*) as bs)
{{< / highlight >}}
        </p>
        <p>Clash will figure out the type of this function through its powerful type inference system. To "lock" types in place, we can partially apply `fir`: </p>
        <p>
{{< highlight haskell >}}
-- inferred: Signal dom Int -> Signal dom Int
fir3int = fir (3 :> 4 :> 5 :> Nil)

-- inferred: Signal dom Float -> Signal dom Float
fir4float = fir (3.5 :> 4.2 :> 3.0 :> 6.1 :> Nil)
{{< / highlight >}}
        </p>
    </div>
    <div class="card">
        <h2>Matrix multiplication</h2>
        <p> If you do choose to write types explicitely, you can add additional constraints. Clash will check these constraints and refuse to compile if they are not met. The following example implements a fully parallel matrix multiplication algorithm:
{{< highlight haskell >}}
mmult
  -- Dimension constraints:
  :: na ~ mb
  => 1 <= mb
  
  -- Allow simulation to access mb/nb:
  => KnownNat mb
  => KnownNat nb
  
  -- Arguments:
  => Vec ma (Vec na Int)
  -> Vec mb (Vec nb Int)
  
  -- Result:
  -> Vec ma (Vec nb Int)

mmult mA mB = result
  where
    mBT      = transpose mB
    dot a b  = sum $ zipWith (*) a b
    result   = map (\ar -> dot ar <$> mBT) mA
{{< / highlight >}}
        </p>
    </div>

</div>

# Open-source community
Clash benefits from an active community.
Whether you need a question answered or want to contribute to open-source features, browse the features below to make the most of Clash.

{{% fontawesome list-alt %}} [Mailing list](http://groups.google.com/group/clash-language)</br>
{{% fontawesome ticket-alt %}} [Issue tracker](https://github.com/clash-lang/clash-compiler/issues)</br>
{{% fontawesome slack-hash %}} [freenode#clash-lang](irc://chat.freenode.net/clash-lang)</br>
{{% fontawesome slack-hash %}} [freenode#haskell-embedded](irc://chat.freenode.net/haskell-embedded)

# Support
If you need professional support from the [original developers](https://qbaylogic.com) of Clash, check out the [support plan]({{< ref "support" >}}).

<style>
.post__title{ display:none; }
</style>
