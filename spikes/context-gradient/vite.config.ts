/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig, loadEnv, type Plugin } from "vite";
import { Readable } from "node:stream";

/** Read the full body of an incoming request. */
function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => (data += chunk.toString()));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Plugin 1: JSX Transform (reused from Ark)
// ---------------------------------------------------------------------------

/**
 * POST /api/transform
 *
 * Accepts `{ files: Record<string,string>, assets?: Record<string,string> }`
 * and returns `{ code: string }` — bundled CJS ready for the iframe.
 */
function transformPlugin(): Plugin {
  return {
    name: "cg-transform",
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
            const code = await buildBundle(payload.files, payload.assets ?? {});
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
 * Multi-file bundle → CJS via esbuild.build with virtual module plugins.
 */
async function buildBundle(
  files: Record<string, string>,
  assets: Record<string, string>
): Promise<string> {
  const esbuild = await import("esbuild");

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
    plugins: [
      {
        name: "virtual-modules",
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.path === "react" || args.path.startsWith("react/")) {
              return { path: args.path, external: true };
            }
            if (args.path.startsWith("@widgets/")) {
              return { path: args.path, external: true };
            }

            let normalized = args.path;
            if (
              (args.path.startsWith("./") || args.path.startsWith("../")) &&
              args.importer
            ) {
              const importerDir = args.importer.includes("/")
                ? args.importer.substring(
                    0,
                    args.importer.lastIndexOf("/") + 1
                  )
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

            // CSS?
            const cssKey =
              findFileKey(normalized, files, [".css"]) ??
              findFileKey(normalized + ".css", files, []);
            if (cssKey) {
              return { path: cssKey, namespace: "virtual-css" };
            }

            // Asset?
            const assetUrl = resolveAssetUrl(normalized, assets);
            if (assetUrl !== undefined) {
              return { path: normalized, namespace: "virtual-asset" };
            }

            // JSX/component?
            const jsxKey =
              findFileKey(normalized, files, [".jsx", ".js"]) ??
              findFileKey(normalized + ".jsx", files, []) ??
              findFileKey(normalized + ".js", files, []);
            if (jsxKey) {
              return { path: jsxKey, namespace: "virtual-jsx" };
            }

            return undefined;
          });

          build.onLoad(
            { filter: /.*/, namespace: "virtual-jsx" },
            (args) => ({
              contents: autoExportComponent(files[args.path] ?? ""),
              loader: "jsx",
            })
          );

          build.onLoad(
            { filter: /.*/, namespace: "virtual-css" },
            (args) => ({
              contents: [
                `const style = document.createElement("style");`,
                `style.textContent = ${JSON.stringify(files[args.path])};`,
                `document.head.appendChild(style);`,
              ].join("\n"),
              loader: "js",
            })
          );

          build.onLoad(
            { filter: /.*/, namespace: "virtual-asset" },
            (args) => {
              const url = resolveAssetUrl(args.path, assets);
              return {
                contents: `module.exports = ${JSON.stringify(url)};`,
                loader: "js",
              };
            }
          );
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

// ---------------------------------------------------------------------------
// Plugin 2: Gemini Generation
// ---------------------------------------------------------------------------

const GENAI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-3.1-pro-preview";

/**
 * POST /api/generate
 *
 * Accepts `{ objective: string, context: string, skill: string }`
 * and returns `{ files: Record<string, string> }` — JSX file map from Gemini.
 */
function generatePlugin(): Plugin {
  return {
    name: "cg-generate",
    enforce: "pre",
    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.url !== "/api/generate" || req.method !== "POST") {
            next();
            return;
          }

          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            res.statusCode = 503;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({ error: "GEMINI_API_KEY not set" })
            );
            return;
          }

          try {
            const body = await readBody(req);
            const { objective, context, skill, persona, dataset } = JSON.parse(body);

            const userPrompt = buildUserPrompt(objective, context, dataset);
            const systemInstruction = [persona, skill]
              .filter(Boolean)
              .join("\n\n---\n\n");

            const url = `${GENAI_API_BASE}/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

            const geminiBody = {
              system_instruction: {
                parts: [{ text: systemInstruction }],
              },
              contents: [
                {
                  role: "user",
                  parts: [{ text: userPrompt }],
                },
              ],
              generationConfig: {
                temperature: 0.4,
                topP: 0.95,
              },
            };

            // Set up SSE headers BEFORE Gemini fetch so client gets
            // an immediate response and can start reading the stream.
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.flushHeaders();

            const response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(geminiBody),
            });

            if (!response.ok) {
              const errorText = await response.text();
              res.write(`data: ${JSON.stringify({ type: "error", error: `Gemini API error ${response.status}: ${errorText.slice(0, 500)}` })}\n\n`);
              res.end();
              return;
            }

            console.log("[SSE] Gemini responded", response.status, response.headers.get("content-type"));

            let fullText = "";
            let thinkingSent = false;

            // Convert Web ReadableStream to Node Readable stream
            console.log("[SSE] response.body type:", typeof response.body, !!response.body);
            const nodeStream = Readable.fromWeb(
              response.body as import("stream/web").ReadableStream
            );
            let buffer = "";
            let chunkCount = 0;

            await new Promise<void>((resolve, reject) => {
              nodeStream.on("data", (raw: Buffer) => {
                chunkCount++;
                const text = raw.toString();
                if (chunkCount <= 3) {
                  console.log(`[SSE] raw chunk #${chunkCount} (${text.length} chars):`, text.slice(0, 200));
                }
                buffer += text;

                // Process complete lines — each `data: ` line is a full SSE event
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() ?? ""; // Keep incomplete last line

                for (const line of lines) {
                  if (!line.startsWith("data: ")) continue;
                  const json = line.slice(6).trim();
                  if (!json) continue;

                  try {
                    const parsed = JSON.parse(json);
                    const parts = parsed.candidates?.[0]?.content?.parts;
                    if (!parts) continue;

                    for (const part of parts) {
                      if (part.thought && part.text) {
                        // Native thinking content
                        res.write(`data: ${JSON.stringify({ type: "thought", text: part.text })}\n\n`);
                      } else if (part.text) {
                        fullText += part.text;
                        // Check for <thinking> blocks in accumulated text
                        const thinkMatch = fullText.match(/<thinking>([\s\S]*?)<\/thinking>/);
                        if (thinkMatch && !thinkingSent) {
                          thinkingSent = true;
                          res.write(`data: ${JSON.stringify({ type: "thought", text: thinkMatch[1].trim() })}\n\n`);
                        } else if (!fullText.includes("<thinking>") || thinkingSent) {
                          // Only send chunk events after thinking is done
                          res.write(`data: ${JSON.stringify({ type: "chunk", text: part.text })}\n\n`);
                        }
                      }
                    }
                  } catch {
                    // Skip malformed JSON
                  }
                }
              });
              nodeStream.on("end", () => {
                console.log(`[SSE] stream ended. ${chunkCount} chunks, ${fullText.length} chars total`);
                resolve();
              });
              nodeStream.on("error", (err) => {
                console.error("[SSE] stream error:", err);
                reject(err);
              });
            });

            // Strip <thinking> block and parse code files
            const cleanText = fullText.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, "");
            const files = parseFilesFromResponse(cleanText);
            res.write(`data: ${JSON.stringify({ type: "done", files })}\n\n`);
            res.end();
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            // If SSE headers already sent, send error as event
            if (res.headersSent) {
              res.write(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`);
              res.end();
            } else {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: message }));
            }
          }
        });
      };
    },
  };
}

/**
 * Build the user prompt from objective + personal context.
 */
function buildUserPrompt(
  objective: string,
  context: string,
  dataset?: string
): string {
  const parts = [`## Objective\n\n${objective}`];

  if (context.trim()) {
    parts.push(`## Personal Context\n\n${context}`);
  }

  if (dataset) {
    parts.push(dataset);
  }

  parts.push(
    `\n## Output\n\n` +
      `Generate a multi-file React component bundle. Return each file in a ` +
      `fenced code block with the filename as the language identifier, like:\n\n` +
      "```App.jsx\n// ... component code\n```\n\n" +
      "```styles.css\n/* ... styles */\n```\n\n" +
      "```components/ScoreCard.jsx\n// ... component code\n```\n\n" +
      `Use realistic, plausible sample data — no "Lorem ipsum". ` +
      `Be creative and visually impressive. Include agent editorial ` +
      `commentary where appropriate (e.g., "This hits your marks for X ` +
      `because Y").`
  );

  return parts.join("\n\n");
}

/**
 * Parse fenced code blocks from Gemini's response into a file map.
 *
 * Expects blocks like:
 *   ```App.jsx
 *   ... code ...
 *   ```
 */
function parseFilesFromResponse(text: string): Record<string, string> {
  const files: Record<string, string> = {};
  // Match ```filename\n...content...\n```
  const regex = /```([^\n`]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    let filename = match[1].trim();
    const content = match[2];

    // Skip non-file code blocks (e.g., ```jsx or ```javascript)
    if (
      filename === "jsx" ||
      filename === "javascript" ||
      filename === "js" ||
      filename === "css" ||
      filename === "html" ||
      filename === "json"
    ) {
      // Try to infer filename from content
      if (
        filename === "jsx" ||
        filename === "javascript" ||
        filename === "js"
      ) {
        const funcMatch = content.match(
          /(?:function|const)\s+([A-Z]\w*)/
        );
        if (funcMatch) {
          filename = `${funcMatch[1]}.jsx`;
          // If it doesn't look like App, put it in components/
          if (funcMatch[1] !== "App") {
            filename = `components/${funcMatch[1]}.jsx`;
          }
        } else {
          continue; // Skip unidentifiable code blocks
        }
      } else if (filename === "css") {
        filename = "styles.css";
      } else {
        continue;
      }
    }

    files[filename] = content;
  }

  return files;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default defineConfig(({ mode }) => {
  // Load ALL env vars (empty prefix = no filtering), not just VITE_-prefixed.
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    plugins: [transformPlugin(), generatePlugin()],
  };
});
