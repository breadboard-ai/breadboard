import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import * as glob from "@actions/glob";
import * as io from "@actions/io";
import * as fs from "fs";
import path from "path";
const __original_require__ = require;

const globals = {
  require,
  __original_require__,
  github,
  core,
  exec,
  glob,
  io,
  fetch,
};

Object.assign(global, globals);

function spacer({
  char = '=',
  count = 80
}: { char?: string; count?: number; } = {}) {
  console.log(char.repeat(count));
}

const depTypes = ["dependencies", "devDependencies", "peerDependencies"] as const;
const fromScope = "@google-labs";
const packages = [
  "breadboard",
  "breadboard-cli",
  "create-breadboard",
  "create-breadboard-kit",
] as const;

const packagesWithScope = packages.map((pkg) => `${fromScope}/${pkg}`);
const registry = "https://npm.pkg.github.com";

const workspace = process.cwd();
console.log({ workspace });

const runId = github.context.runId;
const runNumber = github.context.runNumber;

function getVersion() {
  // version as YYYY.MM.DD-HH.MM.SS
  const now = new Date();
  // return `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}-${now.getHours()}.${now.getMinutes()}.${now.getSeconds()}`;
  return `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}-${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
}

async function main() {
  console.log({ cwd: workspace });
  const packageDir = path.resolve(workspace, "packages");
  const toScope = `@${github.context.repo.owner.toLowerCase()}`;
  console.log({ fromScope, toScope });

  await npmInstall();
  await npmBuild();

  const scopedRegistryArg = `--@${toScope}:registry=${registry}`;
  const packagePaths = packages.map((pkg) => path.resolve(packageDir, pkg, "package.json"));
  const initialVersion = getVersion();
  spacer();
  console.log(`Initial version: ${initialVersion}`);
  for (const packagePath of packagePaths) {
    console.log(`Handling first publish of ${packagePath} v${initialVersion}`);
    renamePackage(packagePath, fromScope, toScope);
    setVersion(packagePath, initialVersion);
    await npmInstall();
    await npmBuild(packagePath);
    await publishPackage(packagePath, registry, [scopedRegistryArg]);
    spacer({ count: 40 });
  }
  spacer();
  console.log("Proceeding with second stage publishing");
  const secondaryVersion = getVersion();
  for (const packagePath of packagePaths) {
    console.log(`Publishing secondary version of ${packagePath} v${secondaryVersion}`);
    setVersion(packagePath, secondaryVersion);
    await aliasDependencies(packagePath, packagesWithScope, fromScope, toScope);
    await npmInstall();
    await npmBuild(packagePath);
    await publishPackage(packagePath, registry, [scopedRegistryArg]);
    spacer({ count: 40 });
  }

  spacer();
  console.log(`Unpublishing initial versions`);
  for (const packagePath of packagePaths) {
    console.log(`Unpublishing ${packagePath}`);
    renamePackage(packagePath, fromScope, toScope);
    setVersion(packagePath, initialVersion);
    await npmBuild(packagePath);
    await publishPackage(packagePath, registry, [scopedRegistryArg]);
    spacer({ count: 40 });
  }
}

type Package = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

async function npmBuild(cwd = workspace) {
  await execWrapper("npm", ["run", "build"], cwd);
}

async function execWrapper(command: string, args: string[], cwd: string) {
  console.log(`${cwd} $ ${command} ${args.join(" ")}`);
  const listeners = {
    stdout: (data: Buffer) => {
      console.log(data.toString());
    },
    stderr: (data: Buffer) => {
      console.error(data.toString());
    }
  };
  await exec.exec(command, args, { cwd, listeners });
}

async function npmInstall(cwd = workspace) {
  await execWrapper("npm", ["install"], cwd);
}

async function aliasDependencies(packagePath: string, packagesToRescope: string[], fromScope: string, toScope: string, dependencyVersion = "*") {
  spacer({ count: 40 });
  console.log(`Renaming dependencies in ${packagePath}`)
  const packageJson: Package = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  for (const depType of depTypes) {
    const deps = packageJson[depType];
    if (deps) {
      for (const [dep, version] of Object.entries(deps)) {
        for (const pkg of packagesToRescope) {
          if (dep === pkg) {
            const newVersion = `npm:${dep.replace(fromScope, toScope)}@${dependencyVersion}`;
            console.log(`${depType}.${dep}: "${newVersion}"`);
            deps[dep] = newVersion;
            spacer({ count: 10 });
          }
        }
      }
    }
    packageJson[depType] = deps;
  }
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  return packageJson;
}

function renamePackage(packagePath: string, fromScope: string, toScope: string) {
  const packageJson: Package = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const currentName = packageJson.name;
  const newName = currentName?.replace(fromScope, toScope);

  console.log(`name`, ` ${currentName} -> ${newName}`);
  packageJson.name = newName;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  return packageJson;
}

async function publishPackage(cwd: string, registry: string, flags: string[] = []) {
  console.log(`Publishing`, { cwd, registry, flags });
  const packageDir = path.dirname(cwd);
  console.log({ packageDir });
  await exec.exec("npm", ["pkg", "set", `registry=${registry}`], { cwd });
  await exec.exec("npm", ["publish", ...flags], { cwd });
}

function setVersion(packagePath: string, version: string) {
  console.log(`Setting version of ${packagePath} to ${version}`);
  const packageJson: Package = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  packageJson.version = version;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  return packageJson;
}

module.exports = main;
