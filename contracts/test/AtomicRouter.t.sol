// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {AtomicRouter} from "../src/AtomicRouter.sol";
import {IMorpho, MarketParams, MarketParamsLib} from "../src/interfaces/IMorpho.sol";
import {IERC20} from "../src/interfaces/ISwapRouter02.sol";

/// @notice Fork tests against Robinhood Chain mainnet: real Morpho markets, real Uniswap pools.
///         forge test --fork-url $RPC_URL -vv
contract AtomicRouterForkTest is Test {
    using MarketParamsLib for MarketParams;

    address constant MORPHO = 0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010;
    address constant SWAP_ROUTER_02 = 0xCaf681a66D020601342297493863E78C959E5cb2;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant NVDA = 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC;
    address constant AAPL = 0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9;
    address constant GOOGL = 0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3;
    bytes32 constant NVDA_MARKET = 0x8b16891f032a93b771347c9cb470a780e6699dd701553d3402aa3cdba6189c3e;
    bytes32 constant AAPL_MARKET = 0xdeb4782d012d5fd3b24962538c2f6559049d70bda4dabd2e4212dacb96c28d45;
    bytes32 constant GOOGL_MARKET = 0x7fa81b10e5d21b2e4c571f862442bc11aff2ed14f02335868d0ff933fd40d0ba; // AAPL's market ran dry in Oct 2026, rotations target GOOGL

    IMorpho morpho = IMorpho(MORPHO);
    AtomicRouter router;
    MarketParams nvda;
    MarketParams aapl;
    MarketParams googl;
    address user = makeAddr("user");
    address treasury = makeAddr("treasury");

    function setUp() public {
        vm.createSelectFork(vm.envOr("RPC_URL", string("https://robinhood.drpc.org")));
        router = new AtomicRouter(MORPHO, SWAP_ROUTER_02, USDG, treasury, 5);
        nvda = _params(NVDA_MARKET);
        aapl = _params(AAPL_MARKET);
        googl = _params(GOOGL_MARKET);
        assertEq(nvda.collateralToken, NVDA, "nvda market");
        assertEq(aapl.collateralToken, AAPL, "aapl market");

        // Morpho itself holds tens of millions of idle USDG; borrow some as a test balance.
        vm.prank(MORPHO);
        IERC20(USDG).transfer(user, 50_000e6);

        vm.startPrank(user);
        IERC20(USDG).approve(address(router), type(uint256).max);
        morpho.setAuthorization(address(router), true);
        vm.stopPrank();
    }

    function _params(bytes32 id) internal view returns (MarketParams memory p) {
        (p.loanToken, p.collateralToken, p.oracle, p.irm, p.lltv) = morpho.idToMarketParams(id);
    }

    function _path(address a, uint24 fee, address b) internal pure returns (bytes memory) {
        return abi.encodePacked(a, fee, b);
    }

    function _open(uint256 deposit, uint256 flash) internal {
        vm.prank(user);
        router.openLeverage(nvda, deposit, flash, _path(USDG, 500, NVDA), 0);
    }

    // ------------------------------------------------------------------------------------------

    function test_openLeverage_2x() public {
        uint256 deposit = 1_000e6;
        uint256 flash = 1_000e6;
        uint256 balBefore = IERC20(USDG).balanceOf(user);

        _open(deposit, flash);

        (, uint128 borrowShares, uint128 collateral) = morpho.position(NVDA_MARKET, user);
        uint256 debt = router.debtAssets(nvda, user);
        console.log("collateral NVDA (1e18):", collateral);
        console.log("debt USDG (1e6):", debt);

        assertGt(collateral, 0, "collateral supplied");
        assertGt(borrowShares, 0, "debt opened");
        assertApproxEqRel(debt, flash + router.feeOn(flash), 0.0001e18, "debt = flash + fee");
        assertEq(IERC20(USDG).balanceOf(user), balBefore - deposit, "user paid only the deposit");
        assertEq(IERC20(USDG).balanceOf(treasury), router.feeOn(flash), "fee to treasury");
        assertEq(IERC20(USDG).balanceOf(address(router)), 0, "router holds no USDG");
        assertEq(IERC20(NVDA).balanceOf(address(router)), 0, "router holds no NVDA");
        // ~2x: collateral value should be near 2 * deposit. Oracle price is ~$223 so 2000 USDG ~ 8.9 NVDA.
        assertGt(collateral, 8e18, "about 2x exposure");
    }

    function test_closePosition_returnsUsdg() public {
        _open(1_000e6, 1_000e6);
        uint256 balBefore = IERC20(USDG).balanceOf(user);

        vm.prank(user);
        router.closePosition(nvda, _path(NVDA, 500, USDG), 0);

        (, uint128 borrowShares, uint128 collateral) = morpho.position(NVDA_MARKET, user);
        assertEq(borrowShares, 0, "debt cleared");
        assertEq(collateral, 0, "collateral withdrawn");
        uint256 back = IERC20(USDG).balanceOf(user) - balBefore;
        console.log("USDG back after round trip (1e6):", back);
        // Round trip costs two 0.05% swaps plus two 0.05% router fees on ~1000 flash: expect > 990 of 1000.
        assertGt(back, 985e6, "most of the deposit comes back");
        assertLt(back, 1_000e6, "cannot exceed the deposit without price movement");
        assertEq(IERC20(USDG).balanceOf(address(router)), 0, "router empty");
    }

    function test_rotate_nvdaToAapl() public {
        _open(1_000e6, 1_000e6);
        uint256 debtBefore = router.debtAssets(nvda, user);

        vm.prank(user);
        router.rotate(nvda, googl, abi.encodePacked(NVDA, uint24(500), USDG, uint24(500), GOOGL), 0);

        (, uint128 sharesFrom, uint128 collFrom) = morpho.position(NVDA_MARKET, user);
        (, uint128 sharesTo, uint128 collTo) = morpho.position(GOOGL_MARKET, user);
        uint256 debtAfter = router.debtAssets(googl, user);
        console.log("GOOGL collateral (1e18):", collTo);
        console.log("debt before / after (1e6):", debtBefore, debtAfter);

        assertEq(sharesFrom, 0, "old debt cleared");
        assertEq(collFrom, 0, "old collateral gone");
        assertGt(collTo, 0, "new collateral supplied");
        assertGt(sharesTo, 0, "debt re-opened");
        assertApproxEqRel(debtAfter, debtBefore + router.feeOn(debtBefore), 0.0001e18, "debt moved plus fee");
        assertEq(IERC20(NVDA).balanceOf(address(router)) + IERC20(GOOGL).balanceOf(address(router)), 0, "router empty");
    }

    function test_arb_revertsWhenNoSpread() public {
        // Same pool both ways can never clear two fees; the whole transaction must revert.
        vm.prank(user);
        vm.expectRevert();
        router.arb(5_000e6, _path(USDG, 500, NVDA), _path(NVDA, 500, USDG), 0);
        assertEq(IERC20(USDG).balanceOf(address(router)), 0, "nothing left behind");
    }

    function test_reverts_withoutAuthorization() public {
        address stranger = makeAddr("stranger");
        vm.prank(MORPHO);
        IERC20(USDG).transfer(stranger, 2_000e6);
        vm.startPrank(stranger);
        IERC20(USDG).approve(address(router), type(uint256).max);
        vm.expectRevert(AtomicRouter.NotAuthorizedOnMorpho.selector);
        router.openLeverage(nvda, 1_000e6, 1_000e6, _path(USDG, 500, NVDA), 0);
        vm.stopPrank();
    }

    function test_reverts_onSlippage() public {
        vm.prank(user);
        vm.expectRevert();
        router.openLeverage(nvda, 1_000e6, 1_000e6, _path(USDG, 500, NVDA), type(uint256).max);
    }

    function test_callback_rejectsStrangers() public {
        vm.expectRevert(AtomicRouter.NotMorpho.selector);
        router.onMorphoFlashLoan(1, "");
    }

    function test_close_withoutPosition_reverts() public {
        vm.prank(user);
        vm.expectRevert(AtomicRouter.NoPosition.selector);
        router.closePosition(nvda, _path(NVDA, 500, USDG), 0);
    }

    function test_owner_feeBounds() public {
        vm.expectRevert(AtomicRouter.FeeTooHigh.selector);
        router.setFee(51);
        router.setFee(10);
        assertEq(router.feeBps(), 10);
        vm.prank(user);
        vm.expectRevert(AtomicRouter.NotOwner.selector);
        router.setFee(1);
    }

    // ---- v1.2: holder fee waiver ----

    function test_holderDiscount_waivesFee() public {
        // USDG stands in for the ATOMIC token: the user already holds it from the deposit.
        router.setHolderDiscount(USDG, 1e6);
        assertEq(router.feeFor(user, 1_000e6), 0, "holder pays nothing");
        address stranger = makeAddr("stranger");
        assertEq(router.feeFor(stranger, 1_000e6), router.feeOn(1_000e6), "non-holder pays the normal fee");
    }

    function test_holderDiscount_thresholdAndClear() public {
        router.setHolderDiscount(USDG, type(uint256).max);
        assertEq(router.feeFor(user, 1_000e6), router.feeOn(1_000e6), "below threshold pays");
        router.setHolderDiscount(address(0), 0);
        assertEq(router.feeFor(user, 1_000e6), router.feeOn(1_000e6), "cleared pays");
    }

    function test_holderDiscount_revertingTokenFallsBackToFee() public {
        router.setHolderDiscount(address(0xdead), 1); // no code at all: must not break the action
        assertEq(router.feeFor(user, 1_000e6), router.feeOn(1_000e6), "broken token never blocks the action");
        router.setHolderDiscount(address(MORPHO), 1); // code, but no balanceOf: the call reverts and the fee applies
        assertEq(router.feeFor(user, 1_000e6), router.feeOn(1_000e6), "reverting balanceOf never blocks the action");
    }

    function test_holderDiscount_onlyOwner() public {
        vm.prank(user);
        vm.expectRevert(AtomicRouter.NotOwner.selector);
        router.setHolderDiscount(USDG, 1);
    }
}
