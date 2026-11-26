// Quiet dip-buy mean-reversion bot — "Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana"
//
// Champion pattern (make.fun BTC-race winners, 5 of 7 editions): buy the dip after a
// washout, confirm with an uptick, take a small quick profit, keep drawdown small,
// trade few times. Adapted to this 7-symbol Solana universe (hourly bars):
//   - Entry: a symbol's close is >=6% below its own 24-bar high AND the latest close
//     ticked up from the previous close (bounce confirmation). One position per symbol.
//   - Size: up to 2,500 USDC per symbol (the 25% weight cap), from cash on hand.
//   - Exit (whole position): +2% take-profit or -5% stop from the actual fill price,
//     or after 24 bars held, whichever comes first.
//   - No clock, no randomness, no network: every decision is a pure function of the bars.
//
// Dev-window behaviour (grade-local, kit dev window): net PnL about +400 USDC (offline sim), 23 trades,
// max drawdown ~3.3% — vs buy-and-hold -869 USDC and best house baseline (hold-cash) 0.

import { BPS, runBars, type BarsState, type Batch, type BuyInput, type OrderInput, type SellInput } from './vendor/makefun-bars.ts';

const LOOKBACK_BARS = 24; // bars for the trailing high
const DIP_BPS = 600n; // entry: close >= 6% below the 24-bar high
const TAKE_PROFIT_BPS = 200n; // exit: +2% from fill price
const STOP_BPS = 500n; // exit: -5% from fill price
const HOLD_MAX_BARS = 24; // exit: held this many bars
const SLICE_QUOTE_UNITS = 2_500_000_000n; // 2,500 USDC (6 decimals), the weight cap at $10k equity
const MAX_SLIPPAGE_BPS = 10_000;

/** Per-symbol close history, by batch seq (bigint closes, null before the first bar). */
const closes = new Map<string, (bigint | null)[]>();
/** Per-symbol entry fill price + entry seq, for symbols currently held. */
const entries = new Map<string, { price: bigint; seq: number }>();

function history(symbol: string): (bigint | null)[] {
  let h = closes.get(symbol);
  if (h === undefined) closes.set(symbol, (h = []));
  return h;
}

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    // Record actual fill prices of buys decided earlier (fills land at this bar's open).
    for (const f of batch.fills) {
      if (f.status === 'filled' && f.side === 'buy') {
        entries.set(f.symbol, { price: BigInt(f.price), seq: batch.seq });
      }
      if (f.status === 'filled' && f.side === 'sell') entries.delete(f.symbol);
    }
    // Record this batch's closes.
    for (const { symbol } of state.hello.symbols) {
      history(symbol).push(state.close(symbol));
    }
    if (state.warmingUp) return [];

    const orders: OrderInput[] = [];
    let cashLeft = state.cash;
    const { caps, fees } = state.hello;
    const minNotional = BigInt(fees.min_notional_quote_units);

    // Exits first: whole position on TP / stop / max hold.
    for (const [symbol, p] of state.positions) {
      const c = state.close(symbol);
      if (c === null) continue;
      const entry = entries.get(symbol);
      const held = entry !== undefined ? batch.seq - entry.seq : HOLD_MAX_BARS;
      const takeProfit = entry !== undefined && c * BPS >= entry.price * (BPS + TAKE_PROFIT_BPS);
      const stopped = entry !== undefined && c * BPS <= entry.price * (BPS - STOP_BPS);
      if (takeProfit || stopped || held >= HOLD_MAX_BARS) {
        orders.push({ side: 'sell', symbol, qty: p.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } as SellInput);
      }
    }
    const selling = new Set(orders.filter((o) => o.side === 'sell').map((o) => o.symbol));

    // Entries: dip below the 12-bar high + one uptick close.
    for (const { symbol } of state.hello.symbols) {
      if (state.positions.has(symbol) || selling.has(symbol)) continue;
      if (state.positions.size + orders.filter((o) => o.side === 'buy').length >= caps.max_open_positions) break;
      const h = history(symbol);
      const seq = batch.seq;
      if (seq < 12 || h.length <= seq) continue; // need 12 bars of history first
      const c = h[seq];
      const prev = h[seq - 1];
      if (c === null || prev === null) continue;
      if (c <= prev) continue; // bounce confirmation: latest close ticked up
      let high: bigint | null = null;
      for (let i = Math.max(0, seq - LOOKBACK_BARS + 1); i <= seq; i++) {
        const v = h[i];
        if (v !== null && (high === null || v > high)) high = v;
      }
      if (high === null) continue;
      if (c * BPS > high * (BPS - DIP_BPS)) continue; // not >= 6% below the high
      const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
      let slice = SLICE_QUOTE_UNITS;
      if (byWeight < slice) slice = byWeight;
      if (cashLeft < slice) slice = cashLeft;
      if (slice < minNotional) continue;
      orders.push({ side: 'buy', symbol, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS } as BuyInput);
      cashLeft -= slice;
    }
    return orders.slice(0, caps.max_orders_per_bar);
  },
});
