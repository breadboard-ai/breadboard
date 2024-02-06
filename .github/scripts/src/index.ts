import * as github from "@actions/github";
import path from "path";
import { aliasDependencies } from "./aliasDependencies";
import { generationVersion } from "./generationVersion";
import { npmBuild } from "./npmBuild";
import { npmInstall } from "./npmInstall";
import { publishPackage } from "./publishPackage";
import { renamePackage } from "./renamePackage";
import { setVersion } from "./setVersion";

export function spacer({
  char = '=',
  count = 80
}: { char?: string; count?: number; } = {}) {
  console.log(char.repeat(count));
}

export const depTypes = ["dependencies", "devDependencies", "peerDependencies"] as const;
const fromScope = "@google-labs";
const packages = [
  "breadboard",
  "breadboard-cli",
  "create-breadboard",
  "create-breadboard-kit",
] as const;

const packagesWithScope = packages.map((pkg) => `${fromScope}/${pkg}`);
const registry = "https://npm.pkg.github.com";

export const workspace = process.cwd();
console.log({ workspace });

/**
 * A unique number for each run of a particular workflow in a repository. This number begins at 1 for the workflow's first run, and increments with each new run. This number does not change if you re-run the workflow run.
 */
export const runNumber: number = github.context.runNumber;
/**
 * A unique number for each workflow run within a repository. This number does not change if you re-run the workflow run.
 */
export const runId: number = github.context.runId;

async function main() {
  console.log({ cwd: workspace });
  const packageDir = path.resolve(workspace, "packages");
  const toScope = `@${github.context.repo.owner.toLowerCase()}`;
  console.log({ fromScope, toScope });

  const scopedRegistryArg = `--@${toScope}:registry=${registry}`;
  const packagePaths = packages.map((pkg) => path.resolve(packageDir, pkg, "package.json"));
  const newVersion = generationVersion();
  spacer();
  console.log(`Initial version: ${newVersion}`);
  for (const packagePath of packagePaths) {
    console.log(`Renaming package ${packagePath}`);
    renamePackage(packagePath, fromScope, toScope);
    setVersion(packagePath, newVersion);
    await aliasDependencies(packagePath, packagesWithScope, fromScope, toScope);
    spacer({ count: 40 });
  }

  await npmInstall();

  for (const packagePath of packagePaths) {
    console.log(`Publishing ephemeral version of ${packagePath} v${newVersion}`);
    await npmBuild(packagePath);
    await publishPackage(packagePath, registry, [scopedRegistryArg]);
    spacer({ count: 40 });
  }
}

export type Package = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  publishConfig?: {
    registry?: string;
  };
};

module.exports = main;
