import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import * as glob from "@actions/glob";
import * as io from "@actions/io";
import * as fs from "fs";
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
  console.log("Hello world");
  fs.readdirSync(".").forEach((file) => {
    console.log(file);
  });
};
