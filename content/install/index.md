---
identifier: install-clash
title: Install Clash
disable_comments: true
---

Binary distributions are not available for Windows and macOS. _Please file a [bug report](https://github.com/clash-lang/clash-lang.org/issues) if the following installation instructions do not work for you._

## Linux (binary)


Clash is released as a binary package on snapcraft. Snap is supported on all major Linux distributions. Visit [Clash's snapcraft page](https://snapcraft.io/clash)  scroll down, and choose your distribution for installation instructions. To install the latest stable version, use:

```bash
snap install clash
```

To install the latest development version of Clash, run:

```bash
snap install clash --edge
```

This version is updated every 24 hours.

## Linux / macOS (source)

Install [the latest nix](https://nixos.org/nix/download.html) and run:

```bash
curl -s -L https://github.com/clash-lang/clash-compiler/archive/1.2.tar.gz | tar xz
nix-shell clash-compiler-1.2/shell.nix
```

You can find other install instructions (using Cabal or Stack) [on github.com/clash-lang/clash-compiler](https://github.com/clash-lang/clash-compiler/tree/1.0#using-clash-from-source).

## Windows (source)

(**Windows 10 2004 build or Insider preview**: The instructions below do not work if you are running the very latest 2004 build or an insider preview of Windows 10 due to an upstream bug. See further details and a work-around [here](https://github.com/clash-lang/clash-compiler/issues/1290))

1. Install [Stack](https://get.haskellstack.org/stable/windows-x86_64-installer.exe)
2. Download [the source code](https://github.com/clash-lang/clash-compiler/archive/1.2.zip) of Clash 1.2
3. Unpack the archive
4. Use `cd` to navigate to the unpacked directory
5. Run: `stack build clash-ghc`. [This will take a while.](https://xkcd.com/303/)

Try to compile one of the examples to see if it works:

```
stack run clash -- examples/Blinker.hs --vhdl
```

You can use `clashi` by invoking:

```
stack run clashi
```

<style>
.post__title{ display:none; }
</style>
