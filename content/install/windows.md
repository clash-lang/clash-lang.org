---
identifier: install-clash-windows
title: Install Clash on Windows
disable_comments: true
---

<link rel="stylesheet" href="/css/install.css">

# 1. Choose your platform
<div id="platform-select" class="button-group">
    <a href="/install/windows"><button class="button active">{{% fontawesome windows-brands %}}<br>Windows</button>
    </a><a href="/install/macos"><button class="button">{{% fontawesome apple-brands %}}<br>macOS</button>
    </a><a href="/install/linux"><button class="button">{{% fontawesome linux-brands %}}<br>Linux</button>
    </a>
</div>

<br/>
<br/>

# 2. Install Stack

Download Stack from [get.haskellstack.org](https://get.haskellstack.org/stable/windows-x86_64-installer.exe) and install it. Stack is a build tool for Haskell / Clash projects.

# 3. Setup Clash

To setup a new project based on the provided starter projects, run:

```
stack new my-clash-project clash-lang/simple
```

This will create a new project called `my-clash-project` in a folder with the same name. The folder will contain a `README.md` to get you up and running. Alternatively, you [can read it online](https://github.com/clash-lang/clash-starters/tree/main/simple#simple-starter-project).

### Alternatives

A starter project using Stack is the recommended way to use Clash, and is fully supported. Alternative methods sometimes exhibit issues that can be confusing even to people used to working with GHC, since Clash is pretty non-standard. Clash is a modification to the GHC compiler rather than a normal Haskell package, and it uses several GHC plugins to extend the functionality of type-level naturals, which are extensively used in Clash designs.

#### Run Clash on its own
The following compiles the file [`ShortBlinker.hs`](/code/ShortBlinker.hs) to VHDL:

```
stack exec --resolver nightly-2025-03-01 --package clash-ghc -- clash ShortBlinker.hs -Wall --vhdl
```

(The option `-Wall` turns on many warnings that are turned off by default.)
