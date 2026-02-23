/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Codemod runner.
 *
 * Usage:
 *   npx tsx codemods/run.ts <transform-name> [--apply]
 *
 * Without --apply, runs in dry-run mode (reports changes without writing).
 */

import { Project } from "ts-morph";
import { resolve, join, basename } from "path";
import { readdirSync } from "fs";

const REPO_ROOT = resolve(import.meta.dirname, "..");

interface Transform {
  description: string;
  include: string[];
  transform: (file: import("ts-morph").SourceFile) => boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const transformName = args.find((a) => !a.startsWith("--"));

  if (!transformName) {
    console.log("Usage: npx tsx codemods/run.ts <transform-name> [--apply]");
    console.log("\nAvailable transforms:");
    const dir = join(import.meta.dirname, "transforms");
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
      console.log(`  ${basename(f, ".ts")}`);
    }
    process.exit(1);
  }

  const transformPath = join(
    import.meta.dirname,
    "transforms",
    `${transformName}.ts`
  );
  const mod: Transform = await import(transformPath);

  console.log(`\n🔧 ${mod.description}`);
  console.log(`   Mode: ${apply ? "APPLY" : "DRY RUN"}\n`);

  const project = new Project({
    tsConfigFilePath: join(REPO_ROOT, "packages/visual-editor/tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  // Add files matching the include globs
  for (const pattern of mod.include) {
    project.addSourceFilesAtPaths(join(REPO_ROOT, pattern));
  }

  const files = project.getSourceFiles();
  console.log(`   Found ${files.length} files to scan.\n`);

  let totalChanges = 0;

  for (const file of files) {
    const changed = mod.transform(file);
    if (changed) {
      totalChanges++;
      if (apply) {
        console.log(`   ✏️  ${file.getFilePath().replace(REPO_ROOT, ".")}`);
      }
    }
  }

  if (apply && totalChanges > 0) {
    await project.save();
    console.log(`\n   ✅ Saved ${totalChanges} file(s).`);
  } else if (totalChanges === 0) {
    console.log("   ✅ No changes needed.");
  } else {
    console.log(`\n   📋 ${totalChanges} file(s) would be modified.`);
    console.log("   Run with --apply to write changes.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
