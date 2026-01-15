/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "url";

function getCoverageStats() {
  const SUMMARY_PATH = [
    "..",
    "packages",
    "visual-editor",
    "coverage",
    "coverage-summary.json",
  ];

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const json = readFileSync(path.join(__dirname, ...SUMMARY_PATH), "utf8");
    const { total } = JSON.parse(json);

    return {
      statsString: `Lines: ${total.lines.pct}% | Funcs: ${total.functions.pct}% | Branches: ${total.branches.pct}%`,
      fullDetails: `
### 🧪 Coverage Report
| Category | Percentage |
| :--- | :--- |
| **Lines** | ${total.lines.pct}% |
| **Functions** | ${total.functions.pct}% |
| **Branches** | ${total.branches.pct}% |
`,
    };
  } catch (error) {
    console.warn(`⚠️ Could not read coverage summary from ${SUMMARY_PATH}`);
    console.warn(error.message);
    return null;
  }
}

async function publishCheck() {
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, COMMIT_SHA } =
    globalThis.process.env;
  const data = getCoverageStats();

  if (!data || !GITHUB_TOKEN) return;

  const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/check-runs`;
  const body = {
    name: "code-coverage",
    head_sha: COMMIT_SHA,
    status: "completed",
    conclusion: "neutral",
    output: {
      title: data.statsString,
      summary: data.fullDetails,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error(`❌ Error: ${response.status} ${response.statusText}`);
    const err = await response.text();
    console.error(err);
    globalThis.process.exit(1);
  } else {
    console.log("✅ Published Code Coverage Check Row");
  }
}

publishCheck();
