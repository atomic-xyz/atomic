# ATOMIC

Borrow, swap, repay in one transaction.

ATOMIC is the execution layer for stock tokens on Robinhood Chain (chain id 4663). It composes a Morpho flash loan, Uniswap swaps and a Morpho position into a single transaction, so leverage, collateral rotation and arbitrage either settle completely or do not happen at all.

- App: https://useatomic.xyz/app
- Site: https://useatomic.xyz
- X: https://x.com/useatomic_xyz

## What it does

| Action | In one transaction |
| --- | --- |
| Perpetual | Flash-borrow USDG, buy the stock, supply it as collateral on Morpho, borrow against it, repay the flash loan. The wallet ends up holding a leveraged position with no expiry |
| Rotate | Repay the loan with a flash loan, withdraw the collateral, swap it into another stock, supply that, re-borrow, repay the flash loan. The debt never leaves the market |
| Arbitrage | Flash-borrow USDG, buy in the cheaper pool, sell in the dearer one, repay, send the difference to the caller. No capital needed |
| Close | Repay, withdraw, sell, repay the flash loan, return what is left to the wallet |

ATOMIC holds no deposits and runs no pool. Positions live on Morpho under the user's own address; the router only executes.

## Contracts

| Contract | Address |
| --- | --- |
| AtomicRouter v1.2 | [`0x82eec2769274eEc9F0BB9063F5B8a9908F3e389b`](https://sourcify.dev/#/lookup/0x82eec2769274eEc9F0BB9063F5B8a9908F3e389b) (Sourcify exact match) |
| ATOMIC token | `0x658DC84c90A7286480Bb16d009Aa34606345f5fB` |
| Morpho | `0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010` |
| Uniswap v3 SwapRouter02 | `0xCaf681a66D020601342297493863E78C959E5cb2` |
| Uniswap v3 QuoterV2 | `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` |
| Uniswap v4 StateView | `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b` |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| Stock token factory | `0x4783C67b63dE2B358Ac5951a7D41F47A38F3C046` |

The router charges `feeBps` (5 = 0.05%, capped at 0.50%) of the flash amount. Wallets holding at least 100,000 ATOMIC pay no fee: the router reads the balance itself in `feeFor`, with no staking, lockup or claim. Earlier router versions (v1.0, v1.1) are superseded and hold nothing; see `contracts/deployment.json`.

## Security

- `contracts/src/AtomicRouter.sol` is about 400 lines with no upgradeability and no custody
- 23 fork tests run against live mainnet state: `contracts/test/AtomicRouter.t.sol` (behaviour) and `contracts/test/AtomicRouterAudit.t.sol` (adversarial)
- `AUDIT.md` is an internal review, not a third-party audit. It lists every finding, the fix and the residual risks
- The owner can change the fee (within the cap), the treasury, the holder discount and ownership, and sweep tokens sent to the router by mistake. It cannot touch user positions
- Leverage and rotate need a one-time Morpho authorization for the router. Revoke it on Morpho when you are done

## Repository

- `contracts/` Foundry project: router, interfaces, deploy script, tests. See `contracts/README.md`
- `src/app` Next.js app router: landing (`/`), app (`/app?tab=leverage|arb|borrowers|holders|positions|rotate`) and content pages
- `src/app/api/snapshot` one cached multicall: Chainlink feeds, Uniswap v3/v4 and fork pool prices, Morpho market state, borrow rates, oracle prices, idle USDG
- `src/app/api/quote` best Uniswap v3 route for an exact-input swap (every fee tier, two-hop via WETH and via USDG)
- `src/app/api/borrowers` every open loan on the stock markets with live profit, rebuilt from each wallet's Morpho history
- `src/data` generated snapshots of stock tokens, Chainlink feeds, pools and Morpho markets
- `scripts/pull-data.mjs` regenerates `src/data/*.json`

## Run it

```bash
npm install
npm run dev
```

Set `NEXT_PUBLIC_ATOMIC_ROUTER` to the router address to enable signing; without it the app runs in simulation mode with live quotes. `NEXT_PUBLIC_RPC_URLS` (comma separated) replaces the default public RPC list.

Contracts:

```bash
cd contracts
forge install foundry-rs/forge-std
forge test
```

Tests fork Robinhood Chain through `RPC_URL` (default `https://robinhood.drpc.org`) and need `evm_version = "cancun"`, which `foundry.toml` already sets.

## License

MIT, see `LICENSE`.
