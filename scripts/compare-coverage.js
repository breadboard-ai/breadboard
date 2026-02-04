/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* global process, console */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const [prPath, basePath] = process.argv.slice(2);

function readCoverage(path) {
  if (!existsSync(path)) {
    console.warn(`⚠️ Coverage file not found: ${path}`);
    return null;
  }

  try {
    const json = JSON.parse(readFileSync(path, "utf8"));
    if (!json.total) {
      console.warn(`⚠️ Invalid coverage format in: ${path}`);
      return null;
    }
    return {
      lines: json.total.lines?.pct ?? 0,
      functions: json.total.functions?.pct ?? 0,
      branches: json.total.branches?.pct ?? 0,
    };
  } catch (error) {
    console.warn(`⚠️ Error reading coverage file ${path}:`, error.message);
    return null;
  }
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
