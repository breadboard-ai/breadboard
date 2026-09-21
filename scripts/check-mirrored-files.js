/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* global console, process */

/**
 * Reports whether a change touches any file that is mirrored into the
 * downstream internal repository. The list of mirrored files, and the rules
 * that apply to them, live in .github/mirrored-files.txt.
 *
 * Usage:
 *   node scripts/check-mirrored-files.js [--base=<ref>] [--head=<ref>]
 *                                        [--exit-code] [--github]
 *
 * Options:
 *   --base=<ref>   Compare against this ref. Defaults to the PR base in CI,
 *                  then the tracking branch, then origin/opal-eol / origin/main.
 *   --head=<ref>   Defaults to HEAD.
 *   --exit-code    Exit 1 when mirrored files changed (default: always exit 0).
 *   --github       Emit GitHub Actions annotations, step summary, and the
 *                  `mirrored` step output.
 *
 * Uncommitted (staged and unstaged) changes are included unless running in CI.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export { listMirroredFiles, main };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, ".github", "mirrored-files.txt");

function git(args, { allowFailure = false } = {}) {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (allowFailure) return null;
    throw error;
  }
}

function listMirroredFiles() {
  return readFileSync(MANIFEST, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function resolveBase(explicit) {
  const candidates = [
    explicit,
    process.env.GITHUB_BASE_REF && `origin/${process.env.GITHUB_BASE_REF}`,
    "@{upstream}",
    "origin/opal-eol",
    "origin/main",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (
      git(["rev-parse", "--verify", "--quiet", `${candidate}^{commit}`], {
        allowFailure: true,
      })
    ) {
      return candidate;
    }
  }
  return null;
}

function changedPaths(base, head, includeWorkingTree) {
  const paths = new Set();
  const add = (output) => {
    for (const line of (output ?? "").split("\n")) {
      if (line.trim()) paths.add(line.trim());
    }
  };
  if (base) {
    add(
      git(["diff", "--name-only", `${base}...${head}`], {
        allowFailure: true,
      })
    );
  }
  if (includeWorkingTree) {
    add(git(["diff", "--name-only", "HEAD"], { allowFailure: true }));
    add(git(["diff", "--name-only", "--cached"], { allowFailure: true }));
    add(
      git(["ls-files", "--others", "--exclude-standard"], {
        allowFailure: true,
      })
    );
  }
  return paths;
}

function banner(touched) {
  const lines = [
    "",
    "  ============================================================",
    "   ⚠️  DOWNSTREAM MIRROR SYNC REQUIRED",
    "  ============================================================",
    "",
    "   This change touches files that are mirrored into a downstream",
    "   internal repository.",
    "",
    ...touched.map((file) => `     • ${file}`),
    "",
    "   1. Land the change on the `opal-eol` branch.",
    "   2. Put ACK_SYNC_REQUIRED in the PR description — CI fails",
    "      without it.",
    "   3. Ask a maintainer with downstream access to run the import.",
    "   4. Call out any added/removed files or new imports and",
    "      dependencies — those need hand edits downstream.",
    "",
    "   See .github/mirrored-files.txt for the full rules.",
    "  ============================================================",
    "",
  ];
  return lines.join("\n");
}

function main(argv) {
  const args = argv.slice(2);
  const flag = (name) => args.includes(`--${name}`);
  const option = (name) =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];

  const mirrored = listMirroredFiles();
  const stale = mirrored.filter((file) => !existsSync(path.join(ROOT, file)));
  if (stale.length > 0) {
    console.error(
      `\n  ⚠️  Stale entries in .github/mirrored-files.txt (file not found):\n` +
        stale.map((file) => `     • ${file}`).join("\n") +
        `\n  Removing or renaming a mirrored file also requires a downstream` +
        ` config change.\n`
    );
  }

  const head = option("head") ?? "HEAD";
  const base = resolveBase(option("base"));
  const touched = [...changedPaths(base, head, !process.env.CI)]
    .filter((file) => mirrored.includes(file))
    .sort();

  if (flag("github")) {
    reportToGitHub(touched, base);
  }

  if (touched.length === 0) {
    if (!flag("github")) {
      console.log(`No mirrored files changed (base: ${base ?? "unknown"}).`);
    }
    return 0;
  }

  console.error(banner(touched));
  return flag("exit-code") ? 1 : 0;
}

function reportToGitHub(touched, base) {
  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    appendFileSync(output, `mirrored=${touched.length > 0}\n`);
  }
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (!summary) return;
  if (touched.length === 0) {
    appendFileSync(
      summary,
      `### Downstream mirror\n\nNo mirrored files changed (base: \`${base ?? "unknown"}\`).\n`
    );
    return;
  }
  appendFileSync(
    summary,
    [
      `### ⚠️ Downstream mirror sync required`,
      ``,
      `This PR changes files that are mirrored into a downstream internal`,
      `repository. Until the mirror is synced, the downstream build keeps`,
      `compiling against the old version of these files.`,
      ``,
      ...touched.map((file) => `- \`${file}\``),
      ``,
      `Add \`ACK_SYNC_REQUIRED\` to the PR description to acknowledge, then flag`,
      `the PR to a maintainer who can run the import.`,
      ``,
      `See \`.github/mirrored-files.txt\` for the full rules.`,
      ``,
    ].join("\n")
  );
  for (const file of touched) {
    console.log(
      `::warning file=${file},title=Downstream mirror sync required::` +
        `${file} is mirrored downstream; this change needs a mirror sync.`
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv));
}
