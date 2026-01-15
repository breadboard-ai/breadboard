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

    return `Lines: ${total.lines.pct}% | Funcs: ${total.functions.pct}% | Branches: ${total.branches.pct}%`;
  } catch (error) {
    console.warn(`⚠️ Could not read coverage summary from ${SUMMARY_PATH}`);
    console.warn(error.message);
    return null;
  }
}

async function publishStatus(description) {
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, COMMIT_SHA } =
    globalThis.process.env;

  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !COMMIT_SHA) {
    console.error(
      "❌ Missing required environment variables (GITHUB_TOKEN, GITHUB_REPOSITORY, COMMIT_SHA)."
    );
    globalThis.process.exit(1);
  }

  const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/statuses/${COMMIT_SHA}`;

  const body = {
    // Always 'success' to act as an informational badge
    state: "success",
    description: description,
    context: "code-coverage",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error(
      `❌ Failed to update status: ${response.status} ${response.statusText}`
    );
    const err = await response.text();
    console.error(err);
    globalThis.process.exit(1);
  }

  console.log(`✅ Published coverage status: "${description}"`);
}

const stats = getCoverageStats();
if (stats) {
  publishStatus(stats);
} else {
  console.log("Skipping status update due to missing coverage data.");
}
