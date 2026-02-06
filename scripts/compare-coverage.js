/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* global process, console */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const [prPath, basePath] = process.argv.slice(2);

/**
 * Validates that a value is a number (not NaN, not Infinity).
 * @param {unknown} value
 * @returns {value is number}
 */
function isValidNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Validates the coverage metric object has the expected shape.
 * @param {unknown} metric
 * @returns {metric is { pct: number }}
 */
function isValidMetric(metric) {
  return (
    typeof metric === "object" &&
    metric !== null &&
    "pct" in metric &&
    isValidNumber(metric.pct)
  );
}

/**
 * Validates the coverage JSON has the expected structure.
 * Expected shape:
 * {
 *   total: {
 *     lines: { pct: number },
 *     functions: { pct: number },
 *     branches: { pct: number }
 *   }
 * }
 * @param {unknown} json
 * @returns {{ valid: true, data: { lines: number, functions: number, branches: number } } | { valid: false, error: string }}
 */
function validateCoverageJson(json) {
  if (typeof json !== "object" || json === null) {
    return { valid: false, error: "JSON is not an object" };
  }

  if (!("total" in json)) {
    return { valid: false, error: "Missing 'total' property" };
  }

  const { total } = json;
  if (typeof total !== "object" || total === null) {
    return { valid: false, error: "'total' is not an object" };
  }

  if (!("lines" in total)) {
    return { valid: false, error: "Missing 'total.lines' property" };
  }
  if (!isValidMetric(total.lines)) {
    return {
      valid: false,
      error: "'total.lines.pct' is missing or not a valid number",
    };
  }

  if (!("functions" in total)) {
    return { valid: false, error: "Missing 'total.functions' property" };
  }
  if (!isValidMetric(total.functions)) {
    return {
      valid: false,
      error: "'total.functions.pct' is missing or not a valid number",
    };
  }

  if (!("branches" in total)) {
    return { valid: false, error: "Missing 'total.branches' property" };
  }
  if (!isValidMetric(total.branches)) {
    return {
      valid: false,
      error: "'total.branches.pct' is missing or not a valid number",
    };
  }

  return {
    valid: true,
    data: {
      lines: total.lines.pct,
      functions: total.functions.pct,
      branches: total.branches.pct,
    },
  };
}

/**
 * Reads and validates a coverage JSON file.
 * @param {string} path
 * @returns {{ lines: number, functions: number, branches: number } | null}
 */
function readCoverage(path) {
  if (!existsSync(path)) {
    console.warn(`⚠️ Coverage file not found: ${path}`);
    return null;
  }

  let fileContent;
  try {
    fileContent = readFileSync(path, "utf8");
  } catch (error) {
    console.warn(`⚠️ Error reading file ${path}:`, error.message);
    return null;
  }

  let json;
  try {
    json = JSON.parse(fileContent);
  } catch (error) {
    console.warn(`⚠️ Invalid JSON in ${path}:`, error.message);
    return null;
  }

  const result = validateCoverageJson(json);
  if (!result.valid) {
    console.warn(`⚠️ Invalid coverage format in ${path}: ${result.error}`);
    return null;
  }

  return result.data;
}

function formatDelta(pr, base) {
  const delta = pr - base;
  const sign = delta >= 0 ? "+" : "";
  const icon = delta > 0 ? "🟢" : delta < 0 ? "🔴" : "⚪";
  return `${icon} ${sign}${delta.toFixed(2)}%`;
}

function formatRow(metric, pr, base) {
  if (base === null) {
    return `| ${metric} | ${pr.toFixed(2)}% | — | — |`;
  }
  return `| ${metric} | ${pr.toFixed(2)}% | ${base.toFixed(2)}% | ${formatDelta(pr, base)} |`;
}

// Validate arguments
if (!prPath) {
  console.error(
    "Usage: compare-coverage.js <pr-coverage.json> <base-coverage.json>"
  );
  process.exit(1);
}

const prCoverage = readCoverage(prPath);
const baseCoverage = readCoverage(basePath);

if (!prCoverage) {
  console.error("❌ Could not read PR coverage data");
  process.exit(1);
}

let comment = `## 📊 Coverage Report\n\n`;

if (!baseCoverage) {
  comment += `> [!NOTE]\n`;
  comment += `> Baseline coverage not available. Showing PR coverage only.\n\n`;
}

comment += `| Metric | PR | Main | Delta |\n`;
comment += `|--------|---:|-----:|-------|\n`;
comment += `${formatRow("Lines", prCoverage.lines, baseCoverage?.lines ?? null)}\n`;
comment += `${formatRow("Functions", prCoverage.functions, baseCoverage?.functions ?? null)}\n`;
comment += `${formatRow("Branches", prCoverage.branches, baseCoverage?.branches ?? null)}\n`;

writeFileSync("coverage-comment.md", comment);
console.log("✅ Coverage comment written to coverage-comment.md");
