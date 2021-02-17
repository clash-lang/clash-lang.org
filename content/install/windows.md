---
identifier: install-clash-windows
title: Install Clash on Windows
disable_comments: true
---

<link rel="stylesheet" href="/css/install.css">

# 1. Choose your platform
<div id="platform-select">
  <a href="/install/windows">{{% fontawesome windows-brands %}}</a>
  <a style="color:black;" href="/install/macos">{{% fontawesome apple-brands %}}</a>
  <a style="color:black;" href="/install/linux">{{% fontawesome linux-brands %}}</a>
</div>

<br/>

# 2. Install Stack

Download Stack from [get.haskellstack.org](https://get.haskellstack.org/stable/windows-x86_64-installer.exe) and install it. Stack is a build tool for Haskell / Clash projects.

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

This will create a new project called `my-clash-project` in a folder named the same. The folder will contain a `README.md` to get you up and running. Alternatively, you [can read it online](https://github.com/clash-lang/clash-starters/tree/main/simple#simple-starter-project).
