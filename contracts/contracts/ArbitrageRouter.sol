// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IRequiemVault.sol";

/**
 * @title ArbitrageRouter
 * @notice Operator-restricted contract that triggers cross-platform arbitrage
 *         using pooled funds from RequiemVault. Every trade is emitted as an
 *         on-chain event for transparent proof on BscScan.
 */
contract ArbitrageRouter is Ownable {
    mapping(address => bool) public operators;

    uint256 public totalTradesExecuted;
    uint256 public totalProfitGenerated;

    uint256 public minProfitBps = 50; // 0.5% minimum profit threshold

    event OperatorUpdated(address indexed operator, bool status);
    event ArbitrageTriggered(
        address indexed vault,
        uint256 amount,
        uint256 profit,
        address target,
        uint256 timestamp
    );
    event MinProfitUpdated(uint256 oldBps, uint256 newBps);

    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "ArbitrageRouter: not operator");
        _;
    }

    constructor() Ownable(msg.sender) {
        operators[msg.sender] = true;
    }

    function setOperator(address operator, bool status) external onlyOwner {
        operators[operator] = status;
        emit OperatorUpdated(operator, status);
    }

    function setMinProfitBps(uint256 bps) external onlyOwner {
        require(bps <= 10000, "ArbitrageRouter: bps > 100%");
        emit MinProfitUpdated(minProfitBps, bps);
        minProfitBps = bps;
    }

    /**
     * @notice Triggers an arbitrage trade through the vault.
     * @param vault The RequiemVault holding pooled stablecoins
     * @param amount Amount of stablecoins to use
     * @param target The external contract to call (DEX, prediction market, etc.)
     * @param data The encoded swap/trade calldata
     */
    function triggerArbitrage(
        address vault,
        uint256 amount,
        address target,
        bytes calldata data
    ) external onlyOperator {
        require(vault != address(0), "ArbitrageRouter: zero vault");
        require(amount > 0, "ArbitrageRouter: zero amount");

        uint256 profit = IRequiemVault(vault).executeArbitrage(amount, target, data);

        uint256 minProfit = (amount * minProfitBps) / 10000;
        require(profit >= minProfit, "ArbitrageRouter: profit below threshold");

        totalTradesExecuted++;
        totalProfitGenerated += profit;

        emit ArbitrageTriggered(vault, amount, profit, target, block.timestamp);
    }

    function stats() external view returns (uint256 trades, uint256 profit) {
        return (totalTradesExecuted, totalProfitGenerated);
    }
}
