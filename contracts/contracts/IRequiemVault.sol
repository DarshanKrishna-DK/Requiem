// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRequiemVault {
    function deposit(uint256 amount) external;
    function withdraw(uint256 shares) external;
    function executeArbitrage(uint256 amount, address target, bytes calldata data) external returns (uint256 profit);

    function totalPooled() external view returns (uint256);
    function sharesOf(address user) external view returns (uint256);
    function totalShares() external view returns (uint256);
    function pointsOf(address user) external view returns (uint256);

    event Deposited(address indexed user, uint256 amount, uint256 sharesIssued);
    event Withdrawn(address indexed user, uint256 shares, uint256 amountReturned);
    event ArbitrageExecuted(address indexed executor, uint256 amountUsed, uint256 profit, address target);
    event RewardsDistributed(uint256 totalProfit, uint256 timestamp);
}
