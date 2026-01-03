// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.17;
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../../interfaces/IPMarket.sol";
import "../../interfaces/IPMarketFactory.sol";
import "../../interfaces/IPYieldContractFactory.sol";

import "../libraries/Errors.sol";
import "./PendleMarketV6Hydra.sol";

// =============================================================================
// HYDRA CHANGES FROM ORIGINAL PendleMarketFactoryV6Upg.sol:
// =============================================================================
//
// REMOVED IMPORTS:
//   import "../libraries/BaseSplitCodeFactory.sol";
//   import "../libraries/BoringOwnableUpgradeableV2.sol";
//
// REMOVED INHERITANCE:
//   Original: contract PendleMarketFactoryV6Upg is BoringOwnableUpgradeableV2, IPMarketFactory
//   Hydra:    contract PendleMarketFactoryHydra is IPMarketFactory
//
// ADDED:
//   Simple owner pattern (address public owner, modifier onlyOwner)
//
// REMOVED IMMUTABLES (split code factory pattern):
//   address public immutable marketCreationCodeContractA;
//   uint256 public immutable marketCreationCodeSizeA;
//   address public immutable marketCreationCodeContractB;
//   uint256 public immutable marketCreationCodeSizeB;
//
// REMOVED IMMUTABLES (gauge system):
//   address public immutable vePendle;
//   address public immutable gaugeController;
//
// REMOVED FROM CONSTRUCTOR:
//   _marketCreationCodeContractA, _marketCreationCodeSizeA,
//   _marketCreationCodeContractB, _marketCreationCodeSizeB,
//   _vePendle, _gaugeController
//   _disableInitializers();
//
// REMOVED FUNCTION:
//   function initialize(address _owner, address _treasury, uint8 _reserveFeePercent) external initializer
//
// CHANGED createNewMarket:
//   Original used: BaseSplitCodeFactory._create2(..., vePendle, gaugeController)
//   Hydra uses:    new PendleMarketV6Hydra(PT, scalarRoot, initialAnchor, lnFeeRateRoot)
//
// =============================================================================

/**
 * @title PendleMarketFactoryHydra
 * @notice Hydra-compatible MarketFactory without vePendle/gaugeController dependency.
 * @dev Deploys PendleMarketV6Hydra markets using CREATE (not CREATE2 split code).
 *      Simple owner pattern instead of BoringOwnableUpgradeableV2.
 */
