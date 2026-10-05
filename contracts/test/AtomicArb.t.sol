// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {AtomicArb, IV3PoolLike} from "../src/AtomicArb.sol";
import {IERC20} from "../src/interfaces/ISwapRouter02.sol";

interface ICallback {
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external;
}

/// @dev Minimal token for the deterministic tests.
contract MockToken {
    mapping(address => uint256) public balanceOf;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @dev A pool with a fixed exchange rate that behaves like Uniswap v3: it asks for its input through the
///      callback and sends the output to the recipient. `mode` turns it hostile for the security tests.
contract FakePool {
    address public token0;
    address public token1;
    uint256 public num; // token1 out per token0 in, scaled by den (and the inverse the other way)
    uint256 public den;
    uint8 public mode; // 0 honest, 1 asks for more than it was given, 2 calls back twice

    constructor(address t0, address t1, uint256 num_, uint256 den_, uint8 mode_) {
        token0 = t0; token1 = t1; num = num_; den = den_; mode = mode_;
    }

    function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160, bytes calldata)
        external
        returns (int256 amount0, int256 amount1)
    {
        uint256 amountIn = uint256(amountSpecified);
        uint256 out = zeroForOne ? (amountIn * num) / den : (amountIn * den) / num;
        uint256 ask = mode == 1 ? amountIn + 1 : amountIn;
        (amount0, amount1) = zeroForOne ? (int256(ask), -int256(out)) : (-int256(out), int256(ask));
        ICallback(msg.sender).uniswapV3SwapCallback(amount0, amount1, "");
        if (mode == 2) ICallback(msg.sender).uniswapV3SwapCallback(amount0, amount1, "");
        IERC20(zeroForOne ? token1 : token0).transfer(recipient, out);
    }
}

