/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* globals console, process */

/**
 * Standalone esbuild bundler — reads input.json, outputs bundle.cjs.
 *
 * Designed to run inside the sandbox. Reads a JSON file with
 * {files, assets} and produces a CJS bundle from App.jsx.
 *
 * Usage: node bundler.mjs
 *
 * Expects input.json in the current directory. Writes bundle.cjs
 * to the current directory on success.
 */

import { build } from "esbuild";
import { readFileSync, writeFileSync } from "fs";

const input = JSON.parse(readFileSync("input.json", "utf-8"));
const { files, assets } = input;

if (!files["App.jsx"]) {
  console.error("No App.jsx found in bundle files");
  process.exit(1);
}

/** Auto-export: if no explicit export, detect component and add one. */
function autoExport(source) {
  if (source.includes("export default") || source.includes("module.exports")) {
    return source;
  }
  const match =
    source.match(/^function\s+([A-Z]\w*)/m) ??
    source.match(/^const\s+([A-Z]\w*)\s*=/m);
  if (match) {
    return source + `\nexport default ${match[1]};\n`;
  }
  return source;
}

/** Find a file key trying with given extensions. */
function findKey(path, exts) {
  if (files[path]) return path;
  for (const ext of exts) {
    const k = path + ext;
    if (files[k]) return k;
  }
  return undefined;
}

/** Resolve an asset URL from the assets map. */
function resolveAsset(path) {
  const assetMap = assets || {};
  if (assetMap[path]) return assetMap[path];
  const base = path.split("/").pop();
  for (const [k, url] of Object.entries(assetMap)) {
    if (k.endsWith(`/${base}`) || k === base) return url;
  }
  return undefined;
}

/** Virtual modules plugin for esbuild. */
const virtualModules = {
  name: "virtual-modules",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => {
      // React → external.
      if (args.path === "react" || args.path.startsWith("react/"))
        return { path: args.path, external: true };

      // Resolve relative paths.
      let norm = args.path;
      if ((norm.startsWith("./") || norm.startsWith("../")) && args.importer) {
        const dir = args.importer.includes("/")
          ? args.importer.substring(0, args.importer.lastIndexOf("/") + 1)
          : "";
        const parts = (dir + norm).split("/");
        const resolved = [];
        for (const p of parts) {
          if (p === "..") resolved.pop();
          else if (p !== ".") resolved.push(p);
        }
        norm = resolved.join("/");
      } else {
        norm = norm.replace(/^\.\//, "");
      }

      // CSS?
      const css = findKey(norm, [".css"]) ?? findKey(norm + ".css", []);
      if (css) return { path: css, namespace: "css" };

      // Asset?
      if (resolveAsset(norm) !== undefined)
        return { path: norm, namespace: "asset" };

      // JSX?
      const jsx =
        findKey(norm, [".jsx", ".js"]) ??
        findKey(norm + ".jsx", []) ??
        findKey(norm + ".js", []);
      if (jsx) return { path: jsx, namespace: "jsx" };

      return undefined;
    });

    b.onLoad({ filter: /.*/, namespace: "jsx" }, (args) => ({
      contents: autoExport(files[args.path] ?? ""),
      loader: "jsx",
    }));

    b.onLoad({ filter: /.*/, namespace: "css" }, (args) => ({
      contents: [
        `const s = document.createElement("style");`,
        `s.textContent = ${JSON.stringify(files[args.path])};`,
        `document.head.appendChild(s);`,
      ].join("\n"),
      loader: "js",
    }));

    b.onLoad({ filter: /.*/, namespace: "asset" }, (args) => ({
      contents: `module.exports = ${JSON.stringify(resolveAsset(args.path))};`,
      loader: "js",
    }));
  },
};

// Bundle.
try {
  const result = await build({
    stdin: {
      contents: autoExport(files["App.jsx"]),
      loader: "jsx",
      resolveDir: "/",
    },
    bundle: true,
    write: false,
    format: "cjs",
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    plugins: [virtualModules],
  });

  const output = result.outputFiles?.[0];
  if (!output) {
    console.error("esbuild produced no output");
    process.exit(1);
  }

  writeFileSync("bundle.cjs", output.text);
} catch (err) {
  console.error(err.message ?? err);
  process.exit(1);
}
