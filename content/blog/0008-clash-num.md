---
title: "Putting a Clash Coat of Paint on Rust"
date: "2025-12-23"
description: "Reproducing Clash's numeric types in Rust"
disable_comments: false
author: "ryanslawson"
authorbox: true
summary: "With the introduction of [`clash-protocols-memmap`][cpm] and [`clash-bitpackc`][bpc], it
  seemed a good idea to create matching `BitVec<N>`, `Unsigned<N>`, `Signed<N>`, and `Index<N>` types in Rust. Let's talk about how we can make this happen."
toc: true
mathjax: true
categories:
  - "Tutorial"
tags:
  - "Clash internals"
  - "Rust"
  - "Design"
---

# Introduction

So somewhat recently in the [Bittide][bittide] project, we added two very useful libraries:
[`clash-protocols-memmap`][cpm] and [`clash-bitpackc`][bpc]. `clash-protocols-memmap` provides a way
to build memory mapped peripherals for embedded systems that gives you a register mapping "for free"
(with some opt-in cost). Combined with a code generator, you can simply write a component using this
library and get a Rust crate or C library that will handle the raw register operations that talk to
your peripheral. This library is built on top of `clash-bitpackc`, which introduces typeclasses that
ask you to tell Clash how to pack your Haskell types into C ABI-compatible registers.

# The problem

Generally, when you use `clash-protocols-memmap` and `clash-bitpackc`, the goal is that they should
be as transparent as possible to the user. That is to say, when they're writing code to interact
with a memory mapped component, the types they work with should look as close as possible to the
ones they dealt with when creating the component.

So then, what if you want to have a register for a `BitVector n`, `Unsigned n`, `Signed n`, or
`Index n`? Currently, `clash-bitpackc` and `clash-protocols-memmap` do some up-front
monomorphization: a `BitVector 3` becomes a `[u8; 1]` in Rust (or a `uint8_t*` in C), an
`Unsigned 18` becomes a `u32`, and so on. While it's true that these are the correct representations
of these types, I found it unsatisfactory that writing a component with an `Index 107`  in Clash
would then require the user to talk about a `u8` in Rust. As such, I started work on the `clash-num`
repository.

# Limits

The `n` in each of the Clash types is of kind `Natural`, which is an arbitrary precision number.
Unfortunately, Rust doesn't have a primitive type with support for arbitrary precision, and const
generics (without an experimental nightly feature) are limited to a subset of primitive types:
`bool`, `char`, `u8`, `u16`, `u32`, `u64`, `u128`, `usize`, `i8`, `i16`, `i32`, `i64`, `i128`, and
`isize`. Keeping this in mind, then, let's choose types for const generic of each of our Clash
types:
- `Index n` => `Index<const N: u128>`
- `Unsigned n` => `Index<const N: u8>`
- `Signed n` => `Signed<const N: u8>`
- `BitVector n` => `BitVec<const N: usize>`

## Why `u8` on `Signed` and `Unsigned`?

See, the thing is: if we want to implement things like `Add` for all `Signed<N>`, then we need to
create implementations that are generic over the backing type. This means that we have to be able
to constrain that the backing type implements `Add`, or an `Add`-like trait. We can imagine that the
backing type of, say, a `Signed<256>` would be a `[u8; 32]`, or maybe a
`[usize; 256 / usize::BITS as usize]`. But there isn't an implementation of an `Add`-like
trait for `[T; N]`, so we would have to make a new `SignedAdd` trait that wraps the `Add` impls for
the smaller type representations (`u8`, `u16`, ...) and then create an implementation for `[T; N]`.
Then we would be able to be generic over the backing type by constraining on `SignedAdd`. I didn't
choose to do this for two reasons:
1. This adds a _lot_ of additional design complexity to the `clash-num` crate that I hoped to avoid
2. Don't. Don't make an `Unsigned 256`, or `Signed 1024`. Stop it. I'm going to take away your
   keyboard.

So: no "arbitrary"-sized `Signed` and `Unsigned`.

# Turning const generics into type representations

So as stated before, we want to have an `Index<const N: u128>`. To make this happen, we need two
things:
1. A trait that provides an associated type, which will be used as the type representation
2. Implementations of that trait over relevant ranges of `N`

