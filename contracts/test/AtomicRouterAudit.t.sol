// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {AtomicRouter} from "../src/AtomicRouter.sol";
import {IMorpho, MarketParams, MarketParamsLib} from "../src/interfaces/IMorpho.sol";
import {IERC20} from "../src/interfaces/ISwapRouter02.sol";

/// @notice Adversarial fork tests written during the audit. Each one encodes a finding.
contract AtomicRouterAuditTest is Test {
    using MarketParamsLib for MarketParams;

    address constant MORPHO = 0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010;
    address constant SWAP_ROUTER_02 = 0xCaf681a66D020601342297493863E78C959E5cb2;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant NVDA = 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC;
    address constant AAPL = 0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9;
    address constant GOOGL = 0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3;
    bytes32 constant NVDA_MARKET = 0x8b16891f032a93b771347c9cb470a780e6699dd701553d3402aa3cdba6189c3e;
    bytes32 constant AAPL_MARKET = 0xdeb4782d012d5fd3b24962538c2f6559049d70bda4dabd2e4212dacb96c28d45;
    bytes32 constant GOOGL_MARKET = 0x7fa81b10e5d21b2e4c571f862442bc11aff2ed14f02335868d0ff933fd40d0ba;

    IMorpho morpho = IMorpho(MORPHO);
    AtomicRouter router;
    MarketParams nvda;
    MarketParams aapl;
    MarketParams googl;
    address user = makeAddr("user");
    address attacker = makeAddr("attacker");
    address treasury = makeAddr("treasury");

    function setUp() public {
        vm.createSelectFork(vm.envOr("RPC_URL", string("https://robinhood.drpc.org")));
        router = new AtomicRouter(MORPHO, SWAP_ROUTER_02, USDG, treasury, 5);
        (nvda.loanToken, nvda.collateralToken, nvda.oracle, nvda.irm, nvda.lltv) = morpho.idToMarketParams(NVDA_MARKET);
        (aapl.loanToken, aapl.collateralToken, aapl.oracle, aapl.irm, aapl.lltv) = morpho.idToMarketParams(AAPL_MARKET);
        (googl.loanToken, googl.collateralToken, googl.oracle, googl.irm, googl.lltv) = morpho.idToMarketParams(GOOGL_MARKET);
        for (uint256 i = 0; i < 2; i++) {
            address a = i == 0 ? user : attacker;
            vm.prank(MORPHO);
            IERC20(USDG).transfer(a, 20_000e6);
            vm.startPrank(a);
            IERC20(USDG).approve(address(router), type(uint256).max);
            morpho.setAuthorization(address(router), true);
            vm.stopPrank();
        }
    }

    function _p(address a, uint24 f, address b) internal pure returns (bytes memory) {
        return abi.encodePacked(a, f, b);
    }

    // Finding A1: a crafted path must not be able to move tokens that are not part of the recipe.
    // Scenario: someone sent NVDA to the router by mistake; an attacker tries to claim it as collateral
    // by opening a "leverage" whose swap buys AAPL while the market is NVDA.
    function test_A1_pathMismatch_cannotStealStrayCollateral() public {
        vm.prank(0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3); // NVDA/USDG pool holds plenty of NVDA
        IERC20(NVDA).transfer(address(router), 5e18);

        vm.prank(attacker);
        vm.expectRevert(AtomicRouter.BadPath.selector);
        router.openLeverage(nvda, 1_000e6, 1_000e6, _p(USDG, 500, AAPL), 0);
        assertEq(IERC20(NVDA).balanceOf(address(router)), 5e18, "stray NVDA untouched");
    }

    // Finding A1 (close variant): selling a token other than the market's collateral is rejected.
    function test_A1_closePathMismatch_reverts() public {
        vm.prank(user);
        router.openLeverage(nvda, 1_000e6, 1_000e6, _p(USDG, 500, NVDA), 0);
        vm.prank(user);
        vm.expectRevert(AtomicRouter.BadPath.selector);
        router.closePosition(nvda, _p(AAPL, 500, USDG), 0);
    }

    // Finding A1 (arb variant): buy and sell legs must connect and must start and end in USDG.
    function test_A1_arbPathsMustConnect() public {
        vm.prank(user);
        vm.expectRevert(AtomicRouter.BadPath.selector);
        router.arb(1_000e6, _p(USDG, 500, NVDA), _p(AAPL, 500, USDG), 0);
        vm.prank(user);
        vm.expectRevert(AtomicRouter.BadPath.selector);
        router.arb(1_000e6, _p(USDG, 500, NVDA), _p(NVDA, 500, AAPL), 0);
    }

    // Finding A2: a position with collateral but no debt (1x, or debt repaid elsewhere) must be closable.
    function test_A2_closeDebtFreePosition() public {
        vm.prank(user);
        router.openLeverage(nvda, 1_000e6, 0, _p(USDG, 500, NVDA), 0); // 1x: no flash, no debt
        (, uint128 shares, uint128 coll) = morpho.position(NVDA_MARKET, user);
        assertEq(shares, 0);
        assertGt(coll, 0);

        uint256 before = IERC20(USDG).balanceOf(user);
        vm.prank(user);
        router.closePosition(nvda, _p(NVDA, 500, USDG), 0);
        (, , uint128 collAfter) = morpho.position(NVDA_MARKET, user);
        assertEq(collAfter, 0, "collateral withdrawn");
        assertGt(IERC20(USDG).balanceOf(user) - before, 990e6, "sale proceeds returned");
    }

    // Finding A2 (rotate variant): a debt-free position rotates without borrowing anything.
    function test_A2_rotateDebtFreePosition() public {
        vm.prank(user);
        router.openLeverage(nvda, 1_000e6, 0, _p(USDG, 500, NVDA), 0);
        vm.prank(user);
        router.rotate(nvda, googl, abi.encodePacked(NVDA, uint24(500), USDG, uint24(500), GOOGL), 0);
        (, uint128 sharesTo, uint128 collTo) = morpho.position(GOOGL_MARKET, user);
        assertEq(sharesTo, 0, "still no debt");
        assertGt(collTo, 0, "GOOGL collateral");
    }

    // Finding A3: the callback only runs inside an entry point, never from a cold start.
    function test_A3_callbackNeedsActiveContext() public {
        vm.prank(MORPHO);
        vm.expectRevert(AtomicRouter.NoContext.selector);
        router.onMorphoFlashLoan(1, "");
    }

    // Finding A4: a user can only ever act on their own position. Authorization given to the router by
    // the victim cannot be used by anyone else, because the recipe always targets msg.sender.
    function test_A4_cannotActOnSomeoneElsesPosition() public {
        vm.prank(user);
        router.openLeverage(nvda, 1_000e6, 1_000e6, _p(USDG, 500, NVDA), 0);
        (, uint128 sharesBefore, uint128 collBefore) = morpho.position(NVDA_MARKET, user);

        // Attacker has no position: close and rotate revert with NoPosition, the victim is untouched.
        vm.startPrank(attacker);
        vm.expectRevert(AtomicRouter.NoPosition.selector);
        router.closePosition(nvda, _p(NVDA, 500, USDG), 0);
        vm.expectRevert(AtomicRouter.NoPosition.selector);
        router.rotate(nvda, googl, abi.encodePacked(NVDA, uint24(500), USDG, uint24(500), GOOGL), 0);
        vm.stopPrank();

        (, uint128 sharesAfter, uint128 collAfter) = morpho.position(NVDA_MARKET, user);
        assertEq(sharesAfter, sharesBefore);
        assertEq(collAfter, collBefore);
    }

    // Finding A5: malformed paths (wrong length) are rejected before any token moves.
    function test_A5_malformedPathRejected() public {
        vm.prank(user);
        vm.expectRevert(AtomicRouter.BadPath.selector);
        router.openLeverage(nvda, 1_000e6, 1_000e6, abi.encodePacked(USDG, uint24(500), NVDA, uint8(1)), 0);
    }

    // Finding A6: the router never keeps a balance after any successful recipe.
    function test_A6_routerNeverHoldsFunds() public {
        vm.startPrank(user);
        router.openLeverage(nvda, 1_000e6, 1_000e6, _p(USDG, 500, NVDA), 0);
        router.rotate(nvda, googl, abi.encodePacked(NVDA, uint24(500), USDG, uint24(500), GOOGL), 0);
        router.closePosition(googl, _p(GOOGL, 500, USDG), 0);
        vm.stopPrank();
        assertEq(IERC20(USDG).balanceOf(address(router)), 0);
        assertEq(IERC20(NVDA).balanceOf(address(router)), 0);
        assertEq(IERC20(GOOGL).balanceOf(address(router)), 0);
    }

    // Finding A7: the owner cannot touch user positions; the only privileged actions are fee, treasury,
    // ownership and sweeping the router's own balance.
    function test_A7_ownerPowersAreBounded() public {
        vm.prank(user);
        router.openLeverage(nvda, 1_000e6, 1_000e6, _p(USDG, 500, NVDA), 0);
        // owner (this test contract) has no entry point that takes a user parameter
        router.setFee(50);
        vm.expectRevert(AtomicRouter.FeeTooHigh.selector);
        router.setFee(51);
        (, uint128 shares, uint128 coll) = morpho.position(NVDA_MARKET, user);
        assertGt(shares, 0);
        assertGt(coll, 0);
    }
}
