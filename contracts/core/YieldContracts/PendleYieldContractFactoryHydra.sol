// SPDX-License-Identifier: GPL-3.0-or-later
/*
 * MIT License
 * ===========
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 */

pragma solidity ^0.8.17;

import "../../interfaces/IPYieldContractFactoryHydra.sol";

import "../libraries/Errors.sol";

import "./PendlePrincipalToken.sol";
import "./PendleYieldToken.sol";

/// @notice Minimal YieldContractFactory implementation for Hydra/R55 testing.
/// @dev This contract intentionally prioritizes deployed bytecode size over full Pendle metadata formatting.
/// It preserves core functionality: validate expiry, deploy PT/YT via CREATE, initialize PT, and register mappings.
contract PendleYieldContractFactoryHydra is IPYieldContractFactoryHydra {
    uint256 public constant VERSION = 6;

    string private constant PT_PREFIX = "PT";
    string private constant YT_PREFIX = "YT";

    uint256 public constant maxInterestFeeRate = 2e17; // 20%
    uint256 public constant maxRewardFeeRate = 2e17; // 20%

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    // 1 SLOT
    uint128 public interestFeeRate; // a fixed point number
    uint128 public rewardFeeRate; // a fixed point number

    // 1 SLOT
    address public treasury;
    uint96 public expiryDivisor;

    // SY => expiry => address
    // returns address(0) if not created
    // note: These mappings are used to enforce that no PT/YT is created twice for the same SY/expiry pair.
    mapping(address => mapping(uint256 => address)) public getPT;
    mapping(address => mapping(uint256 => address)) public getYT;
    mapping(address => bool) public isPT;
    mapping(address => bool) public isYT;

    constructor(
        address _owner,
        uint96 _expiryDivisor,
        uint128 _interestFeeRate,
        uint128 _rewardFeeRate,
        address _treasury
    ) {
        if (_expiryDivisor == 0) revert Errors.YCFactoryZeroExpiryDivisor();
        if (_treasury == address(0)) revert Errors.YCFactoryZeroTreasury();
        if (_interestFeeRate > maxInterestFeeRate) {
            revert Errors.YCFactoryInterestFeeRateTooHigh(_interestFeeRate, maxInterestFeeRate);
        }
        if (_rewardFeeRate > maxRewardFeeRate) {
            revert Errors.YCFactoryRewardFeeRateTooHigh(_rewardFeeRate, maxRewardFeeRate);
        }
        owner = _owner;
        expiryDivisor = _expiryDivisor;
        interestFeeRate = _interestFeeRate;
        rewardFeeRate = _rewardFeeRate;
        treasury = _treasury;
    }

    /**
     * @notice Create a pair of (PT, YT) using CREATE instead of CREATE2.
     * @dev Minimal metadata formatting to reduce bytecode size:
     * - Uses SY.name()/SY.symbol() directly (no prefix stripping).
     * - Does not append a formatted expiry string (no ExpiryUtilsLib usage).
     */
    function createYieldContractWithCreate(address SY, uint32 expiry, bool doCacheIndexSameBlock)
        external
        returns (address PT, address YT)
    {
        if (expiry <= block.timestamp || expiryDivisor == 0 || expiry % expiryDivisor != 0) {
            revert Errors.YCFactoryInvalidExpiry();
        }

        if (getPT[SY][expiry] != address(0)) revert Errors.YCFactoryYieldContractExisted();

        IStandardizedYield _SY = IStandardizedYield(SY);

        (,, uint8 assetDecimals) = _SY.assetInfo();

        // Intentionally minimal metadata: preserve uniqueness via (SY, expiry) mapping, not string formatting.
        string memory syName = _SY.name();
        string memory sySymbol = _SY.symbol();

        PT = address(
            new PendlePrincipalToken(
                SY,
                string(abi.encodePacked(PT_PREFIX, " ", syName)),
                string(abi.encodePacked(PT_PREFIX, "-", sySymbol)),
                assetDecimals,
                expiry
            )
        );

        YT = address(
            new PendleYieldToken(
                SY,
                PT,
                string(abi.encodePacked(YT_PREFIX, " ", syName)),
                string(abi.encodePacked(YT_PREFIX, "-", sySymbol)),
                assetDecimals,
                expiry,
                doCacheIndexSameBlock
            )
        );

        IPPrincipalToken(PT).initialize(YT);

        getPT[SY][expiry] = PT;
        getYT[SY][expiry] = YT;
        isPT[PT] = true;
        isYT[YT] = true;

        emit CreateYieldContract(SY, expiry, PT, YT);
    }

    function setExpiryDivisor(uint96 newExpiryDivisor) public onlyOwner {
        if (newExpiryDivisor == 0) revert Errors.YCFactoryZeroExpiryDivisor();

        expiryDivisor = newExpiryDivisor;
        emit SetExpiryDivisor(newExpiryDivisor);
    }

    function setInterestFeeRate(uint128 newInterestFeeRate) public onlyOwner {
        if (newInterestFeeRate > maxInterestFeeRate) {
            revert Errors.YCFactoryInterestFeeRateTooHigh(newInterestFeeRate, maxInterestFeeRate);
        }

        interestFeeRate = newInterestFeeRate;
        emit SetInterestFeeRate(newInterestFeeRate);
    }

    function setRewardFeeRate(uint128 newRewardFeeRate) public onlyOwner {
        if (newRewardFeeRate > maxRewardFeeRate) {
            revert Errors.YCFactoryRewardFeeRateTooHigh(newRewardFeeRate, maxRewardFeeRate);
        }

        rewardFeeRate = newRewardFeeRate;
        emit SetRewardFeeRate(newRewardFeeRate);
    }

    function setTreasury(address newTreasury) public onlyOwner {
        if (newTreasury == address(0)) revert Errors.YCFactoryZeroTreasury();

        treasury = newTreasury;
        emit SetTreasury(newTreasury);
    }
}
