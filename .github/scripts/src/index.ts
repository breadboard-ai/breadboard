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

module.exports = async () => {
  const workspace = process.cwd();
  console.log({ cwd: workspace });

  const packageDir = path.resolve(workspace, "packages");
  const packages = [
    "breadboard",
    "breadboard-cli",
    "create-breadboard",
    "create-breadboard-kit",
  ] as const;

  const depTypes = ["dependencies", "devDependencies", "peerDependencies"] as const;

  const fromScope = "@google-labs";
  const toScope = `@${github.context.repo.owner.toLowerCase()}`;
  console.log({ fromScope, toScope });

  await exec.exec("npm", ["install"], { cwd: workspace });

  for (const pkg of packages) {
    const packagePath = path.resolve(packageDir, pkg, "package.json");
    console.log({ package: packagePath });
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    const packageName = packageJson.name;
    console.log({ name: packageName });
  }
};
