/**
 * Pendle V2 Local Deployment Script
 * 
 * Deploys Pendle core contracts for local testing on Anvil.
 * - Uses PendleMarketV6Local (no vePendle/gaugeController dependency)
 * - Uses PendleMarketFactoryLocal with CREATE2 split code pattern (matches production)
 * - Only gauge/vePendle parameters removed - all other patterns preserved
 * 
 * Usage: npx hardhat run scripts/deploy-local.ts --network localhost
 */

// @ts-ignore - ethers injected by hardhat-ethers plugin at runtime
import { ethers } from "hardhat";
import * as fs from "fs";

interface DeploymentResult {
  // Core infrastructure
  baseSplitCodeFactory: string;
  oracleLib: string;
  
  // Split code for PendleMarketV6Local
  marketCreationCodeContractA: string;
  marketCreationCodeSizeA: number;
  marketCreationCodeContractB: string;
  marketCreationCodeSizeB: number;
  
  // Factories
  yieldContractFactory: string;
  marketFactory: string;
  marketFactoryImpl: string;
  syFactory: string;
  
  // Router (main entry point)
  router: string;
  routerFacets: {
    actionStorageV4: string;
    actionAddRemoveLiqV3: string;
    actionSwapPTV3: string;
    actionSwapYTV3: string;
    actionMiscV3: string;
    actionSimple: string;
    actionCallbackV3: string;
  };
  
  // RouterStatic (read-only queries)
  routerStatic: string;
  routerStaticFacets: {
    actionStorageStatic: string;
    actionInfoStatic: string;
    actionMarketAuxStatic: string;
    actionMarketCoreStatic: string;
    actionMintRedeemStatic: string;
  };
  
  // Oracles & Helpers
  pyYtLpOracle: string;
  pendleSwap: string;
  poolDeployHelper: string;
}

