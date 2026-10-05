# ATOMIC contracts

`AtomicRouter` composes a Morpho flash loan with Uniswap v3 swaps and Morpho collateral/borrow calls so that a leveraged position can be opened, closed or rotated, or a two-venue spread captured, in one transaction on Robinhood Chain (chain id 4663).

## Layout

- `src/AtomicRouter.sol` - the router. Entry points: `openLeverage`, `closePosition`, `rotate`, `arb`. Everything runs inside `onMorphoFlashLoan`; any failure reverts the whole transaction.
- `src/interfaces/` - the minimal Morpho Blue and SwapRouter02 surfaces the router uses.
- `src/AtomicArb.sol` - ownerless multi-DEX arbitrage with direct pool swaps and Uniswap v4 hops, v3 live at `0x65Db7Bf6Bc52C4725117f7490617b13d7a8e3fB9` (v1 at `0xfc36D801680Ca99f4ebE020Ab9967f3249e87A48` is superseded). Tests in `test/AtomicArb.t.sol`.
- `test/AtomicRouter.t.sol` - fork tests against mainnet state (real NVDA and AAPL markets, real pools).
- `script/Deploy.s.sol` - deployment script.

## Deployment

Robinhood Chain mainnet, 2026-10-03: `AtomicRouter` v1.2 (holder fee waiver) at `0x82eec2769274eEc9F0BB9063F5B8a9908F3e389b` (tx `0xde6a612203378a77c947d125743dc7971ff026561a48c4171bc285eeb8e2862e`), fee 5 bps, treasury and owner `0x4fc22D5bbC37fBcC453C1FA099406e324B485C9f`. v1.1 at `0xC7056Fe38081b9359997FBCBf94591e2Cf7E34d9` is superseded and holds nothing. Record in `deployment.json`. The v1.0 router at `0x7D0E0827a8Bbc5a2CD78e5B12226c65cB449a9Ec` is superseded and holds nothing. Findings and fixes are in `../AUDIT.md`.

## Addresses used

| Contract | Address |
| --- | --- |
| Morpho | `0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010` |
| Uniswap v3 SwapRouter02 | `0xCaf681a66D020601342297493863E78C959E5cb2` |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |

## Commands

Fork tests (needs a Robinhood Chain RPC; the official one is rate limited, dRPC works):

```bash
forge test --fork-url https://robinhood.drpc.org -vv
```

Deploy (reads `PRIVATE_KEY`, `TREASURY` and optional `FEE_BPS` from `.env`):

```bash
source .env && forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

Verify on Sourcify (Blockscout imports Sourcify matches; Blockscout's own API is behind Cloudflare for CLIs):

```bash
forge verify-contract <ROUTER> src/AtomicRouter.sol:AtomicRouter --chain-id 4663 --verifier sourcify --constructor-args $(cast abi-encode "constructor(address,address,address,address,uint16)" 0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010 0xCaf681a66D020601342297493863E78C959E5cb2 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 <TREASURY> 5)
```

Then put the printed address into the web app's `.env` as `NEXT_PUBLIC_ATOMIC_ROUTER`.

Local end-to-end (anvil fork on port 8546, router deployed there, test wallet funded from Morpho's idle USDG):

```bash
anvil --fork-url https://robinhood.drpc.org --no-rate-limit --port 8546 --chain-id 4663 --block-time 1
PRIVATE_KEY=<anvil key 0> TREASURY=<anvil account 0> forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8546 --broadcast
```

## Security model

- The router never holds funds between transactions. Positions are created on Morpho under the caller's address (`onBehalf = msg.sender`).
- Callers grant the router a Morpho authorization (`setAuthorization`) so it can borrow and withdraw collateral on their behalf inside the transaction. It can be revoked at any time.
- Every swap carries a caller-supplied minimum output. `arb` also requires `usdgOut >= size + fee + minProfit`.
- The flash-loan callback accepts calls only from Morpho and only while an entry point has set the call context. Entry points are non-reentrant.
- Fee: `feeBps` of the flash amount (default 5 = 0.05%), capped at 50, paid to `treasury`. The owner can change fee, treasury and ownership, and sweep tokens that were sent here by mistake.
- Holder waiver (v1.2): `setHolderDiscount(token, minBalance)` names a token and a minimum balance; wallets that hold at least that much pay no fee (`feeFor(user, amount)` returns 0). A token that reverts or has no code never blocks an action, the normal fee simply applies. Disabled until the owner sets it, which happens once the ATOMIC token exists.
- The EVM target is `cancun` because Robinhood stock tokens already use post-Shanghai opcodes.
