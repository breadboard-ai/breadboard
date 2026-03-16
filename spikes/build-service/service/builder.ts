/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure build function — JSX file map → bundled CJS string.
 *
 * Extracted from Ark's vite.config.ts buildBundle(). Same virtual module
 * plugins (CSS injection, asset URL resolution, React externalization,
 * auto-export), but no Vite dependency.
 */

import * as esbuild from "esbuild";

export { buildBundle };

interface BuildInput {
  files: Record<string, string>;
  assets: Record<string, string>;
}

interface BuildOutput {
  code: string;
}

/**
 * Bundle a multi-file JSX app into a single CJS string.
 *
 * - Entry point is `App.jsx` by convention.
 * - React is externalized (provided by the host runtime's require shim).
 * - CSS imports become `<style>` injection snippets.
 * - Asset imports resolve to their URL string.
 */
async function buildBundle(input: BuildInput): Promise<BuildOutput> {
  const { files, assets } = input;

  const entry = files["App.jsx"];
  if (!entry) {
    throw new Error("No App.jsx found in bundle files");
  }

  const entrySource = autoExportComponent(entry);

  const result = await esbuild.build({
    stdin: {
      contents: entrySource,
      loader: "jsx",
      resolveDir: "/",
    },
    bundle: true,
    write: false,
    format: "cjs",
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    plugins: [virtualModulesPlugin(files, assets)],
  });

  const output = result.outputFiles?.[0];
  if (!output) {
    throw new Error("esbuild.build produced no output");
  }

  return { code: output.text };
}

// ─── Virtual Module Plugin ──────────────────────────────────────────────────

function virtualModulesPlugin(
  files: Record<string, string>,
  assets: Record<string, string>
): esbuild.Plugin {
  return {
    name: "virtual-modules",
    setup(build) {
      // Resolve all imports.
      build.onResolve({ filter: /.*/ }, (args) => {
        // React → external (provided by the host runtime's require shim).
        if (args.path === "react" || args.path.startsWith("react/")) {
          return { path: args.path, external: true };
        }

        // Resolve relative paths against the importer's directory.
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
          const resolved: string[] = [];
          for (const part of parts) {
            if (part === "..") {
              resolved.pop();
            } else if (part !== ".") {
              resolved.push(part);
            }
          }
          normalized = resolved.join("/");
        } else {
          normalized = normalized.replace(/^\.\//, "");
        }

        // CSS file?
        const cssKey =
          findFileKey(normalized, files, [".css"]) ??
          findFileKey(normalized + ".css", files, []);
        if (cssKey) {
          return { path: cssKey, namespace: "virtual-css" };
        }

        // Asset file?
        const assetUrl = resolveAssetUrl(normalized, assets);
        if (assetUrl !== undefined) {
          return { path: normalized, namespace: "virtual-asset" };
        }

        // JSX/component file?
        const jsxKey =
          findFileKey(normalized, files, [".jsx", ".js"]) ??
          findFileKey(normalized + ".jsx", files, []) ??
          findFileKey(normalized + ".js", files, []);
        if (jsxKey) {
          return { path: jsxKey, namespace: "virtual-jsx" };
        }

        return undefined;
      });

      // Load virtual JSX modules (auto-export if needed).
      build.onLoad({ filter: /.*/, namespace: "virtual-jsx" }, (args) => ({
        contents: autoExportComponent(files[args.path] ?? ""),
        loader: "jsx",
      }));

      // Load virtual CSS modules as style injection.
      build.onLoad({ filter: /.*/, namespace: "virtual-css" }, (args) => ({
        contents: [
          `const style = document.createElement("style");`,
          `style.textContent = ${JSON.stringify(files[args.path])};`,
          `document.head.appendChild(style);`,
        ].join("\n"),
        loader: "js",
      }));

      // Load virtual asset modules as URL exports.
      build.onLoad({ filter: /.*/, namespace: "virtual-asset" }, (args) => {
        const url = resolveAssetUrl(args.path, assets);
        return {
          contents: `module.exports = ${JSON.stringify(url)};`,
          loader: "js",
        };
      });
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Auto-export: if a JSX source has no explicit export, detect the
 * component name and append `export default ComponentName;`.
 */
function autoExportComponent(source: string): string {
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

/**
 * Find a file key in the files map, trying with the given extensions.
 */
function findFileKey(
  path: string,
  files: Record<string, string>,
  extensions: string[]
): string | undefined {
  if (files[path]) return path;
  for (const ext of extensions) {
    const withExt = path + ext;
    if (files[withExt]) return withExt;
  }
  return undefined;
}

/**
 * Resolve an asset URL from the assets map, handling path normalization.
 */
function resolveAssetUrl(
  path: string,
  assets: Record<string, string>
): string | undefined {
  if (assets[path]) return assets[path];

  const basename = path.split("/").pop()!;
  for (const [key, url] of Object.entries(assets)) {
    if (key.endsWith(`/${basename}`) || key === basename) {
      return url;
    }
  }
  return undefined;
}
