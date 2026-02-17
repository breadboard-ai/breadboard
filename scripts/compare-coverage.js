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
 * Extracts per-file coverage data from the full JSON.
 * Returns a Map of relative file path → lines.pct.
 * Skips the "total" key.
 * @param {Record<string, unknown>} json
 * @returns {Map<string, number>}
 */
function extractPerFileLineCoverage(json) {
  const result = new Map();
  for (const [key, value] of Object.entries(json)) {
    if (key === "total") continue;
    if (
      typeof value === "object" &&
      value !== null &&
      "lines" in value &&
      isValidMetric(value.lines)
    ) {
      // Shorten absolute paths to relative paths from src/
      const srcIndex = key.indexOf("/src/");
      const shortPath = srcIndex !== -1 ? key.slice(srcIndex + 1) : key;
      result.set(shortPath, value.lines.pct);
    }
  }
  return result;
}

/**
 * Finds files where line coverage degraded between baseline and PR.
 * @param {Map<string, number>} prFiles
 * @param {Map<string, number>} baseFiles
 * @returns {{ file: string, prPct: number, basePct: number, delta: number }[]}
 */
function findDegradedFiles(prFiles, baseFiles) {
  const degraded = [];
  for (const [file, prPct] of prFiles) {
    const basePct = baseFiles.get(file);
    if (basePct !== undefined && prPct < basePct) {
      degraded.push({ file, prPct, basePct, delta: prPct - basePct });
    }
  }
  // Sort by largest drop first.
  degraded.sort((a, b) => a.delta - b.delta);
  return degraded;
}

/**
 * Generates a collapsible markdown section for degraded files.
 * @param {{ file: string, prPct: number, basePct: number, delta: number }[]} degraded
 * @returns {string}
 */
function formatDegradedFiles(degraded) {
  if (degraded.length === 0) return "";

  const capped = degraded.slice(0, 10);
  const hasMore = degraded.length > 10;

  let md = `\n<details>\n`;
  md += `<summary>🔴 ${degraded.length} file${degraded.length === 1 ? "" : "s"} with reduced line coverage</summary>\n\n`;
  md += `| File | PR | Main | Delta |\n`;
  md += `|------|---:|-----:|-------|\n`;
  for (const { file, prPct, basePct, delta } of capped) {
    const basename = file.split("/").pop();
    md += `| \`${basename}\` | ${prPct.toFixed(2)}% | ${basePct.toFixed(2)}% | 🔴 ${delta.toFixed(2)}% |\n`;
  }
  if (hasMore) {
    md += `\n_…and ${degraded.length - 10} more._\n`;
  }
  md += `\n</details>\n`;
  return md;
}

/**
 * Reads and parses a coverage JSON file.
 * Returns { totals, json } where totals is the validated total metrics
 * and json is the full parsed object (for per-file comparison).
 * @param {string} path
 * @returns {{ totals: { lines: number, functions: number, branches: number }, json: Record<string, unknown> } | null}
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

  return { totals: result.data, json };
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

const prResult = readCoverage(prPath);
const baseResult = readCoverage(basePath);

if (!prResult) {
  console.error("❌ Could not read PR coverage data");
  process.exit(1);
}

const prCoverage = prResult.totals;
const baseCoverage = baseResult?.totals ?? null;

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

// Append per-file degradation details when both datasets are available.
if (baseResult) {
  const prFiles = extractPerFileLineCoverage(prResult.json);
  const baseFiles = extractPerFileLineCoverage(baseResult.json);
  const degraded = findDegradedFiles(prFiles, baseFiles);
  comment += formatDegradedFiles(degraded);
}

// Celebrate when overall line coverage increases.
if (baseCoverage && prCoverage.lines > baseCoverage.lines) {
  const celebrations = [
    "🎉 Coverage is up!",
    "🚀 Lines covered went up with this change.",
    "💪 Net positive on coverage.",
    "⭐ Test coverage improved.",
    "🏆 Coverage going in the right direction.",
    "🌟 More lines covered than before.",
    "🎯 Coverage is trending up.",
    "✨ More coverage, fewer surprises.",
  ];
  const message = celebrations[Math.floor(Math.random() * celebrations.length)];
  comment += `\n${message}\n`;
}

writeFileSync("coverage-comment.md", comment);
console.log("✅ Coverage comment written to coverage-comment.md");
