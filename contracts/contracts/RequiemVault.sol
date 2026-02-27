// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IRequiemVault.sol";

/**
 * @title RequiemVault
 * @notice Non-custodial staking vault where users deposit stablecoins (USDT/USDC).
 *         Pooled funds can be used by the ArbitrageRouter to execute cross-platform
 *         prediction market arbitrage. Profits are distributed proportionally to stakers.
 */
contract RequiemVault is IRequiemVault, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable stablecoin;

    uint256 public override totalShares;
    uint256 public override totalPooled;
    uint256 public totalProfitAccumulated;

    mapping(address => uint256) private _shares;
    mapping(address => uint256) private _points;

    address public router;

    modifier onlyRouter() {
        require(msg.sender == router, "RequiemVault: caller is not the router");
        _;
    }

    constructor(address _stablecoin) Ownable(msg.sender) {
        require(_stablecoin != address(0), "RequiemVault: zero address");
        stablecoin = IERC20(_stablecoin);
    }

    function setRouter(address _router) external onlyOwner {
        router = _router;
    }

    function deposit(uint256 amount) external override nonReentrant {
        require(amount > 0, "RequiemVault: zero deposit");

        uint256 sharesToMint;
        if (totalShares == 0 || totalPooled == 0) {
            sharesToMint = amount;
        } else {
            sharesToMint = (amount * totalShares) / totalPooled;
        }

        stablecoin.safeTransferFrom(msg.sender, address(this), amount);

        _shares[msg.sender] += sharesToMint;
        totalShares += sharesToMint;
        totalPooled += amount;

        _points[msg.sender] += amount / 1e18;

        emit Deposited(msg.sender, amount, sharesToMint);
    }

    function withdraw(uint256 shares) external override nonReentrant {
        require(shares > 0 && shares <= _shares[msg.sender], "RequiemVault: invalid shares");

        uint256 amountToReturn = (shares * totalPooled) / totalShares;

        _shares[msg.sender] -= shares;
        totalShares -= shares;
        totalPooled -= amountToReturn;

        stablecoin.safeTransfer(msg.sender, amountToReturn);

        emit Withdrawn(msg.sender, shares, amountToReturn);
    }

    /**
     * @notice Called by ArbitrageRouter to pull funds, execute a swap, then return profit.
     * @param amount The stablecoin amount to use for the arbitrage
     * @param target The external contract/address to call
     * @param data The calldata for the external call
     * @return profit Net profit after the arbitrage
     */
    function executeArbitrage(
        uint256 amount,
        address target,
        bytes calldata data
    ) external override onlyRouter nonReentrant returns (uint256 profit) {
        require(amount <= totalPooled, "RequiemVault: insufficient pool");
        require(target != address(0), "RequiemVault: zero target");

        uint256 balanceBefore = stablecoin.balanceOf(address(this));

        stablecoin.safeTransfer(target, amount);

        (bool success, ) = target.call(data);
        require(success, "RequiemVault: external call failed");

        uint256 balanceAfter = stablecoin.balanceOf(address(this));
        require(balanceAfter >= balanceBefore - amount, "RequiemVault: funds lost");

        profit = balanceAfter > balanceBefore ? balanceAfter - balanceBefore : 0;
        totalPooled = balanceAfter;
        totalProfitAccumulated += profit;

        emit ArbitrageExecuted(msg.sender, amount, profit, target);
        if (profit > 0) {
            emit RewardsDistributed(profit, block.timestamp);
        }

        return profit;
    }

    function sharesOf(address user) external view override returns (uint256) {
        return _shares[user];
    }

    function pointsOf(address user) external view override returns (uint256) {
        return _points[user];
    }

    function previewWithdraw(uint256 shares) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares * totalPooled) / totalShares;
    }

    function pricePerShare() external view returns (uint256) {
        if (totalShares == 0) return 1e18;
        return (totalPooled * 1e18) / totalShares;
    }
}