async function main(): Promise<DeploymentResult> {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  const balance = await deployer.getBalance();
  console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");

  const result: DeploymentResult = {
    baseSplitCodeFactory: "",
    oracleLib: "",
    marketCreationCodeContractA: "",
    marketCreationCodeSizeA: 0,
    marketCreationCodeContractB: "",
    marketCreationCodeSizeB: 0,
    yieldContractFactory: "",
    marketFactory: "",
    marketFactoryImpl: "",
    syFactory: "",
    router: "",
    routerFacets: {
      actionStorageV4: "",
      actionAddRemoveLiqV3: "",
      actionSwapPTV3: "",
      actionSwapYTV3: "",
      actionMiscV3: "",
      actionSimple: "",
      actionCallbackV3: "",
    },
    routerStatic: "",
    routerStaticFacets: {
      actionStorageStatic: "",
      actionInfoStatic: "",
      actionMarketAuxStatic: "",
      actionMarketCoreStatic: "",
      actionMintRedeemStatic: "",
    },
    pyYtLpOracle: "",
    pendleSwap: "",
    poolDeployHelper: "",
  };

  // ============================================
  // 1. Deploy BaseSplitCodeFactoryContract
  // ============================================
  console.log("\n[1/14] Deploying BaseSplitCodeFactoryContract...");
  const BaseSplitCodeFactoryContract = await ethers.getContractFactory("BaseSplitCodeFactoryContract");
  const baseSplitCodeFactory = await BaseSplitCodeFactoryContract.deploy();
  await baseSplitCodeFactory.deployed();
  result.baseSplitCodeFactory = baseSplitCodeFactory.address;
  console.log("BaseSplitCodeFactoryContract:", result.baseSplitCodeFactory);

  // ============================================
  // 2. Deploy YieldToken creation code via split factory
  // ============================================
  console.log("\n[2/14] Deploying YieldToken split code...");
  const PendleYieldToken = await ethers.getContractFactory("PendleYieldToken");
  const ytBytecode = PendleYieldToken.bytecode;
  
  const ytDeployTx = await baseSplitCodeFactory.deploy("PendleYieldToken", ytBytecode);
  const ytReceipt = await ytDeployTx.wait();
  
  const ytDeployedEvent = ytReceipt.events?.find((e: any) => e.event === "Deployed");
  if (!ytDeployedEvent) throw new Error("Failed to find YT Deployed event");
  const [, ytCodeA, ytSizeA, ytCodeB, ytSizeB] = ytDeployedEvent.args!;
  console.log("YieldToken split code deployed");

  // ============================================
  // 3. Deploy OracleLib (required library for Market)
  // ============================================
  console.log("\n[3/14] Deploying OracleLib...");
  const OracleLib = await ethers.getContractFactory("OracleLib");
  const oracleLib = await OracleLib.deploy();
  await oracleLib.deployed();
  result.oracleLib = oracleLib.address;
  console.log("OracleLib:", result.oracleLib);

  // ============================================
  // 4. Deploy PendleMarketV6Local split code (with OracleLib linked)
  // ============================================
  console.log("\n[4/14] Deploying PendleMarketV6Local split code...");
  // Get the factory with OracleLib linked - this gives us the linked bytecode
  const PendleMarketV6Local = await ethers.getContractFactory("PendleMarketV6Local", {
    libraries: { OracleLib: oracleLib.address },
  });
  const marketBytecode = PendleMarketV6Local.bytecode;
  
  const mktDeployTx = await baseSplitCodeFactory.deploy("PendleMarketV6Local", marketBytecode);
  const mktReceipt = await mktDeployTx.wait();
  
  const mktDeployedEvent = mktReceipt.events?.find((e: any) => e.event === "Deployed");
  if (!mktDeployedEvent) throw new Error("Failed to find Market Deployed event");
  const [, mktCodeA, mktSizeA, mktCodeB, mktSizeB] = mktDeployedEvent.args!;
  result.marketCreationCodeContractA = mktCodeA;
  result.marketCreationCodeSizeA = mktSizeA.toNumber();
  result.marketCreationCodeContractB = mktCodeB;
  result.marketCreationCodeSizeB = mktSizeB.toNumber();
  console.log("PendleMarketV6Local split code deployed");
  console.log("  CodeContractA:", mktCodeA);
  console.log("  CodeContractB:", mktCodeB);

  // ============================================
  // 5. Deploy YieldContractFactory
  // ============================================
  console.log("\n[5/14] Deploying YieldContractFactory...");
  const PendleYieldContractFactoryUpg = await ethers.getContractFactory("PendleYieldContractFactoryUpg");
  const ycfImpl = await PendleYieldContractFactoryUpg.deploy(ytCodeA, ytSizeA, ytCodeB, ytSizeB);
  await ycfImpl.deployed();

  const ycfInitData = ycfImpl.interface.encodeFunctionData("initialize", [
    604800, // expiryDivisor (1 week)
    ethers.BigNumber.from("30000000000000000"), // interestFeeRate (3%)
    ethers.BigNumber.from("30000000000000000"), // rewardFeeRate (3%)
    deployer.address, // treasury
    deployer.address, // owner
  ]);

  const TransparentUpgradeableProxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
  const ycfProxy = await TransparentUpgradeableProxy.deploy(ycfImpl.address, deployer.address, ycfInitData);
  await ycfProxy.deployed();
  result.yieldContractFactory = ycfProxy.address;
  console.log("YieldContractFactory:", result.yieldContractFactory);

  // ============================================
  // 6. Deploy MarketFactoryLocal (CREATE2 split code pattern)
  // ============================================
  console.log("\n[6/14] Deploying MarketFactoryLocal...");
  // MarketFactoryLocal uses the split code pattern like production
  const PendleMarketFactoryLocal = await ethers.getContractFactory("PendleMarketFactoryLocal");
  const marketFactoryImpl = await PendleMarketFactoryLocal.deploy(
    result.yieldContractFactory,   // yieldContractFactory
    mktCodeA,                       // marketCreationCodeContractA
    mktSizeA,                       // marketCreationCodeSizeA
    mktCodeB,                       // marketCreationCodeContractB
    mktSizeB                        // marketCreationCodeSizeB
  );
  await marketFactoryImpl.deployed();
  result.marketFactoryImpl = marketFactoryImpl.address;
  console.log("MarketFactoryLocal impl:", result.marketFactoryImpl);

  // Deploy proxy and initialize
  const mfInitData = marketFactoryImpl.interface.encodeFunctionData("initialize", [
    deployer.address,  // owner
    deployer.address,  // treasury
    80                 // reserveFeePercent
  ]);
  const marketFactoryProxy = await TransparentUpgradeableProxy.deploy(
    marketFactoryImpl.address, 
    deployer.address, 
    mfInitData
  );
  await marketFactoryProxy.deployed();
  result.marketFactory = marketFactoryProxy.address;
  console.log("MarketFactoryLocal proxy:", result.marketFactory);

  // ============================================
  // 7. Deploy SY Factory
  // ============================================
  console.log("\n[7/14] Deploying SY Factory...");
  const PendleCommonSYFactory = await ethers.getContractFactory("PendleCommonSYFactory");
  const syFactoryImpl = await PendleCommonSYFactory.deploy(deployer.address);
  await syFactoryImpl.deployed();

  const syFactoryInitData = syFactoryImpl.interface.encodeFunctionData("initialize", [deployer.address]);
  const syFactoryProxy = await TransparentUpgradeableProxy.deploy(syFactoryImpl.address, deployer.address, syFactoryInitData);
  await syFactoryProxy.deployed();
  result.syFactory = syFactoryProxy.address;
  console.log("SY Factory:", result.syFactory);

  // ============================================
  // 8. Deploy Router + Facets
  // ============================================
  console.log("\n[8/14] Deploying Router facets...");

  const deployFacet = async (name: string): Promise<string> => {
    const Factory = await ethers.getContractFactory(name);
    const facet = await Factory.deploy();
    await facet.deployed();
    console.log(`  ${name}:`, facet.address);
    return facet.address;
  };

  result.routerFacets.actionStorageV4 = await deployFacet("ActionStorageV4");
  result.routerFacets.actionAddRemoveLiqV3 = await deployFacet("ActionAddRemoveLiqV3");
  result.routerFacets.actionSwapPTV3 = await deployFacet("ActionSwapPTV3");
  result.routerFacets.actionSwapYTV3 = await deployFacet("ActionSwapYTV3");
  result.routerFacets.actionMiscV3 = await deployFacet("ActionMiscV3");
  result.routerFacets.actionSimple = await deployFacet("ActionSimple");
  result.routerFacets.actionCallbackV3 = await deployFacet("ActionCallbackV3");

  console.log("\nDeploying PendleRouterV4...");
  const PendleRouterV4 = await ethers.getContractFactory("PendleRouterV4");
  const router = await PendleRouterV4.deploy(deployer.address, result.routerFacets.actionStorageV4);
  await router.deployed();
  result.router = router.address;
  console.log("PendleRouterV4:", result.router);

  // ============================================
  // 9. Register Router facets
  // ============================================
  console.log("\n[9/14] Registering Router facets...");

  const getSelectors = async (contractName: string): Promise<string[]> => {
    const factory = await ethers.getContractFactory(contractName);
    const selectors: string[] = [];
    for (const funcSig of Object.keys(factory.interface.functions)) {
      selectors.push(factory.interface.getSighash(funcSig));
    }
    return selectors;
  };

  const routerSelectorsToFacets = [
    { facet: result.routerFacets.actionStorageV4, selectors: await getSelectors("ActionStorageV4") },
    { facet: result.routerFacets.actionAddRemoveLiqV3, selectors: await getSelectors("ActionAddRemoveLiqV3") },
    { facet: result.routerFacets.actionSwapPTV3, selectors: await getSelectors("ActionSwapPTV3") },
    { facet: result.routerFacets.actionSwapYTV3, selectors: await getSelectors("ActionSwapYTV3") },
    { facet: result.routerFacets.actionMiscV3, selectors: await getSelectors("ActionMiscV3") },
    { facet: result.routerFacets.actionSimple, selectors: await getSelectors("ActionSimple") },
    { facet: result.routerFacets.actionCallbackV3, selectors: await getSelectors("ActionCallbackV3") },
  ];

  const routerAsStorage = await ethers.getContractAt("IPActionStorageV4", result.router);
  await (await routerAsStorage.setSelectorToFacets(routerSelectorsToFacets)).wait();
  console.log("Router facets registered");

  // ============================================
  // 10. Deploy RouterStatic + Static Facets
  // ============================================
  console.log("\n[10/14] Deploying RouterStatic facets...");

  result.routerStaticFacets.actionStorageStatic = await deployFacet("ActionStorageStatic");
  result.routerStaticFacets.actionInfoStatic = await deployFacet("ActionInfoStatic");
  result.routerStaticFacets.actionMarketAuxStatic = await deployFacet("ActionMarketAuxStatic");
  result.routerStaticFacets.actionMarketCoreStatic = await deployFacet("ActionMarketCoreStatic");
  result.routerStaticFacets.actionMintRedeemStatic = await deployFacet("ActionMintRedeemStatic");

  console.log("\nDeploying PendleRouterStatic...");
  const PendleRouterStatic = await ethers.getContractFactory("PendleRouterStatic");
  const routerStatic = await PendleRouterStatic.deploy(deployer.address, result.routerStaticFacets.actionStorageStatic);
  await routerStatic.deployed();
  result.routerStatic = routerStatic.address;
  console.log("PendleRouterStatic:", result.routerStatic);

  // ============================================
  // 11. Register RouterStatic facets
  // ============================================
  console.log("\n[11/14] Registering RouterStatic facets...");

  const staticSelectorsToFacets = [
    { facet: result.routerStaticFacets.actionStorageStatic, selectors: await getSelectors("ActionStorageStatic") },
    { facet: result.routerStaticFacets.actionInfoStatic, selectors: await getSelectors("ActionInfoStatic") },
    { facet: result.routerStaticFacets.actionMarketAuxStatic, selectors: await getSelectors("ActionMarketAuxStatic") },
    { facet: result.routerStaticFacets.actionMarketCoreStatic, selectors: await getSelectors("ActionMarketCoreStatic") },
    { facet: result.routerStaticFacets.actionMintRedeemStatic, selectors: await getSelectors("ActionMintRedeemStatic") },
  ];

  const routerStaticAsStorage = await ethers.getContractAt("ActionStorageStatic", result.routerStatic);
  await (await routerStaticAsStorage.setFacetForSelectors(staticSelectorsToFacets)).wait();
  console.log("RouterStatic facets registered");

  // ============================================
  // 12. Deploy PY/YT/LP Oracle
  // ============================================
  console.log("\n[12/14] Deploying PY/YT/LP Oracle...");
  const PendlePYLpOracle = await ethers.getContractFactory("PendlePYLpOracle");
  const oracleImpl = await PendlePYLpOracle.deploy();
  await oracleImpl.deployed();

  const oracleInitData = oracleImpl.interface.encodeFunctionData("initialize", [1000, deployer.address]);
  const oracleProxy = await TransparentUpgradeableProxy.deploy(oracleImpl.address, deployer.address, oracleInitData);
  await oracleProxy.deployed();
  result.pyYtLpOracle = oracleProxy.address;
  console.log("PendlePYLpOracle:", result.pyYtLpOracle);

  // ============================================
  // 13. Deploy PendleSwap (swap aggregator)
  // ============================================
  console.log("\n[13/14] Deploying PendleSwap...");
  const PendleSwap = await ethers.getContractFactory("PendleSwap");
  const pendleSwapImpl = await PendleSwap.deploy(true);
  await pendleSwapImpl.deployed();

  const pendleSwapInitData = pendleSwapImpl.interface.encodeFunctionData("initialize", [deployer.address]);
  const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
  const pendleSwapProxy = await ERC1967Proxy.deploy(pendleSwapImpl.address, pendleSwapInitData);
  await pendleSwapProxy.deployed();
  result.pendleSwap = pendleSwapProxy.address;
  console.log("PendleSwap:", result.pendleSwap);

  // ============================================
  // 14. Deploy Pool Deploy Helper
  // ============================================
  console.log("\n[14/14] Deploying PoolDeployHelper...");
  const PendlePoolDeployHelperV2 = await ethers.getContractFactory("PendlePoolDeployHelperV2");
  const poolDeployHelper = await PendlePoolDeployHelperV2.deploy(
    result.router,
    result.yieldContractFactory,
    result.marketFactory
  );
  await poolDeployHelper.deployed();
  result.poolDeployHelper = poolDeployHelper.address;
  console.log("PoolDeployHelper:", result.poolDeployHelper);

  // ============================================
  // Print deployment summary
  // ============================================
  console.log("\n" + "=".repeat(70));
  console.log("PENDLE LOCAL DEPLOYMENT COMPLETE");
  console.log("=".repeat(70));
  console.log("\nCore Infrastructure:");
  console.log("  BaseSplitCodeFactory:", result.baseSplitCodeFactory);
  console.log("  OracleLib:", result.oracleLib);
  console.log("\nMarket Split Code (PendleMarketV6Local):");
  console.log("  CodeContractA:", result.marketCreationCodeContractA);
  console.log("  CodeContractB:", result.marketCreationCodeContractB);
  console.log("\nFactories:");
  console.log("  YieldContractFactory:", result.yieldContractFactory);
  console.log("  MarketFactoryLocal:", result.marketFactory);
  console.log("  MarketFactoryLocal impl:", result.marketFactoryImpl);
  console.log("  SY Factory:", result.syFactory);
  console.log("\nRouter (main entry point):");
  console.log("  Router:", result.router);
  console.log("  Facets:", Object.keys(result.routerFacets).length);
  console.log("\nRouterStatic (read-only queries):");
  console.log("  RouterStatic:", result.routerStatic);
  console.log("  Facets:", Object.keys(result.routerStaticFacets).length);
  console.log("\nOracles & Helpers:");
  console.log("  PY/YT/LP Oracle:", result.pyYtLpOracle);
  console.log("  PendleSwap:", result.pendleSwap);
  console.log("  PoolDeployHelper:", result.poolDeployHelper);
  console.log("\nNotes:");
  console.log("  - Uses PendleMarketV6Local (no gauge dependency)");
  console.log("  - Uses CREATE2 split code pattern (matches production)");
  console.log("  - MarketFactory is upgradeable (behind proxy)");
  console.log("  - No vePendle/gaugeController required");
  console.log("  - Deployer is owner and treasury");
  console.log("  - Ready to create SY tokens, PT/YT pairs, and markets");
  console.log("=".repeat(70));

  // Save deployment
  const deploymentPath = "./deployments/local-deployment.json";
  fs.mkdirSync("./deployments", { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(result, null, 2));
  console.log(`\nDeployment saved to: ${deploymentPath}`);

  return result;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
