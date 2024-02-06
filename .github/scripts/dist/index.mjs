var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined")
    return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/index.ts
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import * as glob from "@actions/glob";
import * as io from "@actions/io";
var __original_require__ = __require;
var globals = {
  require: __require,
  __original_require__,
  github,
  core,
  exec,
  glob,
  io,
  fetch
};
Object.assign(global, globals);
(async () => {
  console.log("Hello world");
  core.setOutput("time", (/* @__PURE__ */ new Date()).toTimeString());
})();
