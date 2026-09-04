---
title: "Building systolic arrays with Clash"
aliases:
  - /blog/0002-systolic-arrays/
description: "Building a matrix multiplier using systolic arrays"
disable_comments: false
author: "martijnbastiaan"
authorbox: true # Optional, enable authorbox for specific post
summary: Systolic arrays are networks of locally coupled processing elements, continuously receiving and sending their inputs and outputs from and to their neighbors. They cannot access main memory or global buses, thus allowing them to keep critical paths short. Because of this, they are extremely good at solving problems in the field of image processing, artificial intelligence, and computer vision. This blogpost will take a look at how to build systolic arrays with Clash and subsequently build a matrix multiplier with it. 
toc: true
mathjax: false
categories:
  - "Tutorial"
tags:
  - "Systolic arrays"
  - "Design"
---

{{% darkmode-notice %}}

Systolic arrays are networks of locally coupled processing elements, continuously receiving and sending their inputs and outputs from and to their neighbors. They cannot access main memory or global buses, thus allowing them to keep critical paths short. Because of this, they are extremely good at solving problems in the field of image processing, artificial intelligence, and computer vision. This blogpost will take a look at how to build systolic arrays with Clash and subsequently build a matrix multiplier with it. If you're new to Clash or matrix multiplication, [read this blogpost first](/blog/0001-matrix-multiplication/).

*This post was originally written in 2018 for Clash 0.99. It was updated in September 2026 for Clash 1.10, and now comes with a companion repository.*

