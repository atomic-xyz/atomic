// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IMorpho, IMorphoFlashLoanCallback} from "./interfaces/IMorpho.sol";
import {IERC20} from "./interfaces/ISwapRouter02.sol";

/// @notice The two views this contract reads from the main router: the fee a wallet pays (zero for holders)
///         and where fees go. Keeping them there means one fee policy for the whole product.
interface IAtomicFees {
    function feeFor(address user, uint256 flashAmount) external view returns (uint256);
    function treasury() external view returns (address);
}

/// @notice The part of a Uniswap v3 style pool this contract uses. Ramses v3, PancakeSwap v3 style forks and
///         Uniswap v3 itself all share it; they differ only in the name of the swap callback.
interface IV3PoolLike {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96, bytes calldata data)
        external
        returns (int256 amount0, int256 amount1);
}

/// @notice The part of the Uniswap v4 PoolManager this contract uses. All v4 pools live inside this one
///         contract; a swap happens inside `unlock`, and what is owed is settled before the lock closes.
interface IPoolManagerLike {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    function unlock(bytes calldata data) external returns (bytes memory);
    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData) external returns (int256 delta);
    function sync(address currency) external;
    function settle() external payable returns (uint256);
    function take(address currency, address to, uint256 amount) external;
}

/// @title AtomicArb
/// @notice Zero-capital arbitrage across concentrated-liquidity pools from different DEXes. Flash-borrows USDG
///         from Morpho, swaps it through a chain of pools into a stock token and back, repays, and sends
///         what is left to the caller. If the round trip does not clear the flash loan, the fee and the
///         caller's minimum profit, the whole transaction reverts.
/// @dev Swaps go straight to the pools rather than through a DEX router, so any pool that follows the
///      Uniswap v3 swap interface works, and so does any Uniswap v4 pool, through the PoolManager. The
///      contract has no owner, no upgrade path and no state between transactions, and it never needs a
///      Morpho authorization: it touches nobody's position.
contract AtomicArb is IMorphoFlashLoanCallback {
    /// @dev One swap: `tokenIn` goes into `pool`, the pool's other token comes out.
    ///      For a Uniswap v3 style pool only `pool` and `tokenIn` are read. When `pool` is the Uniswap v4
    ///      PoolManager, the hop is a v4 swap and `tokenOut`, `fee`, `tickSpacing` and `hooks` identify the pool.
    struct Hop {
        address pool;
        address tokenIn;
        address tokenOut;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    error NotMorpho();
    error NoContext();
    error Reentrancy();
    error NotActivePool();
    error BadCallback();
    error BadPath();
    error ZeroAmount();
    error NotPoolManager();
    error PartialFill();
    error InsufficientOutput(uint256 got, uint256 need);

    event Arbed(address indexed user, uint256 size, uint256 profit);

    uint160 private constant MIN_SQRT_RATIO = 4295128739;
    uint160 private constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    IMorpho public immutable MORPHO;
    IERC20 public immutable USDG;
    IAtomicFees public immutable FEES;
    IPoolManagerLike public immutable POOL_MANAGER;

    address private _user;
    uint8 private _lock;
    uint256 private _profit; // carries the result out of the flash-loan callback, cleared before returning

    // Set only for the duration of one pool.swap call, so the callback can be authenticated and bounded.
    address private _activePool;
    address private _activeTokenIn;
    uint256 private _activeMaxIn;

    // True only between this contract's own call to PoolManager.unlock and the callback it triggers.
    bool private _v4Pending;

    constructor(address morpho, address usdg, address fees, address poolManager) {
        MORPHO = IMorpho(morpho);
        USDG = IERC20(usdg);
        FEES = IAtomicFees(fees);
        POOL_MANAGER = IPoolManagerLike(poolManager);
    }

    /// @notice Flash-borrow `size` USDG, run it through `buy` (USDG to the stock) and `sell` (the stock back
    ///         to USDG), and keep the difference.
    /// @param minProfit Minimum USDG the caller must receive, after the flash loan and the fee.
    /// @return profit USDG sent to the caller. Returned so an `eth_call` can price the trade exactly,
    ///         price impact included, before anyone signs.
    function arb(uint256 size, Hop[] calldata buy, Hop[] calldata sell, uint256 minProfit) external returns (uint256 profit) {
        if (_lock == 1) revert Reentrancy();
        if (size == 0) revert ZeroAmount();
        if (buy.length == 0 || sell.length == 0) revert BadPath();
        _lock = 1;
        _user = msg.sender;
        MORPHO.flashLoan(address(USDG), size, abi.encode(buy, sell, minProfit));
        profit = _profit;
        _profit = 0;
        _user = address(0);
        _lock = 0;
    }

    function onMorphoFlashLoan(uint256 assets, bytes calldata data) external override {
        if (msg.sender != address(MORPHO)) revert NotMorpho();
        address user = _user;
        if (user == address(0) || _lock != 1) revert NoContext();

        (Hop[] memory buy, Hop[] memory sell, uint256 minProfit) = abi.decode(data, (Hop[], Hop[], uint256));

        (uint256 stockAmount, address stock) = _route(buy, address(USDG), assets);
        (uint256 out, address tokenOut) = _route(sell, stock, stockAmount);
        if (tokenOut != address(USDG)) revert BadPath();

        uint256 fee = FEES.feeFor(user, assets);
        uint256 need = assets + fee + minProfit;
        if (out < need) revert InsufficientOutput(out, need);

        if (fee > 0) USDG.transfer(FEES.treasury(), fee);
        uint256 profit = out - assets - fee;
        _profit = profit;
        if (profit > 0) USDG.transfer(user, profit);
        emit Arbed(user, assets, profit);

        // Morpho pulls `assets` back with transferFrom after this returns.
        if (USDG.allowance(address(this), address(MORPHO)) < assets) USDG.approve(address(MORPHO), type(uint256).max);
    }

    /// @dev Runs `amount` of `tokenIn` through each hop in turn. Every hop must take exactly the token the
    ///      previous one produced, so a path cannot smuggle in a token that is not part of the trade.
    function _route(Hop[] memory hops, address tokenIn, uint256 amount) private returns (uint256, address) {
        for (uint256 i; i < hops.length; ++i) {
            Hop memory h = hops[i];
            if (h.tokenIn != tokenIn) revert BadPath();
            if (h.pool == address(POOL_MANAGER)) {
                if (h.tokenOut == tokenIn || h.tokenOut == address(0)) revert BadPath();
                _v4Pending = true;
                amount = abi.decode(POOL_MANAGER.unlock(abi.encode(h, amount)), (uint256));
                tokenIn = h.tokenOut;
                continue;
            }
            address t0 = IV3PoolLike(h.pool).token0();
            address t1 = IV3PoolLike(h.pool).token1();
            bool zeroForOne = tokenIn == t0;
            if (!zeroForOne && tokenIn != t1) revert BadPath();

            _activePool = h.pool;
            _activeTokenIn = tokenIn;
            _activeMaxIn = amount;
            (int256 a0, int256 a1) = IV3PoolLike(h.pool).swap(
                address(this), zeroForOne, int256(amount), zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1, ""
            );
            _activePool = address(0);
            _activeTokenIn = address(0);
            _activeMaxIn = 0;

            int256 outDelta = zeroForOne ? a1 : a0;
            if (outDelta >= 0) revert BadCallback();
            amount = uint256(-outDelta);
            tokenIn = zeroForOne ? t1 : t0;
        }
        return (amount, tokenIn);
    }

    /// @notice The Uniswap v4 PoolManager calls this inside `unlock`. Swaps the whole input, pays it in, and
    ///         takes the output. Only reachable while this contract itself is in the middle of a v4 hop.
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(POOL_MANAGER)) revert NotPoolManager();
        if (!_v4Pending || _lock != 1) revert NoContext();
        _v4Pending = false;

        (Hop memory h, uint256 amount) = abi.decode(data, (Hop, uint256));
        bool zeroForOne = h.tokenIn < h.tokenOut;
        int256 delta = POOL_MANAGER.swap(
            IPoolManagerLike.PoolKey({
                currency0: zeroForOne ? h.tokenIn : h.tokenOut,
                currency1: zeroForOne ? h.tokenOut : h.tokenIn,
                fee: h.fee,
                tickSpacing: h.tickSpacing,
                hooks: h.hooks
            }),
            // v4 marks an exact-input swap with a negative amount
            IPoolManagerLike.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amount),
                sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1
            }),
            ""
        );
        // The delta packs amount0 in the high 128 bits and amount1 in the low 128 bits, from this
        // contract's point of view: negative is owed to the pool, positive is owed to this contract.
        int256 d0 = int256(int128(delta >> 128));
        int256 d1 = int256(int128(delta));
        (int256 dIn, int256 dOut) = zeroForOne ? (d0, d1) : (d1, d0);
        if (dOut <= 0 || dIn >= 0) revert BadCallback();
        // A swap that stopped early would strand part of the input here, so only whole fills are accepted.
        if (uint256(-dIn) != amount) revert PartialFill();

        POOL_MANAGER.sync(h.tokenIn);
        IERC20(h.tokenIn).transfer(address(POOL_MANAGER), amount);
        POOL_MANAGER.settle();
        POOL_MANAGER.take(h.tokenOut, address(this), uint256(dOut));
        return abi.encode(uint256(dOut));
    }

    /// @notice Uniswap v3 and Ramses v3 pools call this to collect the input of a swap.
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata) external {
        _pay(amount0Delta, amount1Delta);
    }

    /// @notice PancakeSwap v3 style pools call this to collect the input of a swap.
    function pancakeV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata) external {
        _pay(amount0Delta, amount1Delta);
    }

    /// @dev Pays the pool that is being swapped against, in the token that was promised, and never more
    ///      than the amount that was sent into the swap. Anything else reverts.
    function _pay(int256 amount0Delta, int256 amount1Delta) private {
        if (msg.sender != _activePool || _lock != 1) revert NotActivePool();
        int256 owed = amount0Delta > 0 ? amount0Delta : amount1Delta;
        if (owed <= 0 || uint256(owed) > _activeMaxIn) revert BadCallback();
        _activeMaxIn -= uint256(owed);
        IERC20(_activeTokenIn).transfer(msg.sender, uint256(owed));
    }
}
