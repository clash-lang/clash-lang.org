-- Automatically generated VHDL-93
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;
use IEEE.MATH_REAL.ALL;
use std.textio.all;
use work.all;
use work.ShortBlinker_topEntity_types.all;

entity topEntity is
  port(-- clock
       clk    : in ShortBlinker_topEntity_types.clk_DomSys;
       -- reset
       rst    : in ShortBlinker_topEntity_types.rst_DomSys;
       result : out std_logic);
end;

architecture structural of topEntity is
  -- ShortBlinker.hs:21:1-9
  signal \c$counter_case_scrut\                 : ShortBlinker_topEntity_types.Tuple2;
  -- ShortBlinker.hs:21:1-9
  signal a2                                     : std_logic_vector(0 downto 0);
  -- ShortBlinker.hs:21:1-9
  signal counter                                : ShortBlinker_topEntity_types.Tuple2_0 := ( Tuple2_0_sel0_std_logic_vector => std_logic_vector'("0")
, Tuple2_0_sel1_index_25000000 => to_unsigned(0,25) );
  -- ShortBlinker.hs:21:1-9
  signal \c$counter_case_alt\                   : ShortBlinker_topEntity_types.Tuple2_0;
  -- ShortBlinker.hs:21:1-9
  signal overflowB                              : boolean;
  -- ShortBlinker.hs:21:1-9
  signal b1                                     : ShortBlinker_topEntity_types.index_25000000;
  -- ShortBlinker.hs:21:1-9
  signal \c$counter_case_scrut_0\               : ShortBlinker_topEntity_types.Tuple2_1;
  -- ShortBlinker.hs:21:1-9
  signal b0                                     : ShortBlinker_topEntity_types.index_25000000;
  signal \c$bv\                                 : std_logic_vector(0 downto 0);
  signal \c$counter_case_scrut_selection_res\   : boolean;
  signal \c$counter_case_scrut_selection_res_0\ : boolean;

begin
  \c$bv\ <= (a2);

  result <= \c$bv\(0);

  \c$counter_case_scrut_selection_res\ <= a2 = std_logic_vector'("1");

  \c$counter_case_scrut\ <= ( Tuple2_sel0_boolean => true
                            , Tuple2_sel1_std_logic_vector => std_logic_vector'(1-1 downto 0 => '0') ) when \c$counter_case_scrut_selection_res\ else
                            ( Tuple2_sel0_boolean => false
                            , Tuple2_sel1_std_logic_vector => std_logic_vector(unsigned(a2) + unsigned(std_logic_vector'("1"))) );

  a2 <= counter.Tuple2_0_sel0_std_logic_vector;

  -- register begin
  counter_register : process(clk)
  begin
    if rising_edge(clk) then
      if rst =  '1'  then
        counter <= ( Tuple2_0_sel0_std_logic_vector => std_logic_vector'("0")
  , Tuple2_0_sel1_index_25000000 => to_unsigned(0,25) );
      else
        counter <= \c$counter_case_alt\;
      end if;
    end if;
  end process;
  -- register end

  \c$counter_case_alt\ <= ( Tuple2_0_sel0_std_logic_vector => \c$counter_case_scrut\.Tuple2_sel1_std_logic_vector
                          , Tuple2_0_sel1_index_25000000 => b1 ) when overflowB else
                          ( Tuple2_0_sel0_std_logic_vector => a2
                          , Tuple2_0_sel1_index_25000000 => b1 );

  overflowB <= \c$counter_case_scrut_0\.Tuple2_1_sel0_boolean;

  b1 <= \c$counter_case_scrut_0\.Tuple2_1_sel1_index_25000000;

  \c$counter_case_scrut_selection_res_0\ <= b0 = to_unsigned(24999999,25);

  \c$counter_case_scrut_0\ <= ( Tuple2_1_sel0_boolean => true
                              , Tuple2_1_sel1_index_25000000 => to_unsigned(0,25) ) when \c$counter_case_scrut_selection_res_0\ else
                              ( Tuple2_1_sel0_boolean => false
                              , Tuple2_1_sel1_index_25000000 => b0 + to_unsigned(1,25) );

  b0 <= counter.Tuple2_0_sel1_index_25000000;


end;

