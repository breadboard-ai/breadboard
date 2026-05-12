/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Standalone JSX bundler for the ui-generator skill.
 *
 * Reads JSX/CSS files from the current working directory, bundles them
 * into a single CJS output (with React as external), and writes
 * `bundle.js` + `bundle.css` to the same directory.
 *
 * Usage (via execute_bash):
 *   node skills/ui-generator/tools/bundler.mjs
 *
 * Entry point: App.jsx in the current directory.
 * React is provided by the iframe runtime — not bundled here.
 */

/* global process, console */

import { build } from "esbuild";
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname, relative } from "path";

const cwd = process.cwd();

// ── Collect files from disk ──────────────────────────────────────────────

/** Recursively collect files into a flat map: relative-path → content. */
function collectFiles(dir, base = dir) {
  const result = {};
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(base, full);
    if (statSync(full).isDirectory()) {
      // Skip node_modules, hidden dirs, and output files.
      if (entry.startsWith(".") || entry === "node_modules") continue;
      Object.assign(result, collectFiles(full, base));
    } else {
      const ext = extname(entry);
      if ([".jsx", ".js", ".css"].includes(ext)) {
        result[rel] = readFileSync(full, "utf-8");
      }
    }
  }
  return result;
}

const files = collectFiles(cwd);

const entryFile = files["App.jsx"] ? "App.jsx" : files["app.jsx"] ? "app.jsx" : null;

if (!entryFile) {
  console.error("Error: No App.jsx or app.jsx found in", cwd);
  process.exit(1);
}

// ── Auto-export ──────────────────────────────────────────────────────────

/**
 * If a JSX source has no explicit export, detect the component name
 * and append `export default ComponentName;`.
 */
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

// ── Collect CSS ──────────────────────────────────────────────────────────

const cssChunks = [];

// ── Bundle ───────────────────────────────────────────────────────────────

/**
 * Find a file key in the files map, trying with the given extensions.
 */
function findFileKey(path, extensions) {
  if (files[path]) return path;
  for (const ext of extensions) {
    const withExt = path + ext;
    if (files[withExt]) return withExt;
  }
  return undefined;
}

try {
  const result = await build({
    stdin: {
      contents: autoExport(files[entryFile]),
      loader: "jsx",
      resolveDir: "/",
    },
    bundle: true,
    write: false,
    format: "cjs",
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    plugins: [
      {
        name: "virtual-modules",
        setup(build) {
          // React → external (provided by iframe's requireShim).
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.path === "react" || args.path.startsWith("react/")) {
              return { path: args.path, external: true };
            }

            // Resolve relative paths.
            let normalized = args.path;
            if (
              (args.path.startsWith("./") || args.path.startsWith("../")) &&
              args.importer
            ) {
              const importerDir = args.importer.includes("/")
                ? args.importer.substring(0, args.importer.lastIndexOf("/") + 1)
                : "";
              const joined = importerDir + args.path;
              const parts = joined.split("/");
              const resolved = [];
              for (const part of parts) {
                if (part === "..") resolved.pop();
                else if (part !== ".") resolved.push(part);
              }
              normalized = resolved.join("/");
            } else {
              normalized = normalized.replace(/^\.\//, "");
            }

            // Resolve to any known file, then assign namespace by extension.
            const jsExts = [".jsx", ".js"];
            const cssExts = [".css"];
            const allExts = [...jsExts, ...cssExts];

            const key =
              findFileKey(normalized, allExts) ??
              findFileKey(normalized + ".jsx", []) ??
              findFileKey(normalized + ".js", []) ??
              findFileKey(normalized + ".css", []);

            if (key) {
              const ns = key.endsWith(".css") ? "virtual-css" : "virtual-jsx";
              return { path: key, namespace: ns };
            }

            return undefined;
          });

          // Load virtual JSX modules (auto-export if needed).
          build.onLoad({ filter: /.*/, namespace: "virtual-jsx" }, (args) => ({
            contents: autoExport(files[args.path] ?? ""),
            loader: "jsx",
          }));

          // Load virtual CSS — collect it and return empty JS.
          build.onLoad({ filter: /.*/, namespace: "virtual-css" }, (args) => {
            cssChunks.push(files[args.path] ?? "");
            return { contents: "", loader: "js" };
          });
        },
      },
    ],
  });

  const output = result.outputFiles?.[0];
  if (!output) {
    throw new Error("esbuild.build produced no output");
  }

  // Write bundle.js
  writeFileSync(join(cwd, "bundle.js"), output.text, "utf-8");

  // Write bundle.css (concatenated CSS chunks)
  if (cssChunks.length > 0) {
    writeFileSync(join(cwd, "bundle.css"), cssChunks.join("\n"), "utf-8");
  }

  console.log(
    `✓ Bundled: bundle.js (${output.text.length} bytes)` +
      (cssChunks.length > 0
        ? `, bundle.css (${cssChunks.join("\n").length} bytes)`
        : "")
  );
} catch (err) {
  console.error("Bundle failed:", err.message);
  process.exit(1);
}
