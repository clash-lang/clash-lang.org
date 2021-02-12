---
identifier: install-clash-linux
title: Install Clash on Linux
disable_comments: true
---

<link rel="stylesheet" href="/css/install.css">

# 1. Choose your platform
<div id="platform-select">
  <a style="color:black;" href="/install/windows">{{% fontawesome windows-brands %}}</a>
  <a style="color:black;" href="/install/macos">{{% fontawesome apple-brands %}}</a>
  <a href="/install/linux">{{% fontawesome linux-brands %}}</a>
</div>

<br/>

# 2. Setup Clash
Depending on your goals, you might want to simply run Clash on its own, or setup a proper project. The first one will get you up and running quickly and you won't have to learn build tools. However, you won't be able to use dependencies from [Hackage](https://hackage.haskell.org/) and it is harder to get a consistent build environment.

### Option A. Run Clash on its own

Either:

 * Install Clash using `snap`: see [snapcraft.io/clash](https://snapcraft.io/clash);
 * Run `clash HelloWorld.hs --vhdl` to compile `HelloWorld.hs` to VHDL.

..or:

 * [Install Stack](https://docs.haskellstack.org/en/stable/README/#how-to-install). Stack is a build tool for Haskell / Clash projects;
 * Run `stack exec --package clash-ghc -- clash HelloWorld.hs --vhdl` to compile `HelloWorld.hs` to VHDL.

### Option B. Setup a project
To setup a new project, [install Stack](https://docs.haskellstack.org/en/stable/README/#how-to-install) and run:

```
stack new my-clash-project clash-lang/simple
```

This will create a new project called `my-clash-project` in a folder named the same. The folder will contain a `README.md` to get you up and running. Alternatively, you [can read it online](https://github.com/clash-lang/clash-starters/tree/main/simple#simple-starter-project). People familiar with the Haskell ecosystem might prefer to use Cabal instead. To do so, [download the starter project as a zip](https://raw.githubusercontent.com/clash-lang/clash-starters/main/simple.zip) and follow the instructions in `README.md`.
