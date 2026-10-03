// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

struct MarketParams {
    address loanToken;
    address collateralToken;
    address oracle;
    address irm;
    uint256 lltv;
}

/// @dev Minimal Morpho Blue surface used by the router.
interface IMorpho {
    function flashLoan(address token, uint256 assets, bytes calldata data) external;

    function supplyCollateral(MarketParams calldata marketParams, uint256 assets, address onBehalf, bytes calldata data) external;

    function withdrawCollateral(MarketParams calldata marketParams, uint256 assets, address onBehalf, address receiver) external;

    function borrow(MarketParams calldata marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver)
        external
        returns (uint256 assetsBorrowed, uint256 sharesBorrowed);

    function repay(MarketParams calldata marketParams, uint256 assets, uint256 shares, address onBehalf, bytes calldata data)
        external
        returns (uint256 assetsRepaid, uint256 sharesRepaid);

    function accrueInterest(MarketParams calldata marketParams) external;

    function setAuthorization(address authorized, bool newIsAuthorized) external;

    function isAuthorized(address authorizer, address authorized) external view returns (bool);

    function position(bytes32 id, address user) external view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral);

    function market(bytes32 id)
        external
        view
        returns (
            uint128 totalSupplyAssets,
            uint128 totalSupplyShares,
            uint128 totalBorrowAssets,
            uint128 totalBorrowShares,
            uint128 lastUpdate,
            uint128 fee
        );

    function idToMarketParams(bytes32 id)
        external
        view
        returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv);
}

interface IMorphoFlashLoanCallback {
    function onMorphoFlashLoan(uint256 assets, bytes calldata data) external;
}

library MarketParamsLib {
    function id(MarketParams memory m) internal pure returns (bytes32) {
        return keccak256(abi.encode(m));
    }
}
