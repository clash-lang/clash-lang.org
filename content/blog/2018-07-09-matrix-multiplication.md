---
title: "Matrix multiplication with Clash"
aliases:
  - /blog/0001-matrix-multiplication/
description: "Building, restructuring, and pipelining matrix multiplication with Clash"
disable_comments: false
author: "martijnbastiaan"
authorbox: true # Optional, enable authorbox for specific post
summary: Matrix multiplications happen to be useful in a very broad range of computational applications, such as computer graphics, artificial intelligence, and climate change research. At QbayLogic we help implement these (and more) applications on FPGAs using Clash. In this blogpost we will explore the intricacies of implementing matrix multiplications on FPGAs. We will explore the apparent differences between hardware and software development, how to use Clash to convert a “naive” algorithm to one suitable for an FPGA, and the use of Clash dependent types.
toc: true
mathjax: true
categories:
  - "Tutorial"
tags:
  - "Matrices"
  - "Design"
---

<script src="script.js" defer></script>

*Matrix multiplications happen to be useful in a very broad range of computational applications, such as computer graphics, artificial intelligence, and climate change research. At QbayLogic we help implement these (and more) applications on FPGAs using Clash. In this blogpost we will explore the intricacies of implementing matrix multiplications on FPGAs. We will explore the apparent differences between hardware and software development, how to use Clash to convert a “naive” algorithm to one suitable for an FPGA, and the use of Clash dependent types.*

*Our goal is to create a flexible yet efficient matrix multiplier. We want a pipelined architecture, polymorphic in its element type. That is, it should handle different number types (float, double, integers) even when the operations on these different types have different timing characteristics. We will see Clash is up for the task, providing a generic description for hardware polymorphic in timing and matrix dimensions. At the end of the post we’ll reflect on the experience and offer thoughts on the difficulties we encountered and how Clash could ease them in the future.*

*This post was originally written in 2018 for Clash 0.99. It was updated in September 2026 for Clash 1.10, and now comes with a companion repository.*

<hr>

