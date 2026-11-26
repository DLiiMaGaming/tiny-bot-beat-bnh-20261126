[![make.fun](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1.svg)](https://make.fun/c/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![rank](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/DLiiMaGaming/tiny-bot-beat-bnh-20261126/rank.svg)](https://make.fun/c/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![reward](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/DLiiMaGaming/tiny-bot-beat-bnh-20261126/reward.svg)](https://make.fun/c/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)

# Quiet Dip-Buy Bot — Beat Buy-and-Hold on Solana

Entry for [Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana](https://make.fun/c/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1) (make.fun).

A quiet dip-buy mean-reversion bot for hourly Solana DEX bars (FARTCOIN,
JITOSOL, POPCAT, RAY, SOL, WETH, WIF). It follows the pattern that won 5 of 7
BTC-race 24h editions: buy a real washout dip, confirm with an uptick, take a
small quick profit, keep drawdown small, trade few times.

## Strategy

- **Entry:** a symbol's close is ≥ 6% below its own 24-bar high **and** the
  latest close ticked up from the previous close (bounce confirmation).
  One position per symbol, at most 2,500 USDC per symbol (the 25% weight cap).
- **Exit** (whole position): +2% take-profit or −5% stop from the actual fill
  price, or after 24 bars held — whichever comes first.
- **Deterministic:** no clock, no randomness, no network; every decision is a
  pure function of the bars. `main.ts` speaks `agent-fun/bars-replay/v1`
  through the vendored `vendor/makefun-bars.ts` SDK shim.

## Dev-window results (kit `grade-local`, `--driver process`, two runs)

| | net PnL (USDC) | trades | win rate | max drawdown |
|---|---|---|---|---|
| **This bot** | **+362.68** | 23 | 91.7% | 3.40% |
| buy-and-hold | −869.34 | 7 | 0% | 10.92% |
| hold-cash | 0.00 | 0 | — | 0% |
| macd-cci | −20.22 | 17 | 70% | 2.46% |
| rsi-bollinger | −56.49 | 8 | 42.9% | 5.16% |
| adx-momentum | −114.42 | 11 | 28.6% | 1.38% |
| ema-cross | −173.04 | 28 | 11.8% | 2.51% |
| momentum | −268.23 | 19 | 54.5% | 5.66% |

Guardrails met (≥ 8 trades, drawdown ≤ 25%). Both executions reproduced byte
for byte (`action_log_sha256 5c454f406ed63da71f4f1757de25b3be60fb7ece22dcc8bd1000768e28633c5e`).
At 2x fees the bot is still +311.26 USDC.

## Run it

```sh
node cli/makefun.mjs grade-local --kit <kit-dir> --bot . --driver process
```

## License

MIT — see [LICENSE](LICENSE).