With these things, our type definition for `Index` can look like this:
```rust
// Given some `GetIndexRepr<N>`, a type alias that accesses an associated type that provides the
// appropriate type representation for a given size `N`.
pub struct Index<const N: u8>(pub(crate) GetIndexRepr<N>);
```
Now as for the trait that provides the associated type and its `impl`s, there's two methods to do
this that I know of.

## Method 1: Specialization

I believe that this is the easier to understand way to map a const generic to a type. For this
method we will need two things: a marker type with a const `bool` parameter, and a marker type with
a const `u8` parameter which we will create specialized `impl`s on to provide the backing type.
```rust
#![feature(specialization)]
#![allow(incomplete_features)]

pub const ConstCheck<const B: bool>;
pub trait True {}
impl True for ConstCheck<true> {}
pub trait False {}
impl False for ConstCheck<false> {}

pub struct IndexMarker<const N: u128>;

pub trait IndexRepr {
    type Repr;

    fn bounds_check(val: &Self::Repr) -> bool;
}

// Base impl
default impl<const N: u128> IndexRepr for IndexMarker<N> {
    type Repr = u128;
    // ...
}

// Introduce one additional constraint each time for successive `impl`s:
default impl<const N: u128> IndexRepr for IndexMarker<N>
where
    ConstCheck<{ N <= u64::MAX as u128 + 1 }>: True,
{
    type Repr = u64;
    // ...
}

default impl<const N: u128> IndexRepr for IndexMarker<N>
where
    ConstCheck<{ N <= u64::MAX as u128 + 1 }>: True,
    ConstCheck<{ N <= u32::MAX as u128 + 1 }>: True,
{
    type Repr = u32;
    // ...
}

default impl<const N: u128> IndexRepr for IndexMarker<N>
where
    ConstCheck<{ N <= u64::MAX as u128 + 1 }>: True,
    ConstCheck<{ N <= u32::MAX as u128 + 1 }>: True,
    ConstCheck<{ N <= u16::MAX as u128 + 1 }>: True,
{
    type Repr = u16;
    // ...
}

impl<const N: u128> IndexRepr for IndexMarker<N>
where
    ConstCheck<{ N <= u64::MAX as u128 + 1 }>: True,
    ConstCheck<{ N <= u32::MAX as u128 + 1 }>: True,
    ConstCheck<{ N <= u16::MAX as u128 + 1 }>: True,
    ConstCheck<{ N <= u8::MAX as u128 + 1 }>: True,
{
    type Repr = u8;
    // ...
}

// And now the type alias:
pub type GetIndexRepr<const N: u128> = <IndexMarker<N> as IndexRepr>::Repr;
```
This specialization chain now correctly provides the backing type for a given `Index<N>`. And it
even allows us to write generic versions very cleanly! We can write
```rust
impl<const N: u128> Index<N> {
    // ...
}
```
And there's no need for any `where` clause, since the base of our specialization chain is over _all_
`N: u128`. But here's the big issue: _associated types in specialization chains are opaque_. That
leads to the following issue:
```rust
impl<const N: u128> Index<N> {
    // Note the type of `val` in this definition:
    pub fn new(val: GetIndexRepr<N>) -> Option<Index<N>> {
        if IndexMarker<N>::bounds_check(&val) {
            Some(Index(val))
        } else {
            None
        }
    }
}

fn main() {
    let foo: Index<13> = Index::new(10u8).unwrap(); // ERROR
    // ...
}
```
We will get an error here saying that `u8` is not the type `<IndexMarker<13> as IndexRepr>::Repr`.
That's... very annoying. This method of doing things may be useful if we were sticking to more
type-level computations and not really lowering to value-level, but that's unfortunately not what
we're working with here. So, how do we avoid it?

## Method 2: Generic const expressions

We're instead going to use the `generic_const_exprs` feature in a construction I like to call a
trait look-up table or trait LUT. For this we need to do two things:
1. Write a function that maps `u128`s to table keys (which will be of type `u8`)
2. Change the marker type to include both the `N` bound as well as the table key