# Setting up
The source code corresponding to this blogpost can be found at [github.com/clash-lang/clash-lang.org-systolic-arrays](https://github.com/clash-lang/clash-lang.org-systolic-arrays). Like the code of the previous post, it is a regular Clash *starter project*, see the [installation page](/install/) for how to set up Stack and start a project of your own. To build the code and run its test suite:

```
git clone https://github.com/clash-lang/clash-lang.org-systolic-arrays.git
cd clash-lang.org-systolic-arrays
stack build
stack test
```

The systolic arrays we'll build are all polymorphic; `SystolicArrays.Top` picks concrete types so Clash can generate HDL:

```
stack run clash -- SystolicArrays.Top --vhdl
```

# Concepts

Let's first have a look at a simple systolic array where each processing element has an input from their left and upper neighbor, and an output to their right and bottom neighbor. It looks like:

<center><img src="LeftTopPE.svg"></img></center>

Processing elements can do arbitrary things with their inputs and pass arbitrary things as their outputs, but we'll keep it simple for now. The following example consists of processing elements which each simply pass along the data they receive from their left neighbour to their right neighbor. Similarly, they pass their top input to their bottom neighbor. Simulating a grid of three by three for a total of nine processing elements looks like:

<div class="sysarray" id="mm0">
    <center>
        <table></table>
        <button class="next">Next</button>
        <button class="reset">Reset</button>
    </center>
</div>

<br/>

Yellow elements move to the right every cycle, while blue ones move to the bottom. As can be seen, not every processing element has two (valid) inputs at all points in the simulation. This is not always an issue, but many systolic array applications would like `G` and `8` to end up in the same cell at the same time. By delaying the inputs strategically, this ends up being true:


<div class="sysarray" id="mm1">
    <center>
        <table></table>
        <button class="next">Next</button>
        <button class="reset">Reset</button>
    </center>
</div>

<br/>

In fact, all values of the yellow rows end up in the same cell (at different times) as the values in the blue columns. If that makes you think of matrix multiplication, well, that's because it is! By changing the processing elements to perform multiply-accumulate we end up with a fully pipelined and parallelly executing matrix multiplier:

<div class="sysarray" id="mm2">
    <center>
        <table></table>
        <button class="next">Next</button>
        <button class="reset">Reset</button>
    </center>
</div>

<br/>

An example which actually multiplies two concrete matrices:

<div class="sysarray" id="mm4">
    <center>
        <table></table>
        <button class="next">Next</button>
        <button class="reset">Reset</button>
    </center>
</div>

<br/>

Lots of other applications exist, such as matrix inversion, correlation, and QR decomposition. We'll implement some of them in this post.

# Generic systolic array
A generic systolic array consists of processing elements consuming and producing from and to all their direct neighbors, chained together to create that large interconnected structure. A single processing element therefore looks like:

<center><img src="LinearPE.svg"></img></center>

Apart from style choices, its type is fairly straightforward in Clash. We simply define it as a function taking four inputs, and producing four outputs. For debugging purposes, each processing element will also receive its index in the systolic array. One might later use this in combination with `trace`. To ease working with this function later, it is defined in its [uncurried form](https://wiki.haskell.org/Currying).

```haskell
type ProcessingElement dom m n lr rl tb bt =
  ( (Index m, Index n)
  , Signal dom lr
  , Signal dom rl
  , Signal dom tb
  , Signal dom bt
  ) ->
  ( Signal dom lr
  , Signal dom rl
  , Signal dom tb
  , Signal dom bt
  )
```

In order to create a systolic array these processing elements need to be chained together. Let's first focus on creating a single column of processing elements, which -for a column of three elements- looks like:

<center><img style="min-width:25%" src="SysColumn.svg"></img></center>

Any function constructing the array above would need to (internally) construct the colored edges, given the uncolored ones. In code, we'll use the following names for the inputs:

* `tb`: the input at the start of the 'top to bottom' chain. Marked in the diagram as `TB_0`.
* `bt`: the input at the start of the 'bottom to top' chain. Marked in the diagram as `BT_0`
* `lrs`: inputs from left to right. `LR_0`, `LR_1`, ...
* `rls`, `tbs`, `bts`: analogous to `lrs`

And the following names for the outputs:

* `tb1`: the output at the end of the 'top to bottom' chain. Marked in the diagram as `TB_3`.
* `bt1`: the output at the end of the 'bottom to top' chain. Marked in the diagram as `BT_3`
* `lrs1`: outputs from left to right. `LR_0*`, `LR_1*`, ...
* `rls1`, `tbs1`, `bts1`: analogous to `lrs1`

Additionally, we create the indices assuming we've got some `n` in context: `mn = zip indicesI (repeat n)`. Again, this is for debugging purposes only. The trick to creating the columns is to take a leap of faith and just *assume* all variables are well-defined. Then it is simply a matter of mapping over these inputs and applying them to the processing element function:

```haskell
  (lrs1, rls1, tbs1, bts1) = unzip4 (lazyV (map pelem (zip5 mn lrs rls tbs bts)))
```

The diagram indicates that our function already has `rls` and `lrs`, so we don't have to think about those. However, `tbs` and `bts` are missing. Let's focus on `tbs` first, which consists of all top-bottom *inputs* to the processing elements, i.e. `TB_0`, `TB_1`, and `TB_2`. We do have `TB_0` as an input to our function, but the others are still missing. However, we also know `tbs1` consists of all top-bottom *outputs* to the processing elements, i.e. `TB_1`, `TB_2`, and `TB_3`. Thus:

```haskell
  tbs = tb :> init tbs1
```

This is where the leap of faith comes in: `tbs` is defined in terms of `tbs1`, which is defined in terms of `tbs`. Haskell's laziness makes this work, with one caveat. Functions on `Vec` such as `zip5` inspect the *structure* of their arguments, and `init tbs1` would need the structure of `tbs1` before the first processing element has even been applied. [lazyV](https://hackage.haskell.org/package/clash-prelude-1.10.1/docs/Clash-Sized-Vector.html#v:lazyV) exists for exactly this situation: it rebuilds the structure of a vector from its (compile-time known) length, so it can be inspected before any of its elements are evaluated.

We can define `bts` similarly. We then end up with a single function constructing a single column of the systolic array:

```haskell
syscol ::
  forall dom m n lr rl tb bt.
  (KnownNat m) =>
  ProcessingElement dom (m + 1) n lr rl tb bt ->
  ( Index n
  , Vec (m + 1) (Signal dom lr)
  , Vec (m + 1) (Signal dom rl)
  , Signal dom tb
  , Signal dom bt
  ) ->
  ( Vec (m + 1) (Signal dom lr)
  , Vec (m + 1) (Signal dom rl)
  , Signal dom tb
  , Signal dom bt
  )
syscol pelem (n, lrs, rls, tb, bt) = (lrs1, rls1, tb1, bt1)
 where
  -- Position of every processing element in this column
  mn = zip indicesI (repeat n)

  -- 'lazyV' makes sure the vector's spine can be inspected before its elements
  -- are evaluated: the definitions of 'tbs' and 'bts' below depend on it.
  (lrs1, rls1, tbs1, bts1) = unzip4 (lazyV (map pelem (zip5 mn lrs rls tbs bts)))

  tbs = tb :> init tbs1
  bts = tail bts1 :< bt
  tb1 = last tbs1
  bt1 = head bts1
```

Note that a column has `m + 1` processing elements rather than `m`: `init`, `tail`, `last` and `head` only make sense for non-empty vectors, and their types say so.

Before we tie columns together, there is one thing missing. As it stands, data would flow from the sides of the systolic array all through it in a single clock cycle. This doesn't quite correspond to the examples shown at the very beginning of this blogpost, where data moves one processing element per cycle. All outputs need to be delayed a single clock cycle, as such:

<center><img style="min-width:25%" src="LinearPEReg.svg"></img></center>

By simply using [register](https://hackage.haskell.org/package/clash-prelude-1.10.1/docs/Clash-Signal.html#v:register) we can delay every output by one:

```haskell
-- | Add a register to every output of a processing element
delayPelem ::
  (HiddenClockResetEnable dom, NFDataX lr, NFDataX rl, NFDataX tb, NFDataX bt) =>
  ProcessingElement dom m n lr rl tb bt ->
  -- | Register defaults
  (lr, rl, tb, bt) ->
  ProcessingElement dom m n lr rl tb bt
delayPelem pelem (lrDflt, rlDflt, tbDflt, btDflt) input =
  (register lrDflt lr, register rlDflt rl, register tbDflt tb, register btDflt bt)
 where
  (lr, rl, tb, bt) = pelem input
```

The `HiddenClockResetEnable dom` constraint tells Clash this component contains registers, which need a clock, reset and enable line that Clash routes implicitly. `NFDataX` says the data on a channel can be stored in a register.

To create the whole array, we apply the same strategy as for a single column. Instead of using `pelem`, we'll use `syscol` and instead of dealing with vectors of signals, we have to deal with vectors of vectors of signals to accommodate all the right-left / left-right connections between each column.

```haskell
systolicArray2D ::
  forall dom m n lr rl tb bt.
  ( HiddenClockResetEnable dom
  , KnownNat m
  , KnownNat n
  , NFDataX lr
  , NFDataX rl
  , NFDataX tb
  , NFDataX bt
  ) =>
  -- | Register defaults
  (lr, rl, tb, bt) ->
  -- | Processing element
  ProcessingElement dom (m + 1) (n + 1) lr rl tb bt ->
  -- | Inputs from the left, one for every row
  Signal dom (Vec (m + 1) lr) ->
  -- | Inputs from the right, one for every row
  Signal dom (Vec (m + 1) rl) ->
  -- | Inputs from the top, one for every column
  Signal dom (Vec (n + 1) tb) ->
  -- | Inputs from the bottom, one for every column
  Signal dom (Vec (n + 1) bt) ->
  -- | Outputs to the right, left, bottom and top
  ( Signal dom (Vec (m + 1) lr)
  , Signal dom (Vec (m + 1) rl)
  , Signal dom (Vec (n + 1) tb)
  , Signal dom (Vec (n + 1) bt)
  )
systolicArray2D dflts pelem lrs rls tbs bts =
  -- From `Vec m (Signal dom a)` to `Signal dom (Vec m a)`:
  (bundle lrs2, bundle rls2, bundle tbs2, bundle bts2)
 where
  -- Processing element with registered outputs
  pelem1 = delayPelem pelem dflts

  -- Tie PE columns together:
  (lrss1, rlss1, tbs2, bts2) =
    unzip4 (lazyV (map (syscol pelem1) (zip5 indicesI lrss rlss tbs1 bts1)))

  -- From `Signal dom (Vec m a)` to `Vec m (Signal dom a)`:
  (lrs1, rls1, tbs1, bts1) = (unbundle lrs, unbundle rls, unbundle tbs, unbundle bts)

  lrss = lrs1 :> init lrss1
  rlss = tail rlss1 :< rls1
  lrs2 = last lrss1
  rls2 = head rlss1
```

And that's it for actually tying the processing elements together in a grid. We've built the systolic array corresponding to the very first interactive example given in this blogpost. You'll find it in `SystolicArrays.Array` in the repository.

# Delayed systolic array
Lots of applications, including matrix multiplication, have some need to delay their inputs in such a way that the right elements "meet" each other at the same time. Similarly, the outputs need to be delayed strategically such that results belonging to the same entity (for example, a row in a result matrix) arrive synchronously. When data flows left to right and top to bottom, the most natural delay strategy is such that the n<sup>th</sup> element of the n<sup>th</sup> input from the left, arrives at the same time as the n<sup>th</sup> element of the n<sup>th</sup> input from the top. Visually, this equals the second example (repeated here):

<div class="sysarray" id="mm1-rep">
    <center>
        <table></table>
        <button class="next">Next</button>
        <button class="reset">Reset</button>
    </center>
</div>
<br/>

The example suggests the first left-input is delayed by zero, the second by one, etc. For outputs it would make sense to be delayed the other way around. The exact configuration depends on the application and whether paths are used to push results out of the array, or flow data into it. For now, we'll assume the simple case where all inputs are delayed as described, and all outputs are delayed the other way around. 

Clash does not have a function to put a number of registers after a plain `Signal` (it does have [delayN](https://hackage.haskell.org/package/clash-prelude-1.10.1/docs/Clash-Signal-Delayed.html#v:delayN) for delayed signals, `DSignal`), so we need to build one ourselves. A quick solution is to fold over a vector of units, while adding a register at each step. Clash will filter empty types, so this actually won't interfere with our HDL output at all.

```haskell
-- | Put /n/ registers after given signal. Folds over a vector of units, adding
-- a register at every step. Clash filters empty types, so the units won't show
-- up in the generated HDL.
registerN ::
  forall n dom a.
  (HiddenClockResetEnable dom, NFDataX a) =>
  -- | Default value register
  a ->
  -- | Number of registers to insert
  SNat n ->
  -- | Signal to delay
  Signal dom a ->
  -- | Delayed signal
  Signal dom a
registerN dflt n@SNat signal =
  foldl (\s _ -> register dflt s) signal (replicate n ())
```

Delaying the signals is fairly easy with [smap](https://hackage.haskell.org/package/clash-prelude-1.10.1/docs/Clash-Sized-Vector.html#v:smap), which passes the index of every element as an `SNat` to the function it maps. Most of the code is related to packing/unpacking signals so they can be mapped over ("type torturing" 🙂):

```haskell
-- | Delay the /i/th element of a vector of signals by /i/ cycles
delayInputs ::
  (HiddenClockResetEnable dom, KnownNat n, NFDataX a) =>
  a ->
  Signal dom (Vec n a) ->
  Signal dom (Vec n a)
delayInputs dflt = bundle . smap (registerN dflt) . unbundle

-- | Delay the /i/th element of a vector of /n/ signals by /n - i - 1/ cycles
delayOutputs ::
  (HiddenClockResetEnable dom, KnownNat n, NFDataX a) =>
  a ->
  Signal dom (Vec n a) ->
  Signal dom (Vec n a)
delayOutputs dflt = bundle . reverse . smap (registerN dflt) . reverse . unbundle
```

The delayed systolic array then simply wraps `systolicArray2D`. Its type is the same, so we omit it here:

```haskell
systolicArray2Dd dflts@(lr, rl, tb, bt) pelem lrs rls tbs bts =
  (delayOutputs lr lrs2, delayOutputs rl rls2, delayOutputs tb tbs2, delayOutputs bt bts2)
 where
  -- Create systolic array without delays of outputs
  (lrs2, rls2, tbs2, bts2) =
    systolicArray2D
      dflts
      pelem
      (delayInputs lr lrs)
      (delayInputs rl rls)
      (delayInputs tb tbs)
      (delayInputs bt bts)
```

And that's all there is to it. These functions live in `SystolicArrays.Delayed`.



# Matrix multiplication
So far we've built a generic systolic array and a delayed one on top of it. We haven't built anything useful yet though, which is what this section is for. We've selected a few amongst the most commonly used. Even with rigid structures such as systolic arrays, many design choices still exist. The implemented algorithms are therefore by no means meant as perfect solutions. This subsection will deal with matrix multiplication.

<center><img style="min-width:40%" src="MM.svg"></img></center>

To test and communicate various communication strategies, we'll use spacetime diagrams. On the vertical axis there's space: the processing elements. On the horizontal axis there's time. We'll only consider the case where processing elements can communicate in one dimension: either left-right or top-bottom. If they communicate left-right, the processing elements represent a row in the systolic array, if they communicate top-down, the processing elements represent a column in the systolic array. It actually doesn't really matter, so to ease talking about this problem let's assume the communicate top-bottom. A <span style="background-color:#66CC00; color:white;">green</span> background represents every moment in time a specific element produces useful data:

<table cellspacing="0" border="0">
	<colgroup width="34"></colgroup>
	<colgroup width="23" span="10"></colgroup>
	<colgroup width="26" span="5"></colgroup>
	<tbody><tr>
		<td height="21" align="left"><b>c \ t</b></td>
		<td sdval="0" sdnum="1043;" align="center"><b>0</b></td>
		<td sdval="1" sdnum="1043;" align="center"><b>1</b></td>
		<td sdval="2" sdnum="1043;" align="center"><b>2</b></td>
		<td sdval="3" sdnum="1043;" align="center"><b>3</b></td>
		<td sdval="4" sdnum="1043;" align="center"><b>4</b></td>
		<td sdval="5" sdnum="1043;" align="center"><b>5</b></td>
		<td sdval="6" sdnum="1043;" align="center"><b>6</b></td>
		<td sdval="7" sdnum="1043;" align="center"><b>7</b></td>
		<td sdval="8" sdnum="1043;" align="center"><b>8</b></td>
		<td sdval="9" sdnum="1043;" align="center"><b>9</b></td>
		<td sdval="10" sdnum="1043;" align="center"><b>10</b></td>
		<td sdval="11" sdnum="1043;" align="center"><b>11</b></td>
		<td sdval="12" sdnum="1043;" align="center"><b>12</b></td>
		<td sdval="13" sdnum="1043;" align="center"><b>13</b></td>
		<td sdval="14" sdnum="1043;" align="center"><b>14</b></td>
	</tr>
	<tr>
		<td height="17" align="left"><b>pe1</b></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r1</font></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r1</font></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r1</font></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
	</tr>
	<tr>
		<td height="17" align="left"><b>pe2</b></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r2</font></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r2</font></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r2</font></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
	</tr>
	<tr>
		<td height="17" align="left"><b>pe3</b></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r3</font></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r3</font></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r3</font></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
	</tr>
	<tr>
		<td height="17" align="left"><b>pe4</b></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r4</font></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r4</font></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r4</font></td>
		<td align="center"><br></td>
	</tr>
	<tr>
		<td height="17" align="left"><b>pe5</b></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r5</font></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r5</font></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r5</font></td>
	</tr>
</tbody></table>

Empty cells will be used to indicate where some piece of data resides. We'll see an example in the next section.

## General matrix multiplication
Matrix multiplication can be implemented by having each processing element multiply both its input signals, accumulating, and pushing its data out periodically as shown in the first part of this blogpost. The period at which processing elements need to push out data depends on `n`, the number of columns in the left matrix and the number of rows in the right. Visually:

<center><img style="min-width:70%" src="Dimensions.svg"></img></center>

Assuming that each cell communicates its result downwards and each cell can only push a single element, we need a number of flush rounds if `m` exceeds `n`. After all, the bandwidth of the outer processing element to its environment is a single element per cycle. Thus, more than one result per cycle per column exceeds that bandwidth. If `n` exceeds `m` no flush rounds are needed, but the systolic array produces "garbage" values some of the time as the bandwidth exceeds the result production. 

For now, let's assume `n = m`. Communication downwards effectively binds the systolic array to communicate as follows:

<table cellspacing="0" border="0">
	<colgroup width="33" span="16"></colgroup>
	<tbody><tr>
		<td height="20" align="left"><b>c \ t</b></td>
		<td sdval="0" sdnum="1043;" align="center"><b>0</b></td>
		<td sdval="1" sdnum="1043;" align="center"><b>1</b></td>
		<td sdval="2" sdnum="1043;" align="center"><b>2</b></td>
		<td sdval="3" sdnum="1043;" align="center"><b>3</b></td>
		<td sdval="4" sdnum="1043;" align="center"><b>4</b></td>
		<td sdval="5" sdnum="1043;" align="center"><b>5</b></td>
		<td sdval="6" sdnum="1043;" align="center"><b>6</b></td>
		<td sdval="7" sdnum="1043;" align="center"><b>7</b></td>
		<td sdval="8" sdnum="1043;" align="center"><b>8</b></td>
		<td sdval="9" sdnum="1043;" align="center"><b>9</b></td>
		<td sdval="10" sdnum="1043;" align="center"><b>10</b></td>
		<td sdval="11" sdnum="1043;" align="center"><b>11</b></td>
		<td sdval="12" sdnum="1043;" align="center"><b>12</b></td>
		<td sdval="13" sdnum="1043;" align="center"><b>13</b></td>
		<td sdval="14" sdnum="1043;" align="center"><b>14</b></td>
	</tr>
	<tr>
		<td height="17" align="left"><b>pe1</b></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r1</font></td>
		<td align="center"><font color="#CCCCCC">r1</font></td>
		<td align="center"><font color="#CCCCCC">r1</font></td>
		<td align="center"><font color="#CCCCCC">r1</font></td>
		<td align="center">r1</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r1</font></td>
		<td align="center"><font color="#CCCCCC">r1</font></td>
		<td align="center"><font color="#CCCCCC">r1</font></td>
		<td align="center"><font color="#CCCCCC">r1</font></td>
		<td align="center">r1</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r1</font></td>
		<td align="center"><font color="#CCCCCC">r1</font></td>
		<td align="center"><font color="#CCCCCC">r1</font></td>
		<td align="center"><font color="#CCCCCC">r1</font></td>
		<td align="center">r1</td>
	</tr>
	<tr>
		<td height="17" align="left"><b>pe2</b></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r2</font></td>
		<td align="center"><font color="#CCCCCC">r2</font></td>
		<td align="center"><font color="#CCCCCC">r2</font></td>
		<td align="center">r2</td>
		<td align="center">r1</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r2</font></td>
		<td align="center"><font color="#CCCCCC">r2</font></td>
		<td align="center"><font color="#CCCCCC">r2</font></td>
		<td align="center">r2</td>
		<td align="center">r1</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r2</font></td>
		<td align="center"><font color="#CCCCCC">r2</font></td>
		<td align="center"><font color="#CCCCCC">r2</font></td>
		<td align="center">r2</td>
	</tr>
	<tr>
		<td height="17" align="left"><b>pe3</b></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r3</font></td>
		<td align="center"><font color="#CCCCCC">r3</font></td>
		<td align="center">r3</td>
		<td align="center">r2</td>
		<td align="center">r1</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r3</font></td>
		<td align="center"><font color="#CCCCCC">r3</font></td>
		<td align="center">r3</td>
		<td align="center">r2</td>
		<td align="center">r1</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r3</font></td>
		<td align="center"><font color="#CCCCCC">r3</font></td>
		<td align="center">r3</td>
	</tr>
	<tr>
		<td height="17" align="left"><b>pe4</b></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r4</font></td>
		<td align="center">r4</td>
		<td align="center">r3</td>
		<td align="center">r2</td>
		<td align="center">r1</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r4</font></td>
		<td align="center">r4</td>
		<td align="center">r3</td>
		<td align="center">r2</td>
		<td align="center">r1</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r4</font></td>
		<td align="center">r4</td>
	</tr>
	<tr>
		<td height="17" align="left"><b>pe5</b></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r5</font></td>
		<td align="center">r4</td>
		<td align="center">r3</td>
		<td align="center">r2</td>
		<td align="center">r1</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r5</font></td>
		<td align="center">r4</td>
		<td align="center">r3</td>
		<td align="center">r2</td>
		<td align="center">r1</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r5</font></td>
	</tr>
</tbody></table>

Elements need to store their results for a while, before synchronously passing them to their neighbors. In the diagram, the moments where each element pushes its own result is `t=4`, `t=9`, and `t=14`. At all other cycles, processing elements simply pass the results they receive from their upper neighbors down. Because processing elements need to synchronously push their data, this either requires:

1. a signal from the left telling if `t=5n - 1`; or
2. each element keeping a local counter counting the global time; or
3. each element keeping a local counter counting last time since fire; or

The last two waste hardware. The first one requires a split between timing strategies for data and control. That does requires a combination of `systolicArray2D` and `systolicArray2Dd`, but that's easy enough - though tedious - to implement:

```haskell
systolicArray2Dud dflts@((_, lrd), (_, rld), (_, tbd), (_, btd)) pelem lrus lrds rlus rlds tbus tbds btus btds =
  ( lrus1
  , delayOutputs lrd lrds1
  , rlus1
  , delayOutputs rld rlds1
  , tbus1
  , delayOutputs tbd tbds1
  , btus1
  , delayOutputs btd btds1
  )
 where
  -- Bundle undelayed and delayed signals
  lrs = zip <$> lrus <*> delayInputs lrd lrds
  rls = zip <$> rlus <*> delayInputs rld rlds
  tbs = zip <$> tbus <*> delayInputs tbd tbds
  bts = zip <$> btus <*> delayInputs btd btds

  -- Create systolic array without delays of outputs
  (lrs1, rls1, tbs1, bts1) = systolicArray2D dflts pelem lrs rls tbs bts

  -- Unbundle undelayed and delayed signals
  (lrus1, lrds1) = (fmap fst <$> lrs1, fmap snd <$> lrs1)
  (rlus1, rlds1) = (fmap fst <$> rls1, fmap snd <$> rls1)
  (tbus1, tbds1) = (fmap fst <$> tbs1, fmap snd <$> tbs1)
  (btus1, btds1) = (fmap fst <$> bts1, fmap snd <$> bts1)
```

Note that the only difference between `systolicArray2Dud` and `systolicArray2Dd` is that we pass in tuples of which the first element is passed undelayed to the matrix, while the second is delayed according to earlier discussed strategies. (Its type signature, eight inputs and eight outputs long, is in the repository.) Each processing element needs to support the actions discussed just now:

```haskell
-- | Synchronous instruction: passed to the processing elements undelayed
data SyncInstrPEDown
  = -- | Take data from upper neighbor, pass to lower neighbor
    Pass
  | -- | Discard data from upper neighbor, pass own storage to lower neighbor
    Inject
  deriving (Generic, Show, Eq, NFDataX)

-- | Asynchronous instruction: travels along with the data
data AsyncInstrPEDown
  = -- | Accumulate products of incoming signals
    Accum
  | -- | Move current result to storage
    Store
  deriving (Generic, Show, Eq, NFDataX)
```

Instructions end up in registers, hence the derived `NFDataX` instances. The processing element then keeps two buffers: one to store an accumulation (`s1`), and one to store a result (`s2`). Processing elements are exactly the same everywhere and simply listen for incoming instructions as defined earlier.

```haskell
pelemDown ::
  (HiddenClockResetEnable dom, Num a, NFDataX a) =>
  ProcessingElement
    dom
    m
    n
    (SyncInstrPEDown, (a, AsyncInstrPEDown))
    ((), ())
    ((), (a, a))
    ((), ())
pelemDown (_mn, lrs, rls, tbs, bts) = (lrs, rls, tbs2, bts)
 where
  tbs1 = mealy pelem1 (0, 0) (bundle (lrs, snd <$> tbs))
  tbs2 = liftA2 (,) (fst <$> tbs) tbs1

  -- State: (accumulator, stored result)
  pelem1 (s1, s2) ((Pass, (a, Accum)), (b, res)) = ((s1 + a * b, s2), (b, res))
  pelem1 (s1, _s2) ((Pass, (a, Store)), (b, res)) = ((0, s1 + a * b), (b, res))
  pelem1 (s1, s2) ((Inject, (a, Accum)), (b, _res)) = ((s1 + a * b, s2), (b, s2))
  pelem1 (s1, s2) ((Inject, (a, Store)), (b, _res)) = ((0, s1 + a * b), (b, s2))
```

A wrapping function ties the systolic array and processing element functions.

```haskell
generalMatrixMultiplicationDown ::
  forall a n m p dom.
  (HiddenClockResetEnable dom, Num a, NFDataX a, KnownNat n, KnownNat m, KnownNat p) =>
  -- | Number of columns / rows of left matrix / right matrix
  SNat (n + 1) ->
  -- | Columns of left matrix
  Signal dom (Vec (m + 1) a) ->
  -- | Rows of right matrix
  Signal dom (Vec (p + 1) a) ->
  -- | Rows of result matrix, in reverse order
  Signal dom (Vec (p + 1) a)
generalMatrixMultiplicationDown SNat cols rows = fmap snd <$> tbs1
 where
  -- Determine inputs for systolic array:
  counter :: Signal dom (Index (n + 1))
  counter = register minBound (satSucc SatWrap <$> counter)

  sysCmd c
    | c == maxBound = (repeat Inject, repeat Store)
    | otherwise = (repeat Pass, repeat Accum)

  (lrus, dcmds) = unbundle (sysCmd <$> counter)

  -- Pass columns and delayed commands from the left, and the rows and dummy
  -- passthrough values from the top:
  lrds = zip <$> cols <*> dcmds
  tbds = zip <$> rows <*> pure (repeat 0)

  -- nothingP and nothingM differ in vector length, thus having different
  -- types, explaining the seemingly duplicate definitions:
  nothingP = pure (repeat ())
  nothingM = pure (repeat ())

  -- Create actual array:
  (_, _, _, _, _, tbs1, _, _) =
    systolicArray2Dud
      -- Defaults for registers
      ((Inject, (0, Store)), ((), ()), ((), (0, 0)), ((), ()))
      -- Processing element
      pelemDown
      -- Inputs:
      lrus
      lrds
      nothingM
      nothingM
      nothingP
      tbds
      nothingP
      nothingP
```

Let's try it on the matrices of the interactive example, *A* = [[1,2,1],[0,1,0],[2,3,4]] and *B* = [[2,5,1],[6,7,1],[1,8,2]], whose product is [[15,27,5],[6,7,1],[26,63,13]]. The array consumes the *columns* of *A* and the *rows* of *B*, one per cycle, and the first column must arrive when the counter is at zero, i.e. right after reset:

```
clashi> import SystolicArrays.MatrixMultiplication
clashi> import qualified Data.List as L
clashi> let colsA = (1 :> 0 :> 2 :> Nil) :> (2 :> 1 :> 3 :> Nil) :> (1 :> 0 :> 4 :> Nil) :> Nil :: Vec 3 (Vec 3 Int)
clashi> let rowsB = (2 :> 5 :> 1 :> Nil) :> (6 :> 7 :> 1 :> Nil) :> (1 :> 8 :> 2 :> Nil) :> Nil :: Vec 3 (Vec 3 Int)
clashi> let input = toList (zip colsA rowsB) L.++ L.repeat (repeat 0, repeat 0)
clashi> mapM_ print (L.zip [0 :: Int ..] (simulateN @System 12 (\i -> let (c, r) = unbundle i in generalMatrixMultiplicationDown d3 c r) input))
(0,0 :> 0 :> 0 :> Nil)
(1,0 :> 0 :> 0 :> Nil)
(2,0 :> 0 :> 0 :> Nil)
(3,0 :> 0 :> 0 :> Nil)
(4,0 :> 0 :> 0 :> Nil)
(5,0 :> 0 :> 0 :> Nil)
(6,0 :> 0 :> 0 :> Nil)
(7,0 :> 0 :> 0 :> Nil)
(8,26 :> 63 :> 13 :> Nil)
(9,6 :> 7 :> 1 :> Nil)
(10,15 :> 27 :> 5 :> Nil)
(11,0 :> 0 :> 0 :> Nil)
```

The rows of the result come out in reverse order, as promised. The test suite in the repository checks this for a number of matrix sizes, including matrices fed back to back, and predicts the exact cycle at which every row appears.

Bandwidth requirements per node, where `|a|` is the number of bits needed to store numeric type `a`:

* Top-to-bottom: 2 &middot; `|a|`
* Left-to-right: `|a|` + 1 + 1

Registers needed systolic array:

* Top: 0.5 &middot; (p<sup>2</sup> - p) &middot; `|a|`
* Left: 0.5 &middot; (m<sup>2</sup> - m) &middot; (`|a|` + 1)
* Bottom: 0.5 &middot; (p<sup>2</sup> - p) &middot; `|a|`
* Nodes: 2pm &middot; `|a|`
* Edges: 3pm &middot; (`|a|` + 1 + 1)

The total latency from inputting the last row/column to receiving the last result row is `m`, the number of rows in the left matrix.

## `m` equals `n`
The general matrix multiplication algorithm needs an extra register in each processing elements to temporarily store the results generated by each element, in order to transmit it to their bottom neighbors later. A simple alternative strategy would be to introduce flush rounds, where PEs end up being utilized 50% of the time - trading utilization for bandwidth.

Square matrices turn out to have an interesting property which allows them to be calculated and read without introducing additional registers. By utilizing the bottom-to-top communication channel of our systolic array, processing elements can pass their results right after producing a meaningful result. The spacetime diagram then looks like:

<table cellspacing="0" border="0">
	<colgroup width="34"></colgroup>
	<colgroup width="23" span="10"></colgroup>
	<colgroup width="26" span="5"></colgroup>
	<tbody><tr>
		<td height="21" align="left"><b>c \ t</b></td>
		<td sdval="0" sdnum="1043;" align="center"><b>0</b></td>
		<td sdval="1" sdnum="1043;" align="center"><b>1</b></td>
		<td sdval="2" sdnum="1043;" align="center"><b>2</b></td>
		<td sdval="3" sdnum="1043;" align="center"><b>3</b></td>
		<td sdval="4" sdnum="1043;" align="center"><b>4</b></td>
		<td sdval="5" sdnum="1043;" align="center"><b>5</b></td>
		<td sdval="6" sdnum="1043;" align="center"><b>6</b></td>
		<td sdval="7" sdnum="1043;" align="center"><b>7</b></td>
		<td sdval="8" sdnum="1043;" align="center"><b>8</b></td>
		<td sdval="9" sdnum="1043;" align="center"><b>9</b></td>
		<td sdval="10" sdnum="1043;" align="center"><b>10</b></td>
		<td sdval="11" sdnum="1043;" align="center"><b>11</b></td>
		<td sdval="12" sdnum="1043;" align="center"><b>12</b></td>
		<td sdval="13" sdnum="1043;" align="center"><b>13</b></td>
		<td sdval="14" sdnum="1043;" align="center"><b>14</b></td>
	</tr>
	<tr>
		<td height="17" align="left"><b>pe1</b></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r1</font></td>
		<td align="center"><br></td>
		<td align="center">r2</td>
		<td align="center"><br></td>
		<td align="center">r3</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r1</font></td>
		<td align="center">r4</td>
		<td align="center">r2</td>
		<td align="center">r5</td>
		<td align="center">r3</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r1</font></td>
		<td align="center">r4</td>
		<td align="center">r2</td>
		<td align="center">r5</td>
		<td align="center">r3</td>
	</tr>
	<tr>
		<td height="17" align="left"><b>pe2</b></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r2</font></td>
		<td align="center"><br></td>
		<td align="center">r3</td>
		<td align="center"><br></td>
		<td align="center">r4</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r2</font></td>
		<td align="center">r5</td>
		<td align="center">r3</td>
		<td align="center"><br></td>
		<td align="center">r4</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r2</font></td>
		<td align="center">r5</td>
		<td align="center">r3</td>
		<td align="center"><br></td>
	</tr>
	<tr>
		<td height="17" align="left"><b>pe3</b></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r3</font></td>
		<td align="center"><br></td>
		<td align="center">r4</td>
		<td align="center"><br></td>
		<td align="center">r5</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r3</font></td>
		<td align="center"><br></td>
		<td align="center">r4</td>
		<td align="center"><br></td>
		<td align="center">r5</td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r3</font></td>
		<td align="center"><br></td>
		<td align="center">r4</td>
	</tr>
	<tr>
		<td height="17" align="left"><b>pe4</b></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r4</font></td>
		<td align="center"><br></td>
		<td align="center">r5</td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r4</font></td>
		<td align="center"><br></td>
		<td align="center">r5</td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r4</font></td>
		<td align="center"><br></td>
	</tr>
	<tr>
		<td height="17" align="left"><b>pe5</b></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r5</font></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r5</font></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td align="center"><br></td>
		<td bgcolor="#66CC00" align="center"><font color="#EEEEEE">r5</font></td>
	</tr>
</tbody></table>

Compared to the previous communication strategy, no additional buffers are needed - but latency is up. Also note that this is only possible with square matrices where each side is of odd size. Even matrices would need a single flush cycle. Due to the missing register, the implementation is much less complex. First, the processing elements only need to support two commands:

```haskell
-- | Instruction for 'pelemUp'
data InstrPEUp
  = -- | Clear state, push old state plus product of incoming to upper neighbor
    Clear
  | -- | Move data from neighbor below to upper neighbor
    Data
  deriving (Generic, Show, Eq, NFDataX)
```

The implementation of the processing elements now looks like:

```haskell
pelemUp ::
  (HiddenClockResetEnable dom, Num a, NFDataX a) =>
  ProcessingElement dom m n (InstrPEUp, a) () a a
pelemUp (_mn, lrs, rls, tbs, bts) = (lrs, rls, tbs, bts1)
 where
  bts1 = mealy pelem1 0 (bundle (lrs, tbs, bts))
  pelem1 c ((Clear, a), b, _bt) = (0, a * b + c)
  pelem1 c ((Data, a), b, bt) = (a * b + c, bt)
```

Similar to our previous strategy, we need a simple component generating the commands passed to the processing elements. In contrast to our previous approach, we don't need to split delayed and undelayed inputs to the systolic array. The command generation component simply looks like:

```haskell
sysInput ::
  (KnownNat n, KnownNat m) =>
  Index n ->
  Vec m a ->
  Vec p a ->
  (Vec m (InstrPEUp, a), Vec p a)
sysInput c col row
  | c == maxBound = (zip (repeat Clear) col, row)
  | otherwise = (zip (repeat Data) col, row)
```

All that is left is a wrapper instantiating `systolicArray2Dd` with `pelemUp`, and feeding it the output of `sysInput`:

```haskell
squareMatrixMultiplicationUp ::
  forall a n dom.
  (HiddenClockResetEnable dom, Num a, NFDataX a, KnownNat n) =>
  -- | Columns of left matrix
  Signal dom (Vec (n + 1) a) ->
  -- | Rows of right matrix
  Signal dom (Vec (n + 1) a) ->
  -- | Rows of result matrix
  Signal dom (Vec (n + 1) a)
squareMatrixMultiplicationUp cols rows = bts1
 where
  counter :: Signal dom (Index (n + 1))
  counter = register minBound (satSucc SatWrap <$> counter)

  (lrs, tbs) = unbundle (sysInput <$> counter <*> cols <*> rows)

  (_, _, _, bts1) =
    systolicArray2Dd
      ((Data, 0), (), 0, 0)
      pelemUp
      lrs
      (pure (repeat ()))
      tbs
      (pure (repeat 0))
```

which already concludes the implementation of this matrix multiplication algorithm. On the same input as before, the rows now come out in order, every other cycle:

```
clashi> mapM_ print (L.zip [0 :: Int ..] (simulateN @System 12 (\i -> let (c, r) = unbundle i in squareMatrixMultiplicationUp c r) input))
(0,0 :> 0 :> 0 :> Nil)
(1,0 :> 0 :> 0 :> Nil)
(2,0 :> 0 :> 0 :> Nil)
(3,0 :> 0 :> 0 :> Nil)
(4,0 :> 0 :> 0 :> Nil)
(5,15 :> 27 :> 5 :> Nil)
(6,0 :> 0 :> 0 :> Nil)
(7,6 :> 7 :> 1 :> Nil)
(8,0 :> 0 :> 0 :> Nil)
(9,26 :> 63 :> 13 :> Nil)
(10,0 :> 0 :> 0 :> Nil)
(11,0 :> 0 :> 0 :> Nil)
```

Both multipliers live in `SystolicArrays.MatrixMultiplication`.

Bandwidth requirements per node, where `|a|` is the number of bits needed to store numeric type `a`:

* Top-to-bottom: `|a|`
* Bottom-to-top: `|a|`
* Left-to-right: `|a|` + 1

Registers needed systolic array:

* Top: (p<sup>2</sup> - p) &middot; `|a|`
* Left: 0.5 &middot; (m<sup>2</sup> - m) &middot; (`|a|` + 1)
* Nodes: pm &middot; `|a|`
* Edges: 3pm &middot; (`|a|` + 1)

The total latency from inputting the last row/column to receiving the last result row is `2m`, the number of rows in the left matrix.

## A quick note on pipelined processing elements
One of the advantages of using a systolic array like this one is that integrating pipelined elements is easy. As long as all outputs are delayed by the same number of registers, the array will have the same behavior bar its increased latency. Clash offers some tools to make it easier to type these pipelined signals in the form of [delayed signals](https://hackage.haskell.org/package/clash-prelude-1.10.1/docs/Clash-Signal-Delayed.html). In fact, [a previous blogpost on matrix multiplication](/blog/0001-matrix-multiplication/) used this to guarantee some timing aspects of its pipelined functions.

# Triangular systolic arrays
Systolic arrays are not by definition of rectangular shape. For example, [Gentleman and Kung](http://www.csd.uwo.ca/~moreno/CS433-CS9624/Resources/Matrix_Triangularization_by_systetolic_arrays.pdf) describe a systolic array with a triangular shape for many different algorithms. Due to a varying number of processing elements on each "row" of the systolic array, we cannot use the same tactic for building systolic arrays as before. Let's first look at a visualized systolic array as described by Gentleman and Kung:

<center><img src="halfSysArray.svg"></img></center>

Let's define the types of the different wires as follows:

* `↓ :: tb` (<u>t</u>op-<u>b</u>ottom)
* `↘ :: dg` (<u>d</u>ia<u>g</u>onal)
* `→ :: lr` (<u>l</u>eft-<u>r</u>ight)

Now, with these types, we can imagine that:

* `○ :: Signal dom tb -> Signal dom dg -> (Signal dom dg, Signal dom lr)`
* `◻ :: Signal dom tb -> Signal dom lr -> (Signal dom tb, Signal dom lr)`

whereas our complete systolic array `triangularSystolicArray` is of type:

```haskell
triangularSystolicArray ::
  forall n tb dg lr dom.
  (HiddenClockResetEnable dom, KnownNat n, NFDataX tb, NFDataX dg, NFDataX lr) =>
  -- | Function for ○
  (Signal dom tb -> Signal dom dg -> (Signal dom dg, Signal dom lr)) ->
  -- | Function for ◻
  (Signal dom tb -> Signal dom lr -> (Signal dom tb, Signal dom lr)) ->
  -- | Register defaults
  (tb, dg, lr) ->
  -- | Input from top
  Signal dom (Vec n tb) ->
  -- | Input for first ○
  Signal dom dg ->
  -- | (diagonal output of last ○, right outputs)
  (Signal dom dg, Signal dom (Vec n lr))
```

Building this systolic array is a bit more complex due to its non-square shape. We can't simply hold every signal corresponding to a wire between processing elements in a vector, as the first row has *n* wires, the next *n-1*, etc. Similarly, the first column has *1* wire from left to right, while the second has *2*, etc. Luckily, we're only actually interested in the most right wires and we can safely discard the rest. If we can write a function creating a single column given the results of the previous column, [dfold](https://hackage.haskell.org/package/clash-prelude-1.10.1/docs/Clash-Sized-Vector.html#v:dfold) promises to build the whole thing.

Building a single column can be achieved with `mapAccumL`, accumulating the top-bottom output, while producing a left-right output for every inner processing element (◻). The top-bottom output is combined with the diagonal input from the previous column and an edge processing element (○). Every processing element output gets a register, using a small helper `bidelay`. If omitted, all data would flow through the systolic array in a single cycle which is undesirable. Thus:

```haskell
triangularColumn ::
  forall dom l tb dg lr.
  (HiddenClockResetEnable dom, KnownNat l, NFDataX tb, NFDataX dg, NFDataX lr) =>
  -- | Function for ○
  (Signal dom tb -> Signal dom dg -> (Signal dom dg, Signal dom lr)) ->
  -- | Function for ◻
  (Signal dom tb -> Signal dom lr -> (Signal dom tb, Signal dom lr)) ->
  -- | Register defaults
  (tb, dg, lr) ->
  -- | Input from top
  Signal dom tb ->
  -- | Diagonal input
  Signal dom dg ->
  -- | Inputs from the left
  Signal dom (Vec l lr) ->
  -- | (diagonal output, outputs to the right)
  (Signal dom dg, Signal dom (Vec (l + 1) lr))
triangularColumn edgeF innerF (tb, dg, lr) top diagonal (unbundle -> lefts) =
  (diagonal1, bundle (rights :< right))
 where
  -- Simple helper function to delay tuples
  bidelay ::
    forall a b.
    (NFDataX a, NFDataX b) =>
    (a, b) ->
    (Signal dom a, Signal dom b) ->
    (Signal dom a, Signal dom b)
  bidelay (aDflt, bDflt) (a, b) = (register aDflt a, register bDflt b)

  -- Apply inner functions
  (bottom, rights) = mapAccumL innerF1 top lefts
  innerF1 top1 left = bidelay (tb, lr) (innerF top1 left)

  -- Terminate with edge function
  (diagonal1, right) = bidelay (dg, lr) (edgeF bottom diagonal)
```

(`bidelay` is used at two different types, so it needs a type signature of its own: local definitions that use hidden clocks are not generalized.)

In order for `dfold` to work, it asks its users to define a type-level function yielding the type at iteration *n*. If the type works out after each iteration, the whole construct typechecks. We first need to define a data type used to instantiate type level function application:

```haskell
-- | Collection of types that don't change between fold-iterations, which we
-- need to construct the type at some iteration.
data TriangularMotive (dg :: Type) (lr :: Type) (dom :: Domain) (f :: TyFun Nat Type) :: Type
```

Then, we provide an instance for [Apply](https://hackage.haskell.org/package/singletons-3.0.4/docs/Data-Singletons.html#t:Apply), the class used to implement type level functions. Both `TyFun` and `Apply` come from the `singletons` package. The actual type we end up with at the *n<sup>th</sup>* iteration is simple enough: a tuple of the diagonal input and a vector of left-right outputs from our inner (◻) and edge (○) functions.

```haskell
-- | Intermediate type at fold-iteration /n/: the diagonal output and the outputs
-- to the right of a column with /n/ processing elements.
type instance
  Apply (TriangularMotive dg lr dom) n =
    (Signal dom dg, Signal dom (Vec n lr))
```

We can now glue the whole array together. The actual code is mostly taken by type signatures needed to disambiguate certain types. One subtlety: `dfold` folds from the right, so the *last* element of the vector ends up in the first (and smallest) column. As the paper asks for the first input to be delayed by zero cycles, the second by one, etc., the vector of delayed inputs is reversed before folding over it.

```haskell
triangularSystolicArray edgeF innerF dflts@(tbDflt, _, _) tops diagonal =
  (diagonal1, rights)
 where
  -- Add delays to top inputs, as described in paper: the /i/th input is delayed
  -- by /i/ cycles. 'dfold' folds from the right, so the vector is reversed to
  -- make the first (undelayed) input end up in the first column.
  tops1 = reverse (smap (registerN tbDflt) (unbundle tops))

  -- Fold over top inputs, progressively expanding the triangular array
  (diagonal1, rights) =
    dfold
      (Proxy @(TriangularMotive dg lr dom))
      go
      (diagonal, pure Nil)
      tops1

  -- Simple wrapping function around 'triangularColumn'. Explicit types are
  -- needed to not confuse the type checker.
  go ::
    forall l.
    SNat l ->
    Signal dom tb ->
    (Signal dom dg, Signal dom (Vec l lr)) ->
    (Signal dom dg, Signal dom (Vec (l + 1) lr))
  go SNat tb (dg, lrs) =
    triangularColumn edgeF innerF dflts tb dg lrs
```

Note that we haven't implemented any functionality yet, just like our previous general systolic array functions. It's now easy to build one though, as we only have to pass in the two functions, ◻ and ○. These functions live in `SystolicArrays.Triangular`.

# Matrix triangularization
Gentleman and Kung describe two algorithms expressed in terms of the triangular systolic array. We're going to implement the first one; *triangularization with neighbor pivoting* (page 3). The paper lays out the inner ("internal") and boundary ("edge") functions with pseudocode which we can more or less copy. The pseudo code is defined as a simple mealy machine, so that's how we'll do it as well. `safeQuot` is a function which returns zero if the denominator is zero, as also described in the paper:

```haskell
-- | Integer division that returns zero if the denominator is zero
safeQuot :: (Integral a) => a -> a -> a
safeQuot _ 0 = 0
safeQuot a b = a `quot` b

-- | "Internal cell" as mealy machine. The state is the element of the
-- triangular matrix this cell holds.
innerF :: (Num a) => a -> (a, (a, Bool)) -> (a, a)
innerF x (x1, (m1, True)) = (x1, x + (m1 * x1))
innerF x (x1, (m1, False)) = (x, x1 + (m1 * x))

-- | "Boundary cell" as mealy machine. The state is the diagonal element of the
-- triangular matrix this cell holds.
edgeF :: (Integral a) => a -> a -> (a, (a, Bool))
edgeF x x1
  | abs x1 >= abs x = (x1, (safeQuot x x1, True))
  | otherwise = (x, (negate (safeQuot x1 x), False))
```

The systolic array is then created by slightly modifying these functions to signal notation, and calling `triangularSystolicArray`. Note that the algorithm doesn't actually use the diagonal communication lines. Just like when we didn't use all communication channels in the square systolic array, we'll simply pass Haskell's "empty" type: unit (`()`). Empty types will be filtered by Clash.

```haskell
neighborPivotTriangularization ::
  forall n a dom.
  (HiddenClockResetEnable dom, Integral a, NFDataX a, KnownNat n) =>
  -- | Rows of matrix
  Signal dom (Vec n a) ->
  Signal dom (Vec n a)
neighborPivotTriangularization rows = fmap fst <$> lrs
 where
  -- Instantiate systolic array
  (_, lrs) =
    triangularSystolicArray
      -- Processing elements:
      edgeF1
      innerF1
      -- Defaults for registers:
      (0, (), (0, False))
      -- Top-bottom input:
      rows
      -- Diagonal input:
      (pure ())

  -- Turn mealy machines into signal constructs
  edgeF1 tb dg = (dg, mealy edgeF 0 tb)
  innerF1 tb lr = (mealy innerF 0 (liftA2 (,) tb lr), lr)
```

The paper does not tell us how to retrieve the results from the array. Like any systolic array, we could introduce flush rounds or increase bandwidth to move the results to the array borders. We've already seen this process for matrix multiplication, so we'll skip it for this one. What the array does expose are the multipliers computed by the boundary cells, which the test suite in the repository compares against a plain Haskell implementation of the same algorithm. You'll find the code in `SystolicArrays.Triangularization`.

# Conclusion
We've built two types of systolic arrays in Clash, both solving real-world problems. Although the design methodology in Clash is somewhat different than other (traditional) tooling, it hopefully gave a feeling on how to build generalized solutions in Clash, while retaining readability. Any thoughts or questions can be left in the comments. See you in a next blogpost!


<!-- Javascript and CSS --> 
<script src="script.js"></script>

<style>
.sysarray{
  min-height:568px;
}

.sysarray table, 
.sysarray td{
  border:none;
  text-align:center;
}

.sysarray td{ 
  height:65px;
  width:65px;
}

.sysarray .a{
  background-color: #FFF2CC;
}

.sysarray .b{
  background-color: #DAE8FC;
}

.systolic table{ 
  height:auto;
  width:auto;
  font-family: monospace;
}

.sysarray td.pe{
  border: 1px solid black;
}

#mm0 table{
  width:80%;
}

#mm0 {
  min-height:439px;
}

#mm1 td.pe,
#mm2 td.pe,
#mm3 td.pe,
#mm4 td.pe{
  font-size:0.8em;

}

</style>
