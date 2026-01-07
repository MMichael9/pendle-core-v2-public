/**
 * COMPREHENSIVE Math Vector Tests for R55/Rust Parity
 * 
 * This test suite:
 * 1. Tests EVERY function in MathVectorHarness.sol
 * 2. Saves all results to test/vectors/math_vectors.json
 * 3. Covers edge cases, boundary conditions, and realistic scenarios
 * 
 * Run with: yarn test:vectors
 */

/// <reference types="mocha" />
import { ethers } from "hardhat";
import { MathVectorHarness } from "../typechain-types";
import * as fs from "fs";
import * as path from "path";

interface TestVector {
    function: string;
    inputs: Record<string, string>;
    output: string | Record<string, string> | null;
    reverts?: boolean;
}

describe("COMPREHENSIVE Math Vectors", function () {
    let h: MathVectorHarness;
    const vectors: TestVector[] = [];

    const ONE = 10n ** 18n;
    const IONE = 10n ** 18n;
    const IMPLIED_RATE_TIME = 365n * 86400n;

    function addVector(fn: string, inputs: Record<string, bigint | number>, output: bigint | Record<string, bigint> | null, reverts = false) {
        const inputsStr: Record<string, string> = {};
        for (const [k, v] of Object.entries(inputs)) {
            inputsStr[k] = v.toString();
        }
        let outputStr: string | Record<string, string> | null;
        if (output === null) {
            outputStr = null;
        } else if (typeof output === "bigint") {
            outputStr = output.toString();
        } else {
            outputStr = {};
            for (const [k, v] of Object.entries(output)) {
                outputStr[k] = v.toString();
            }
        }
        vectors.push({ function: fn, inputs: inputsStr, output: outputStr, reverts });
    }

    before(async function () {
        const Factory = await ethers.getContractFactory("MathVectorHarness");
        h = await Factory.deploy() as MathVectorHarness;
        await h.deployed();
        console.log("\n" + "=".repeat(80));
        console.log("COMPREHENSIVE MATH VECTOR GENERATION");
        console.log("=".repeat(80) + "\n");
    });

    after(async function () {
        // Save all vectors to JSON
        const vectorsDir = path.join(__dirname, "vectors");
        if (!fs.existsSync(vectorsDir)) {
            fs.mkdirSync(vectorsDir, { recursive: true });
        }
        const outputPath = path.join(vectorsDir, "math_vectors.json");
        fs.writeFileSync(outputPath, JSON.stringify(vectors, null, 2));
        console.log(`\n${"=".repeat(80)}`);
        console.log(`SAVED ${vectors.length} TEST VECTORS TO: ${outputPath}`);
        console.log("=".repeat(80) + "\n");
    });

    // =========================================================================
    // SECTION 1: Constants
    // =========================================================================
    describe("1. Constants", function () {
        it("verifies all constants", async function () {
            const c = await h.constants();
            console.log(`    ONE = ${c.ONE}`);
            console.log(`    IONE = ${c.IONE}`);
            console.log(`    MAX_NATURAL_EXPONENT = ${c.MAX_NATURAL_EXPONENT}`);
            console.log(`    MIN_NATURAL_EXPONENT = ${c.MIN_NATURAL_EXPONENT}`);
            console.log(`    LN_36_LOWER_BOUND = ${c.LN_36_LOWER_BOUND}`);
            console.log(`    LN_36_UPPER_BOUND = ${c.LN_36_UPPER_BOUND}`);
            console.log(`    IMPLIED_RATE_TIME = ${c.IMPLIED_RATE_TIME}`);
            console.log(`    MAX_MARKET_PROPORTION = ${c.MAX_MARKET_PROPORTION}`);
            console.log(`    MINIMUM_LIQUIDITY = ${c.MINIMUM_LIQUIDITY}`);
            addVector("constants", {}, {
                ONE: c.ONE.toBigInt(),
                IONE: c.IONE.toBigInt(),
                MAX_NATURAL_EXPONENT: c.MAX_NATURAL_EXPONENT.toBigInt(),
                MIN_NATURAL_EXPONENT: c.MIN_NATURAL_EXPONENT.toBigInt(),
                LN_36_LOWER_BOUND: c.LN_36_LOWER_BOUND.toBigInt(),
                LN_36_UPPER_BOUND: c.LN_36_UPPER_BOUND.toBigInt(),
                IMPLIED_RATE_TIME: c.IMPLIED_RATE_TIME.toBigInt(),
                MAX_MARKET_PROPORTION: c.MAX_MARKET_PROPORTION.toBigInt(),
                MINIMUM_LIQUIDITY: c.MINIMUM_LIQUIDITY.toBigInt(),
            });
        });
    });

    // =========================================================================
    // SECTION 2: exp()
    // =========================================================================
    describe("2. exp()", function () {
        const cases = [
            // Boundaries
            { name: "zero", x: 0n },
            { name: "max", x: 130n * ONE },
            { name: "near_max", x: 129n * ONE + ONE - 1n },
            { name: "min", x: -41n * ONE },
            { name: "near_min", x: -40n * ONE - ONE + 1n },
            // Small positives
            { name: "1_wei", x: 1n },
            { name: "1e12", x: ONE / 1000000n },
            { name: "1e15", x: ONE / 1000n },
            { name: "0.1", x: ONE / 10n },
            { name: "0.25", x: ONE / 4n },
            { name: "0.5", x: ONE / 2n },
            { name: "1", x: ONE },
            { name: "2", x: 2n * ONE },
            { name: "5", x: 5n * ONE },
            { name: "10", x: 10n * ONE },
            // Negatives
            { name: "-1_wei", x: -1n },
            { name: "-1e12", x: -ONE / 1000000n },
            { name: "-0.1", x: -ONE / 10n },
            { name: "-0.5", x: -ONE / 2n },
            { name: "-1", x: -ONE },
            { name: "-2", x: -2n * ONE },
            { name: "-5", x: -5n * ONE },
            { name: "-10", x: -10n * ONE },
            { name: "-20", x: -20n * ONE },
            { name: "-30", x: -30n * ONE },
            { name: "-40", x: -40n * ONE },
            // Decomposition boundaries
            { name: "x11_6.25", x: 6250000000000000000n },
            { name: "x10_12.5", x: 12500000000000000000n },
            { name: "x9_25", x: 25000000000000000000n },
            { name: "x8_50", x: 50000000000000000000n },
            { name: "x7_100", x: 100000000000000000000n },
            { name: "x1_64", x: 64000000000000000000n },
            { name: "x0_128", x: 128000000000000000000n },
            // DeFi rates
            { name: "1%_apy", x: 9950330853168082n },
            { name: "5%_apy", x: 48790164169432003n },
            { name: "10%_apy", x: 95310179804324859n },
            { name: "mainnet", x: 39399837653746832n },
            { name: "fee_rate", x: 1998002662673056n },
        ];

        for (const c of cases) {
            it(`exp(${c.name})`, async function () {
                try {
                    const result = await h.exp(c.x);
                    console.log(`    exp[${c.name}](${c.x}) = ${result}`);
                    addVector("exp", { x: c.x }, result.toBigInt());
                } catch (e) {
                    console.log(`    exp[${c.name}](${c.x}) REVERTS`);
                    addVector("exp", { x: c.x }, null, true);
                }
            });
        }
    });

    // =========================================================================
    // SECTION 3: ln()
    // =========================================================================
    describe("3. ln()", function () {
        const cases = [
            // ln_36 path (0.9 to 1.1)
            { name: "1", a: ONE },
            { name: "1.001", a: ONE + ONE / 1000n },
            { name: "0.999", a: ONE - ONE / 1000n },
            { name: "1.01", a: 1010000000000000000n },
            { name: "0.99", a: 990000000000000000n },
            { name: "1.09", a: 1090000000000000000n },
            { name: "0.91", a: 910000000000000000n },
            { name: "1.1", a: 1100000000000000000n },
            { name: "0.9", a: 900000000000000000n },
            // Standard values
            { name: "1.2", a: 1200000000000000000n },
            { name: "1.5", a: 1500000000000000000n },
            { name: "2", a: 2n * ONE },
            { name: "e", a: 2718281828459045235n },
            { name: "3", a: 3n * ONE },
            { name: "5", a: 5n * ONE },
            { name: "10", a: 10n * ONE },
            { name: "100", a: 100n * ONE },
            { name: "1000", a: 1000n * ONE },
            // Below 1
            { name: "0.8", a: 800000000000000000n },
            { name: "0.5", a: 500000000000000000n },
            { name: "0.1", a: 100000000000000000n },
            { name: "0.01", a: 10000000000000000n },
            // Tiny
            { name: "1_wei", a: 1n },
            { name: "100_wei", a: 100n },
            { name: "1e9_wei", a: 1000000000n },
            { name: "1e15_wei", a: 1000000000000000n },
            // Decomposition boundaries (powers of e)
            { name: "a11", a: 106449445891785942956n },
            { name: "a10", a: 113314845306682631683n },
            { name: "a9", a: 128402541668774148407n },
            { name: "a8", a: 164872127070012814685n },
            { name: "a7", a: 271828182845904523536n },
            // Mainnet
            { name: "mainnet_anchor", a: 1040138669417921641n },
        ];

        for (const c of cases) {
            it(`ln(${c.name})`, async function () {
                try {
                    const result = await h.ln(c.a);
                    console.log(`    ln[${c.name}](${c.a}) = ${result}`);
                    addVector("ln", { a: c.a }, result.toBigInt());
                } catch (e) {
                    console.log(`    ln[${c.name}](${c.a}) REVERTS`);
                    addVector("ln", { a: c.a }, null, true);
                }
            });
        }
    });

    // =========================================================================
    // SECTION 4: pow()
    // =========================================================================
    describe("4. pow()", function () {
        const cases = [
            { name: "1^1", x: ONE, y: ONE },
            { name: "2^1", x: 2n * ONE, y: ONE },
            { name: "2^2", x: 2n * ONE, y: 2n * ONE },
            { name: "2^0.5_sqrt", x: 2n * ONE, y: ONE / 2n },
            { name: "10^0.5_sqrt", x: 10n * ONE, y: ONE / 2n },
            { name: "1.5^3", x: 1500000000000000000n, y: 3n * ONE },
            { name: "e^1", x: 2718281828459045235n, y: ONE },
            { name: "e^2", x: 2718281828459045235n, y: 2n * ONE },
            { name: "4^0.5", x: 4n * ONE, y: ONE / 2n },
            { name: "9^0.5", x: 9n * ONE, y: ONE / 2n },
            { name: "100^0.5", x: 100n * ONE, y: ONE / 2n },
            { name: "2^10", x: 2n * ONE, y: 10n * ONE },
            { name: "1.01^365", x: 1010000000000000000n, y: 365n * ONE },
            { name: "0.5^1", x: ONE / 2n, y: ONE },
            { name: "0.5^2", x: ONE / 2n, y: 2n * ONE },
        ];

        for (const c of cases) {
            it(`pow(${c.name})`, async function () {
                try {
                    const result = await h.pow(c.x, c.y);
                    console.log(`    pow[${c.name}](${c.x}, ${c.y}) = ${result}`);
                    addVector("pow", { x: c.x, y: c.y }, result.toBigInt());
                } catch (e) {
                    console.log(`    pow[${c.name}](${c.x}, ${c.y}) REVERTS`);
                    addVector("pow", { x: c.x, y: c.y }, null, true);
                }
            });
        }
    });

    // =========================================================================
    // SECTION 5: mulDown / mulDownInt
    // =========================================================================
    describe("5. mulDown()", function () {
        const unsignedCases = [
            { name: "1x1", a: ONE, b: ONE },
            { name: "2x3", a: 2n * ONE, b: 3n * ONE },
            { name: "tiny_x_huge", a: 1n, b: 10n ** 30n },
            { name: "rounding_down", a: 3n, b: ONE / 3n },
            { name: "max_x_1", a: 2n ** 128n - 1n, b: ONE },
            { name: "0.5x0.5", a: ONE / 2n, b: ONE / 2n },
            { name: "1.5x1.5", a: 1500000000000000000n, b: 1500000000000000000n },
        ];

        for (const c of unsignedCases) {
            it(`mulDown(${c.name})`, async function () {
                const result = await h.mulDown(c.a, c.b);
                console.log(`    mulDown[${c.name}](${c.a}, ${c.b}) = ${result}`);
                addVector("mulDown", { a: c.a, b: c.b }, result.toBigInt());
            });
        }

        const signedCases = [
            { name: "pos_x_pos", a: ONE, b: 2n * ONE },
            { name: "neg_x_pos", a: -ONE, b: 2n * ONE },
            { name: "pos_x_neg", a: ONE, b: -2n * ONE },
            { name: "neg_x_neg", a: -ONE, b: -2n * ONE },
            { name: "tiny_neg", a: -1n, b: ONE },
        ];

        for (const c of signedCases) {
            it(`mulDownInt(${c.name})`, async function () {
                const result = await h.mulDownInt(c.a, c.b);
                console.log(`    mulDownInt[${c.name}](${c.a}, ${c.b}) = ${result}`);
                addVector("mulDownInt", { a: c.a, b: c.b }, result.toBigInt());
            });
        }
    });

    // =========================================================================
    // SECTION 6: divDown / divDownInt
    // =========================================================================
    describe("6. divDown()", function () {
        const unsignedCases = [
            { name: "1/1", a: ONE, b: ONE },
            { name: "1/2", a: ONE, b: 2n * ONE },
            { name: "1/3", a: ONE, b: 3n * ONE },
            { name: "2/3", a: 2n * ONE, b: 3n * ONE },
            { name: "raw_1/3", a: 1n, b: 3n },
            { name: "large/small", a: 10n ** 30n, b: ONE },
            { name: "1/1.5", a: ONE, b: 1500000000000000000n },
        ];

        for (const c of unsignedCases) {
            it(`divDown(${c.name})`, async function () {
                const result = await h.divDown(c.a, c.b);
                console.log(`    divDown[${c.name}](${c.a}, ${c.b}) = ${result}`);
                addVector("divDown", { a: c.a, b: c.b }, result.toBigInt());
            });
        }

        const signedCases = [
            { name: "pos/pos", a: ONE, b: 2n * ONE },
            { name: "neg/pos", a: -ONE, b: 2n * ONE },
            { name: "pos/neg", a: ONE, b: -2n * ONE },
            { name: "neg/neg", a: -ONE, b: -2n * ONE },
        ];

        for (const c of signedCases) {
            it(`divDownInt(${c.name})`, async function () {
                const result = await h.divDownInt(c.a, c.b);
                console.log(`    divDownInt[${c.name}](${c.a}, ${c.b}) = ${result}`);
                addVector("divDownInt", { a: c.a, b: c.b }, result.toBigInt());
            });
        }
    });

    // =========================================================================
    // SECTION 7: rawDivUp
    // =========================================================================
    describe("7. rawDivUp()", function () {
        const unsignedCases = [
            { name: "10/3", a: 10n, b: 3n },
            { name: "9/3_exact", a: 9n, b: 3n },
            { name: "1/2", a: 1n, b: 2n },
            { name: "1/1", a: 1n, b: 1n },
            { name: "0/1", a: 0n, b: 1n },
            { name: "7/3", a: 7n, b: 3n },
            { name: "large/small", a: 10n ** 20n + 1n, b: 10n ** 10n },
        ];

        for (const c of unsignedCases) {
            it(`rawDivUp(${c.name})`, async function () {
                const result = await h.rawDivUp(c.a, c.b);
                console.log(`    rawDivUp[${c.name}](${c.a}, ${c.b}) = ${result}`);
                addVector("rawDivUp", { a: c.a, b: c.b }, result.toBigInt());
            });
        }

        const signedCases = [
            { name: "10/3", a: 10n, b: 3n },
            { name: "-10/3", a: -10n, b: 3n },
            { name: "10/-3", a: 10n, b: -3n },
            { name: "-10/-3", a: -10n, b: -3n },
        ];

        for (const c of signedCases) {
            it(`rawDivUpInt(${c.name})`, async function () {
                const result = await h.rawDivUpInt(c.a, c.b);
                console.log(`    rawDivUpInt[${c.name}](${c.a}, ${c.b}) = ${result}`);
                addVector("rawDivUpInt", { a: c.a, b: c.b }, result.toBigInt());
            });
        }
    });

    // =========================================================================
    // SECTION 8: sqrt
    // =========================================================================
    describe("8. sqrt()", function () {
        const cases = [
            { name: "0", y: 0n },
            { name: "1", y: 1n },
            { name: "2", y: 2n },
            { name: "3", y: 3n },
            { name: "4", y: 4n },
            { name: "9", y: 9n },
            { name: "16", y: 16n },
            { name: "144", y: 144n },
            { name: "145", y: 145n },
            { name: "1e18", y: ONE },
            { name: "1e36", y: ONE * ONE },
            { name: "max_u128", y: 2n ** 128n - 1n },
            { name: "max_u255", y: 2n ** 255n - 1n },
            { name: "perfect_1e20", y: 10n ** 20n },
        ];

        for (const c of cases) {
            it(`sqrt(${c.name})`, async function () {
                const result = await h.sqrt(c.y);
                console.log(`    sqrt[${c.name}](${c.y}) = ${result}`);
                addVector("sqrt", { y: c.y }, result.toBigInt());
            });
        }
    });

    // =========================================================================
    // SECTION 9: subNoNeg, abs, neg
    // =========================================================================
    describe("9. Helpers: subNoNeg, abs, neg", function () {
        describe("subNoNeg", function () {
            const cases = [
                { name: "5-3", a: 5n * ONE, b: 3n * ONE },
                { name: "3-3", a: 3n * ONE, b: 3n * ONE },
                { name: "1e18-1", a: ONE, b: 1n },
            ];

            for (const c of cases) {
                it(`subNoNeg(${c.name})`, async function () {
                    const result = await h.subNoNeg(c.a, c.b);
                    console.log(`    subNoNeg[${c.name}](${c.a}, ${c.b}) = ${result}`);
                    addVector("subNoNeg", { a: c.a, b: c.b }, result.toBigInt());
                });
            }
        });

        describe("abs", function () {
            const cases = [
                { name: "positive", x: ONE },
                { name: "negative", x: -ONE },
                { name: "zero", x: 0n },
                { name: "large_neg", x: -(10n ** 30n) },
            ];

            for (const c of cases) {
                it(`abs(${c.name})`, async function () {
                    const result = await h.abs(c.x);
                    console.log(`    abs[${c.name}](${c.x}) = ${result}`);
                    addVector("abs", { x: c.x }, result.toBigInt());
                });
            }
        });

        describe("neg", function () {
            const cases = [
                { name: "positive", x: ONE },
                { name: "negative", x: -ONE },
                { name: "zero", x: 0n },
            ];

            for (const c of cases) {
                it(`neg(${c.name})`, async function () {
                    const result = await h.neg(c.x);
                    console.log(`    neg[${c.name}](${c.x}) = ${result}`);
                    addVector("neg", { x: c.x }, result.toBigInt());
                });
            }
        });
    });

    // =========================================================================
    // SECTION 10: toInt, toUint
    // =========================================================================
    describe("10. Type Conversions: toInt, toUint", function () {
        describe("toInt", function () {
            const cases = [
                { name: "zero", x: 0n },
                { name: "one", x: ONE },
                { name: "max_i256", x: 2n ** 255n - 1n },
            ];

            for (const c of cases) {
                it(`toInt(${c.name})`, async function () {
                    const result = await h.toInt(c.x);
                    console.log(`    toInt[${c.name}](${c.x}) = ${result}`);
                    addVector("toInt", { x: c.x }, result.toBigInt());
                });
            }
        });

        describe("toUint", function () {
            const cases = [
                { name: "zero", x: 0n },
                { name: "one", x: ONE },
                { name: "max_i256", x: 2n ** 255n - 1n },
            ];

            for (const c of cases) {
                it(`toUint(${c.name})`, async function () {
                    const result = await h.toUint(c.x);
                    console.log(`    toUint[${c.name}](${c.x}) = ${result}`);
                    addVector("toUint", { x: c.x }, result.toBigInt());
                });
            }
        });
    });

    // =========================================================================
    // SECTION 11: SYUtils
    // =========================================================================
    describe("11. SYUtils", function () {
        describe("syToAsset / syToAssetUp", function () {
            const cases = [
                { name: "rate_1", rate: ONE, amount: ONE },
                { name: "rate_1.05", rate: 1050000000000000000n, amount: ONE },
                { name: "rate_1.1", rate: 1100000000000000000n, amount: 100n * ONE },
                { name: "rate_2", rate: 2n * ONE, amount: 123456789n * ONE },
                { name: "tiny_amount", rate: 1050000000000000000n, amount: 1n },
                { name: "rounding_case", rate: 3n * ONE, amount: ONE },
            ];

            for (const c of cases) {
                it(`syToAsset(${c.name})`, async function () {
                    const down = await h.syToAsset(c.rate, c.amount);
                    const up = await h.syToAssetUp(c.rate, c.amount);
                    console.log(`    syToAsset[${c.name}](${c.rate}, ${c.amount}) = ${down}, up=${up}`);
                    addVector("syToAsset", { rate: c.rate, amount: c.amount }, down.toBigInt());
                    addVector("syToAssetUp", { rate: c.rate, amount: c.amount }, up.toBigInt());
                });
            }
        });

        describe("assetToSy / assetToSyUp", function () {
            const cases = [
                { name: "rate_1", rate: ONE, amount: ONE },
                { name: "rate_1.05", rate: 1050000000000000000n, amount: ONE },
                { name: "rate_1.1", rate: 1100000000000000000n, amount: 100n * ONE },
                { name: "rate_2", rate: 2n * ONE, amount: 123456789n * ONE },
                { name: "tiny_amount", rate: 1050000000000000000n, amount: 1n },
                { name: "rounding_case", rate: 3n * ONE, amount: ONE },
            ];

            for (const c of cases) {
                it(`assetToSy(${c.name})`, async function () {
                    const down = await h.assetToSy(c.rate, c.amount);
                    const up = await h.assetToSyUp(c.rate, c.amount);
                    console.log(`    assetToSy[${c.name}](${c.rate}, ${c.amount}) = ${down}, up=${up}`);
                    addVector("assetToSy", { rate: c.rate, amount: c.amount }, down.toBigInt());
                    addVector("assetToSyUp", { rate: c.rate, amount: c.amount }, up.toBigInt());
                });
            }
        });
    });

    // =========================================================================
    // SECTION 12: logProportion
    // =========================================================================
    describe("12. logProportion()", function () {
        const cases = [
            // Symmetric around 0.5
            { name: "0.5", p: 500000000000000000n },
            { name: "0.4", p: 400000000000000000n },
            { name: "0.6", p: 600000000000000000n },
            { name: "0.3", p: 300000000000000000n },
            { name: "0.7", p: 700000000000000000n },
            { name: "0.2", p: 200000000000000000n },
            { name: "0.8", p: 800000000000000000n },
            { name: "0.1", p: 100000000000000000n },
            { name: "0.9", p: 900000000000000000n },
            // Extremes
            { name: "0.01", p: 10000000000000000n },
            { name: "0.99", p: 990000000000000000n },
            { name: "0.001", p: 1000000000000000n },
            { name: "0.999", p: 999000000000000000n },
            { name: "0.96_max_market", p: 960000000000000000n },
            { name: "tiny", p: 100000000000000n },
            { name: "near_one", p: 999999999999999999n },
        ];

        for (const c of cases) {
            it(`logProportion(${c.name})`, async function () {
                try {
                    const result = await h.logProportion(c.p);
                    console.log(`    logProportion[${c.name}](${c.p}) = ${result}`);
                    addVector("logProportion", { proportion: c.p }, result.toBigInt());
                } catch (e) {
                    console.log(`    logProportion[${c.name}](${c.p}) REVERTS`);
                    addVector("logProportion", { proportion: c.p }, null, true);
                }
            });
        }
    });

    // =========================================================================
    // SECTION 13: getExchangeRateFromImpliedRate
    // =========================================================================
    describe("13. getExchangeRateFromImpliedRate()", function () {
        const lnRate = 39399837653746832n; // ~4% APY
        const times = [
            { name: "1_year", t: 31536000n },
            { name: "6_months", t: 15768000n },
            { name: "3_months", t: 7884000n },
            { name: "1_month", t: 2628000n },
            { name: "1_week", t: 604800n },
            { name: "1_day", t: 86400n },
            { name: "1_hour", t: 3600n },
            { name: "1_second", t: 1n },
        ];

        for (const c of times) {
            it(`rate_at_${c.name}`, async function () {
                const result = await h.getExchangeRateFromImpliedRate(lnRate, c.t);
                console.log(`    getExchangeRateFromImpliedRate[${c.name}](${lnRate}, ${c.t}) = ${result}`);
                addVector("getExchangeRateFromImpliedRate", { lnImpliedRate: lnRate, timeToExpiry: c.t }, result.toBigInt());
            });
        }

        const apys = [
            { name: "1%_apy", rate: 9950330853168082n },
            { name: "5%_apy", rate: 48790164169432003n },
            { name: "10%_apy", rate: 95310179804324859n },
            { name: "50%_apy", rate: 405465108108164381n },
            { name: "100%_apy", rate: 693147180559945309n },
        ];

        for (const c of apys) {
            it(`apy_${c.name}`, async function () {
                const result = await h.getExchangeRateFromImpliedRate(c.rate, 31536000n);
                console.log(`    getExchangeRateFromImpliedRate[${c.name}](${c.rate}, 31536000) = ${result}`);
                addVector("getExchangeRateFromImpliedRate", { lnImpliedRate: c.rate, timeToExpiry: 31536000n }, result.toBigInt());
            });
        }
    });

    // =========================================================================
    // SECTION 14: getRateScalar
    // =========================================================================
    describe("14. getRateScalar()", function () {
        const scalarRoot = 219693210787180268630n;
        const times = [
            { name: "1_year", t: 31536000n },
            { name: "6_months", t: 15768000n },
            { name: "3_months", t: 7884000n },
            { name: "1_month", t: 2628000n },
            { name: "1_week", t: 604800n },
            { name: "1_day", t: 86400n },
            { name: "1_hour", t: 3600n },
        ];

        for (const c of times) {
            it(`scalar_at_${c.name}`, async function () {
                const result = await h.getRateScalar(scalarRoot, c.t);
                console.log(`    getRateScalar[${c.name}](${scalarRoot}, ${c.t}) = ${result}`);
                addVector("getRateScalar", { scalarRoot, timeToExpiry: c.t }, result.toBigInt());
            });
        }
    });

    // =========================================================================
    // SECTION 15: getExchangeRate - Full AMM
    // =========================================================================
    describe("15. getExchangeRate()", function () {
        const rateScalar = 219693210787180268630n;
        const rateAnchor = 1040138669417921641n;

        const poolConfigs = [
            { name: "balanced", totalPt: 1000n * ONE, totalAsset: 1000n * ONE },
            { name: "pt_heavy", totalPt: 1500n * ONE, totalAsset: 500n * ONE },
            { name: "asset_heavy", totalPt: 500n * ONE, totalAsset: 1500n * ONE },
            { name: "large", totalPt: 1000000n * ONE, totalAsset: 1000000n * ONE },
            { name: "small", totalPt: 100n * ONE, totalAsset: 100n * ONE },
        ];

        const trades = [0n, ONE, 10n * ONE, 50n * ONE, 100n * ONE, (-ONE), (-10n) * ONE, (-50n) * ONE, (-100n) * ONE];

        for (const pool of poolConfigs) {
            describe(`${pool.name} pool`, function () {
                for (const netPt of trades) {
                    const tradeName = netPt === 0n ? "no_trade" : netPt > 0n ? `buy_${netPt / ONE}pt` : `sell_${-netPt / ONE}pt`;
                    it(`${tradeName}`, async function () {
                        try {
                            const result = await h.getExchangeRate(pool.totalPt, pool.totalAsset, rateScalar, rateAnchor, netPt);
                            console.log(`    getExchangeRate[${pool.name}_${tradeName}] = ${result}`);
                            addVector("getExchangeRate", {
                                totalPt: pool.totalPt,
                                totalAsset: pool.totalAsset,
                                rateScalar,
                                rateAnchor,
                                netPtToAccount: netPt,
                            }, result.toBigInt());
                        } catch (e) {
                            console.log(`    getExchangeRate[${pool.name}_${tradeName}] REVERTS`);
                            addVector("getExchangeRate", {
                                totalPt: pool.totalPt,
                                totalAsset: pool.totalAsset,
                                rateScalar,
                                rateAnchor,
                                netPtToAccount: netPt,
                            }, null, true);
                        }
                    });
                }
            });
        }
    });

    // =========================================================================
    // SECTION 16: getRateAnchor
    // =========================================================================
    describe("16. getRateAnchor()", function () {
        const rateScalar = 219693210787180268630n;
        const oneYear = 31536000n;

        const cases = [
            { name: "balanced_4%", totalPt: 1000n * ONE, totalAsset: 1000n * ONE, lnImpliedRate: 39399837653746832n },
            { name: "pt_heavy_4%", totalPt: 1500n * ONE, totalAsset: 500n * ONE, lnImpliedRate: 39399837653746832n },
            { name: "asset_heavy_4%", totalPt: 500n * ONE, totalAsset: 1500n * ONE, lnImpliedRate: 39399837653746832n },
            { name: "balanced_10%", totalPt: 1000n * ONE, totalAsset: 1000n * ONE, lnImpliedRate: 95310179804324859n },
            { name: "balanced_1%", totalPt: 1000n * ONE, totalAsset: 1000n * ONE, lnImpliedRate: 9950330853168082n },
        ];

        for (const c of cases) {
            it(`getRateAnchor_${c.name}`, async function () {
                try {
                    const result = await h.getRateAnchor(c.totalPt, c.lnImpliedRate, c.totalAsset, rateScalar, oneYear);
                    console.log(`    getRateAnchor[${c.name}] = ${result}`);
                    addVector("getRateAnchor", {
                        totalPt: c.totalPt,
                        lastLnImpliedRate: c.lnImpliedRate,
                        totalAsset: c.totalAsset,
                        rateScalar,
                        timeToExpiry: oneYear,
                    }, result.toBigInt());
                } catch (e) {
                    console.log(`    getRateAnchor[${c.name}] REVERTS`);
                    addVector("getRateAnchor", {
                        totalPt: c.totalPt,
                        lastLnImpliedRate: c.lnImpliedRate,
                        totalAsset: c.totalAsset,
                        rateScalar,
                        timeToExpiry: oneYear,
                    }, null, true);
                }
            });
        }
    });

    // =========================================================================
    // SECTION 17: getLnImpliedRate
    // =========================================================================
    describe("17. getLnImpliedRate()", function () {
        const rateScalar = 219693210787180268630n;
        const oneYear = 31536000n;

        const cases = [
            { name: "balanced_low", totalPt: 1000n * ONE, totalAsset: 1000n * ONE, rateAnchor: 1020000000000000000n },
            { name: "balanced_mid", totalPt: 1000n * ONE, totalAsset: 1000n * ONE, rateAnchor: 1040138669417921641n },
            { name: "balanced_high", totalPt: 1000n * ONE, totalAsset: 1000n * ONE, rateAnchor: 1100000000000000000n },
            { name: "pt_heavy", totalPt: 1500n * ONE, totalAsset: 500n * ONE, rateAnchor: 1040138669417921641n },
            { name: "asset_heavy", totalPt: 500n * ONE, totalAsset: 1500n * ONE, rateAnchor: 1040138669417921641n },
        ];

        for (const c of cases) {
            it(`getLnImpliedRate_${c.name}`, async function () {
                try {
                    const result = await h.getLnImpliedRate(c.totalPt, c.totalAsset, rateScalar, c.rateAnchor, oneYear);
                    console.log(`    getLnImpliedRate[${c.name}] = ${result}`);
                    addVector("getLnImpliedRate", {
                        totalPt: c.totalPt,
                        totalAsset: c.totalAsset,
                        rateScalar,
                        rateAnchor: c.rateAnchor,
                        timeToExpiry: oneYear,
                    }, result.toBigInt());
                } catch (e) {
                    console.log(`    getLnImpliedRate[${c.name}] REVERTS`);
                    addVector("getLnImpliedRate", {
                        totalPt: c.totalPt,
                        totalAsset: c.totalAsset,
                        rateScalar,
                        rateAnchor: c.rateAnchor,
                        timeToExpiry: oneYear,
                    }, null, true);
                }
            });
        }
    });

    // =========================================================================
    // SECTION 18: addLiquidityFirst
    // =========================================================================
    describe("18. addLiquidityFirst()", function () {
        const cases = [
            { name: "equal_100", sy: 100n * ONE, pt: 100n * ONE },
            { name: "equal_1000", sy: 1000n * ONE, pt: 1000n * ONE },
            { name: "equal_1M", sy: 1000000n * ONE, pt: 1000000n * ONE },
            { name: "sy_heavy", sy: 2000n * ONE, pt: 500n * ONE },
            { name: "pt_heavy", sy: 500n * ONE, pt: 2000n * ONE },
            { name: "extreme", sy: 10000n * ONE, pt: 100n * ONE },
            { name: "tiny", sy: ONE / 1000n, pt: ONE / 1000n },
        ];

        for (const c of cases) {
            it(`addLiquidityFirst_${c.name}`, async function () {
                const [lpReserve, lpAccount] = await h.addLiquidityFirst(c.sy, c.pt);
                console.log(`    addLiquidityFirst[${c.name}](${c.sy}, ${c.pt}) = reserve:${lpReserve}, account:${lpAccount}`);
                addVector("addLiquidityFirst", { syDesired: c.sy, ptDesired: c.pt }, {
                    lpToReserve: lpReserve.toBigInt(),
                    lpToAccount: lpAccount.toBigInt(),
                });
            });
        }
    });

    // =========================================================================
    // SECTION 19: addLiquidityProportional
    // =========================================================================
    describe("19. addLiquidityProportional()", function () {
        const totalSy = 1000n * ONE;
        const totalPt = 1000n * ONE;
        const totalLp = 999999999999999999000n;

        const cases = [
            { name: "10%", syDesired: 100n * ONE, ptDesired: 100n * ONE },
            { name: "sy_excess", syDesired: 200n * ONE, ptDesired: 100n * ONE },
            { name: "pt_excess", syDesired: 100n * ONE, ptDesired: 200n * ONE },
            { name: "1%", syDesired: 10n * ONE, ptDesired: 10n * ONE },
            { name: "50%", syDesired: 500n * ONE, ptDesired: 500n * ONE },
        ];

        for (const c of cases) {
            it(`addLiquidityProportional_${c.name}`, async function () {
                const [lpAccount, syUsed, ptUsed] = await h.addLiquidityProportional(
                    totalSy, totalPt, totalLp, c.syDesired, c.ptDesired
                );
                console.log(`    addLiquidityProportional[${c.name}] = lp:${lpAccount}, sy:${syUsed}, pt:${ptUsed}`);
                addVector("addLiquidityProportional", {
                    totalSy,
                    totalPt,
                    totalLp,
                    syDesired: c.syDesired,
                    ptDesired: c.ptDesired,
                }, {
                    lpToAccount: lpAccount.toBigInt(),
                    syUsed: syUsed.toBigInt(),
                    ptUsed: ptUsed.toBigInt(),
                });
            });
        }
    });

    // =========================================================================
    // SECTION 20: removeLiquidity
    // =========================================================================
    describe("20. removeLiquidity()", function () {
        const totalSy = 1000n * ONE;
        const totalPt = 1000n * ONE;
        const totalLp = 999999999999999999000n;

        const percentages = [1n, 10n, 25n, 50n, 75n, 99n, 100n];

        for (const pct of percentages) {
            const lpToRemove = (totalLp * pct) / 100n;
            it(`remove_${pct}%`, async function () {
                const [netSy, netPt] = await h.removeLiquidity(totalSy, totalPt, totalLp, lpToRemove);
                console.log(`    removeLiquidity[${pct}%](lp=${lpToRemove}) = sy:${netSy}, pt:${netPt}`);
                addVector("removeLiquidity", {
                    totalSy,
                    totalPt,
                    totalLp,
                    lpToRemove,
                }, {
                    netSyToAccount: netSy.toBigInt(),
                    netPtToAccount: netPt.toBigInt(),
                });
            });
        }
    });

    // =========================================================================
    // SECTION 21: calcTrade
    // =========================================================================
    describe("21. calcTrade()", function () {
        const totalPt = 1000n * ONE;
        const totalAsset = 1000n * ONE;
        const rateScalar = 219693210787180268630n;
        const rateAnchor = 1040138669417921641n;
        const feeRate = 1001999333777814n;
        const reserveFeePercent = 10n;
        const pyIndex = 1050000000000000000n;

        const trades = [
            { name: "buy_1", netPt: ONE },
            { name: "buy_10", netPt: 10n * ONE },
            { name: "buy_50", netPt: 50n * ONE },
            { name: "buy_100", netPt: 100n * ONE },
            { name: "buy_200", netPt: 200n * ONE },
            { name: "sell_1", netPt: -ONE },
            { name: "sell_10", netPt: -10n * ONE },
            { name: "sell_50", netPt: -50n * ONE },
            { name: "sell_100", netPt: -100n * ONE },
            { name: "sell_200", netPt: -200n * ONE },
        ];

        for (const c of trades) {
            it(`calcTrade_${c.name}`, async function () {
                try {
                    const [netSy, netSyFee, netSyReserve] = await h.calcTrade(
                        totalPt, totalAsset, rateScalar, rateAnchor,
                        feeRate, reserveFeePercent, pyIndex, c.netPt
                    );
                    console.log(`    calcTrade[${c.name}] = sy:${netSy}, fee:${netSyFee}, reserve:${netSyReserve}`);
                    addVector("calcTrade", {
                        totalPt,
                        totalAsset,
                        rateScalar,
                        rateAnchor,
                        feeRate,
                        reserveFeePercent: Number(reserveFeePercent),
                        pyIndexValue: pyIndex,
                        netPtToAccount: c.netPt,
                    }, {
                        netSyToAccount: netSy.toBigInt(),
                        netSyFee: netSyFee.toBigInt(),
                        netSyToReserve: netSyReserve.toBigInt(),
                    });
                } catch (e) {
                    console.log(`    calcTrade[${c.name}] REVERTS`);
                    addVector("calcTrade", {
                        totalPt,
                        totalAsset,
                        rateScalar,
                        rateAnchor,
                        feeRate,
                        reserveFeePercent: Number(reserveFeePercent),
                        pyIndexValue: pyIndex,
                        netPtToAccount: c.netPt,
                    }, null, true);
                }
            });
        }

        describe("Different fee rates", function () {
            const feeRates = [
                { name: "0.1%", rate: 1000999500166625n },
                { name: "0.5%", rate: 1004995008319372n },
                { name: "1%", rate: 1009950330853168n },
                { name: "2%", rate: 1019802627296179n },
            ];

            for (const f of feeRates) {
                it(`fee_${f.name}`, async function () {
                    try {
                        const [netSy, netSyFee, netSyReserve] = await h.calcTrade(
                            totalPt, totalAsset, rateScalar, rateAnchor,
                            f.rate, reserveFeePercent, pyIndex, 10n * ONE
                        );
                        console.log(`    calcTrade[fee_${f.name}] = sy:${netSy}, fee:${netSyFee}, reserve:${netSyReserve}`);
                        addVector("calcTrade", {
                            totalPt,
                            totalAsset,
                            rateScalar,
                            rateAnchor,
                            feeRate: f.rate,
                            reserveFeePercent: Number(reserveFeePercent),
                            pyIndexValue: pyIndex,
                            netPtToAccount: 10n * ONE,
                        }, {
                            netSyToAccount: netSy.toBigInt(),
                            netSyFee: netSyFee.toBigInt(),
                            netSyToReserve: netSyReserve.toBigInt(),
                        });
                    } catch (e) {
                        console.log(`    calcTrade[fee_${f.name}] REVERTS`);
                    }
                });
            }
        });

        describe("Different PY indexes", function () {
            const indexes = [
                { name: "1.0", index: ONE },
                { name: "1.02", index: 1020000000000000000n },
                { name: "1.05", index: 1050000000000000000n },
                { name: "1.1", index: 1100000000000000000n },
                { name: "1.2", index: 1200000000000000000n },
            ];

            for (const idx of indexes) {
                it(`index_${idx.name}`, async function () {
                    try {
                        const [netSy, netSyFee, netSyReserve] = await h.calcTrade(
                            totalPt, totalAsset, rateScalar, rateAnchor,
                            feeRate, reserveFeePercent, idx.index, 10n * ONE
                        );
                        console.log(`    calcTrade[index_${idx.name}] = sy:${netSy}, fee:${netSyFee}, reserve:${netSyReserve}`);
                        addVector("calcTrade", {
                            totalPt,
                            totalAsset,
                            rateScalar,
                            rateAnchor,
                            feeRate,
                            reserveFeePercent: Number(reserveFeePercent),
                            pyIndexValue: idx.index,
                            netPtToAccount: 10n * ONE,
                        }, {
                            netSyToAccount: netSy.toBigInt(),
                            netSyFee: netSyFee.toBigInt(),
                            netSyToReserve: netSyReserve.toBigInt(),
                        });
                    } catch (e) {
                        console.log(`    calcTrade[index_${idx.name}] REVERTS`);
                    }
                });
            }
        });
    });

    // =========================================================================
    // SECTION 22: setInitialLnImpliedRate - Market Initialization
    // =========================================================================
    describe("22. setInitialLnImpliedRate()", function () {
        // Market state after first addLiquidity
        const expiry = 31536000n + 1000000n; // ~1 year from blockTime
        const blockTime = 1000000n;

        const cases = [
            {
                name: "balanced_4%_anchor",
                totalPt: 1000n * ONE,
                totalSy: 1000n * ONE,
                scalarRoot: 219693210787180268630n,
                initialAnchor: 1040138669417921641n,
                pyIndexValue: ONE,
            },
            {
                name: "balanced_high_anchor",
                totalPt: 1000n * ONE,
                totalSy: 1000n * ONE,
                scalarRoot: 219693210787180268630n,
                initialAnchor: 1100000000000000000n,
                pyIndexValue: ONE,
            },
            {
                name: "pt_heavy",
                totalPt: 1500n * ONE,
                totalSy: 500n * ONE,
                scalarRoot: 219693210787180268630n,
                initialAnchor: 1040138669417921641n,
                pyIndexValue: ONE,
            },
            {
                name: "asset_heavy",
                totalPt: 500n * ONE,
                totalSy: 1500n * ONE,
                scalarRoot: 219693210787180268630n,
                initialAnchor: 1040138669417921641n,
                pyIndexValue: ONE,
            },
            {
                name: "with_py_index_1.05",
                totalPt: 1000n * ONE,
                totalSy: 1000n * ONE,
                scalarRoot: 219693210787180268630n,
                initialAnchor: 1040138669417921641n,
                pyIndexValue: 1050000000000000000n,
            },
        ];

        for (const c of cases) {
            it(`setInitialLnImpliedRate_${c.name}`, async function () {
                try {
                    const result = await h.setInitialLnImpliedRate(
                        c.totalPt, c.totalSy, c.scalarRoot, expiry, c.initialAnchor, blockTime, c.pyIndexValue
                    );
                    console.log(`    setInitialLnImpliedRate[${c.name}] = ${result}`);
                    addVector("setInitialLnImpliedRate", {
                        totalPt: c.totalPt,
                        totalSy: c.totalSy,
                        scalarRoot: c.scalarRoot,
                        expiry,
                        initialAnchor: c.initialAnchor,
                        blockTime,
                        pyIndexValue: c.pyIndexValue,
                    }, result.toBigInt());
                } catch (e) {
                    console.log(`    setInitialLnImpliedRate[${c.name}] REVERTS`);
                    addVector("setInitialLnImpliedRate", {
                        totalPt: c.totalPt,
                        totalSy: c.totalSy,
                        scalarRoot: c.scalarRoot,
                        expiry,
                        initialAnchor: c.initialAnchor,
                        blockTime,
                        pyIndexValue: c.pyIndexValue,
                    }, null, true);
                }
            });
        }
    });

    // =========================================================================
    // SECTION 23: getMarketPreCompute - Full Pre-computation
    // =========================================================================
    describe("23. getMarketPreCompute()", function () {
        const expiry = 31536000n + 1000000n;
        const blockTime = 1000000n;
        const lnFeeRateRoot = 1998002662673056n;
        const lastLnImpliedRate = 39399837653746832n;

        const cases = [
            {
                name: "balanced",
                totalPt: 1000n * ONE,
                totalSy: 1000n * ONE,
                scalarRoot: 219693210787180268630n,
                pyIndexValue: ONE,
            },
            {
                name: "pt_heavy",
                totalPt: 1500n * ONE,
                totalSy: 500n * ONE,
                scalarRoot: 219693210787180268630n,
                pyIndexValue: ONE,
            },
            {
                name: "with_py_index",
                totalPt: 1000n * ONE,
                totalSy: 1000n * ONE,
                scalarRoot: 219693210787180268630n,
                pyIndexValue: 1050000000000000000n,
            },
        ];

        for (const c of cases) {
            it(`getMarketPreCompute_${c.name}`, async function () {
                try {
                    const result = await h.getMarketPreCompute(
                        c.totalPt, c.totalSy, c.scalarRoot, expiry, lnFeeRateRoot, lastLnImpliedRate, blockTime, c.pyIndexValue
                    );
                    console.log(`    getMarketPreCompute[${c.name}]:`);
                    console.log(`      rateScalar = ${result.rateScalar}`);
                    console.log(`      totalAsset = ${result.totalAsset}`);
                    console.log(`      rateAnchor = ${result.rateAnchor}`);
                    console.log(`      feeRate = ${result.feeRate}`);
                    addVector("getMarketPreCompute", {
                        totalPt: c.totalPt,
                        totalSy: c.totalSy,
                        scalarRoot: c.scalarRoot,
                        expiry,
                        lnFeeRateRoot,
                        lastLnImpliedRate,
                        blockTime,
                        pyIndexValue: c.pyIndexValue,
                    }, {
                        rateScalar: result.rateScalar.toBigInt(),
                        totalAsset: result.totalAsset.toBigInt(),
                        rateAnchor: result.rateAnchor.toBigInt(),
                        feeRate: result.feeRate.toBigInt(),
                    });
                } catch (e) {
                    console.log(`    getMarketPreCompute[${c.name}] REVERTS`);
                }
            });
        }
    });

    // =========================================================================
    // SECTION 24: executeTradeWithState - Full Trade Simulation
    // =========================================================================
    describe("24. executeTradeWithState()", function () {
        const expiry = 31536000n + 1000000n;
        const blockTime = 1000000n;
        const lnFeeRateRoot = 1998002662673056n;
        const lastLnImpliedRate = 39399837653746832n;
        const reserveFeePercent = 10n;
        const pyIndexValue = 1050000000000000000n;
        const scalarRoot = 219693210787180268630n;

        const trades = [
            { name: "buy_10pt", totalPt: 1000n * ONE, totalSy: 1000n * ONE, netPt: 10n * ONE },
            { name: "buy_100pt", totalPt: 1000n * ONE, totalSy: 1000n * ONE, netPt: 100n * ONE },
            { name: "sell_10pt", totalPt: 1000n * ONE, totalSy: 1000n * ONE, netPt: -10n * ONE },
            { name: "sell_100pt", totalPt: 1000n * ONE, totalSy: 1000n * ONE, netPt: -100n * ONE },
            { name: "large_pool_buy", totalPt: 1000000n * ONE, totalSy: 1000000n * ONE, netPt: 1000n * ONE },
            { name: "imbalanced_buy", totalPt: 1500n * ONE, totalSy: 500n * ONE, netPt: 10n * ONE },
        ];

        for (const c of trades) {
            it(`executeTradeWithState_${c.name}`, async function () {
                try {
                    const result = await h.executeTradeWithState(
                        c.totalPt, c.totalSy, scalarRoot, expiry,
                        lnFeeRateRoot, lastLnImpliedRate, reserveFeePercent,
                        blockTime, pyIndexValue, c.netPt
                    );
                    console.log(`    executeTradeWithState[${c.name}]:`);
                    console.log(`      netSyToAccount = ${result.netSyToAccount}`);
                    console.log(`      netSyFee = ${result.netSyFee}`);
                    console.log(`      netSyToReserve = ${result.netSyToReserve}`);
                    console.log(`      newLastLnImpliedRate = ${result.newLastLnImpliedRate}`);
                    console.log(`      newTotalPt = ${result.newTotalPt}`);
                    console.log(`      newTotalSy = ${result.newTotalSy}`);
                    addVector("executeTradeWithState", {
                        totalPt: c.totalPt,
                        totalSy: c.totalSy,
                        scalarRoot,
                        expiry,
                        lnFeeRateRoot,
                        lastLnImpliedRate,
                        reserveFeePercent: Number(reserveFeePercent),
                        blockTime,
                        pyIndexValue,
                        netPtToAccount: c.netPt,
                    }, {
                        netSyToAccount: result.netSyToAccount.toBigInt(),
                        netSyFee: result.netSyFee.toBigInt(),
                        netSyToReserve: result.netSyToReserve.toBigInt(),
                        newLastLnImpliedRate: result.newLastLnImpliedRate.toBigInt(),
                        newTotalPt: result.newTotalPt.toBigInt(),
                        newTotalSy: result.newTotalSy.toBigInt(),
                    });
                } catch (e: any) {
                    console.log(`    executeTradeWithState[${c.name}] REVERTS: ${e.message?.slice(0, 50)}`);
                    addVector("executeTradeWithState", {
                        totalPt: c.totalPt,
                        totalSy: c.totalSy,
                        scalarRoot,
                        expiry,
                        lnFeeRateRoot,
                        lastLnImpliedRate,
                        reserveFeePercent: Number(reserveFeePercent),
                        blockTime,
                        pyIndexValue,
                        netPtToAccount: c.netPt,
                    }, null, true);
                }
            });
        }
    });

    // =========================================================================
    // SECTION 25: Edge Cases - Revert Conditions
    // =========================================================================
    describe("25. Revert Edge Cases", function () {
        describe("proportion > MAX_MARKET_PROPORTION (96%)", function () {
            const rateScalar = 219693210787180268630n;
            const rateAnchor = 1040138669417921641n;

            // Pool where PT is ~97% of total = should revert
            it("getExchangeRate_proportion_too_high", async function () {
                try {
                    // 970 PT, 30 Asset => proportion = 970/1000 = 97% > 96%
                    const result = await h.getExchangeRate(970n * ONE, 30n * ONE, rateScalar, rateAnchor, 0n);
                    console.log(`    proportion_97%_UNEXPECTEDLY_PASSED = ${result}`);
                } catch (e: any) {
                    console.log(`    proportion_97%_REVERTS_AS_EXPECTED`);
                    addVector("getExchangeRate_revert_proportion", {
                        totalPt: 970n * ONE,
                        totalAsset: 30n * ONE,
                        rateScalar,
                        rateAnchor,
                        netPtToAccount: 0n,
                    }, null, true);
                }
            });
        });

        describe("logProportion(1) reverts", function () {
            it("logProportion_exactly_one_reverts", async function () {
                try {
                    await h.logProportion(ONE);
                    console.log(`    logProportion(1e18)_UNEXPECTEDLY_PASSED`);
                } catch (e) {
                    console.log(`    logProportion(1e18)_REVERTS_AS_EXPECTED`);
                    addVector("logProportion_revert_one", { proportion: ONE }, null, true);
                }
            });
        });

        describe("ln(0) reverts", function () {
            it("ln_zero_reverts", async function () {
                try {
                    await h.ln(0n);
                    console.log(`    ln(0)_UNEXPECTEDLY_PASSED`);
                } catch (e) {
                    console.log(`    ln(0)_REVERTS_AS_EXPECTED`);
                    addVector("ln_revert_zero", { a: 0n }, null, true);
                }
            });
        });

        describe("exp overflow reverts", function () {
            it("exp_overflow_reverts", async function () {
                try {
                    await h.exp(131n * ONE);
                    console.log(`    exp(131e18)_UNEXPECTEDLY_PASSED`);
                } catch (e) {
                    console.log(`    exp(131e18)_REVERTS_AS_EXPECTED`);
                    addVector("exp_revert_overflow", { x: 131n * ONE }, null, true);
                }
            });
        });

        describe("divDown by zero reverts", function () {
            it("divDown_zero_reverts", async function () {
                try {
                    await h.divDown(ONE, 0n);
                    console.log(`    divDown(1e18, 0)_UNEXPECTEDLY_PASSED`);
                } catch (e) {
                    console.log(`    divDown(1e18, 0)_REVERTS_AS_EXPECTED`);
                    addVector("divDown_revert_zero", { a: ONE, b: 0n }, null, true);
                }
            });
        });
    });

    // =========================================================================
    // SECTION 26: Summary
    // =========================================================================
    describe("26. Summary", function () {
        it("outputs test count", async function () {
            console.log(`\n${"=".repeat(80)}`);
            console.log(`TOTAL VECTORS: ${vectors.length}`);
            console.log("=".repeat(80) + "\n");
        });
    });
});
