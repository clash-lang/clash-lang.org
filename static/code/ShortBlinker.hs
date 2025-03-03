{-# OPTIONS_GHC "-Wno-orphans" #-}

module ShortBlinker where

import Clash.Class.Counter
import Clash.Explicit.Prelude

-- 50 MHz clock (period of 20,000 ps), synchronous resets
createDomain vXilinxSystem{vName="DomSys", vPeriod=20_000}

-- Let Clash compute the number of cycles in 0.5 seconds:
-- 500e9 picoseconds divided by clock period
type HalfSecDelay = 500_000_000_000 `Div` DomainPeriod DomSys
-- For the 50 MHz clock, this is equivalent to
-- type HalfSecDelay = 25_000_000

topEntity ::
  Clock DomSys ->
  Reset DomSys ->
  Signal DomSys Bit
topEntity clk rst = (bitCoerce . fst) <$> counter
 where
  counter :: Signal DomSys (BitVector 1, Index HalfSecDelay)
  counter = register clk rst enableGen (0,0) (countSucc <$> counter)
{-# OPAQUE topEntity #-}