/// @notice Fork tests for the multi-DEX arbitrage contract. Real pools prove the swap interface works on
///         Uniswap v3, Ramses v3 and a PancakeSwap v3 style fork; fake pools make the money flow, the fee
///         and the callback protections deterministic.
contract AtomicArbForkTest is Test {
    address constant MORPHO = 0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant ROUTER = 0x82eec2769274eEc9F0BB9063F5B8a9908F3e389b; // fee policy lives here
    address constant ATOMIC = 0x658DC84c90A7286480Bb16d009Aa34606345f5fB;

    address constant SPY = 0x117cc2133c37B721F49dE2A7a74833232B3B4C0C;
    address constant CRCL = 0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5;
    address constant SPY_RAMSES_USDG = 0x38453c115607463Ac284820Ce959831042f3Df4E;
    address constant SPY_UNI_WETH = 0xDDCBBa3666f578E3F09516f21Ff85BFee859AB5e;
    address constant WETH_USDG_UNI = 0x52e65B17fB6E5BA00Ed806f37Afcd2DaA50271Ca;
    address constant CRCL_UNI_USDG = 0x654E4143e82a5824445Ade0824351C2A9ACD95a8;
    address constant CRCL_GIGA_USDG = 0xD6032036aD225Ff5143c1533FE8274437ea68ca6;

    address constant SPY_ALGEBRA_USDG = 0x05E146F995aA70d0BF8481Ee3D27368A537a8e0D; // alandale, Algebra callback
    address constant NVDA = 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC;
    address constant NVDA_UP_USDG = 0x18A5aF4E442F8be68968Cc1f00D537F8af2D12Cd; // up, Slipstream style
    address constant NVDA_UNI_V3_USDG = 0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3;

    address constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951; // Uniswap v4
    address constant META = 0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35;
    address constant META_UNI_V3_USDG = 0x107a7Cb40d8665360ba10E59471Af06150A50922;

    AtomicArb arb;
    address user = makeAddr("user");

    function setUp() public {
        vm.createSelectFork(vm.envOr("RPC_URL", string("https://robinhood.drpc.org")));
        arb = new AtomicArb(MORPHO, USDG, ROUTER, POOL_MANAGER);
    }

    function _hop(address pool, address tokenIn) internal pure returns (AtomicArb.Hop memory) {
        return AtomicArb.Hop({pool: pool, tokenIn: tokenIn, tokenOut: address(0), fee: 0, tickSpacing: 0, hooks: address(0)});
    }

    function _one(address pool, address tokenIn) internal pure returns (AtomicArb.Hop[] memory h) {
        h = new AtomicArb.Hop[](1);
        h[0] = _hop(pool, tokenIn);
    }

    /// @dev A round trip through real pools either makes money or stops at the profit check. Stopping there
    ///      with most of the money back proves every swap and callback on the way worked.
    function _assertRoundTrip(uint256 size, AtomicArb.Hop[] memory buy, AtomicArb.Hop[] memory sell, string memory label, uint256 minBackBps) internal {
        vm.prank(user);
        try arb.arb(size, buy, sell, 0) returns (uint256) {
            console.log(label, "made a profit of (USDG 1e6):", IERC20(USDG).balanceOf(user));
        } catch (bytes memory err) {
            assertEq(bytes4(err), AtomicArb.InsufficientOutput.selector, "only the profit check may stop it");
            (uint256 got, uint256 need) = abi.decode(_strip(err), (uint256, uint256));
            console.log(label, "round trip returned (USDG 1e6):", got);
            assertGt(got, (size * minBackBps) / 10_000, "swaps executed and returned USDG");
            assertGt(need, size, "owed the flash loan plus the fee");
        }
        assertEq(IERC20(USDG).balanceOf(address(arb)), 0, "nothing left behind");
    }

    function _strip(bytes memory err) internal pure returns (bytes memory out) {
        out = new bytes(err.length - 4);
        for (uint256 i = 4; i < err.length; ++i) out[i - 4] = err[i];
    }

    // ---- real pools ----

    function test_ramsesBuy_uniswapSell_twoHops() public {
        AtomicArb.Hop[] memory sell = new AtomicArb.Hop[](2);
        sell[0] = _hop(SPY_UNI_WETH, SPY);
        sell[1] = _hop(WETH_USDG_UNI, WETH);
        _assertRoundTrip(500e6, _one(SPY_RAMSES_USDG, USDG), sell, "ramses -> uniswap", 9_700);
    }

    /// @dev This giga pool quotes CRCL about 6% above every other venue, but it holds almost no USDG, so
    ///      selling into it returns next to nothing. The swap and its callback still run, which is all this
    ///      test needs; the lesson for the app is to simulate a trade instead of trusting the quoted gap.
    function test_uniswapBuy_gigaSell_thinPool() public {
        _assertRoundTrip(100e6, _one(CRCL_UNI_USDG, USDG), _one(CRCL_GIGA_USDG, CRCL), "uniswap -> giga (thin)", 0);
    }

    function test_gigaBuy_uniswapSell() public {
        _assertRoundTrip(100e6, _one(CRCL_GIGA_USDG, USDG), _one(CRCL_UNI_USDG, CRCL), "giga -> uniswap", 8_000);
    }

    // ---- Algebra and Slipstream style pools ----

    function test_algebraBuy_ramsesSell() public {
        _assertRoundTrip(500e6, _one(SPY_ALGEBRA_USDG, USDG), _one(SPY_RAMSES_USDG, SPY), "algebra -> ramses", 9_700);
    }

    function test_ramsesBuy_algebraSell() public {
        _assertRoundTrip(500e6, _one(SPY_RAMSES_USDG, USDG), _one(SPY_ALGEBRA_USDG, SPY), "ramses -> algebra", 9_700);
    }

    function test_slipstreamBuy_uniswapSell() public {
        _assertRoundTrip(500e6, _one(NVDA_UP_USDG, USDG), _one(NVDA_UNI_V3_USDG, NVDA), "up -> uniswap v3", 9_700);
    }

    // ---- Uniswap v4 ----

    /// @dev META / USDG on v4. `fee` and `tickSpacing` select the pool: 0.30% / 60 and 0.031% / 3 both exist.
    function _v4(address tokenIn, address tokenOut, uint24 fee, int24 tickSpacing) internal pure returns (AtomicArb.Hop[] memory h) {
        h = new AtomicArb.Hop[](1);
        h[0] = AtomicArb.Hop({pool: POOL_MANAGER, tokenIn: tokenIn, tokenOut: tokenOut, fee: fee, tickSpacing: tickSpacing, hooks: address(0)});
    }

    function test_v4Buy_v3Sell() public {
        _assertRoundTrip(500e6, _v4(USDG, META, 3000, 60), _one(META_UNI_V3_USDG, META), "v4 -> uniswap v3", 9_700);
        assertEq(IERC20(META).balanceOf(address(arb)), 0, "no stock left behind");
    }

    function test_v3Buy_v4Sell() public {
        _assertRoundTrip(500e6, _one(META_UNI_V3_USDG, USDG), _v4(META, USDG, 3000, 60), "uniswap v3 -> v4", 9_700);
    }

    function test_v4Buy_v4Sell() public {
        _assertRoundTrip(500e6, _v4(USDG, META, 3000, 60), _v4(META, USDG, 310, 3), "v4 -> v4", 9_700);
    }

    function test_v4UnknownPool_reverts() public {
        vm.prank(user);
        vm.expectRevert(); // the PoolManager rejects a key that was never initialized
        arb.arb(100e6, _v4(USDG, META, 3000, 61), _one(META_UNI_V3_USDG, META), 0);
    }

    function test_v4HopMustNameADifferentOutput() public {
        vm.prank(user);
        vm.expectRevert(AtomicArb.BadPath.selector);
        arb.arb(100e6, _v4(USDG, USDG, 3000, 60), _one(META_UNI_V3_USDG, META), 0);
    }

    function test_unlockCallbackFromStranger_reverts() public {
        vm.expectRevert(AtomicArb.NotPoolManager.selector);
        arb.unlockCallback("");
        // the PoolManager itself cannot be used to reach it outside a trade either
        vm.prank(POOL_MANAGER);
        vm.expectRevert(AtomicArb.NoContext.selector);
        arb.unlockCallback("");
    }

    // ---- deterministic money flow ----

    function _profitablePools(uint8 mode) internal returns (AtomicArb.Hop[] memory buy, AtomicArb.Hop[] memory sell, MockToken stock) {
        stock = new MockToken();
        FakePool cheap = new FakePool(USDG, address(stock), 1e12, 1, mode); // 1 USDG buys 1 stock (18 dec)
        FakePool dear = new FakePool(address(stock), USDG, 101, 100e12, 0); // 1 stock sells for 1.01 USDG
        stock.mint(address(cheap), 1_000_000e18);
        deal(USDG, address(dear), 1_000_000e6);
        buy = _one(address(cheap), USDG);
        sell = _one(address(dear), address(stock));
    }

    function test_profitGoesToCaller_feeToTreasury() public {
        (AtomicArb.Hop[] memory buy, AtomicArb.Hop[] memory sell,) = _profitablePools(0);
        address treasury = arb.FEES().treasury();
        uint256 treasuryBefore = IERC20(USDG).balanceOf(treasury);
        uint256 size = 10_000e6;
        uint256 fee = arb.FEES().feeFor(user, size);
        assertGt(fee, 0, "a wallet without the token pays the fee");

        vm.prank(user);
        uint256 profit = arb.arb(size, buy, sell, 90e6);

        assertEq(profit, 100e6 - fee, "arb returns the profit it paid out");
        assertEq(IERC20(USDG).balanceOf(treasury) - treasuryBefore, fee, "fee to treasury");
        assertEq(IERC20(USDG).balanceOf(user), 100e6 - fee, "1% gap minus the fee to the caller");
        assertEq(IERC20(USDG).balanceOf(address(arb)), 0, "nothing left behind");
    }

    function test_holderPaysNoFee() public {
        (AtomicArb.Hop[] memory buy, AtomicArb.Hop[] memory sell,) = _profitablePools(0);
        deal(ATOMIC, user, 100_000e18);
        assertEq(arb.FEES().feeFor(user, 10_000e6), 0, "holder waiver read from the router");
        vm.prank(user);
        arb.arb(10_000e6, buy, sell, 0);
        assertEq(IERC20(USDG).balanceOf(user), 100e6, "the whole gap to the holder");
    }

    function test_revertsBelowMinProfit() public {
        (AtomicArb.Hop[] memory buy, AtomicArb.Hop[] memory sell,) = _profitablePools(0);
        vm.prank(user);
        vm.expectPartialRevert(AtomicArb.InsufficientOutput.selector);
        arb.arb(10_000e6, buy, sell, 100e6); // the gap is 100 before the fee, so 100 after it is out of reach
    }

    // ---- protections ----

    function test_poolCannotTakeMoreThanItWasSent() public {
        (AtomicArb.Hop[] memory buy, AtomicArb.Hop[] memory sell,) = _profitablePools(1);
        vm.prank(user);
        vm.expectRevert(AtomicArb.BadCallback.selector);
        arb.arb(10_000e6, buy, sell, 0);
    }

    function test_poolCannotCallBackTwice() public {
        (AtomicArb.Hop[] memory buy, AtomicArb.Hop[] memory sell,) = _profitablePools(2);
        vm.prank(user);
        vm.expectRevert(AtomicArb.BadCallback.selector);
        arb.arb(10_000e6, buy, sell, 0);
    }

    function test_callbackFromStranger_reverts() public {
        vm.expectRevert(AtomicArb.NotActivePool.selector);
        arb.uniswapV3SwapCallback(1, 0, "");
        vm.expectRevert(AtomicArb.NotActivePool.selector);
        arb.pancakeV3SwapCallback(0, 1, "");
        vm.expectRevert(AtomicArb.NotActivePool.selector);
        arb.algebraSwapCallback(1, 0, "");
    }

    function test_flashCallbackFromStranger_reverts() public {
        vm.expectRevert(AtomicArb.NotMorpho.selector);
        arb.onMorphoFlashLoan(1, "");
    }

    function test_pathMustChain() public {
        // first hop must take USDG
        vm.prank(user);
        vm.expectRevert(AtomicArb.BadPath.selector);
        arb.arb(100e6, _one(CRCL_UNI_USDG, CRCL), _one(CRCL_GIGA_USDG, CRCL), 0);
        // the sell side must end in USDG
        vm.prank(user);
        vm.expectRevert(AtomicArb.BadPath.selector);
        arb.arb(100e6, _one(SPY_RAMSES_USDG, USDG), _one(SPY_UNI_WETH, SPY), 0);
        // a pool that does not hold the token at all
        vm.prank(user);
        vm.expectRevert(AtomicArb.BadPath.selector);
        arb.arb(100e6, _one(SPY_UNI_WETH, USDG), _one(SPY_RAMSES_USDG, SPY), 0);
    }

    function test_emptyAndZero_revert() public {
        AtomicArb.Hop[] memory none = new AtomicArb.Hop[](0);
        vm.prank(user);
        vm.expectRevert(AtomicArb.BadPath.selector);
        arb.arb(100e6, none, _one(CRCL_GIGA_USDG, CRCL), 0);
        vm.prank(user);
        vm.expectRevert(AtomicArb.ZeroAmount.selector);
        arb.arb(0, _one(CRCL_UNI_USDG, USDG), _one(CRCL_GIGA_USDG, CRCL), 0);
    }
}
