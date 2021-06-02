---
title: "Getting started with Clash on the Arrow DECA devkit"
date: "2021-06-01"
description: "Quickly set up a Clash project for the Arrow DECA development board"
disable_comments: false
author: "christiaanbaaij"
authorbox: true # Optional, enable authorbox for specific post
summary: Using a stack project template you can easily set up a new project for the Arrow DECA development board which contains an Intel MAX10 FPGA (50K LEs; 1638 Kbit memory) and a lot of peripherals (10/100 Mbps EtherNet; HDMI TX; USB 2.0 PHY; audio CODEC; etc). The project template contains and LED-blinker created in Clash and a Quartus project that automatically loads the Clash generated files.
toc: false
mathjax: false
---

It is now easier to get started with Clash on the
[Arrow DECA development kit](https://www.arrow.com/en/products/deca/arrow-development-tools).
with the release of the [DECA Starter Project](https://github.com/clash-lang/clash-starters/blob/main/deca/README.md).

The DECA development kit is an inexpensive ($37 ex. VAT at the time of writing) FPGA development kit with a lot of peripherals and has a decent-sized FPGA for many projects:

* FPGA Device
  *  MAX 10 10M50DAF484C6G Device
  *  Integrated dual ADCs, each ADC supports 1 dedicated analog input and 8 dual function pins
  *  50K programmable logic elements
  *  1,638 Kbits embedded memory
  *  5,888 Kbits user flash memory
  *  144 embedded 18x18 multipliers
  *  4 PLLs
* Configuration and Debug
  * Onboard USB-Blaster II (Mini USB type B connector)
* Memory devices
  * 512 MB DDR3 SDRAM (16-bit data bus)
  * 64 MB QSPI Flash
  * Micro SD card socket
* Communication
  * 10/100 Mbps Ethernet PHY with RJ45 connector
  * USB 2.0 PHY with Mini USB type AB connector
* Connectors
  * Two 46-pin BeagleBone expansion headers
  * Two MAX 10 FPGA ADC SMA inputs
* Display
  * HDMI TX, incorporates HDMI v1.4 features, including 3D video supporting
* Audio
  * 24-bit CD-quality audio CODEC with line-in, line-out jacks
* Video Input
  * MIPI CSI-2 camera interface (using a Hirose DF40C-30DS-0.4V receptacle, needs a DF40C-30DP-0.4V connector)
* Analog
  * Two MAX 10 FPGA ADC SMA inputs
  * Seven MAX 10 FPGA ADC inputs available on the BeagleBone expansion header
* Switches, Buttons, and Indicators
  * 2 push-buttons
  * 2 slide switches
  * 8 blue user LEDs
* Sensors
  * One proximity/ambient lighter sensor
  * One humidity and temperature sensor
  * One temperature sensor
  * One accelerometer
  * Two Capacitive touch sensor pads
* Power
  * 5V DC input

# Getting the starter project
If you haven't already, install `stack`, a build tool for Haskell: https://docs.haskellstack.org/en/stable/README/.
(In case you are a `cabal-install` or `nix` user, just follow the DECA starter project README from this point on: https://github.com/clash-lang/clash-starters/blob/main/deca/README.md)

Once `stack` is completely installed and on your `PATH`, you can now create a new Clash project for the DECA devkit using:

```
stack new my-clash-deca-project clash-lang/deca
```

Where `my-clash-deca-project` is the name of the folder where the project will be created.

# Building the starter project
Now change directory to `my-clash-deca-project`, and run:

```
stack run clash -- DECA --vhdl
```

This will compile the [`src/DECA.hs`](https://github.com/clash-lang/clash-starters/blob/2c19ceb566f4137bfd3fd6222aedd4a75dece4c5/deca/src/DECA.hs) Haskell/Clash source file to VHDL.
If this is the first time you are building a Clash project using `stack` then this step will take some time as `stack` will install (from source) many of the project dependencies.

When all goes well, the last couple of lines in the terminal should read something in the spirit of:

```
Registering library for my-clash-deca-project-0.1..
GHC: Parsing and optimising modules took: 0.730s
GHC: Loading external modules from interface files took: 0.000s
GHC: Parsing annotations took: 0.002s
Clash: Parsing and compiling primitives took 0.140s
GHC+Clash: Loading modules cumulatively took 1.207s
Clash: Compiling DECA.deca
Clash: Normalization took 0.019s
Clash: Netlist generation took 0.003s
Clash: Total compilation took 1.246s
```

Now that VHDL generation is finished, you can start [Quartus Prime](https://fpgasoftware.intel.com/?edition=lite); once started, in the menu bar, click `File -> Open Project` and open `syn/deca.qpf`.
In the menu bar, click: `Processing -> Start Compilation`.
This can take up to a minute depending on your machine.
If everything worked as it was supposed to work then the last messages in the logs should be in the spirit of:

```
Info (332101): Design is fully constrained for setup requirements
Info (332101): Design is fully constrained for hold requirements
Info: Quartus Prime Timing Analyzer was successful. 0 errors, 2 warnings
	Info: Peak virtual memory: 550 megabytes
	Info: Processing ended: Tue Jun  1 09:51:50 2021
	Info: Elapsed time: 00:00:01
	Info: Total CPU time (on all processors): 00:00:01
Info (293000): Quartus Prime Full Compilation was successful. 0 errors, 11 warnings
```

## Programming the FPGA
After synthesis has finished, it is time to program our FPGA board.
Connect the FPGA board to a USB port, and start the programmer from the menu bar: `Tools -> Programmer`.
Press the `Start` button on the left to program your FPGA and wait until the progress bar says `100% (Successful)`.

Once programmed, you should be able to operate the DECA devkit as seen here: {{< youtube zsChH7q03mg >}}

# What's next
Currently, the starter project is just a minor adaption of the blinker circuit described in the [Clash FPGA starter](https://qbaylogic.com/all/clash/clash-fpga-starter/) blog post.
The included [README.md](https://github.com/clash-lang/clash-starters/blob/main/deca/README.md) elaborates some more on the purpose of all the files in the project, and also repeats the above instructions on how to program the FPGA.

For now, the DECA starter project only connects the LEDs and the push-buttons.
The intention is however to improve this DECA starter project over time and to add Clash descriptions that enable you to talk to all the other peripherals on the devkit.
