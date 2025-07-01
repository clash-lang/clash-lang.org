---
identifier: ecosystem
title: Clash Ecosystem
disable_comments: true
---

# Ecosystem

Here you can find a list of projects that might be helpful for you!

## Tried and tested

These packages work with the latest Clash version (1.8.2)

### [`clash-protocols`](https://github.com/clash-lang/clash-protocols)

A battery-included library for writing on-chip protocols, such as AMBA AXI and Altera Avalon.

{{< details summary="Adding to the starter project">}}
  Make sure to add/insert this to your `stack.yaml`file:
  ```yaml
  extra-deps:
    - git: https://github.com/clash-lang/clash-protocols.git
      commit: 8b6a7695161c2bada9d1373c6fcaf0da887c787a
    - git: https://github.com/cchalmers/circuit-notation.git
      commit: 564769c52aa05b90f81bbc898b7af7087d96613d
  ```
  and this to your `project.cabal` file
  ```yaml
  build-depends:
    , clash-protocols
    , circuit-notation
  ```
{{< /details >}}


### [`clash-cores`](https://github.com/clash-lang/clash-cores)

A collection of Clash IP cores, including: SPI master; UART; CRC; Etherbone; 8b10b line encoder/decoder; SGMII PCS receiver/transmitter; various wrappers around AMD FPGA IPs/primitives (blockRam, dcfifo, floating, ila, xpm, etc.)

{{< details summary="Adding to the starter project">}}
  Make sure to add/insert this to your `stack.yaml`file:
  ```yaml
  extra-deps:
    - git: https://github.com/clash-lang/clash-protocols.git
      commit: 8b6a7695161c2bada9d1373c6fcaf0da887c787a
    - git: https://github.com/cchalmers/circuit-notation.git
      commit: 564769c52aa05b90f81bbc898b7af7087d96613d
    - git: https://github.com/clash-lang/clash-cores.git
      commit: f710a1cbfaa3ea6d07f4454cf01d069487f3bab2
  ```
  and this to your `project.cabal` file
  ```yaml
  build-depends:
    , clash-cores
  ```
{{< /details >}}


### [`ice40-prim`](https://github.com/standardsemiconductor/ice40-prim)

Clash primitives to instantiate Lattice Semiconductor's iCE40 FPGA hard IP

{{< details summary="Adding to the starter project">}}
  Make sure to add/insert this to your `stack.yaml`file:
  ```yaml
  extra-deps:
    - ice40-prim-0.3.1.4@sha256:c1b5217b79a2aec1eff4ca1a5f3ecf4e2daf70a2e6d3219435086ac6fe4b70c4,2779
  ```
  and this to your `project.cabal` file
  ```yaml
  build-depends:
    , ice40-prim
  ```
{{< /details >}}

## Just need a quick update

These packages do work with latest clash, but might need a manual version bump here and there.

### [`clash-shake`](https://github.com/gergoerdi/clash-shake)

Shake (a build system) rules for building Clash programs and synthesizing FPGA. Contains build rules for AMD ISE, AMD Vivado, Altera Quartus, F4PGA for Xilinx, and Yosys for ECP-5 and toolchains.

**Builds with Clash 1.8.2, needs a new `stack.yaml` to pick LTS-23**

{{< details summary="Adding to the starter project">}}
  Make sure to add/insert this to your `stack.yaml`file:
  ```yaml
  extra-deps:
    - git: https://github.com/gergoerdi/clash-shake.git
      commit: 409824bceb442888fab4dc70265c05d870dfd0f0
  ```
  and this to your `project.cabal` file
  ```yaml
  build-depends:
    , clash-shake
  ```
{{< /details >}}

### [`clash-utils`](https://github.com/adamwalker/clash-utils)

`clash-utils` is a collection of reusable clash designs, IP wrappers and components.

**A [PR](https://github.com/adamwalker/clash-utils/pull/16) to update `clash-utils` to Clash 1.8.2 is open but not yet merged**

The installation instructions below use the updated version from the linked PR.

{{< details summary="Adding to the starter project">}}
  Make sure to add/insert this to your `stack.yaml`file:
  ```yaml
  extra-deps:
    - git: https://github.com/hydrolarus/clash-utils.git
      commit: 59151d9f94737dc052f24237c74700af1ccca658
  ```
  and this to your `project.cabal` file
  ```yaml
  build-depends:
    , clash-utils
  ```
{{< /details >}}


## Only works on older versions of Clash

### [`clash-wavedrom`](https://github.com/expipiplus1/clash-wavedrom)

Generate wave diagrams from Clash with [WaveDrom](https://wavedrom.com/).

**Does not build with Clash 1.8, needs to be updated.**

## Needs unreleased Clash version

### [`clash-vexriscv`](https://github.com/clash-lang/clash-vexriscv)

A [VexRiscv](https://github.com/SpinalHDL/VexRiscv) based CPU core and bindings for use in Clash. The CPU can be simulated in Clash simulation through co-simulation with Verilator. The core interfaces with other components via [Wishbone](https://cdn.opencores.org/downloads/wbspec_b4.pdf) interfaces, using [`clash-protocols`](https://github.com/clash-lang/clash-protocols) types.

## Unknown

- [`clashilator`](https://github.com/gergoerdi/clashilator)
- [`clash-axi`](https://git.smart-cactus.org/ben/clash-axi)
- [`clash-port-name`](https://git.smart-cactus.org/ben/clash-port-name)
- [`clash-testbench`](https://git.smart-cactus.org/ben/clash-testbench)
- [`axi-register`](https://git.smart-cactus.org/ben/axi-register)


<style>
.post__title{ display:none; }
</style>
