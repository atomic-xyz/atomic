# ATOMIC internal audit, 2026-09-25

Scope: `contracts/src/AtomicRouter.sol` (v1.0 as deployed at `0x7D0E0827a8Bbc5a2CD78e5B12226c65cB449a9Ec`), the web app's execution layer (`src/lib/router.ts`, `src/hooks/useOnchain.ts`, `src/components/app/*`), the two API routes, and the Railway deployment. Method: line-by-line review with an attacker's checklist (fund custody, path and calldata trust, reentrancy, authorization scope, rounding, privileged roles, secrets handling), then an adversarial fork-test file (`contracts/test/AtomicRouterAudit.t.sol`) that encodes every finding so the fix is proven rather than asserted.

This is an internal review by the team that wrote the code. It is not a substitute for an independent third-party audit before large balances rely on the router.

## Summary

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| A1 | Medium | Swap paths were not validated, so a crafted path could route tokens that are not part of the recipe, including any balance sitting on the router by mistake | Fixed in v1.1 |
| A2 | Medium | Closing or rotating a position with no debt (a 1x position, or debt repaid elsewhere) reverted, locking such positions out of the app | Fixed in v1.1 |
| A3 | Low | Flash-loan callback did not check that an entry point was actually running (defence in depth) | Fixed in v1.1 |
| A4 | Info | Morpho authorization scope: the router can only ever act on `msg.sender`'s position | Verified, test added |
| A5 | Low | Malformed path lengths were caught late, inside the swap | Fixed in v1.1 |
| A6 | Info | Router must never hold funds after a recipe | Verified, test added |
| A7 | Info | Owner powers are bounded to fee (max 0.5%), treasury, ownership and sweeping the router's own balance | Verified, test added |
| F1 | Low | `/api/quote` passed unvalidated addresses to the RPC layer, surfacing 500s | Fixed |
| F2 | Low | Arb executed with `minProfit = 0`, so a zero-edge attempt could succeed and only pay gas | Fixed, minimum profit 0.05% of size |
| D1 | High (operational) | First `railway up` used a `.railwayignore` that did not exclude env files, so the deployer private key may have entered the build context | Key rotated, owner and treasury moved, ignore rules fixed |

## Contract findings

### A1. Unvalidated swap paths (Medium)

Every entry point took a caller-supplied Uniswap v3 path and `_swap` approved and spent whatever token the path started with. The recipe then used the amount returned by the swap as if it were the market's collateral token. If the router ever held a stray balance of a stock token (sent by mistake), a caller could open a leverage whose swap bought a different token, and `supplyCollateral` would pull the stray token from the router as the caller's own collateral. The same shape existed for close, rotate and both arb legs.

Fix: `_checkPath` enforces `length == 20 + n * 23` and that the first and last tokens equal what the recipe expects (leverage: USDG to `market.collateralToken`; close: collateral to USDG; rotate: `from.collateralToken` to `to.collateralToken`; arb: USDG to X and X back to USDG, with X taken from the buy leg). Tests: `test_A1_pathMismatch_cannotStealStrayCollateral`, `test_A1_closePathMismatch_reverts`, `test_A1_arbPathsMustConnect`, `test_A5_malformedPathRejected`.

### A2. Debt-free positions could not be closed or rotated (Medium)

`_run` treated `flashAmount == 0` as "leverage 1x" and decoded the payload as `LeverageData` regardless of action. A close or rotate of a position with zero debt therefore reverted on decode, and even with correct dispatch `Morpho.repay(0, 0)` would have reverted. Users who opened a 1x position, or repaid their debt directly on Morpho, could not exit through the app.

Fix: `_run` dispatches by action when there is nothing to flash-borrow; `_close` and `_rotate` skip `repay` when `borrowShares == 0` and `_rotate` skips `borrow` when there is no debt to move. Tests: `test_A2_closeDebtFreePosition`, `test_A2_rotateDebtFreePosition`.

### A3. Callback context (Low)

`onMorphoFlashLoan` checked `msg.sender == MORPHO` and a non-zero `_ctxUser`. Morpho only calls the callback on the address that called `flashLoan`, so the check was already sufficient, but the callback now also requires the reentrancy lock to be held, which ties it to a running entry point. Test: `test_A3_callbackNeedsActiveContext`.

### A4. Authorization scope (Info)

Users grant the router a Morpho authorization so it can borrow and withdraw on their behalf. The recipe always targets `_ctxUser`, which is set to `msg.sender` at entry, and there is no function that takes a user parameter. A third party, including the owner, cannot direct the router at someone else's position. Test: `test_A4_cannotActOnSomeoneElsesPosition`.

### A6, A7. Custody and privilege (Info)

The router ends every recipe with a zero balance (`test_A6_routerNeverHoldsFunds`). The owner can change the fee up to `MAX_FEE_BPS = 50`, the treasury, ownership, and sweep tokens from the router's own balance; none of those reach user positions (`test_A7_ownerPowersAreBounded`).

### Reviewed and found sound

- Rounding: flash size uses Morpho's `toAssetsUp` after `accrueInterest` in the same transaction, and `repay` by shares consumes the same rounded amount, so the router holds exactly enough and leaves no dust.
- Reentrancy: all entry points are `nonReentrant`; the tokens involved have no transfer hooks; Uniswap callbacks land on SwapRouter02, not the router.
- Slippage: every swap carries a caller minimum; arb additionally requires `usdgOut >= size + fee + minProfit`.
- Approvals: reset to zero before setting max, for tokens that reject non-zero to non-zero changes.
- Fee accounting: leverage borrows `flash + fee` and forwards the fee; close and arb take the fee from proceeds; rotate borrows `debt + fee`.

## Frontend and API findings

- F1: `/api/quote` now rejects malformed addresses and amounts with 400.
- F2: arb execution passes `minProfit = size / 2000` (0.05%).
- Reviewed: allowance approvals are exact-amount, not infinite; the on-chain debt shown in Positions uses the same `toAssetsUp` formula as the contract; minimum outputs come from a fresh quote with a user-set slippage (default 0.5%); no user input reaches `dangerouslySetInnerHTML`; no secrets are shipped to the browser (only the public router address).

## Deployment finding

- D1: the first Railway upload may have included `contracts/.env`. The key was treated as compromised the same day: router ownership and treasury were moved to a fresh wallet, the old wallet was emptied, and `.railwayignore` now excludes every env file. Railway holds only the public router address as a variable.

## Deployments

| Version | Address | Notes |
| --- | --- | --- |
| v1.0 | `0x7D0E0827a8Bbc5a2CD78e5B12226c65cB449a9Ec` | superseded, holds nothing, owner is the new wallet |
| v1.1 | `0xC7056Fe38081b9359997FBCBf94591e2Cf7E34d9` | superseded by v1.2, holds nothing |
| v1.2 | `0x82eec2769274eEc9F0BB9063F5B8a9908F3e389b` | live, wired into the app; adds the holder fee waiver (`setHolderDiscount`, `feeFor`), covered by four new fork tests |

Owner and treasury: `0x4fc22D5bbC37fBcC453C1FA099406e324B485C9f`.

## Residual risks (not code defects)

- No independent audit yet.
- Stock tokens are issuer-backed debt securities with geographic restrictions; Morpho liquidates against a Chainlink-backed oracle that can move while a pool is quiet.
- Public RPC endpoints back the read side; the app falls back across three of them.
