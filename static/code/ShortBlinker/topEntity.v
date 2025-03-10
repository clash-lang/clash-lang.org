/* AUTOMATICALLY GENERATED VERILOG-2001 SOURCE CODE.
** GENERATED BY CLASH 1.8.2. DO NOT MODIFY.
*/
`default_nettype none
`timescale 100fs/100fs
module topEntity
    ( // Inputs
      input wire  clk // clock
    , input wire  rst // reset

      // Outputs
    , output wire  result
    );
  // ShortBlinker.hs:21:1-9
  wire [1:0] c$counter_case_scrut;
  // ShortBlinker.hs:21:1-9
  wire [0:0] a2;
  // ShortBlinker.hs:21:1-9
  reg [25:0] counter = {1'b0,   25'd0};
  // ShortBlinker.hs:21:1-9
  wire [25:0] c$counter_case_alt;
  // ShortBlinker.hs:21:1-9
  wire  overflowB;
  // ShortBlinker.hs:21:1-9
  wire [24:0] b1;
  // ShortBlinker.hs:21:1-9
  wire [25:0] c$counter_case_scrut_0;
  // ShortBlinker.hs:21:1-9
  wire [24:0] b0;

  assign result = (a2);

  assign c$counter_case_scrut = (a2 == 1'b1) ? {1'b1,
                                                1'd0} : {1'b0,   a2 + 1'b1};

  assign a2 = counter[25:25];

  // register begin
  always @(posedge clk ) begin : counter_register
    if ( rst) begin
      counter <= {1'b0,   25'd0};
    end else begin
      counter <= c$counter_case_alt;
    end
  end
  // register end

  assign c$counter_case_alt = overflowB ? {c$counter_case_scrut[0:0],
                                           b1} : {a2,   b1};

  assign overflowB = c$counter_case_scrut_0[25:25];

  assign b1 = c$counter_case_scrut_0[24:0];

  assign c$counter_case_scrut_0 = (b0 == 25'd24999999) ? {1'b1,
                                                          25'd0} : {1'b0,   b0 + 25'd1};

  assign b0 = counter[24:0];


endmodule

