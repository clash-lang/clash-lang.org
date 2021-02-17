---
identifier: install-clash-macos
title: Install Clash on macOS
disable_comments: true
---

<link rel="stylesheet" href="/css/install.css">

# 1. Choose your platform
<div id="platform-select">
  <a style="color:black;" href="/install/windows">{{% fontawesome windows-brands %}}</a>
  <a href="/install/macos">{{% fontawesome apple-brands %}}</a>
  <a style="color:black;" href="/install/linux">{{% fontawesome linux-brands %}}</a>
</div>

<br/>

# 2. Install Stack

Use `brew install haskell-stack` or [manually install it](https://docs.haskellstack.org/en/stable/README/#how-to-install). Stack is a build tool for Haskell / Clash projects.

_If you want to setup a Clash project with Cabal instead, read [the starter project's README.md](https://github.com/clash-lang/clash-starters/tree/main/simple#simple-starter-project)._

# 3. Setup Clash
Depending on your goals, you might want to simply run Clash on its own, or setup a proper project. The first one will get you up and running quickly and you won't have to learn build tools. However, you won't be able to use dependencies from [Hackage](https://hackage.haskell.org/) and it is harder to get a consistent build environment.

### Option A. Run Clash on its own
The following compiles a file `HelloWorld.hs` to VHDL:

```
stack exec --package clash-ghc -- clash HelloWorld.hs --vhdl
```

### Option B. Setup a project
To setup a new project, run:

```
stack new my-clash-project clash-lang/simple
```

This will create a new project called `my-clash-project` in a folder named the same. The folder will contain a `README.md` to get you up and running. Alternatively, you [can read it online](https://github.com/clash-lang/clash-starters/tree/main/simple#simple-starter-project). People familiar with the Haskell ecosystem might prefer to use Cabal instead. To do so, [download the starter project as a zip](https://raw.githubusercontent.com/clash-lang/clash-starters/main/simple.zip) and follow the instructions in `README.md`.
