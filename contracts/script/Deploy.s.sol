// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {AtomicRouter} from "../src/AtomicRouter.sol";

/// @notice Deploys the router on Robinhood Chain.
///         forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
contract Deploy is Script {
    address constant MORPHO = 0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010;
    address constant SWAP_ROUTER_02 = 0xCaf681a66D020601342297493863E78C959E5cb2;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY");
        uint16 feeBps = uint16(vm.envOr("FEE_BPS", uint256(5)));

        vm.startBroadcast(pk);
        AtomicRouter router = new AtomicRouter(MORPHO, SWAP_ROUTER_02, USDG, treasury, feeBps);
        vm.stopBroadcast();

        console.log("AtomicRouter:", address(router));
        console.log("treasury:", treasury);
        console.log("feeBps:", feeBps);
    }
}