Let's see what that looks like:
```rust
#![feature(generic_const_exprs)]
#![allow(incomplete_features)]

pub const fn index_size(n: u128) -> u8 {
    if n == 0 {
        panic!("Cannot represent `Index<0>`!");
    } else if n <= u8::MAX as u128 + 1 {
        8
    } else if n <= u16::MAX as u128 + 1 {
        16
    } else if n <= u32::MAX as u128 + 1 {
        32
    } else if n <= u64::MAX as u128 + 1 {
        64
    } else {
        128
    }
}


pub struct IndexMarker<const M: u128, const N: u8>;

pub trait IndexRepr {
    type Repr;

    fn bounds_check(val: &Self::Repr) -> bool;
}

impl<const N: u128> IndexRepr for IndexMarker<N, 8> {
    type Repr = u8;
    // ...
}

impl<const N: u128> IndexRepr for IndexMarker<N, 16> {
    type Repr = u16;
    // ...
}

impl<const N: u128> IndexRepr for IndexMarker<N, 32> {
    type Repr = u32;
    // ...
}

impl<const N: u128> IndexRepr for IndexMarker<N, 64> {
    type Repr = u64;
    // ...
}

impl<const N: u128> IndexRepr for IndexMarker<N, 128> {
    type Repr = u128;
    // ...
}

// And now we redefine the type alias a bit
pub type IndexLut<const N: u128> = IndexMarker<N, { index_size(N) }>;
pub type GetIndexRepr<const N: u128> = <IndexLut<N> as IndexRepr>::Repr;
```
Now we can write generic implementations again, except...
```rust
impl<const N: u128> Index<N>
where
    IndexLut<N>: IndexRepr, // ...it's now necessary to have this `where` clause bound.
{
    // ...
}
```
The nice thing here though is that these associated types _are_ fully transparent. So the example
from before (with the new `where` clause) actually works:
```rust
impl<const N: u128> Index<N>
where
    IndexLut<N>: IndexRepr,
{
    // Note the type of `val` in this definition:
    pub fn new(val: GetIndexRepr<N>) -> Option<Index<N>> {
        if IndexMarker<N>::bounds_check(&val) {
            Some(Index(val))
        } else {
            None
        }
    }
}

fn main() {
    let foo: Index<13> = Index::new(10u8).unwrap(); // Works fine!
    // ...
}
```
Since this produces desirable behaviour on the user end while only requiring some minor
inconvenience on the part of library writers. We can then replicate this pattern and get the same
desired result for the other types, though to see that I would ask that you refer to the actual
[`clash-num`][num] repository.

# Conclusions

Well, to begin with, we decided not to use this (for now) in Bittide since it's relying on an
incomplete nightly feature that we're not super sure we want to use in production software at time
of writing. We may use it in the future should there be a strong enough reason for us to use it over
what we plan to do instead. I did still think that it was useful enough if you don't mind opting in
to that that it warranted publishing _somewhere_.

As for what it was like writing this - honestly, it was pretty nice once I figured out that what I
should be working with is the trait LUT method rather than specialization. I plan to use this method
in other things as well, since I have some other projects that use const generics to inform
associated types (such as canonicalizing something that looks like [homogeneous lists][hlist]). The
trait LUT pattern is really great for such cases, and honestly I wish it was written down more
clearly in more places, since it would've saved me a lot of time getting started with this project.

I'm also quite a fan of using these `const fn`s to do the mapping, since it's a lot easier to insert
failure cases at the `fn` level as compared to the type level, and especially since you can much
more clearly tell the user _why_ it doesn't work rather than just them seeing an error that a trait
isn't implemented for your type. Instead, you can take a look at the type and say exactly what's
wrong in a panic message.

Someone should really work on stabilizing `generic_const_exprs` or something.

[bittide]: https://github.com/bittide/bittide-hardware
[cpm]: https://github.com/bittide/bittide-hardware/tree/main/clash-protocols-memmap
[bpc]: https://github.com/bittide/bittide-hardware/tree/main/clash-bitpackc
[num]: https://github.com/QBayLogic/clash-num
[hlist]: https://hackage.haskell.org/package/hlist-0.0.0.0/docs/Data-HList.html
