import { runBars, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const TRAILING_STOP_BPS = 800;
const MAX_SLIPPAGE_BPS = 10_000;

let entered = false;
let stopped = false;
let peak = 0;

await runBars({
  onBatch(state, batch) {
    const bar = batch.bars.find((x) => x.symbol === 'CBBTC');
    if (bar === undefined) return [];
    const close = Number(bar.c);
    const held = state.positions.get('CBBTC');

    if (held !== undefined) {
      peak = Math.max(peak, close);
      if ((peak - close) * 10_000 >= peak * TRAILING_STOP_BPS) {
        stopped = true;
        const order: SellInput = {
          side: 'sell', symbol: 'CBBTC', qty: held.qty,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        };
        return [order];
      }
      return [];
    }

    if (entered || stopped || state.warmingUp) return [];
    const { caps, fees } = state.hello;
    const maxWeight = Math.min(caps.max_weight_bps, 10_000);
    const notional = BigInt(maxWeight) * state.equity / 10_000n;
    if (notional < BigInt(fees.min_notional_quote_units) || notional > state.cash) return [];
    const order: BuyInput = {
      side: 'buy', symbol: 'CBBTC', notional_quote_units: notional,
      max_slippage_bps: MAX_SLIPPAGE_BPS,
    };
    entered = true;
    peak = close;
    return [order];
  },
});
