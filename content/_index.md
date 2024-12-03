---
identifier: home
title: Home
weight: -50
---

**Clash** is a functional hardware description language that borrows both its syntax and semantics from the functional programming language **Haskell**. It provides a familiar structural design approach to both combinational and synchronous sequential circuits. The Clash compiler transforms these high-level descriptions to low-level synthesizable **VHDL**, **Verilog**, or **SystemVerilog**.

Clash is an [open-source](https://github.com/clash-lang/clash-compiler) project, licensed under the permissive [BSD2](https://raw.githubusercontent.com/clash-lang/clash-compiler/master/LICENSE) license, and actively maintained by [QBayLogic](https://qbaylogic.com/). The Clash project is a [Haskell Foundation](https://haskell.foundation/affiliates/) affiliated project.

<a href="https://gitlab.com/clash-lang/clash-compiler/commits/master"><img referrerpolicy="no-referrer" src="https://gitlab.com/clash-lang/clash-compiler/badges/master/pipeline.svg" alt="GitLab pipeline status badge"></a>
<a href="https://hackage.haskell.org/package/clash-ghc"><img referrerpolicy="no-referrer" src="https://img.shields.io/hackage/v/clash-ghc.svg" alt="Hackage version badge"></a>
<a href="https://github.com/clash-lang/clash-compiler/commits/master"><img referrerpolicy="no-referrer" src="https://img.shields.io/github/commit-activity/m/clash-lang/clash-compiler" alt="GitHub commit activity badge"></a>

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

<h1 id="get-thebook-retrocomputing-with-clash"><a href="https://unsafeperform.io/retroclash/" style="color:black">Get the book: Retrocomputing with Clash</a></h1>
<div class="cards250">
    <div class="card">
        <p style="text-align:center;"><a href="https://unsafeperform.io/retroclash/"><img src="/cover-3d.png" width="220"></a></p>
    </div>
    <div class="card">
    <p>Haskell has become the functional programming language of choice for many developers due to its excellent tools for abstraction and principled program design. The open source Clash hardware description language now brings these features to FPGA development.</p>
    <p><a href="https://unsafeperform.io/retroclash/">Retrocomputing with Clash</a> takes the experienced Haskell programmer on a journey into the world of hardware design with Clash. Our approach is based on using Haskell to its fullest potential, using abstractions like monads and lenses in building a library of reusable components.</p>
    </div>
    <div class="card">
        Implement various retro-computing devices:
        <ul>
            <li>Pocket calculator</li>
            <li>Pong <a href="https://unsafeperform.io/retroclash/retroclash-chapter09-pong.pdf">(sample chapter)</a></li>
            <li>An implementation of the CHIP-8 virtual computer specification</li>
            <li>Intel 8080 CPU</li>
            <li>Space Invaders arcade machine</li>
            <li>Compucolor II, a home computer from 1977 complete with keyboard, color video, and a floppy drive</li>
        </ul>
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
        <p> If you do choose to write types explicitly, you can add additional constraints. Clash will check these constraints and refuse to compile if they are not met. The following example implements a fully parallel matrix multiplication algorithm:
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

{{% fontawesome list-alt %}} [Discourse: long form discussions and questions](https://clash-lang.discourse.group/)</br>
{{% fontawesome slack-hash %}} [Slack: short form discussions and questions](https://functionalprogramming.slack.com/archives/CPGMJFF50) (Invite yourself at [fpslack.com](https://fpslack.com)) </br>
{{% fontawesome ticket-alt %}} [Github: issue tracker](https://github.com/clash-lang/clash-compiler/issues)

# Support
If you need professional support from the [original developers](https://qbaylogic.com) of Clash, check out the [support plan]({{< ref "support" >}}).

<style>
.post__title{ display:none; }
</style>