contract PendleMarketFactoryHydra is IPMarketFactory {
    using EnumerableSet for EnumerableSet.AddressSet;

    uint256 public constant VERSION = 6;

    // =========================================================================
    // HYDRA: Simple owner pattern (replaces BoringOwnableUpgradeableV2)
    // =========================================================================
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    // =========================================================================
    // REMOVED IN HYDRA (split code factory):
    //     address public immutable marketCreationCodeContractA;
    //     uint256 public immutable marketCreationCodeSizeA;
    //     address public immutable marketCreationCodeContractB;
    //     uint256 public immutable marketCreationCodeSizeB;
    // =========================================================================

    address public immutable yieldContractFactory;

    // =========================================================================
    // REMOVED IN HYDRA (gauge system):
    //     address public immutable vePendle;
    //     address public immutable gaugeController;
    // =========================================================================

    uint256 public immutable maxLnFeeRateRoot;
    uint8 public constant maxReserveFeePercent = 100;
    int256 public constant minInitialAnchor = PMath.IONE;

    address public treasury;
    uint8 public reserveFeePercent;

    // router -> market -> lnFeeRateRoot. lnFeeRateRoot == 0 means no override
    mapping(address => mapping(address => uint80)) internal overriddenFee;

    // PT -> scalarRoot -> initialAnchor
    mapping(address => mapping(int256 => mapping(int256 => mapping(uint80 => address)))) internal markets;
    EnumerableSet.AddressSet internal allMarkets;

    // =========================================================================
    // CONSTRUCTOR - HYDRA VERSION
    // =========================================================================
    // ORIGINAL CONSTRUCTOR (PendleMarketFactoryV6Upg):
    //     constructor(
    //         address _yieldContractFactory,
    //         address _marketCreationCodeContractA,   // <-- REMOVED
    //         uint256 _marketCreationCodeSizeA,       // <-- REMOVED
    //         address _marketCreationCodeContractB,   // <-- REMOVED
    //         uint256 _marketCreationCodeSizeB,       // <-- REMOVED
    //         address _vePendle,                      // <-- REMOVED
    //         address _gaugeController                // <-- REMOVED
    //     ) {
    //         yieldContractFactory = _yieldContractFactory;
    //         maxLnFeeRateRoot = uint256(LogExpMath.ln(int256((105 * PMath.IONE) / 100)));
    //         marketCreationCodeContractA = _marketCreationCodeContractA;
    //         marketCreationCodeSizeA = _marketCreationCodeSizeA;
    //         marketCreationCodeContractB = _marketCreationCodeContractB;
    //         marketCreationCodeSizeB = _marketCreationCodeSizeB;
    //         vePendle = _vePendle;
    //         gaugeController = _gaugeController;
    //         _disableInitializers();
    //     }
    //
    // ORIGINAL also had separate initialize() for owner/treasury/fee:
    //     function initialize(address _owner, address _treasury, uint8 _reserveFeePercent) external initializer {
    //         __BoringOwnableV2_init(_owner);
    //         setTreasuryAndFeeReserve(_treasury, _reserveFeePercent);
    //     }
    // =========================================================================
    constructor(
        address _owner,
        address _yieldContractFactory,
        address _treasury,
        uint8 _reserveFeePercent
    ) {
        owner = _owner;
        yieldContractFactory = _yieldContractFactory;
        maxLnFeeRateRoot = uint256(LogExpMath.ln(int256((105 * PMath.IONE) / 100))); // ln(1.05)
        treasury = _treasury;
        reserveFeePercent = _reserveFeePercent;
    }

    // =========================================================================
    // createNewMarket - HYDRA VERSION
    // =========================================================================
    // ORIGINAL createNewMarket used BaseSplitCodeFactory._create2:
    //     market = BaseSplitCodeFactory._create2(
    //         0,
    //         bytes32(block.chainid),
    //         abi.encode(PT, scalarRoot, initialAnchor, lnFeeRateRoot, vePendle, gaugeController),
    //         marketCreationCodeContractA,
    //         marketCreationCodeSizeA,
    //         marketCreationCodeContractB,
    //         marketCreationCodeSizeB
    //     );
    //
    // HYDRA uses simple CREATE with PendleMarketV6Hydra (no vePendle/gaugeController):
    //     market = address(new PendleMarketV6Hydra(PT, scalarRoot, initialAnchor, lnFeeRateRoot));
    // =========================================================================

    /**
     * @notice Create a market between PT and its corresponding SY with scalar & anchor config.
     * Anyone is allowed to create a market on their own.
     */
    function createNewMarket(address PT, int256 scalarRoot, int256 initialAnchor, uint80 lnFeeRateRoot)
        external
        returns (address market)
    {
        if (!IPYieldContractFactory(yieldContractFactory).isPT(PT)) revert Errors.MarketFactoryInvalidPt();
        if (IPPrincipalToken(PT).isExpired()) revert Errors.MarketFactoryExpiredPt();
        if (lnFeeRateRoot > maxLnFeeRateRoot) {
            revert Errors.MarketFactoryLnFeeRateRootTooHigh(lnFeeRateRoot, maxLnFeeRateRoot);
        }

        if (markets[PT][scalarRoot][initialAnchor][lnFeeRateRoot] != address(0)) {
            revert Errors.MarketFactoryMarketExists();
        }

        if (initialAnchor < minInitialAnchor) {
            revert Errors.MarketFactoryInitialAnchorTooLow(initialAnchor, minInitialAnchor);
        }

        // HYDRA: Deploy PendleMarketV6Hydra via CREATE (not CREATE2 split code)
        // No vePendle/gaugeController parameters
        market = address(
            new PendleMarketV6Hydra(PT, scalarRoot, initialAnchor, lnFeeRateRoot)
        );

        markets[PT][scalarRoot][initialAnchor][lnFeeRateRoot] = market;

        if (!allMarkets.add(market)) assert(false);

        emit CreateNewMarket(market, PT, scalarRoot, initialAnchor, lnFeeRateRoot);
    }

    // =========================================================================
    // REMAINING FUNCTIONS - UNCHANGED FROM ORIGINAL
    // =========================================================================

    function getMarketConfig(address market, address router)
        external
        view
        returns (address _treasury, uint80 _overriddenFee, uint8 _reserveFeePercent)
    {
        (_treasury, _reserveFeePercent) = (treasury, reserveFeePercent);
        _overriddenFee = overriddenFee[router][market];
    }

    /// @dev for gas-efficient verification of market
    function isValidMarket(address market) external view returns (bool) {
        return allMarkets.contains(market);
    }

    function setTreasuryAndFeeReserve(address newTreasury, uint8 newReserveFeePercent) public onlyOwner {
        if (newTreasury == address(0)) revert Errors.MarketFactoryZeroTreasury();
        if (newReserveFeePercent > maxReserveFeePercent) {
            revert Errors.MarketFactoryReserveFeePercentTooHigh(newReserveFeePercent, maxReserveFeePercent);
        }

        treasury = newTreasury;
        reserveFeePercent = newReserveFeePercent;

        emit NewTreasuryAndFeeReserve(newTreasury, newReserveFeePercent);
    }

    function setOverriddenFee(address router, address market, uint80 newFee) public onlyOwner {
        if (!allMarkets.contains(market)) revert Errors.MFNotPendleMarket(market);

        uint80 marketFee = IPMarket(market).getNonOverrideLnFeeRateRoot();
        if (newFee >= marketFee) revert Errors.MarketFactoryOverriddenFeeTooHigh(newFee, marketFee);

        // NOTE: newFee = 0 allowed !!
        overriddenFee[router][market] = newFee;
        emit SetOverriddenFee(router, market, newFee);
    }
}