# Setting up
The source code corresponding to this blogpost can be found at [github.com/clash-lang/clash-lang.org-matrix-multiplication](https://github.com/clash-lang/clash-lang.org-matrix-multiplication). It is a regular Clash *starter project*, so if you want to follow along in a fresh project, install [Stack](https://docs.haskellstack.org/en/stable/) as described on the [installation page](/install/) and run:

```
stack new my-clash-project clash-lang/simple
```

This creates a folder `my-clash-project` with a `README.md` explaining the project layout. Every module in this blogpost lives in `src/`. (People familiar with the Haskell ecosystem might prefer to use Cabal instead of Stack. The `README.md` explains how.)

To use the finished code instead, clone the repository and build it:

```
git clone https://github.com/clash-lang/clash-lang.org-matrix-multiplication.git
cd clash-lang.org-matrix-multiplication
stack build
```

Throughout this post we'll use an interactive Clash session to try out our definitions. The starter project comes with one:

```
stack run clashi
```

To compile a design to VHDL (or Verilog with `--verilog`), run:

```
stack run clash -- MatrixMultiplication.Top --vhdl
```

Finally, the repository has a test suite comparing all the multipliers we'll build against each other. Run it with `stack test`.

# Matrix multiplication
In order to define matrix multiplication, we first need to define a fundamental operation it uses: the dot-product. Given two vectors *a* and *b* both of length *n*, the dot product is:

$$ a \cdot b = \sum_{i=1}^n a_i b_i $$

or in Haskell:

```haskell
dot a b = sum (zipWith (*) a b)
```

The matrix multiplication is then defined as:

$$ (AB)_{ij} = A_i \cdot (B^T)_j $$

where

- *(AB)<sub>ij</sub>* the element of *AB* located at the *i<sup>th</sup>* row and *j<sup>th</sup>* column.
- *A<sub>i</sub>* denotes the *i<sup>th</sup>* row of *A*
- *(B<sup>T</sup>)<sub>j</sub>* denotes the *j<sup>th</sup>* column of *B*

To get a feeling for matrix multiplication, play around with an interactive example kindly provided by André Staltz ([source](https://github.com/staltz/matrixmultiplication.xyz)):

<iframe style="border:none;" width="100%" height="460px" src="matrixmultiplication.xyz"></iframe>

Note that the example calculates the result partially sequentially and partially in parallel. Most algorithms would iterate the rows of the first matrix and for each step iterate the columns of the second. I.e., it would compute..

$$ 1 \cdot 2 + 2 \cdot 6 + 1 \cdot 1 = 15 $$
$$ 1 \cdot 5 + 2 \cdot 7 + 1 \cdot 8 = 27 $$
$$ 0 \cdot 2 + 1 \cdot 6 + 0 \cdot 1 = 6 $$
$$ 0 \cdot 5 + 1 \cdot 7 + 0 \cdot 8 = 7 $$
$$ 2 \cdot 2 + 3 \cdot 6 + 4 \cdot 1 = 26 $$
$$ 2 \cdot 5 + 3 \cdot 7 + 4 \cdot 8 = 63 $$

.. in order. In fact, many other strategies exist. A fully parallel algorithm would calculate each result cell "at the same time". Other algorithms might opt to execute *n* dot products in parallel, but implement its dot product with an accumulator only executing one multiplication each timestep.

## Haskell implementation

Let's make an implementation in native Haskell. The most obvious way to store a matrix in many computer programming languages is a 2D array / list. This makes sense for Haskell too, reflected in the following type:

```haskell
type Vector = [Int]
type Matrix = [Vector]
```

For simplicity, we'll assume a matrix only holds integers. The most straightforward matrix multiplication algorithm then looks like:

```haskell
-- | Dot product (repeated)
dot :: Vector -> Vector -> Int
dot vec1 vec2 = sum (zipWith (*) vec1 vec2)

-- | Matrix/vector multiplication
mvMult :: Matrix -> Vector -> Vector
mvMult mat vec = map (dot vec) mat

-- | Matrix/matrix multiplication
mmMult :: Matrix -> Matrix -> Matrix
mmMult mat1 mat2 = map (mvMult (transpose mat2)) mat1
```

You'll find this version in `MatrixMultiplication.Lists` in the repository.

Matrix multiplication is an excellent candidate for hardware acceleration: every element in the result matrix is independently calculated. In fact, the Haskell implementation we just made does not impose a calculation order at all thanks to lazy evaluation. We could therefore compute the whole thing in parallel. Computing a matrix product in parallel is no easy task though. For a single matrix *C* one needs to compute <i>ay*bx</i> dot products, where each dot product computes *ax* multiplications and *ax* additions. Lumping these together gives us <i>ay*bx*2ax</i> operations, or a massive 270 million hardware elements for a *512x512* matrix.

## Clash implementation
In order to compile our algorithm to a traditional hardware description language, we need to add length information to our code. Haskell lists are linked lists without (explicitly) stored length information, thus rendering them unsuitable for our purposes. As replacement, [Clash offers vectors](https://hackage.haskell.org/package/clash-prelude-1.10.1/docs/Clash-Sized-Vector.html) called `Vec`s. `Vec`s can store arbitrary data.

Clash is only slightly different from GHC. It enables some extensions and uses [its own Prelude](https://hackage.haskell.org/package/clash-prelude-1.10.1/docs/Clash-Prelude.html). Most functions defined in Haskell's Prelude, you'll find in Clash's too. In fact, you'll see that our implementation hardly changes. Let's first redefine our types:

```haskell
-- | A matrix with @m@ rows and @n@ columns, storing elements of type @a@
type Matrix m n a = Vec m (Vec n a)
```

This is conceptually the same as `[[Int]]`, but with length information added. `m` is now the number of rows, while `n` indicates the number of columns. While we're at it, we make the element type a parameter `a` too: our goal is a multiplier that works for any number type, and we'll see later on that this flexibility comes in handy in unexpected places. Let's redefine `dot` first:

```haskell
-- | Dot product
dot ::
  (KnownNat n, Num a) =>
  Vec n a ->
  Vec n a ->
  a
dot vec1 vec2 = sum (zipWith (*) vec1 vec2)
```

Note that the only thing we changed is its type signature, while its implementation stayed exactly the same. Two *constraints* are added to the type signature:

1. `KnownNat n`: allows the implementation to access vector length information at runtime. This is needed for some implementations of functions associated with `Foldable`, such as `sum`. See the FAQ for further discussion.
2. `Num a`: elements must support arithmetic. The list implementation got this for free by fixing the element type to `Int`.

Besides that, lengths are left completely polymorphic. The only thing Clash requires is that the lengths are known when it compiles it down to VHDL. Only the very top of a design, and subsequently the whole tree it implicitly uses, needs to be monomorphic.

Put this definition in a module, `MatrixMultiplication.Naive` in the repository, and load it in an interactive session. The starter project makes all modules of the project available in `clashi`:

```
$ stack run clashi
clashi> import MatrixMultiplication.Naive
clashi> dot (1 :> 2 :> Nil) (5 :> 7 :> Nil)
19
```

Next up is the matrix/vector multiplication:

```haskell
-- | Matrix/vector multiplication
mvMult ::
  (KnownNat n, Num a) =>
  -- | Matrix with @m@ rows, @n@ columns
  Matrix m n a ->
  -- | Vector with @n@ elements
  Vec n a ->
  Vec m a
mvMult mat vec = map (dot vec) mat
```

Again, note the actual implementation did not change. And last but not least, matrix matrix multiplication:

```haskell
-- | Matrix/matrix multiplication
mmMult ::
  -- Number of columns of matrix A must be equal to the number of rows in
  -- matrix B, hence @an ~ bm@.
  (an ~ bm, KnownNat bn, KnownNat bm, Num a) =>
  Matrix am an a ->
  Matrix bm bn a ->
  Matrix am bn a
mmMult mat1 mat2 = map (mvMult (transpose mat2)) mat1
```

And yet again we see the implementation does not actually change over the native Haskell one. The only thing we need to do is add length information to our types to satisfy the Clash compiler.

### Splitting hardware
In the previous section we built a fully parallel, synthesizable matrix multiplication algorithm. This description works fine for small matrices, but quickly grows until it doesn’t fit on even the largest FPGAs. We don't want a fully serial implementation either, which would underutilize our hardware. Ideally, we would like to write a "scalable" algorithm whose parameters can be set in such a way that it perfectly matches our target architecture. This doesn't seem easy, but it is doable in Clash as we'll show in this section.

Like numbers, matrices form a [semiring](https://en.wikipedia.org/wiki/Semiring). Crudely speaking, some "type" is a semiring as soon it supports [addition](https://en.wikipedia.org/wiki/Matrix_addition) and [multiplication](https://en.wikipedia.org/wiki/Matrix_multiplication) and inhibits "number-like" properties such as a zero-element, a one-element, and distribution over addition. Interestingly, the following holds:

$$
A =
\begin{bmatrix}
    a & b & c & d \\\\
    e & f & g & h \\\\
    i & j & k & l \\\\
    m & n & o & p
\end{bmatrix} AA = \begin{bmatrix}
\begin{bmatrix} a & b \\\\ e & f \end{bmatrix} & \begin{bmatrix} c & d \\\\ g & h \end{bmatrix} \\\\ \begin{bmatrix} i & j \\\\ m & n \end{bmatrix} & \begin{bmatrix} k & l \\\\ o & p \end{bmatrix} \end{bmatrix}
$$

$$
B = \begin{bmatrix}
    \alpha & \beta & \gamma & \delta \\\\
    \epsilon & \zeta & \eta & \theta \\\\
    \iota & \tau & \kappa & \lambda \\\\
    \mu & \nu & \omicron & \pi
\end{bmatrix} BB = \begin{bmatrix}
\begin{bmatrix} \alpha & \beta \\\\ \epsilon & \zeta \end{bmatrix} & \begin{bmatrix} \gamma & \delta \\\\ \eta & \theta \end{bmatrix} \\\\ \begin{bmatrix} \iota & \tau \\\\ \mu & \nu \end{bmatrix} & \begin{bmatrix} \kappa & \lambda \\\\ \omicron & \pi \end{bmatrix} \end{bmatrix}
$$

then if we define

$$
A \cong AA \texttt{ and } B \cong BB
$$

then the following holds:

$$
A \cdot B \cong AA \cdot BB
$$

where the 'dot' is matrix multiplication. This pattern holds for larger and smaller matrices alike, pretty cool! Thus, if we're able to build a fully sequential matrix multiplication algorithm (doing exactly one multiplication per time step), we could combine it with our previously built fully parallel one. (Revisit the interactive example, imagining that numbers are matrices if you want to!). If the sizes of these submatrices would be configurable, we would have essentially built a scalable matrix multiplier. This is exactly what we're going to do.

This is where making `Matrix` polymorphic in its element type pays off: a `Matrix m n a` can store integers, but just as well store other matrices. A matrix of *m* by *n* submatrices, each *sm* by *sn* in size, is simply a `Matrix m n (Matrix sm sn a)`.

Up to this point, we have been defining functions without timing specifications. That is, it would just compile to a hardware component finishing in a single time step. Timesteps in Clash are modeled using `Signal`s; an infinite stream of values. Our new function will be defined using these. We will build a component that takes two matrices, calculates the result of their multiplication, and finally returns the result after some time. To distinguish between "no input" and "input", and "no output" and "output" we'll wrap them in `Maybe`.

Finally, before we define our new function, we need a way to talk about the sizes of the various (sub)matrices. The defacto standard in mathematics is to define `m` as the number of rows, and `n` as the number of columns. We'll extend this idea in the following way if `X` is a matrix and `X ≅ XX`:

- `X_m`: number of rows in `X`
- `X_n`: number of columns in `X`
- `XX_m`: number of rows in `XX` (number of submatrices in vertical direction)
- `XX_n`: number of columns in `XX` (number of submatrices in horizontal direction)
- `XX_sm`: number of rows in each *submatrix* of `XX`.
- `XX_sn`: number of columns in each *submatrix* of `XX`.

With that being set up, let's have a look at the type of our new function:

```haskell
mmmult2d ::
  -- Explicit definition of type variables in order to use them in function body
  forall a_m a_n b_m b_n aa_m aa_n bb_m bb_n aa_sm aa_sn bb_sm bb_sn a.
  ( -- Clock, reset and enable lines for registers
    HiddenClockResetEnable System
  , KnownNat aa_m
  , KnownNat aa_n
  , KnownNat bb_m
  , KnownNat bb_n
  , KnownNat aa_sm
  , KnownNat aa_sn
  , KnownNat bb_sm
  , KnownNat bb_sn
  , -- Enforce proper matrix dimensions:
    a_n ~ b_m
  , -- Constrain submatrices:
    a_m ~ (aa_m * aa_sm)
  , a_n ~ (aa_n * aa_sn)
  , b_m ~ (bb_m * bb_sm)
  , b_n ~ (bb_n * bb_sn)
  , bb_sm ~ aa_sn
  , -- We need at least one submatrix in every direction:
    1 <= aa_m
  , 1 <= aa_n
  , 1 <= bb_n
  , -- Elements must support arithmetic and can be stored in registers
    Num a
  , NFDataX a
  ) =>
  -- | Number of submatrices in the vertical direction of AA
  SNat aa_m ->
  -- | Number of columns in each submatrix of AA
  SNat aa_sn ->
  -- | Number of submatrices in the horizontal direction of BB
  SNat bb_n ->
  -- | Matrices to multiply
  Signal System (Maybe (Matrix a_m a_n a, Matrix b_m b_n a)) ->
  -- | Result, returned after calculating for a while
  Signal System (Maybe (Matrix a_m b_n a))
```

Almost the whole type signature is taken up by constraints. This might look tedious at first, but it actually helps to prevent a lot of errors such as passing a wrongly dimensioned matrix. We'll later see we *could* omit the type signatures altogether if we wanted to. Two constraints deserve a special mention. `HiddenClockResetEnable System` says that this component contains registers, which need a clock, reset and enable line. Clash routes these implicitly for us. `NFDataX a` says that values of type `a` can be stored in a register.

The function boils down to four actual arguments. Three submatrix dimensions:

```haskell
  -- | Number of submatrices in the vertical direction of AA
  SNat aa_m ->
  -- | Number of columns in each submatrix of AA
  SNat aa_sn ->
  -- | Number of submatrices in the horizontal direction of BB
  SNat bb_n ->
```

And a single argument *maybe* passing two matrices:

```haskell
  Signal System (Maybe (Matrix a_m a_n a, Matrix b_m b_n a)) ->
```

We'll later see how to forge signals in order to test our function, and how to use `SNat`s to pass our desired (sub)matrix dimensions.

A lot of the times when we work with `Signal`s in Clash, it is convenient to express ourselves in terms of Mealy (or Moore) machines. Instead of thinking about a stream of values evolving over time, we'd express ourselves in terms of a *state* and a function applied to that state yielding an updated state and an output. In Mealy machines, both updating and yielding an output is combined into a single function, while Moore separates these into two functions. We'll use the former in this tutorial.

Without resorting to blockrams just yet, at the very least we need to store three things in our state:

- The matrices `AA` and `BB` given as an input at some earlier point during the computation;
- The partially calculated result matrix `RR`;
- A counter to keep track of how far we've progressed.

We could define this counter in many ways. Preferably though, we would like to keep it as simple as possible. Recall an instance of matrix multiplication:

$$
\begin{bmatrix}
    a & b \\\\
    c & d
\end{bmatrix} \begin{bmatrix}
    e & f \\\\
    g & h
\end{bmatrix} = \begin{bmatrix}
    ae + bg & af + bh \\\\
    ce + dg & cf + dh
\end{bmatrix} = \begin{bmatrix}
    i & j \\\\
    k & l
\end{bmatrix}
$$

We could choose to calculate the submatrix multiplications as follows:

$$
\texttt{ae, ce, af, cf, bg, dg, bh, dh}
$$

At each timestep, we would therefore read from or write to:

$$
AA:
\texttt{a, c, a, c, b, d, b, d} \\\\ BB:
\texttt{e, e, f, f, g, g, h, h} \\\\ RR:
\texttt{i, k, j, l, i, k, j, l} \\\\
$$

In this configuration, we could think of the indices indicating the various elements as follows:

- `AA_m`: row index increases by one every cycle
- `BB_n`: column index increases after full cycle of `AA_m`
- `AA_n`: column index increases after full cycle of `BB_n`
- `BB_m`: row index increases after full cycle of `BB_n`
- `RR_m`: row index increases by one every cycle
- `RR_n`: column index increases after full cycle of `AA_m`

Therefore, we can express our counter as a triple:

```haskell
type Counter = (Index aa_n, Index bb_n, Index aa_m)
```

.. counting from right to left, with carry and wrap-around. In case of our *2x2* example, it would count like:

$$
(0, 0, 0) \\\\ (0, 0, 1) \\\\ (0, 1, 0) \\\\ (0, 1, 1) \\\\ (1, 0, 0) \\\\ \dots
$$

Allowing us to store the indices of all three matrices as a single triple:

```haskell
(aColI, _, aRowI) = counter
(bRowI, bColI, _) = counter
(_, rColI, rRowI) = counter
```

Clash ships exactly this kind of counter in [`Clash.Class.Counter`](https://hackage.haskell.org/package/clash-prelude-1.10.1/docs/Clash-Class-Counter.html): `countSucc` increases a tuple of counters by one, carrying over from right to left and wrapping around at the end. Let's try it out:

```
clashi> import Clash.Class.Counter
clashi> iterate d5 countSucc (minBound :: (Index 2, Index 2, Index 2))
(0,0,0) :> (0,0,1) :> (0,1,0) :> (0,1,1) :> (1,0,0) :> Nil
```

Convenience functions for matrices, such as splitting a matrix into submatrices (`msplit`) and merging them again (`mmerge`), can be found in `MatrixMultiplication.Matrix`. Their implementations are out of scope for this blogpost, but you're welcome to check them out in the repository given in the introduction.

```haskell
import Clash.Class.Counter (countSucc)
import MatrixMultiplication.Matrix
```

With all this said, we can finally start implementing `mmmult2d`. Because we decided to use [`mealy`](https://hackage.haskell.org/package/clash-prelude-1.10.1/docs/Clash-Prelude-Mealy.html), we'll let `mmmult2d` set the stage: setup an initial state for the mealy machine, and split the input matrices into congruent matrices with submatrices:

```haskell
mmmult2d SNat SNat SNat ab =
  mealy mmmult2dmealy state ab1
 where
  -- Take input matrices, and split them into smaller ones. The outer fmap
  -- maps over each value in the signal, the inner fmap applies the function
  -- `splitab` on the inner value of Maybe (if it is not Nothing).
  ab1 = fmap (fmap splitab) ab

  -- Initial state for mealy machine:
  state =
    ( Nothing -- No matrices saved yet
    , minBound -- Counter at zero
    , emptyMatrix nullMatrix -- Matrix with zero-matrices
    )

  -- Split matrices into matrix with submatrices
  splitab (a, b) =
    ( msplit a :: Matrix aa_m aa_n (Matrix aa_sm aa_sn a)
    , msplit b :: Matrix bb_m bb_n (Matrix bb_sm bb_sn a)
    )
```

Note that we don't actually use the three `SNat` arguments: matching on the `SNat` constructor brings the corresponding `KnownNat` into scope, but the constraints in the type signature already give us all the length information we need. They are there for the *caller*, who uses them to pick the submatrix dimensions.

All that's left now is to implement the mealy machine doing the actual calculation. Our mealy machine, `mmmult2dmealy`, matches on three distinct cases:

1. No input, no matrices stored; do nothing.
2. Input given; resets counter and stores matrices given as input.
3. Otherwise; calculate. Pick off at the point indicated by the indices.

It uses `index`, a total version of `!!` from `MatrixMultiplication.Matrix`:

```haskell
-- | Same as '(!!)' but guaranteed to succeed as any value in @Index n@ can never
-- exceed @n-1@.
index :: (KnownNat n) => Vec n a -> Index n -> a
index = (!!)
```

Notice that the following implementation does not have an explicit type. Clash will infer its type simply by the function's definition, including size constraints. (GHC's `-Wall` does warn about this though, so the repository disables `-Wmissing-signatures` for this module.)

```haskell
-- | mmmult2dmealy describes a single calculation step. It returns a result only
-- when it's ready. To be used as mealy machine.
mmmult2dmealy (Nothing, _, _) Nothing =
  -- No input nor state, do nothing:
  ((Nothing, minBound, emptyMatrix nullMatrix), Nothing)
mmmult2dmealy _ matrices@(Just _) =
  -- Input; reset progress so far (if any)
  ((matrices, minBound, emptyMatrix nullMatrix), Nothing)
mmmult2dmealy (matrices@(Just (matrixAA, matrixBB)), counter, matrixRR) _ =
  -- Continue calculating, return result if ready
  (state1, output)
 where
  -- If we're at the counter's maximum, we're done after this cycle
  done = counter == maxBound

  -- Increase counter tuple by one. Wrap around if maximum is reached.
  counter1 = countSucc counter

  -- Calculate new state; if we're done, reset it.
  state1
    | done = (Nothing, counter1, emptyMatrix nullMatrix)
    | otherwise = (matrices, counter1, matrixRR1)

  -- Output only if we're done calculating
  output
    | done = Just (mmerge matrixRR1)
    | otherwise = Nothing

  -- Determine order of fetching from A or B and storing it in R.
  (aColI, _, aRowI) = counter
  (bRowI, bColI, _) = counter
  (_, rColI, rRowI) = counter

  -- Fetch submatrices and partial result
  subA = (matrixAA `index` aRowI) `index` aColI
  subB = (matrixBB `index` bRowI) `index` bColI
  subR = (matrixRR `index` rRowI) `index` rColI

  -- Calculate new partial result, store it in matrix R
  subR1 = madd subR (mmMult subA subB)
  matrixRR1 = replaceMatrixElement matrixRR rRowI rColI subR1
```

And that's it for implementing a scalable matrix multiplier. To summarize: we can multiply matrices of any size and choose the number of integer multipliers by adjusting the size of the submatrices. You'll find this version in `MatrixMultiplication.Sequential`.

Let's take it for a spin. `simulateN` feeds a list of inputs to a circuit and gives us back the first *n* outputs. The reset is asserted during the first cycle, so we start with a `Nothing`. We'll multiply two *2x2* matrices using *1x1* submatrices, which should take *2·2·2 = 8* cycles:

```
clashi> import MatrixMultiplication.Sequential
clashi> import qualified Data.List as L
clashi> let matA = (1 :> 2 :> Nil) :> (3 :> 4 :> Nil) :> Nil :: Matrix 2 2 Int
clashi> let matB = (5 :> 6 :> Nil) :> (7 :> 8 :> Nil) :> Nil :: Matrix 2 2 Int
clashi> simulateN @System 11 (mmmult2d d2 d1 d2) (Nothing : Just (matA, matB) : L.repeat Nothing)
[Nothing,Nothing,Nothing,Nothing,Nothing,Nothing,Nothing,Nothing,Nothing,Just ((19 :> 22 :> Nil) :> (43 :> 50 :> Nil) :> Nil),Nothing]
```

The test suite in the repository does this for a number of submatrix configurations, checking the result against `mmMult`.

### Pipelining `dot`
Any circuit's performance is determined by its critical path: the path between two registers incurring the maximum delay in the whole circuit. In the circuit developed so far we're still using the matrix multiplication from the very first part of this blogpost. This chains multiple multiply-add operations together, clearly inducing a very long path:

{{< inline-svg "images/01-dot.svg" >}}

Simply adding a register after each `f` would greatly reduce the length of the critical path. This however changes the behavior of the circuit significantly, as the output of the first `f` would only be present at the input of the second `f` at timestep *t+1*, while the other inputs of the second `f` still arrive at *t+0*. Instead, we need to add registers to the inputs of every `f`, progressively more further down the pipeline, as such:

{{< inline-svg "images/02-dot.svg" >}}

This new dot-operator would functionally behave the same way as its non-pipelined counterpart, bar a delay between the input and output. Clash allows us to model this kind of behavior with [delayed signals](https://hackage.haskell.org/package/clash-prelude-1.10.1/docs/Clash-Signal-Delayed.html#t:DSignal). Let's first consider the definition of a non-delayed multiply-add as displayed in the first image:

```haskell
-- | Multiply-add on signals: @c + a * b@
multiplyAdd ::
  (Num a) =>
  Signal System (a, a) ->
  Signal System a ->
  Signal System a
multiplyAdd ab c = c + a * b
 where
  (a, b) = unbundle ab
```

Pretty straightforward, hopefully. It's a bit more complicated than vanilla Haskell thanks to the use of `Signal`s and tuples therein. We'll later see why we used a tuple in the first place. For now, let's focus on implementing `dot` using `multiplyAdd`. Using `Signal`s obfuscates it a bit, but `multiplyAdd` is in fact of the form `a -> b -> b` making it suitable for a simple `foldr`.

```haskell
dot ::
  forall n a.
  (KnownNat n, Num a) =>
  Signal System (Vec n a) ->
  Signal System (Vec n a) ->
  Signal System a
dot a b = foldr multiplyAdd (pure 0) ab
 where
  -- <$> is another notation for fmap. fmapping zip over a signal leaves
  -- a signal of 1-argument functions. To apply an argument within the
  -- signal use we use <*>. This is a common pattern in Clash.
  ab :: Vec n (Signal System (a, a))
  ab = unbundle (zip <$> a <*> b)
```

So far so good. So what about the registers? Inserting a single register after each multiply-add is relatively easy using delayed signals and the function [`delayed`](https://hackage.haskell.org/package/clash-prelude-1.10.1/docs/Clash-Signal-Delayed.html#v:delayed), which will insert enough registers to match its type context. In our case, this is a single register inferred by calculating `(n + 1) - n ~ 1`. `DSignal`s have their own `Bundle` class, so we import `Clash.Signal.Delayed.Bundle` qualified to get at its `unbundle`:

```haskell
import qualified Clash.Signal.Delayed.Bundle as DBundle
```

```haskell
dMultiplyAdd ::
  (HiddenClockResetEnable System, Num a, NFDataX a) =>
  DSignal System n (a, a) ->
  DSignal System n a ->
  DSignal System (n + 1) a
dMultiplyAdd ab c = delayed (repeat 0) result
 where
  result = c + a * b
  (a, b) = DBundle.unbundle ab
```

Unfortunately, we just broke our definition of `dot`. The delayed version of `multiplyAdd`, `dMultiplyAdd`, is of the form `a -> b -> c` due to differing delays between the two arguments and the result. Still, in this case we could use the result of type `c` as a second argument to another application of `dMultiplyAdd`. In fact, if we would manually unroll the definition of `foldr` in `dot`, we would end up with a perfectly fine Haskell program! Of course, we cannot, since we do not know the number of times we would have to unroll it when writing the function. It could be three times, it could be a thousand, depending on the context.

Luckily, Clash offers a way out: [dependently typed folds](https://hackage.haskell.org/package/clash-prelude-1.10.1/docs/Clash-Sized-Vector.html#v:dfold). Dependently typed folds can help whenever one wants to fold a function `g :: a -> b -> c`, where `g a c` would type-check. `dfold` asks its users two things:

1. To provide a [type-level function](https://hackage.haskell.org/package/singletons-3.0.4/docs/Data-Singletons.html#t:TyFun) which, given an index *l*, provides the type for a circuit folded *l* times.

2. To provide a function (`go`) which is given three things: [1] an `SNat` indicating how far `dfold` is in the folding process;  [2] the `l`<sup>th</sup> element of the vector given to `dfold`; and [3] the output of the `l-1`<sup>th</sup> application of `go`. The function should return something of the type predicted by the type level function.

Given this, it promises us a type-checking construct.

Type level functions can be implemented by providing an [`Apply`](https://hackage.haskell.org/package/singletons-3.0.4/docs/Data-Singletons.html#t:Apply) instance for it. Both `TyFun` and `Apply` come from the `singletons` package, which we add to our project's dependencies and import:

```haskell
import Data.Singletons (Apply, Proxy (..), TyFun)
```

Instances need a specific type we can match on, so we’ll build a new one:

```haskell
data MultAddFoldedTypeGen (n :: Nat) (a :: Type) (f :: TyFun Nat Type) :: Type
```

We don’t care about a runtime representation, so we’ll skip an actual implementation. `n` corresponds to the delay our function starts with even before folding the given function even once, and `a` is the element type of our vectors. `f` represents the function taking an integer `l` and returning whatever type we wish: `Type` (read `f :: TyFun Nat Type` as `f :: Nat -> Type`). We can see the `l` being used in the instance:

```haskell
type instance Apply (MultAddFoldedTypeGen n a) l = DSignal System (n + l) a
```

As `dMultiplyAdd` incurs a delay of 1 and starts with a delay `n`, the delay after folding `l` times is `n + l`. This concludes the first part required for `dfold`. For the second part, we need to implement a function chaining two parts of the pipeline together:

```haskell
  go ::
    -- Number of times folded already
    SNat l ->
    -- Tuple to be multiplied
    DSignal System d (a, a) ->
    -- Input from previous element in pipeline
    DSignal System (d + l) a ->
    DSignal System (d + l + 1) a
  go SNat ab c = dMultiplyAdd (delayed (repeat (0, 0)) ab) c
```

Finally, we can use our type level function `MultAddFoldedTypeGen` and glue function `go` in an application of `dfold` as such:

```haskell
-- | Pipelined version of 'dot', built with 'dfold'
dotfDfold ::
  forall d n a.
  (HiddenClockResetEnable System, KnownNat n, Num a, NFDataX a) =>
  DSignal System d (Vec n a) ->
  DSignal System d (Vec n a) ->
  DSignal System (d + n) a
dotfDfold a b =
  dfold
    -- Type level function to supply type of /l/th folding
    (Proxy @(MultAddFoldedTypeGen d a))
    -- Chain function:
    go
    -- Start value of pipeline:
    (pure 0)
    -- Every processing element gets an external input:
    (DBundle.unbundle (zip <$> a <*> b))
 where
  go = ...
```

Although this journey so far has given us great insight into how Clash handles types and how to manually build pipelines, it feels like this should have been handled by higher-order functions in the first place. In `MatrixMultiplication.Pipeline` you'll therefore find our pipelining generalized as two functions `foldrp` and `foldrpp`, and a much simpler implementation of the pipelined dot product, `dotf`:

```haskell
-- | Pipelined version of 'dot'
dotf ::
  (HiddenClockResetEnable System, KnownNat n, Num a, NFDataX a) =>
  DSignal System d (Vec n a) ->
  DSignal System d (Vec n a) ->
  DSignal System (d + n) a
dotf a b =
  foldrp
    -- Function:
    (\(x, y) acc -> x * y + acc)
    -- Defaults for output/input of function:
    0
    (0, 0)
    -- Vector to fold over:
    (zip <$> a <*> b)
    -- Start value:
    (pure 0)
```

To summarize, we built a pipelined version of `dot` with the help of delayed signals. We used type level functions to express our type evolving when unfolding our use of `foldr`. Lastly, we saw the use of higher-order functions - in this case `foldrp` - can immensely help ease of implementation and readability.


### Putting it together again
We can't use `dotf` in our definition of `mmmult2dmealy` anymore, as the former is described at a signal level, while the latter is described at a value level. A strategy to handle this is to make multiple mealy machines, chained together in a combining function. In our case, we would designate a component with producing the right input for our `dotf` function, and another component processing the results of that pipeline:

{{< inline-svg "images/03-dot.svg" >}}

Our new function `mmmult2dreader` is an almost exact copy of our previously defined mealy machine. Instead of doing matrix multiplications though, it produces rows and columns fed to `dotf`. Its counter gained two indices to walk over the rows and columns *within* a submatrix:

```haskell
-- | mmmult2dreader stores (sub)matrices and yields a row/column of a submatrix
-- every cycle.
mmmult2dreader (Nothing, _) Nothing =
  -- No input nor state, do nothing:
  ((Nothing, minBound), Nothing)
mmmult2dreader _ matrices@(Just _) =
  -- Input; reset progress so far (if any)
  ((matrices, minBound), Nothing)
mmmult2dreader (matrices@(Just (matrixAA, matrixBB)), counter) _ =
  -- Continue calculating, return result if ready.
  (state1, Just (rowA, colB))
 where
  -- Calculate new state; if we're done, reset it.
  state1
    | counter == maxBound = (Nothing, countSucc counter)
    | otherwise = (matrices, countSucc counter)

  -- Determine order of fetching from A or B and storing it in R.
  (aColI, _, aRowI, saRowI, _) = counter
  (bRowI, bColI, _, _, sbColI) = counter

  -- Fetch submatrices and their row/column
  subA = (matrixAA `index` aRowI) `index` aColI
  subB = (matrixBB `index` bRowI) `index` bColI
  rowA = subA `index` saRowI
  colB = transpose subB `index` sbColI
```

Now that our reader function yields `Maybe` results, we need to change our pipelined dot function to process (and produce) `Maybe` values as well, which we present below. Note that we use `undefined` as an equivalent of `xxxx` in VHDL/Verilog. In fact, this is exactly what the Clash compiler will produce: Clash's Prelude replaces the `undefined` from `base` with one that only raises an exception (an `XException`) when its value is actually used. If all is well though, both our simulation and hardware will never actually use this result. Similarly, `fromJustX` is a version of `fromJust` that yields such an exception on `Nothing`. To improve error reporting during simulation we could replace `undefined` with `errorX "some message"`. Be careful to only use this for values you're convinced your code will never use, as an error has simply no meaning on hardware.

```haskell
dotfm ::
  (HiddenClockResetEnable System, KnownNat n, Num a, NFDataX a) =>
  DSignal System d (Maybe (Vec n a, Vec n a)) ->
  DSignal System (d + n) (Maybe a)
dotfm ab =
  foldrp
    -- Function:
    multAdd
    -- Defaults for output/input of function:
    Nothing
    undefined
    -- Vector to fold over:
    (uncurry zip . fromJustX <$> ab)
    -- Start value; Nothing on no input, Just 0 on input:
    ((const 0 <$>) <$> ab)
 where
  multAdd _ Nothing = Nothing
  multAdd (a, b) (Just c) = Just (a * b + c)
```

The last component we need to write is the component processing the output of our pipelined dot function. This component closely mirrors the structure of our reader. It resets its state if it does not receive an input, and yields its results as soon as it has gathered enough results from the dot function.

```haskell
-- | mmmult2dwriter stores result (sub)matrices and processes results from
-- the dotf pipeline. It yields results whenever it has gathered enough results.
mmmult2dwriter _ Nothing =
  -- No input, reset state
  ((emptyMatrix nullMatrix, minBound), Nothing)
mmmult2dwriter (matrixRR, counter) (Just dotfResult) = (state1, output)
 where
  state1 = (matrixRR2, countSucc counter)

  (matrixRR2, output)
    | counter == maxBound = (emptyMatrix nullMatrix, Just matrixRR1)
    | otherwise = (matrixRR1, Nothing)

  -- Calculate new partial result, store it in matrix R
  (_, rColI, rRowI, srRowI, srColI) = counter

  subR = (matrixRR `index` rRowI) `index` rColI
  subR1 = alterMatrixElement subR srRowI srColI (+ dotfResult)
  matrixRR1 = replaceMatrixElement matrixRR rRowI rColI subR1
```

All that's left to do is to tie the three components together in `mmmult2d`. Its type signature is the same as before, except that we now also require every submatrix to have at least one row and column (`1 <= aa_sm`, `1 <= bb_sn`), as our counter walks over those too. The writer never looks at the first index of the counter, so we give the initial counter an explicit type to help the type checker along:

```haskell
mmmult2d SNat SNat SNat ab =
  fmap (fmap mmerge) writerOutput
 where
  -- Take input matrices, and split them into smaller ones.
  ab1 = fmap (fmap splitab) ab

  splitab (a, b) =
    ( msplit a :: Matrix aa_m aa_n (Matrix aa_sm aa_sn a)
    , msplit b :: Matrix bb_m bb_n (Matrix bb_sm bb_sn a)
    )

  -- Initial counter for both the reader and the writer. The writer does not use
  -- all indices, hence the type annotation.
  counter :: (Index aa_n, Index bb_n, Index aa_m, Index aa_sm, Index bb_sn)
  counter = minBound

  -- [1] Reader stage
  readerOutput :: Signal System (Maybe (Vec aa_sn a, Vec bb_sm a))
  readerOutput = register Nothing $ mealy mmmult2dreader (Nothing, counter) ab1

  -- [2] Dot product pipeline
  dotfOutput :: Signal System (Maybe a)
  dotfOutput = register Nothing $ toSignal $ dotfm $ fromSignal readerOutput

  -- [3] Writer stage
  writerOutput :: Signal System (Maybe (Matrix aa_m bb_n (Matrix aa_sm bb_sn a)))
  writerOutput = mealy mmmult2dwriter (emptyMatrix nullMatrix, counter) dotfOutput
```

And that's it! You'll find this version in `MatrixMultiplication.Pipelined`. Because the whole design is polymorphic in its element type, `MatrixMultiplication.Top` only has to pick concrete types to get a synthesizable design: two *4x4* matrices of `Signed 16`, multiplied using *2x2* submatrices.

```haskell
topEntity ::
  Clock System ->
  Reset System ->
  Enable System ->
  Signal System (Maybe (Matrix 4 4 (Signed 16), Matrix 4 4 (Signed 16))) ->
  Signal System (Maybe (Matrix 4 4 (Signed 16)))
topEntity = exposeClockResetEnable (mmmult2d d2 d2 d2)
```

Run `stack run clash -- MatrixMultiplication.Top --vhdl` and find the result in `vhdl/`.

# Conclusion and reflection
We’ve implemented a pipelined matrix multiplication algorithm, parameterizable in such a way that we can easily make a time/space trade-off. During the implementation we’ve seen a lot of constructs in Clash. This section will go over some critiques.

## Delayed signals: what are they *really*?
Delayed signals are an enormously helpful tool in Clash’s toolbox, but it is unclear what the exact semantics of a delayed signal actually are. In our design we've used it in a pipelined manner, that is: we treat a delayed function f as if it were a non-stateful function but simply with a delay between its in- and output. This is not enforced by the type system in any way though (unclear if that’s even remotely possible), and we can think of at least four other meanings of “delayed”:

1. A delay of *four* could mean inputs and outputs are only valid every 4nth cycle. That is, after supplying an input one should wait for a few clock for an answer. This is incidentally what we do dynamically using a Maybe type in our top-level function `mmmult2d`.

2. A delay of *four* could simply mean the first inputs are ignored and the very first four outputs should be ignored. This could have been used for storing partial results in our matrix multiplication algorithm: the dot product only yields valid results after some time anyway.

3. A delay of *four* could mean the first four inputs are accepted, but the first four outputs should be ignored. For example, imagine a simple moving average function. Internally it maintains a buffer containing a number of elements. A new incoming element will “push” the oldest value out of its buffer. The output is the average of all values. This would potentially (depending on your goal) be an invalid output for the first few averages.

4. A delay of *four* could mean the first four inputs are ignored, but the outputs are already valid.

In fact, it’s not even clear what a “delay” means for a signal on its own. I’d argue that what we actually want to express is a notion of “scheduled validness” or its converse “scheduled undefinedness”. I.e., a signal’s validness could then be defined as the pseudocode:

```haskell
KnownNat p => KnownNat k => forall n. Signal dom (n*p + k) a
```

Where *p* is a period, *k* is an offset and *n* is a natural number. The first valid value for this signal is expressed by *k*, while it would also produce a valid value for *k+p*, *k+2p*, … . An actual definition of such a “scheduled signal” could look like:

```haskell
data SSignal (period :: Nat, offset :: Nat) (dom :: Domain) a = ...
```

where a “normal” Signal could be expressed as:

```haskell
type Signal (dom :: Domain) a = SSignal (1, 0) dom a
```

Various methods could be implemented to make it easy to work with and synchronize otherwise out-of-step signals:

```haskell
-- | Sync offsets by buffering
syncOffset ::
  SSignal dom (pb, oa + o) b ->
  SSignal dom (pa, oa) a ->
  SSignal dom (pa, oa + o) a
syncOffset _ = ...

-- | Sync periods by buffering
syncPeriod ::
  (p ~ LCM pa pb, p ~ npa * pa, p ~ npb * pb) =>
  SSignal dom (pa, o) a ->
  SSignal dom (pb, o) b ->
  SSignal dom (p, p+o) (Vec npa a, Vec npb b)
syncPeriod a b = ...

-- | Synchronize signals's periods and offsets
sync a b =
  syncPeriod (syncOffset a b) b
```

Scheduling information could even be used to automatically enable and disable circuits, depending on how they’re combined with other slower circuits.

All in all, Clash could do with much better integrated support for “delayed” signals. Having this concept at a type level could prove very useful indeed. Most importantly, it could give the programmer a sense of security knowing the compiler checked for synchronization mismatches. Perhaps a future blogpost could work something out..

## Pipelining: we need a stdlib

Clash pipelining capabilities are quite powerful. In combination with delayed signals dependently typed folds are capable of providing a relatively easy way of inserting registers at the right places. While existing functions in Clash cover this, specialized functions for pipelining circuits could provide a more comfortable way of dealing with dependently typed folds. While writing this blogpost, we developed two (see `MatrixMultiplication.Pipeline` in the repository):

```haskell
-- | Pipelined foldr. Function itself is not pipelined, but a single register
-- will be added after it.
foldrp ::
  forall dom a b startDelay n.
  (HiddenClockResetEnable dom, KnownNat n, NFDataX a, NFDataX b) =>
  -- | f
  (a -> b -> b) ->
  -- | Default output
  b ->
  -- | Default input
  a ->
  -- | Vector to fold over
  DSignal dom startDelay (Vec n a) ->
  -- | Start value
  DSignal dom startDelay b ->
  DSignal dom (startDelay + n) b
```

and

```haskell
-- | Pipelined foldr. Function itself might be pipelined.
foldrpp ::
  forall dom a b procDelay startDelay n.
  (HiddenClockResetEnable dom, KnownNat n, KnownNat procDelay, NFDataX a) =>
  -- | Possibly pipelined function
  (forall l. DSignal dom l a -> DSignal dom l b -> DSignal dom (l + procDelay) b) ->
  -- | Default input
  a ->
  -- | Vector to fold over
  DSignal dom startDelay (Vec n a) ->
  -- | Start value
  DSignal dom startDelay b ->
  DSignal dom (startDelay + (n * procDelay)) b
```

While this helped a lot, the fact that we had to write it ourselves is less than ideal. Clash should provide constructs like these in an officially supported library.

# FAQ

## What is `KnownNat n`?
Like *Num*, *KnownNat* is a typeclass. This class does not implement any interesting functions, but allows code to access compile-time numbers (such as the length of a vector) at runtime. If you forget to add a constraint, you might get an error looking like:

```
src/Faq1.hs:6:11: error: [GHC-39999]
    • Could not deduce ‘KnownNat n’ arising from a use of ‘sum’
      from the context: Num a
        bound by the type signature for:
                   dot :: forall a (n :: Nat). Num a => Vec n a -> Vec n a -> a
        at src/Faq1.hs:5:1-41
      Possible fix:
        add (KnownNat n) to the context of
          the type signature for:
            dot :: forall a (n :: Nat). Num a => Vec n a -> Vec n a -> a
    • In the expression: sum (zipWith (*) a b)
      In an equation for ‘dot’: dot a b = sum (zipWith (*) a b)
  |
6 | dot a b = sum (zipWith (*) a b)
  |           ^^^
```

In this case, `sum` needs to access the number `n` at runtime, but the function `dot` didn't require it.

## What does `Couldn't match type ‘ax’ with ‘by’` mean?
If you forgot to include `ax ~ by` you might have seen an error saying Clash figured out that `ax` and `by` should be equal, but that it can’t prove it.

```
src/Faq2.hs:13:53: error: [GHC-25897]
    • Couldn't match type ‘ax’ with ‘by’
      Expected: Vec ay (Vec by a)
        Actual: Vec ay (Vec ax a)
      ‘ax’ is a rigid type variable bound by
        the type signature for:
          mmult :: forall (ax :: Nat) (bx :: Nat) a (ay :: Nat) (by :: Nat).
                   (KnownNat ax, KnownNat bx, Num a) =>
                   Vec ay (Vec ax a) -> Vec by (Vec bx a) -> Vec ay (Vec bx a)
        at src/Faq2.hs:(8,1)-(12,19)
      ‘by’ is a rigid type variable bound by
        the type signature for:
          mmult :: forall (ax :: Nat) (bx :: Nat) a (ay :: Nat) (by :: Nat).
                   (KnownNat ax, KnownNat bx, Num a) =>
                   Vec ay (Vec ax a) -> Vec by (Vec bx a) -> Vec ay (Vec bx a)
        at src/Faq2.hs:(8,1)-(12,19)
    • In the second argument of ‘map’, namely ‘a’
      In the expression: map (\ ar -> map (dot ar) (transpose b)) a
      In an equation for ‘mmult’:
          mmult a b = map (\ ar -> map (dot ar) (transpose b)) a
    • Relevant bindings include
        b :: Vec by (Vec bx a)
          (bound at src/Faq2.hs:13:9)
        a :: Vec ay (Vec ax a)
          (bound at src/Faq2.hs:13:7)
        mmult :: Vec ay (Vec ax a)
                 -> Vec by (Vec bx a) -> Vec ay (Vec bx a)
          (bound at src/Faq2.hs:13:1)
   |
13 | mmult a b = map (\ar -> map (dot ar) (transpose b)) a
   |                                                     ^
```

Although not quite obvious, this constraint is requested by `dot` (in this case), which asks for its given vectors to be of equal length. Of course, this is exactly what we want! Matrix multiplications don’t make sense if `ax` differs from `by`.
