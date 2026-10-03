// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IMorpho, IMorphoFlashLoanCallback, MarketParams, MarketParamsLib} from "./interfaces/IMorpho.sol";
import {ISwapRouter02, IERC20} from "./interfaces/ISwapRouter02.sol";

/// @title AtomicRouter
/// @notice Borrow, swap, repay in one transaction. Composes a Morpho flash loan with Uniswap v3 swaps and
///         Morpho collateral/borrow calls so a leveraged position can be opened, closed or rotated, or a
///         two-venue spread captured, inside a single block. The router holds no funds between transactions;
///         positions live on Morpho under the caller's own address.
/// @dev Every entry point sets a per-call context (user + action) that the flash-loan callback verifies.
///      Callers must have authorized this router on Morpho (`setAuthorization`) for actions that borrow or
///      withdraw collateral on their behalf: leverage, close and rotate.
contract AtomicRouter is IMorphoFlashLoanCallback {
    using MarketParamsLib for MarketParams;

    // ---------------------------------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------------------------------

    enum Action {
        Leverage,
        Close,
        Rotate,
        Arb
    }

    struct LeverageData {
        MarketParams market;
        uint256 deposit;
        bytes path; // Uniswap v3 path, USDG -> collateral
        uint256 minCollateralOut;
    }

    struct CloseData {
        MarketParams market;
        uint128 borrowShares;
        uint128 collateral;
        bytes path; // collateral -> USDG
        uint256 minUsdgOut;
    }

    struct RotateData {
        MarketParams from;
        MarketParams to;
        uint128 borrowShares;
        uint128 collateral;
        bytes path; // from collateral -> to collateral
        uint256 minCollateralOut;
    }

    struct ArbData {
        bytes buyPath; // USDG -> token
        bytes sellPath; // token -> USDG
        uint256 minProfit;
    }

    // ---------------------------------------------------------------------------------------------
    // Errors and events
    // ---------------------------------------------------------------------------------------------

    error NotMorpho();
    error NotOwner();
    error NoContext();
    error WrongLoanToken();
    error ZeroAmount();
    error FeeTooHigh();
    error NotAuthorizedOnMorpho();
    error NoPosition();
    error InsufficientOutput(uint256 got, uint256 need);
    error Reentrancy();
    error BadPath();

    event Leveraged(address indexed user, bytes32 indexed marketId, uint256 deposit, uint256 flash, uint256 collateralOut, uint256 debt);
    event Closed(address indexed user, bytes32 indexed marketId, uint256 debtRepaid, uint256 collateralSold, uint256 usdgOut);
    event Rotated(address indexed user, bytes32 indexed fromId, bytes32 indexed toId, uint256 debt, uint256 collateralIn, uint256 collateralOut);
    event Arbed(address indexed user, uint256 size, uint256 profit);
    event FeeUpdated(uint16 feeBps);
    event TreasuryUpdated(address treasury);
    event HolderDiscountUpdated(address token, uint256 minBalance);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ---------------------------------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------------------------------

    IMorpho public immutable MORPHO;
    ISwapRouter02 public immutable SWAP_ROUTER;
    IERC20 public immutable USDG;

    uint16 public constant MAX_FEE_BPS = 50; // 0.50%
    uint16 public feeBps;
    address public treasury;
    address public owner;

    /// @notice Wallets holding at least `holderMin` of `holderToken` pay no router fee. Zero address disables it.
    address public holderToken;
    uint256 public holderMin;

    address private _ctxUser;
    uint8 private _ctxAction;
    uint8 private _lock;

    // ---------------------------------------------------------------------------------------------
    // Setup
    // ---------------------------------------------------------------------------------------------

    constructor(address morpho, address swapRouter, address usdg, address treasury_, uint16 feeBps_) {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        MORPHO = IMorpho(morpho);
        SWAP_ROUTER = ISwapRouter02(swapRouter);
        USDG = IERC20(usdg);
        treasury = treasury_;
        feeBps = feeBps_;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_lock == 1) revert Reentrancy();
        _lock = 1;
        _;
        _lock = 0;
    }

    function setFee(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    /// @notice Set (or clear, with the zero address) the token and minimum balance that waive the fee.
    function setHolderDiscount(address token, uint256 minBalance) external onlyOwner {
        holderToken = token;
        holderMin = minBalance;
        emit HolderDiscountUpdated(token, minBalance);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Sweeps any token that ended up here by mistake. The router never holds funds by design.
    function rescue(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(treasury, amount);
    }

    // ---------------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------------

    /// @notice Current debt of `user` in `market`, in USDG, before interest accrual in this block.
    function debtAssets(MarketParams calldata market, address user) external view returns (uint256) {
        bytes32 id = market.id();
        (, uint128 borrowShares,) = MORPHO.position(id, user);
        (,, uint128 totalBorrowAssets, uint128 totalBorrowShares,,) = MORPHO.market(id);
        return _toAssetsUp(borrowShares, totalBorrowAssets, totalBorrowShares);
    }

    /// @notice Fee charged on a flash amount at the current rate.
    function feeOn(uint256 flashAmount) public view returns (uint256) {
        return (flashAmount * feeBps) / 10_000;
    }

    /// @notice Fee `user` pays on a flash amount: zero for qualifying holders, otherwise `feeOn`.
    ///         A misbehaving holder token can never block an action: if `balanceOf` reverts, the normal fee applies.
    function feeFor(address user, uint256 flashAmount) public view returns (uint256) {
        if (holderToken != address(0) && holderToken.code.length > 0) {
            try IERC20(holderToken).balanceOf(user) returns (uint256 bal) {
                if (bal >= holderMin) return 0;
            } catch {}
        }
        return feeOn(flashAmount);
    }

    // ---------------------------------------------------------------------------------------------
    // Actions
    // ---------------------------------------------------------------------------------------------

    /// @notice Open a leveraged long: `deposit` USDG from the caller plus `flashAmount` flash-borrowed USDG
    ///         are swapped into the market's collateral, supplied on the caller's behalf, and the flash loan
    ///         plus fee is borrowed back from the same market.
    function openLeverage(MarketParams calldata market, uint256 deposit, uint256 flashAmount, bytes calldata path, uint256 minCollateralOut)
        external
        nonReentrant
    {
        if (market.loanToken != address(USDG)) revert WrongLoanToken();
        if (deposit == 0 && flashAmount == 0) revert ZeroAmount();
        if (!MORPHO.isAuthorized(msg.sender, address(this))) revert NotAuthorizedOnMorpho();
        _checkPath(path, address(USDG), market.collateralToken);
        if (deposit > 0) USDG.transferFrom(msg.sender, address(this), deposit);

        bytes memory data = abi.encode(LeverageData({market: market, deposit: deposit, path: path, minCollateralOut: minCollateralOut}));
        _run(Action.Leverage, flashAmount, data);
    }

    /// @notice Close the caller's whole position in `market`: flash-borrow the debt, repay it, withdraw all
    ///         collateral, sell it for USDG, repay the flash loan plus fee and send the remainder to the caller.
    function closePosition(MarketParams calldata market, bytes calldata path, uint256 minUsdgOut) external nonReentrant {
        if (market.loanToken != address(USDG)) revert WrongLoanToken();
        if (!MORPHO.isAuthorized(msg.sender, address(this))) revert NotAuthorizedOnMorpho();

        _checkPath(path, market.collateralToken, address(USDG));
        (uint256 debt, uint128 borrowShares, uint128 collateral) = _accrueAndRead(market, msg.sender);
        if (collateral == 0) revert NoPosition();

        bytes memory data = abi.encode(
            CloseData({market: market, borrowShares: borrowShares, collateral: collateral, path: path, minUsdgOut: minUsdgOut})
        );
        _run(Action.Close, debt, data);
    }

    /// @notice Move the caller's whole position from one market to another without changing the USDG debt:
    ///         flash-borrow the debt, repay and withdraw in `from`, swap the collateral, supply and re-borrow in `to`.
    function rotate(MarketParams calldata from, MarketParams calldata to, bytes calldata path, uint256 minCollateralOut)
        external
        nonReentrant
    {
        if (from.loanToken != address(USDG) || to.loanToken != address(USDG)) revert WrongLoanToken();
        if (!MORPHO.isAuthorized(msg.sender, address(this))) revert NotAuthorizedOnMorpho();

        _checkPath(path, from.collateralToken, to.collateralToken);
        (uint256 debt, uint128 borrowShares, uint128 collateral) = _accrueAndRead(from, msg.sender);
        if (collateral == 0) revert NoPosition();

        bytes memory data = abi.encode(
            RotateData({from: from, to: to, borrowShares: borrowShares, collateral: collateral, path: path, minCollateralOut: minCollateralOut})
        );
        _run(Action.Rotate, debt, data);
    }

    /// @notice Capture a spread between two venues with flash-borrowed USDG. Reverts unless the round trip
    ///         returns at least `size + fee + minProfit`; the profit goes to the caller.
    function arb(uint256 size, bytes calldata buyPath, bytes calldata sellPath, uint256 minProfit) external nonReentrant {
        if (size == 0) revert ZeroAmount();
        address mid = _lastToken(buyPath);
        _checkPath(buyPath, address(USDG), mid);
        _checkPath(sellPath, mid, address(USDG));
        bytes memory data = abi.encode(ArbData({buyPath: buyPath, sellPath: sellPath, minProfit: minProfit}));
        _run(Action.Arb, size, data);
    }

    // ---------------------------------------------------------------------------------------------
    // Flash-loan callback
    // ---------------------------------------------------------------------------------------------

    function onMorphoFlashLoan(uint256 assets, bytes calldata data) external override {
        if (msg.sender != address(MORPHO)) revert NotMorpho();
        address user = _ctxUser;
        if (user == address(0) || _lock != 1) revert NoContext();
        Action action = Action(_ctxAction);

        if (action == Action.Leverage) _leverage(user, assets, abi.decode(data, (LeverageData)));
        else if (action == Action.Close) _close(user, assets, abi.decode(data, (CloseData)));
        else if (action == Action.Rotate) _rotate(user, assets, abi.decode(data, (RotateData)));
        else _arb(user, assets, abi.decode(data, (ArbData)));

        // Morpho pulls `assets` back with transferFrom after this returns.
        _approve(USDG, address(MORPHO), assets);
    }

    // ---------------------------------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------------------------------

    function _run(Action action, uint256 flashAmount, bytes memory data) private {
        _ctxUser = msg.sender;
        _ctxAction = uint8(action);
        if (flashAmount > 0) {
            MORPHO.flashLoan(address(USDG), flashAmount, data);
        } else if (action == Action.Leverage) {
            // Nothing to borrow (a leverage of exactly 1x): run the recipe directly.
            _leverage(msg.sender, 0, abi.decode(data, (LeverageData)));
        } else if (action == Action.Close) {
            _close(msg.sender, 0, abi.decode(data, (CloseData)));
        } else if (action == Action.Rotate) {
            _rotate(msg.sender, 0, abi.decode(data, (RotateData)));
        } else {
            revert ZeroAmount();
        }
        _ctxUser = address(0);
        _ctxAction = 0;
    }

    function _leverage(address user, uint256 flash, LeverageData memory d) private {
        uint256 amountIn = d.deposit + flash;
        uint256 collateralOut = _swap(d.path, amountIn, d.minCollateralOut);

        IERC20 collateral = IERC20(d.market.collateralToken);
        _approve(collateral, address(MORPHO), collateralOut);
        MORPHO.supplyCollateral(d.market, collateralOut, user, "");

        uint256 fee = feeFor(user, flash);
        uint256 debt = flash + fee;
        if (debt > 0) {
            MORPHO.borrow(d.market, debt, 0, user, address(this));
            if (fee > 0) USDG.transfer(treasury, fee);
        }
        emit Leveraged(user, d.market.id(), d.deposit, flash, collateralOut, debt);
    }

    function _close(address user, uint256 flash, CloseData memory d) private {
        if (d.borrowShares > 0) {
            _approve(USDG, address(MORPHO), flash);
            MORPHO.repay(d.market, 0, d.borrowShares, user, "");
        }
        MORPHO.withdrawCollateral(d.market, d.collateral, user, address(this));

        uint256 usdgOut = _swap(d.path, d.collateral, d.minUsdgOut);
        uint256 fee = feeFor(user, flash);
        uint256 owed = flash + fee;
        if (usdgOut < owed) revert InsufficientOutput(usdgOut, owed);
        if (fee > 0) USDG.transfer(treasury, fee);
        uint256 remainder = usdgOut - owed;
        if (remainder > 0) USDG.transfer(user, remainder);
        emit Closed(user, d.market.id(), flash, d.collateral, remainder);
    }

    function _rotate(address user, uint256 flash, RotateData memory d) private {
        if (d.borrowShares > 0) {
            _approve(USDG, address(MORPHO), flash);
            MORPHO.repay(d.from, 0, d.borrowShares, user, "");
        }
        MORPHO.withdrawCollateral(d.from, d.collateral, user, address(this));

        uint256 collateralOut = _swap(d.path, d.collateral, d.minCollateralOut);
        _approve(IERC20(d.to.collateralToken), address(MORPHO), collateralOut);
        MORPHO.supplyCollateral(d.to, collateralOut, user, "");

        uint256 fee = feeFor(user, flash);
        if (flash > 0) {
            MORPHO.borrow(d.to, flash + fee, 0, user, address(this));
            if (fee > 0) USDG.transfer(treasury, fee);
        }
        emit Rotated(user, d.from.id(), d.to.id(), flash, d.collateral, collateralOut);
    }

    function _arb(address user, uint256 flash, ArbData memory d) private {
        uint256 tokenOut = _swap(d.buyPath, flash, 0);
        uint256 usdgOut = _swap(d.sellPath, tokenOut, 0);
        uint256 fee = feeFor(user, flash);
        uint256 need = flash + fee + d.minProfit;
        if (usdgOut < need) revert InsufficientOutput(usdgOut, need);
        if (fee > 0) USDG.transfer(treasury, fee);
        uint256 profit = usdgOut - flash - fee;
        if (profit > 0) USDG.transfer(user, profit);
        emit Arbed(user, flash, profit);
    }

    /// @dev Swaps `amountIn` of the first token in `path` along a Uniswap v3 path, output to this contract.
    function _swap(bytes memory path, uint256 amountIn, uint256 minOut) private returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        address tokenIn = _firstToken(path);
        _approve(IERC20(tokenIn), address(SWAP_ROUTER), amountIn);
        amountOut = SWAP_ROUTER.exactInput(
            ISwapRouter02.ExactInputParams({path: path, recipient: address(this), amountIn: amountIn, amountOutMinimum: minOut})
        );
    }

    function _firstToken(bytes memory path) private pure returns (address token) {
        if (path.length < 43) revert BadPath();
        assembly {
            token := shr(96, mload(add(path, 32)))
        }
    }

    function _lastToken(bytes memory path) private pure returns (address token) {
        if (path.length < 43) revert BadPath();
        uint256 offset = path.length - 20;
        assembly {
            token := shr(96, mload(add(add(path, 32), offset)))
        }
    }

    /// @dev A Uniswap v3 path is 20 + n * 23 bytes and must start and end with the tokens the recipe expects,
    ///      so a caller can never route the router's own or stray balances through an unexpected token.
    function _checkPath(bytes memory path, address expectedIn, address expectedOut) private pure {
        if (path.length < 43 || (path.length - 20) % 23 != 0) revert BadPath();
        if (_firstToken(path) != expectedIn || _lastToken(path) != expectedOut) revert BadPath();
    }

    function _approve(IERC20 token, address spender, uint256 amount) private {
        if (token.allowance(address(this), spender) < amount) {
            token.approve(spender, 0);
            token.approve(spender, type(uint256).max);
        }
    }

    function _accrueAndRead(MarketParams calldata market, address user)
        private
        returns (uint256 debt, uint128 borrowShares, uint128 collateral)
    {
        MORPHO.accrueInterest(market);
        bytes32 id = market.id();
        (, borrowShares, collateral) = MORPHO.position(id, user);
        (,, uint128 totalBorrowAssets, uint128 totalBorrowShares,,) = MORPHO.market(id);
        debt = _toAssetsUp(borrowShares, totalBorrowAssets, totalBorrowShares);
    }

    /// @dev Mirrors Morpho's SharesMathLib.toAssetsUp with its virtual shares and assets.
    function _toAssetsUp(uint256 shares, uint256 totalAssets, uint256 totalShares) private pure returns (uint256) {
        if (shares == 0) return 0;
        uint256 num = shares * (totalAssets + 1);
        uint256 den = totalShares + 1e6;
        return (num + den - 1) / den;
    }
}
