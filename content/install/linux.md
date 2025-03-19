---
identifier: install-clash-linux
title: Install Clash on Linux
disable_comments: true
---

<link rel="stylesheet" href="/css/install.css">

# 1. Choose your platform
<div id="platform-select" class="button-group">
    <a href="/install/windows"><button class="button">{{% fontawesome windows-brands %}}<br>Windows</button>
    </a><a href="/install/macos"><button class="button">{{% fontawesome apple-brands %}}<br>macOS</button>
    </a><a href="/install/linux"><button class="button active">{{% fontawesome linux-brands %}}<br>Linux</button>
    </a>
</div>

<br/>
<br/>

# 2. Install Stack

[Install Stack](https://docs.haskellstack.org/en/stable/README/#how-to-install). Stack is a build tool for Haskell / Clash projects.

# 3. Setup Clash

To setup a new project based on the provided starter projects, run:

```
stack new my-clash-project clash-lang/simple
```

This will create a new project called `my-clash-project` in a folder with the same name. The folder will contain a `README.md` to get you up and running. Alternatively, you [can read it online](https://github.com/clash-lang/clash-starters/tree/main/simple#simple-starter-project).

### Alternatives

A starter project using Stack is the recommended way to use Clash, and is fully supported. Alternative methods sometimes exhibit issues that can be confusing even to people used to working with GHC, since Clash is pretty non-standard. Clash is a modification to the GHC compiler rather than a normal Haskell package, and it uses several GHC plugins to extend the functionality of type-level naturals, which are extensively used in Clash designs.

#### Starter project with Cabal

 People familiar with the Haskell ecosystem might prefer to use Cabal instead of Stack. To do so, [download the starter project as a zip](https://raw.githubusercontent.com/clash-lang/clash-starters/main/simple.zip) and follow the instructions in [`README.md`](https://github.com/clash-lang/clash-starters/tree/main/simple#simple-starter-project).

#### Run Clash on its own
The following compiles the file <a href="/code/ShortBlinker.hs" download>`ShortBlinker.hs`</a> to VHDL:

```
stack exec --resolver lts-23.15 --package clash-ghc -- clash ShortBlinker.hs --vhdl
```

The resulting HDL should be very similar to the following:

* `--vhdl`: <a href="/code/ShortBlinker/topEntity.vhdl" download>`topEntity.vhdl`</a>
* `--verilog`: <a href="/code/ShortBlinker/topEntity.v" download>`topEntity.v`</a>
* `--systemverilog`: <a href="/code/ShortBlinker/topEntity.sv" download>`topEntity.sv`</a>
