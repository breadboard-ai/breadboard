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

module.exports = () => {
  const cwd = process.cwd();
  console.log({ cwd });
  // list directories
  console.log({ files: fs.readdirSync(cwd).map((f) => path.resolve(cwd, f)) });

  const packageDir = path.resolve(cwd, "packages");
  console.log({ packages: fs.readdirSync(packageDir).map((f) => path.resolve(packageDir, f)) });

  const packages = [
    "breadoard",
    "breadboard-cli",
    "create-breadboard",
    "create-breadboard-kit",
  ];

  for (const pkg of packages) {
    const packagePath = path.resolve(packageDir, pkg, "package.json");
    console.log({ package: packagePath });
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    const packageName = packageJson.name;
    console.log({ name: packageName });


  }

};
