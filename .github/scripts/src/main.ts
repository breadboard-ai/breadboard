import * as github from "@actions/github";
import path from "path";
import { aliasDependencies } from "src/aliasDependencies";
import { generationVersion } from "src/generationVersion";
import { npmBuild } from "src/npmBuild";
import { npmInstall } from "src/npmInstall";
import { publishPackage } from "src/publishPackage";
import { renamePackage } from "src/renamePackage";
import { setVersion } from "src/setVersion";
import { clean } from "./clean";

export function spacer({
  char = "=",
  count = 80,
}: { char?: string; count?: number } = {}) {
  console.log(char.repeat(count));
}

export const depTypes = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
] as const;

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

export async function main() {
  console.log({ workspace });
  console.log({ cwd: workspace });
  const packageDir = path.resolve(workspace, "packages");
  const toScope = `@${github.context.repo.owner.toLowerCase()}`;
  console.log({ fromScope, toScope });

  await npmInstall();

  const scopedRegistryArg = `--@${toScope}:registry=${registry}`;
  const packagePaths = packages.map((pkg) =>
    path.resolve(packageDir, pkg, "package.json")
  );
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

  await clean();

  await npmInstall(workspace);

  for (const packagePath of packagePaths) {
    console.log(
      `Publishing ephemeral version of ${packagePath} v${newVersion}`
    );
    await npmBuild(packagePath);
    await publishPackage(packagePath, registry, [scopedRegistryArg]);
    spacer({ count: 40 });
  }
}

