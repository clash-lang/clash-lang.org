---
title: "New feature: configurable initial values"
date: "2019-06-11"
description: "A new way to represent signal domains allows us to track whether registers have initial values"
disable_comments: false
author: "martijnbastiaan"
authorbox: true # Optional, enable authorbox for specific post
summary: Clash will soon be updated to include the ability to choose whether registers have initial values. In order to do this, we introduce the concept of a _synthesis domain_. In this blogpost we'll go over the reasons why we need initial values, and how to use them.
toc: true
mathjax: false
---

**TL;DR**: [PR #527](https://github.com/clash-lang/clash-compiler/pull/527) will soon be merged. Signal's `Domain` will now be a simple tag (type level string), uniquely referring to a datatype `DomainConfiguration` that holds the properties of the synthesis domain. Properties include the clock period, reset synchronisity, whether registers have initial values, and more. `GatedClock` is no more, but `Enable` now exists. `Clock` is now a singleton value. `Reset` simply carries a signal of `Bool`s.

# Initial values: why do we need them?
To properly simulate what happens in synthesized circuits, the development version of Clash has been simulating what happens _before_ a clock starts running. For a while, Clash implemented the following behavior:

```
$ clashi
>>> let counter = register 0 (counter + 1)
>>> printX (sampleN 5 counter)
[X,0,1,2,3]
```

The first value, `X`, signifies an _undefined_ value with similar meaning to its Verilog, SystemVerilog, and VHDL counterpart. Whenever you have to deal with undefined values, you have to be careful not to evaluate them during simulation at the risk of stopping the simulation entirely. This change in Clash meant that circuits previously not having to deal with undefined values, suddenly had to. This was especially annoying for users that used strict data structures in order to increase simulation performance - for no good reason their simulations wouldn't run anymore.

Undefined initial values had never been intended to stay around for long though, as almost all mainstream FPGAs support defined register initial values. With [PR #498](https://github.com/clash-lang/clash-compiler/pull/498) merged, Clash would now assume the reset value as initial value too:

```
$ clashi
>>> let counter = register 0 (counter + 1)
>>> printX (sampleN 5 counter)
[0,0,1,2,3]
```

Great! Case closed?

No, not really. While this strategy covers a good chunk of use cases, it doesn't account for them all. For example, reconfigurable regions of many FPGAs do _not_ support defined initial values, and neither do ASICs. What we actually need is the ability to configure whether a specific circuit has defined or undefined initial values.

# Synthesis domains
After a few design iterations (see [PR #527](https://github.com/clash-lang/clash-compiler/pull/527) for a technical discussion), we settled on the introduction of _synthesis domains_. Because any feasible design would break backwards compatibility in a serious way anyway, we decided to solve some long-standing annoyances of ours simultaneously. Let's look at an example and go over it line by line:

{{< highlight haskell >}}
register
  :: ( KnownDomain dom
     , NFDataX a )
  => Clock dom
  -> Reset dom
  -> Enable dom
  -> a
  -> Signal dom a
  -> Signal dom a
register clk rst gen initial i = ..
{{< / highlight >}}

First off:

{{< highlight haskell >}}
  :: ( KnownDomain dom
{{< / highlight >}}

^ This is the core of the change: functions that need to know anything about the synthesis domain need a `KnownDomain` constraint. The `dom` part of that construct is a type level string, or `dom :: Symbol`, and represents the name of the domain. A name uniquely refers to a set of domain configuration options. We'll later see how to actually use this constraint, and what properties it carries.

{{< highlight haskell >}}
     , NFDataX a )
{{< / highlight >}}

^ For users of the development version of Clash this should be familiar. It's a constraint that considerably improves dealing with undefined values. For more information, see the blogpost [Undefined values: how do they work?](/blog/0004-undefined-values/).

{{< highlight haskell >}}
  => Clock dom
  -> Reset dom
  -> Enable dom
{{< / highlight >}}

^ Both `Clock` and `Reset` have been simplified. `Clock` used to carry and extra type argument, indicating whether it was a gated clock or not. Because gated clocks don't really exist on FPGAs, we decided to remove this altoghether. Instead, what we _actually_ implemented was some sort of "enabled" clock: a simple wire indicating whether a component is active or not. This has been moved to a separate argument `Enable`. `Reset` used to carry an extra type argument too, indicating whether it was a _synchronous_ or _asynchronous_ reset. This is now part of the synthesis domain. For all arguments, `dom` indicates what domain they belong to.

Finally, not much has changed for `Signal`. `dom` is of kind `Symbol` (a type level string), pointing to the domain carried by the `KnownDomain` constraint. The obvious next question is, what does a domain configuration actually look like?


{{< highlight haskell >}}
data DomainConfiguration
  = DomainConfiguration
  { _dom :: Domain
  -- ^ Domain name
  , _period :: Nat
  -- ^ Period of clock in /ps/
  , _edge :: ActiveEdge
  -- ^ Active edge of the clock (not yet implemented)
  , _reset :: ResetKind
  -- ^ Whether resets are synchronous (edge-sensitive) or
  -- ^ asynchronous (level-sensitive)
  , _init :: InitBehavior
  -- ^ Whether the initial (or "power up") value of memory elements is
  -- unknown/undefined, or configurable to a specific value
  , _polarity :: ResetPolarity
  -- ^ Whether resets are active high or active low
  }
{{< / highlight >}}

Quite a few options!

## How to use: synthesis domains
Because it's quite a tedious task to actually write instances for `KnownDomain` due to its use of GADTs and promoted data kinds, we've written a convenience Template Haskell function called `createDomain`. It takes a `VDomainConfiguration`: it's similar to `DomainConfiguration`, but with `Domain` and `Nat` replaced with `String` and `Integer` respectively, such that it can be represented on Haskell runtime. To create a synthesis domain based on the `System` domain, but with _synchronous_ resets and _undefined_ initial values use:

{{< highlight haskell >}}
createDomain vSystem{vName="SyncUndefined", vReset=Synchronous, vInit=Undefined}
{{< / highlight >}}

After doing this, you can use `SyncUndefined` in your type signatures:

{{< highlight haskell >}}
f :: Signal SyncUndefined Bool
{{< / highlight >}}

and `vSyncUndefined` to create an other domain:

{{< highlight haskell >}}
createDomain vSyncUndefined{vName="SyncUndefined_2300", vPeriod=2300}
{{< / highlight >}}

## How to use: constrained synthesis domains
It sometimes happens that a particular function can only handle certain kinds of domains. For example, you might be implementing a component mimicking an existing piece of hardware made by an FPGA vendor only supporting asynchronous resets. In this case, you'd like your components to work on domains configured to use asynchronous resets. This particular case used to be handled by taking a special kind of `Reset`:

{{< highlight haskell >}}
myIP
  :: Clock dom gated
  -> Reset dom 'Asynchronous
  -> [..]
{{< / highlight >}}

`Reset` lost its second argument however, so we now have to handle this in the constraints like so:

{{< highlight haskell >}}
myIP
  :: ( KnownDomain dom
     , DomainResetKind dom ~ 'Asynchronous
     )
  :: Clock dom
  -> Reset dom
  -> [..]
{{< / highlight >}}

We can constrain initial value behavior, clock periods, and all other domain properties in a similar fashion using: `DomainResetPolarity`, `DomainInitBehavior`, `DomainActiveEdge`, and `DomainPeriod`.


## How to use: initial values
Create a domain using the instructions above, setting `Defined` or `Undefined` however you wish. Given the simple counter we've seen before:

{{< highlight haskell >}}
import Clash.Prelude

createDomain vSystem{vName="SyncUndefined",  vReset=Synchronous,  vInit=Undefined}
createDomain vSystem{vName="SyncDefined",    vReset=Synchronous,  vInit=Defined}
createDomain vSystem{vName="AsyncUndefined", vReset=Asynchronous, vInit=Undefined}
createDomain vSystem{vName="AsyncDefined",   vReset=Asynchronous, vInit=Defined}

counter
  :: HiddenClockResetEnable dom
  => Signal dom Int
counter = register 0 (counter + 1)

main = do
  putStrLn "Sync:"
  putStr "  Undefined: "
  printX (sampleN @SyncUndefined 5 counter)

  putStr "  Defined:   "
  printX (sampleN @SyncDefined 5 counter)

  putStrLn "Async:"
  putStr "  Undefined: "
  printX (sampleN @AsyncUndefined 5 counter)

  putStr "  Defined:   "
  printX (sampleN @AsyncDefined 5 counter)
{{< / highlight >}}

you can expect the output to be:

```
Sync:
  Undefined: [X,0,1,2,3]
  Defined:   [0,0,1,2,3]
Async:
  Undefined: [0,0,1,2,3]
  Defined:   [0,0,1,2,3]
```

## How to use: hidden clocks, resets, and enables
Syntax has changed _slightly_, with some type variables having moved to the synthesis domain. The explicitness of `Enable` slightly changes names of some constructs. To sum it up:

* `SystemClockReset` is now called `SystemClockResetEnable`, as it now includes the enable signal too.
* `HiddenClockReset` is now called `HiddenClockResetEnable`, as it now includes the enable signal too.
* `HiddenClock conf gated` is now `HiddenClock dom`.
* `HiddenReset conf sync` is now `HiddenReset dom`.
* `HiddenEnable dom` has been added.

All of the `Hidden*` constructs carry a `KnownDomain` constraint.

## How to use: explicit clocks, resets, and enables
Nothing fundamentally has changed, but a lot of components now take an extra argument: `Enable dom`. Additionally, they now take an extra constraint `KnownDomain dom`. We plan on eventually removing the constraint again, but this will take some engineering and validation. In short, what this means is that - for example - `register` looked like:

{{< highlight haskell >}}
register
  :: NFDataX a
  => Clock dom
  -> Reset dom
  -> a
  -> [..]
{{< / highlight >}}

and now looks like:

{{< highlight haskell >}}
register
  :: ( KnownDomain dom
     , NFDataX a )
  => Clock dom
  -> Reset dom
  -> Enable dom
  -> a
  -> [..]
{{< / highlight >}}

# Bonus: multiple hidden clocks (experimental)
Thanks to the API changes, you can now use multiple hidden clocks, resets, and enables.
It basically works as you'd expect it would:

{{< highlight haskell >}}
delay2
  :: ( HiddenClockResetEnable domA
     , HiddenClockResetEnable domB )
  => Signal domA Int
  -> Signal domB Int
  -> (Signal domA Int, Signal domB Int)
delay2 a b = (register 0 a, register 0 b)
{{< / highlight >}}

Currently, this feature is still considered experimental and therefor disabled in the 1.0 release.
It is available on the development version of the compiler.

That's all, thanks for reading!
