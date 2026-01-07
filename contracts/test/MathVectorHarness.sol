// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../core/libraries/math/LogExpMath.sol";
import "../core/libraries/math/PMath.sol";
import "../core/StandardizedYield/SYUtils.sol";
import "../core/Market/MarketMathCore.sol";

/**
 * @title MathVectorHarness
 * @notice Test harness that exposes all internal math functions for generating test vectors.
 * @dev Use this contract to generate bit-exact test vectors for R55/Rust implementation.
 */
contract MathVectorHarness {
    using PMath for uint256;
    using PMath for int256;
    using LogExpMath for int256;
    using PYIndexLib for PYIndex;

    // =============================================================================
    // LogExpMath Functions
    // =============================================================================

    /// @notice Natural exponentiation: e^x
    /// @param x 18-decimal fixed-point exponent
    /// @return result e^x as 18-decimal fixed-point
    function exp(int256 x) external pure returns (int256) {
        return LogExpMath.exp(x);
    }

    /// @notice Natural logarithm: ln(a)
    /// @param a 18-decimal fixed-point argument (must be > 0)
    /// @return result ln(a) as 18-decimal fixed-point
    function ln(int256 a) external pure returns (int256) {
        return LogExpMath.ln(a);
    }

    /// @notice Power function: x^y
    /// @param x Base (18-decimal fixed-point)
    /// @param y Exponent (18-decimal fixed-point)
    /// @return result x^y as 18-decimal fixed-point
    function pow(uint256 x, uint256 y) external pure returns (uint256) {
        return LogExpMath.pow(x, y);
    }

    // =============================================================================
    // PMath Functions
    // =============================================================================

    /// @notice Fixed-point multiplication (18 decimals), rounding down
    function mulDown(uint256 a, uint256 b) external pure returns (uint256) {
        return a.mulDown(b);
    }

    /// @notice Fixed-point multiplication for signed integers
    function mulDownInt(int256 a, int256 b) external pure returns (int256) {
        return a.mulDown(b);
    }

    /// @notice Fixed-point division (18 decimals), rounding down
    function divDown(uint256 a, uint256 b) external pure returns (uint256) {
        return a.divDown(b);
    }

    /// @notice Fixed-point division for signed integers
    function divDownInt(int256 a, int256 b) external pure returns (int256) {
        return a.divDown(b);
    }

    /// @notice Integer square root (Uniswap algorithm)
    function sqrt(uint256 y) external pure returns (uint256) {
        return PMath.sqrt(y);
    }

    /// @notice Raw division rounding up: (a + b - 1) / b
    function rawDivUp(uint256 a, uint256 b) external pure returns (uint256) {
        return a.rawDivUp(b);
    }

    /// @notice Raw division rounding up for signed integers
    function rawDivUpInt(int256 a, int256 b) external pure returns (int256) {
        return a.rawDivUp(b);
    }

    /// @notice Subtract with no negative result: require(a >= b)
    function subNoNeg(int256 a, int256 b) external pure returns (int256) {
        return a.subNoNeg(b);
    }

    /// @notice Absolute value
    function abs(int256 x) external pure returns (uint256) {
        return PMath.abs(x);
    }

    /// @notice Negate a signed integer
    function neg(int256 x) external pure returns (int256) {
        return x.neg();
    }

    /// @notice Convert uint256 to int256 (reverts if overflow)
    function toInt(uint256 x) external pure returns (int256) {
        return x.Int();
    }

    /// @notice Convert int256 to uint256 (reverts if negative)
    function toUint(int256 x) external pure returns (uint256) {
        return x.Uint();
    }

    // =============================================================================
    // SYUtils Functions
    // =============================================================================

    /// @notice Convert SY to Asset: (syAmount * exchangeRate) / 1e18
    function syToAsset(uint256 exchangeRate, uint256 syAmount) external pure returns (uint256) {
        return SYUtils.syToAsset(exchangeRate, syAmount);
    }

    /// @notice Convert SY to Asset, rounding up
    function syToAssetUp(uint256 exchangeRate, uint256 syAmount) external pure returns (uint256) {
        return SYUtils.syToAssetUp(exchangeRate, syAmount);
    }

    /// @notice Convert Asset to SY: (assetAmount * 1e18) / exchangeRate
    function assetToSy(uint256 exchangeRate, uint256 assetAmount) external pure returns (uint256) {
        return SYUtils.assetToSy(exchangeRate, assetAmount);
    }

    /// @notice Convert Asset to SY, rounding up
    function assetToSyUp(uint256 exchangeRate, uint256 assetAmount) external pure returns (uint256) {
        return SYUtils.assetToSyUp(exchangeRate, assetAmount);
    }

    // =============================================================================
    // MarketMathCore Internal Functions (exposed for testing)
    // =============================================================================

    /// @notice Calculate exchange rate from implied rate: E = e^(rt)
    /// @param lnImpliedRate The ln of the implied rate (18 decimals)
    /// @param timeToExpiry Time until expiry in seconds
    function getExchangeRateFromImpliedRate(
        uint256 lnImpliedRate,
        uint256 timeToExpiry
    ) external pure returns (int256) {
        uint256 IMPLIED_RATE_TIME = 365 * 86400;
        uint256 rt = (lnImpliedRate * timeToExpiry) / IMPLIED_RATE_TIME;
        return LogExpMath.exp(rt.Int());
    }

    /// @notice Calculate rate scalar from scalar root and time to expiry
    /// @param scalarRoot The scalar root parameter
    /// @param timeToExpiry Time until expiry in seconds
    function getRateScalar(
        int256 scalarRoot,
        uint256 timeToExpiry
    ) external pure returns (int256) {
        uint256 IMPLIED_RATE_TIME = 365 * 86400;
        return (scalarRoot * int256(IMPLIED_RATE_TIME)) / int256(timeToExpiry);
    }

    /// @notice Calculate logit proportion: ln(p / (1 - p))
    /// @param proportion The proportion (18 decimals, must be < 1e18)
    function logProportion(int256 proportion) external pure returns (int256) {
        require(proportion != 1e18, "proportion must not equal one");
        int256 logitP = proportion.divDown(1e18 - proportion);
        return logitP.ln();
    }

    /// @notice Full getExchangeRate calculation
    function getExchangeRate(
        int256 totalPt,
        int256 totalAsset,
        int256 rateScalar,
        int256 rateAnchor,
        int256 netPtToAccount
    ) external pure returns (int256) {
        int256 MAX_MARKET_PROPORTION = (1e18 * 96) / 100;
        
        int256 numerator = totalPt.subNoNeg(netPtToAccount);
        int256 proportion = numerator.divDown(totalPt + totalAsset);
        
        require(proportion <= MAX_MARKET_PROPORTION, "proportion too high");
        require(proportion != 1e18, "proportion must not equal one");
        
        int256 logitP = proportion.divDown(1e18 - proportion);
        int256 lnProportion = logitP.ln();
        
        int256 exchangeRate = lnProportion.divDown(rateScalar) + rateAnchor;
        require(exchangeRate >= 1e18, "exchange rate below one");
        
        return exchangeRate;
    }

    /// @notice Full getLnImpliedRate calculation
    function getLnImpliedRate(
        int256 totalPt,
        int256 totalAsset,
        int256 rateScalar,
        int256 rateAnchor,
        uint256 timeToExpiry
    ) external pure returns (uint256) {
        uint256 IMPLIED_RATE_TIME = 365 * 86400;
        
        // Get exchange rate with netPtToAccount = 0
        int256 numerator = totalPt;
        int256 proportion = numerator.divDown(totalPt + totalAsset);
        
        require(proportion != 1e18, "proportion must not equal one");
        
        int256 logitP = proportion.divDown(1e18 - proportion);
        int256 lnProportion = logitP.ln();
        int256 exchangeRate = lnProportion.divDown(rateScalar) + rateAnchor;
        
        require(exchangeRate >= 1e18, "exchange rate below one");
        
        // exchangeRate >= 1 so ln >= 0
        uint256 lnRate = exchangeRate.ln().Uint();
        return (lnRate * IMPLIED_RATE_TIME) / timeToExpiry;
    }

    /// @notice Full getRateAnchor calculation
    function getRateAnchor(
        int256 totalPt,
        uint256 lastLnImpliedRate,
        int256 totalAsset,
        int256 rateScalar,
        uint256 timeToExpiry
    ) external pure returns (int256) {
        uint256 IMPLIED_RATE_TIME = 365 * 86400;
        
        // Get exchange rate from implied rate
        uint256 rt = (lastLnImpliedRate * timeToExpiry) / IMPLIED_RATE_TIME;
        int256 newExchangeRate = LogExpMath.exp(rt.Int());
        
        require(newExchangeRate >= 1e18, "exchange rate below one");
        
        // Calculate proportion and log proportion
        int256 proportion = totalPt.divDown(totalPt + totalAsset);
        require(proportion != 1e18, "proportion must not equal one");
        
        int256 logitP = proportion.divDown(1e18 - proportion);
        int256 lnProportion = logitP.ln();
        
        return newExchangeRate - lnProportion.divDown(rateScalar);
    }

    // =============================================================================
    // Full Market Math - Add Liquidity
    // =============================================================================

    /// @notice Calculate first liquidity provision
    /// @return lpToReserve LP tokens for reserve (MINIMUM_LIQUIDITY)
    /// @return lpToAccount LP tokens for user
    function addLiquidityFirst(
        int256 syDesired,
        int256 ptDesired
    ) external pure returns (int256 lpToReserve, int256 lpToAccount) {
        int256 MINIMUM_LIQUIDITY = 1000;
        lpToAccount = PMath.sqrt((syDesired * ptDesired).Uint()).Int() - MINIMUM_LIQUIDITY;
        lpToReserve = MINIMUM_LIQUIDITY;
    }

    /// @notice Calculate proportional liquidity provision
    function addLiquidityProportional(
        int256 totalSy,
        int256 totalPt,
        int256 totalLp,
        int256 syDesired,
        int256 ptDesired
    ) external pure returns (int256 lpToAccount, int256 syUsed, int256 ptUsed) {
        int256 netLpByPt = (ptDesired * totalLp) / totalPt;
        int256 netLpBySy = (syDesired * totalLp) / totalSy;
        
        if (netLpByPt < netLpBySy) {
            lpToAccount = netLpByPt;
            ptUsed = ptDesired;
            syUsed = (totalSy * lpToAccount).rawDivUp(totalLp);
        } else {
            lpToAccount = netLpBySy;
            syUsed = syDesired;
            ptUsed = (totalPt * lpToAccount).rawDivUp(totalLp);
        }
    }

    // =============================================================================
    // Full Market Math - Remove Liquidity
    // =============================================================================

    /// @notice Calculate liquidity removal amounts
    function removeLiquidity(
        int256 totalSy,
        int256 totalPt,
        int256 totalLp,
        int256 lpToRemove
    ) external pure returns (int256 netSyToAccount, int256 netPtToAccount) {
        netSyToAccount = (lpToRemove * totalSy) / totalLp;
        netPtToAccount = (lpToRemove * totalPt) / totalLp;
    }

    // =============================================================================
    // Full Trade Calculation
    // =============================================================================

    /// @notice Calculate trade outputs given market state and pre-compute values
    function calcTrade(
        int256 totalPt,
        int256 totalAsset,
        int256 rateScalar,
        int256 rateAnchor,
        int256 feeRate,
        uint256 reserveFeePercent,
        uint256 pyIndexValue,
        int256 netPtToAccount
    ) external pure returns (
        int256 netSyToAccount,
        int256 netSyFee,
        int256 netSyToReserve
    ) {
        int256 PERCENTAGE_DECIMALS = 100;
        
        // Calculate pre-fee exchange rate
        int256 numerator = totalPt.subNoNeg(netPtToAccount);
        int256 proportion = numerator.divDown(totalPt + totalAsset);
        
        require(proportion != 1e18, "proportion must not equal one");
        
        int256 logitP = proportion.divDown(1e18 - proportion);
        int256 lnProportion = logitP.ln();
        int256 preFeeExchangeRate = lnProportion.divDown(rateScalar) + rateAnchor;
        
        require(preFeeExchangeRate >= 1e18, "exchange rate below one");
        
        // Calculate pre-fee asset amount
        int256 preFeeAssetToAccount = netPtToAccount.divDown(preFeeExchangeRate).neg();
        int256 fee = feeRate;
        
        if (netPtToAccount > 0) {
            int256 postFeeExchangeRate = preFeeExchangeRate.divDown(fee);
            require(postFeeExchangeRate >= 1e18, "post-fee exchange rate below one");
            fee = preFeeAssetToAccount.mulDown(1e18 - fee);
        } else {
            fee = ((preFeeAssetToAccount * (1e18 - fee)) / fee).neg();
        }
        
        int256 netAssetToReserve = (fee * int256(reserveFeePercent)) / PERCENTAGE_DECIMALS;
        int256 netAssetToAccount = preFeeAssetToAccount - fee;
        
        // Convert using PY index (simplified inline for testing)
        if (netAssetToAccount < 0) {
            // assetToSyUp for negative amounts
            uint256 absAsset = PMath.abs(netAssetToAccount);
            uint256 syAbs = (absAsset * 1e18 + pyIndexValue - 1) / pyIndexValue;
            netSyToAccount = -int256(syAbs);
        } else {
            netSyToAccount = int256((uint256(netAssetToAccount) * 1e18) / pyIndexValue);
        }
        
        netSyFee = int256((PMath.abs(fee) * 1e18) / pyIndexValue);
        netSyToReserve = int256((PMath.abs(netAssetToReserve) * 1e18) / pyIndexValue);
    }

    // =============================================================================
    // setInitialLnImpliedRate - Critical for market initialization
    // =============================================================================

    /// @notice Calculate initial ln implied rate after first mint
    /// @dev This is called once after the first addLiquidity to set the market's initial rate
    function setInitialLnImpliedRate(
        int256 totalPt,
        int256 totalSy,
        int256 scalarRoot,
        uint256 expiry,
        int256 initialAnchor,
        uint256 blockTime,
        uint256 pyIndexValue
    ) external pure returns (uint256 lastLnImpliedRate) {
        require(expiry > blockTime, "MarketExpired");
        
        uint256 IMPLIED_RATE_TIME = 365 * 86400;
        uint256 timeToExpiry = expiry - blockTime;
        
        // Calculate totalAsset = syToAsset(totalSy)
        int256 totalAsset = int256((uint256(totalSy) * pyIndexValue) / 1e18);
        
        // Calculate rateScalar = (scalarRoot * IMPLIED_RATE_TIME) / timeToExpiry
        int256 rateScalar = (scalarRoot * int256(IMPLIED_RATE_TIME)) / int256(timeToExpiry);
        require(rateScalar > 0, "MarketRateScalarBelowZero");
        
        // Calculate getLnImpliedRate
        // exchangeRate = lnProportion / rateScalar + rateAnchor
        int256 proportion = totalPt.divDown(totalPt + totalAsset);
        require(proportion != 1e18, "proportion must not equal one");
        
        int256 logitP = proportion.divDown(1e18 - proportion);
        int256 lnProportion = logitP.ln();
        int256 exchangeRate = lnProportion.divDown(rateScalar) + initialAnchor;
        
        require(exchangeRate >= 1e18, "exchange rate below one");
        
        // lnRate = ln(exchangeRate) * IMPLIED_RATE_TIME / timeToExpiry
        uint256 lnRate = exchangeRate.ln().Uint();
        lastLnImpliedRate = (lnRate * IMPLIED_RATE_TIME) / timeToExpiry;
    }

    // =============================================================================
    // getMarketPreCompute - Full pre-computation structure
    // =============================================================================

    /// @notice Compute all pre-trade values at once
    function getMarketPreCompute(
        int256 totalPt,
        int256 totalSy,
        int256 scalarRoot,
        uint256 expiry,
        uint256 lnFeeRateRoot,
        uint256 lastLnImpliedRate,
        uint256 blockTime,
        uint256 pyIndexValue
    ) external pure returns (
        int256 rateScalar,
        int256 totalAsset,
        int256 rateAnchor,
        int256 feeRate
    ) {
        require(expiry > blockTime, "MarketExpired");
        
        uint256 IMPLIED_RATE_TIME = 365 * 86400;
        uint256 timeToExpiry = expiry - blockTime;
        
        // rateScalar
        rateScalar = (scalarRoot * int256(IMPLIED_RATE_TIME)) / int256(timeToExpiry);
        require(rateScalar > 0, "MarketRateScalarBelowZero");
        
        // totalAsset = syToAsset(totalSy)
        totalAsset = int256((uint256(totalSy) * pyIndexValue) / 1e18);
        require(totalPt != 0 && totalAsset != 0, "MarketZeroTotalPtOrTotalAsset");
        
        // rateAnchor
        uint256 rt = (lastLnImpliedRate * timeToExpiry) / IMPLIED_RATE_TIME;
        int256 newExchangeRate = LogExpMath.exp(rt.Int());
        require(newExchangeRate >= 1e18, "exchange rate below one");
        
        int256 proportion = totalPt.divDown(totalPt + totalAsset);
        require(proportion != 1e18, "proportion must not equal one");
        int256 logitP = proportion.divDown(1e18 - proportion);
        int256 lnProportion = logitP.ln();
        rateAnchor = newExchangeRate - lnProportion.divDown(rateScalar);
        
        // feeRate = exp(lnFeeRateRoot * timeToExpiry / IMPLIED_RATE_TIME)
        uint256 rtFee = (lnFeeRateRoot * timeToExpiry) / IMPLIED_RATE_TIME;
        feeRate = LogExpMath.exp(rtFee.Int());
    }

    // =============================================================================
    // Full Trade with State Updates - simulates executeTradeCore math
    // =============================================================================

    /// @notice Simulate a full trade including state updates
    function executeTradeWithState(
        int256 totalPt,
        int256 totalSy,
        int256 scalarRoot,
        uint256 expiry,
        uint256 lnFeeRateRoot,
        uint256 lastLnImpliedRate,
        uint256 reserveFeePercent,
        uint256 blockTime,
        uint256 pyIndexValue,
        int256 netPtToAccount
    ) external pure returns (
        int256 netSyToAccount,
        int256 netSyFee,
        int256 netSyToReserve,
        uint256 newLastLnImpliedRate,
        int256 newTotalPt,
        int256 newTotalSy
    ) {
        require(expiry > blockTime, "MarketExpired");
        require(totalPt > netPtToAccount, "MarketInsufficientPtForTrade");
        
        uint256 IMPLIED_RATE_TIME = 365 * 86400;
        int256 PERCENTAGE_DECIMALS = 100;
        uint256 timeToExpiry = expiry - blockTime;
        
        // Compute precompute values
        int256 rateScalar = (scalarRoot * int256(IMPLIED_RATE_TIME)) / int256(timeToExpiry);
        int256 totalAsset = int256((uint256(totalSy) * pyIndexValue) / 1e18);
        
        // rateAnchor
        uint256 rt = (lastLnImpliedRate * timeToExpiry) / IMPLIED_RATE_TIME;
        int256 newExchangeRate = LogExpMath.exp(rt.Int());
        int256 proportion = totalPt.divDown(totalPt + totalAsset);
        int256 logitP = proportion.divDown(1e18 - proportion);
        int256 lnProportion = logitP.ln();
        int256 rateAnchor = newExchangeRate - lnProportion.divDown(rateScalar);
        
        // feeRate
        uint256 rtFee = (lnFeeRateRoot * timeToExpiry) / IMPLIED_RATE_TIME;
        int256 feeRate = LogExpMath.exp(rtFee.Int());
        
        // calcTrade
        int256 numerator = totalPt.subNoNeg(netPtToAccount);
        proportion = numerator.divDown(totalPt + totalAsset);
        logitP = proportion.divDown(1e18 - proportion);
        lnProportion = logitP.ln();
        int256 preFeeExchangeRate = lnProportion.divDown(rateScalar) + rateAnchor;
        
        int256 preFeeAssetToAccount = netPtToAccount.divDown(preFeeExchangeRate).neg();
        int256 fee = feeRate;
        
        if (netPtToAccount > 0) {
            int256 postFeeExchangeRate = preFeeExchangeRate.divDown(fee);
            require(postFeeExchangeRate >= 1e18, "post-fee exchange rate below one");
            fee = preFeeAssetToAccount.mulDown(1e18 - fee);
        } else {
            fee = ((preFeeAssetToAccount * (1e18 - fee)) / fee).neg();
        }
        
        int256 netAssetToReserve = (fee * int256(reserveFeePercent)) / PERCENTAGE_DECIMALS;
        int256 netAssetToAccount = preFeeAssetToAccount - fee;
        
        // Convert using PY index
        if (netAssetToAccount < 0) {
            uint256 absAsset = PMath.abs(netAssetToAccount);
            uint256 syAbs = (absAsset * 1e18 + pyIndexValue - 1) / pyIndexValue;
            netSyToAccount = -int256(syAbs);
        } else {
            netSyToAccount = int256((uint256(netAssetToAccount) * 1e18) / pyIndexValue);
        }
        
        netSyFee = int256((PMath.abs(fee) * 1e18) / pyIndexValue);
        netSyToReserve = int256((PMath.abs(netAssetToReserve) * 1e18) / pyIndexValue);
        
        // Update state
        newTotalPt = totalPt.subNoNeg(netPtToAccount);
        newTotalSy = totalSy.subNoNeg(netSyToAccount + netSyToReserve);
        
        // Calculate new lastLnImpliedRate
        int256 newTotalAsset = int256((uint256(newTotalSy) * pyIndexValue) / 1e18);
        proportion = newTotalPt.divDown(newTotalPt + newTotalAsset);
        logitP = proportion.divDown(1e18 - proportion);
        lnProportion = logitP.ln();
        int256 finalExchangeRate = lnProportion.divDown(rateScalar) + rateAnchor;
        
        uint256 lnRate = finalExchangeRate.ln().Uint();
        newLastLnImpliedRate = (lnRate * IMPLIED_RATE_TIME) / timeToExpiry;
    }

    // =============================================================================
    // Constants
    // =============================================================================

    function constants() external pure returns (
        uint256 ONE,
        int256 IONE,
        int256 MAX_NATURAL_EXPONENT,
        int256 MIN_NATURAL_EXPONENT,
        int256 LN_36_LOWER_BOUND,
        int256 LN_36_UPPER_BOUND,
        uint256 IMPLIED_RATE_TIME,
        int256 MAX_MARKET_PROPORTION,
        int256 MINIMUM_LIQUIDITY
    ) {
        ONE = 1e18;
        IONE = 1e18;
        MAX_NATURAL_EXPONENT = 130e18;
        MIN_NATURAL_EXPONENT = -41e18;
        LN_36_LOWER_BOUND = 1e18 - 1e17;  // 0.9e18
        LN_36_UPPER_BOUND = 1e18 + 1e17;  // 1.1e18
        IMPLIED_RATE_TIME = 365 * 86400;
        MAX_MARKET_PROPORTION = (1e18 * 96) / 100;
        MINIMUM_LIQUIDITY = 1000;
    }
}

