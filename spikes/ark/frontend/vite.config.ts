/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig, type Plugin } from "vite";

/** Read the full body of an incoming request. */
function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => (data += chunk.toString()));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/**
 * Vite plugin — JSX/bundle transform endpoint.
 *
 * POST /api/transform
 *
 * Two modes, determined by the request body shape:
 *
 * 1. Single-source: `{ code: string }` → esbuild.transform (JSX → CJS)
 * 2. Multi-file bundle: `{ files: Record<string,string>, assets: Record<string,string> }`
 *    → esbuild.build with virtual modules. All imports (components, CSS,
 *    assets) resolved by plugins. No regex on the client side.
 */
function transformPlugin(): Plugin {
  return {
    name: "ark-transform",
    enforce: "pre",
    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.url !== "/api/transform" || req.method !== "POST") {
            next();
            return;
          }

          try {
            const body = await readBody(req);
            const payload = JSON.parse(body);

            let code: string;

            if (payload.files) {
              // Multi-file bundle transform via esbuild.build.
              code = await buildBundle(payload.files, payload.assets ?? {});
            } else {
              // Single-source transform.
              code = await transformSingle(payload.code);
            }

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ code }));
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: message }));
          }
        });
      };
    },
  };
}

/** Single-source JSX → CJS via esbuild.transform. */
async function transformSingle(code: string): Promise<string> {
  const esbuild = await import("esbuild");
  const result = await esbuild.transform(code, {
    loader: "jsx",
    format: "cjs",
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
  });
  return result.code;
}

/**
 * Auto-export: if a JSX source has no explicit export, detect the
 * component name and append `export default ComponentName;`.
 *
 * Handles both `function App(` and `const App =` patterns.
 */
function autoExportComponent(source: string): string {
  if (source.includes("export default") || source.includes("module.exports")) {
    return source;
  }

  // Match `function App(` or `const App =`
  const match =
    source.match(/^function\s+([A-Z]\w*)/m) ??
    source.match(/^const\s+([A-Z]\w*)\s*=/m);

  if (match) {
    return source + `\nexport default ${match[1]};\n`;
  }
  return source;
}

/**
 * Multi-file bundle → CJS via esbuild.build with virtual module plugins.
 *
 * - Component imports (./components/Foo) → resolved from the files map
 * - CSS imports → injected as <style> via a JS shim
 * - Asset imports (./assets/logo.svg) → resolved to `export default "url"`
 * - React imports → marked external (provided by the iframe's requireShim)
 */
async function buildBundle(
  files: Record<string, string>,
  assets: Record<string, string>
): Promise<string> {
  const esbuild = await import("esbuild");

  // Find the entry point — App.jsx by convention.
  const entry = files["App.jsx"];
  if (!entry) {
    throw new Error("No App.jsx found in bundle files");
  }

  // Auto-export the entry point if needed.
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
    plugins: [
      {
        name: "virtual-modules",
        setup(build) {
          // Resolve all imports.
          build.onResolve({ filter: /.*/ }, (args) => {
            // React → external (provided by iframe's requireShim).
            if (args.path === "react" || args.path.startsWith("react/")) {
              return { path: args.path, external: true };
            }

            // Resolve relative paths against the importer's directory.
            let normalized = args.path.replace(/^\.\//, "");
            if (
              args.path.startsWith("./") &&
              args.resolveDir !== "/" &&
              args.importer
            ) {
              // args.importer is the virtual path (e.g. "components/Foo.jsx")
              const importerDir = args.importer.includes("/")
                ? args.importer.substring(0, args.importer.lastIndexOf("/") + 1)
                : "";
              normalized = importerDir + normalized;
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

            // Unknown — let esbuild handle (will error if truly missing).
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
      },
    ],
  });

  const output = result.outputFiles?.[0];
  if (!output) {
    throw new Error("esbuild.build produced no output");
  }
  return output.text;
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

  // Try with/without leading paths.
  const basename = path.split("/").pop()!;
  for (const [key, url] of Object.entries(assets)) {
    if (key.endsWith(`/${basename}`) || key === basename) {
      return url;
    }
  }
  return undefined;
}

export default defineConfig({
  plugins: [transformPlugin()],
});
