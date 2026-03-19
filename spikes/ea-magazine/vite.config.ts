/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig, loadEnv, type Plugin } from "vite";
import { createHash } from "node:crypto";
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


function transformPlugin(): Plugin {
  return {
    name: "em-transform",
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
            if (args.path === "xstate" || args.path.startsWith("xstate/")) {
              return { path: args.path, external: true };
            }
            if (args.path.startsWith("@prefab/")) {
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

            const cssKey =
              findFileKey(normalized, files, [".css"]) ??
              findFileKey(normalized + ".css", files, []);
            if (cssKey) {
              return { path: cssKey, namespace: "virtual-css" };
            }

            const assetUrl = resolveAssetUrl(normalized, assets);
            if (assetUrl !== undefined) {
              return { path: normalized, namespace: "virtual-asset" };
            }

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


const GENAI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-3.1-pro-preview";

function generatePlugin(): Plugin {
  return {
    name: "em-generate",
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
            res.end(JSON.stringify({ error: "GEMINI_API_KEY not set" }));
            return;
          }

          try {
            const body = await readBody(req);
            const { objective, context, skill, persona, dataset, designImage, model: requestModel } =
              JSON.parse(body);

            const selectedModel = requestModel || MODEL;

            const userPrompt = buildUserPrompt(objective, context, dataset);
            const systemInstruction = [persona, skill]
              .filter(Boolean)
              .join("\n\n---\n\n");

            const url = `${GENAI_API_BASE}/${selectedModel}:streamGenerateContent?alt=sse&key=${apiKey}`;

            // Build user parts — text + optional design image
            const userParts: Array<Record<string, unknown>> = [
              { text: userPrompt },
            ];
            if (designImage) {
              userParts.push({
                inlineData: {
                  mimeType: "image/png",
                  data: designImage,
                },
              });
              userParts.push({
                text:
                  "\n\nThe image above is a design mockup created by a designer. " +
                  "Implement this design as closely as possible in React, using the " +
                  "editorial layout techniques described in your instructions. " +
                  "Match the visual hierarchy, typography scale, overlaps, and " +
                  "spatial relationships shown in the mockup.",
              });
            }

            const geminiBody = {
              system_instruction: {
                parts: [{ text: systemInstruction }],
              },
              contents: [
                {
                  role: "user",
                  parts: userParts,
                },
              ],
              generationConfig: {
                temperature: 0.4,
                topP: 0.95,
              },
            };

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
              res.write(
                `data: ${JSON.stringify({ type: "error", error: `Gemini API error ${response.status}: ${errorText.slice(0, 500)}` })}\n\n`
              );
              res.end();
              return;
            }

            console.log("[SSE] Gemini responded", response.status);

            let fullText = "";
            let thinkingSent = false;

            const nodeStream = Readable.fromWeb(
              response.body as import("stream/web").ReadableStream
            );
            let buffer = "";
            let chunkCount = 0;

            await new Promise<void>((resolve, reject) => {
              nodeStream.on("data", (raw: Buffer) => {
                chunkCount++;
                const text = raw.toString();
                buffer += text;

                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() ?? "";

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
                        res.write(
                          `data: ${JSON.stringify({ type: "thought", text: part.text })}\n\n`
                        );
                      } else if (part.text) {
                        fullText += part.text;
                        const thinkMatch = fullText.match(
                          /<thinking>([\s\S]*?)<\/thinking>/
                        );
                        if (thinkMatch && !thinkingSent) {
                          thinkingSent = true;
                          res.write(
                            `data: ${JSON.stringify({ type: "thought", text: thinkMatch[1].trim() })}\n\n`
                          );
                        } else if (
                          !fullText.includes("<thinking>") ||
                          thinkingSent
                        ) {
                          res.write(
                            `data: ${JSON.stringify({ type: "chunk", text: part.text })}\n\n`
                          );
                        }
                      }
                    }
                  } catch {
                    // Skip malformed JSON
                  }
                }
              });
              nodeStream.on("end", () => {
                console.log(
                  `[SSE] stream ended. ${chunkCount} chunks, ${fullText.length} chars total`
                );
                resolve();
              });
              nodeStream.on("error", (err) => {
                console.error("[SSE] stream error:", err);
                reject(err);
              });
            });

            const cleanText = fullText.replace(
              /<thinking>[\s\S]*?<\/thinking>\s*/g,
              ""
            );
            const files = parseFilesFromResponse(cleanText);
            res.write(
              `data: ${JSON.stringify({ type: "done", files })}\n\n`
            );
            res.end();
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            if (res.headersSent) {
              res.write(
                `data: ${JSON.stringify({ type: "error", error: message })}\n\n`
              );
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


const ASSESS_MODEL = "gemini-3.1-pro-preview";

function assessPlugin(): Plugin {
  return {
    name: "em-assess",
    enforce: "pre",
    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.url !== "/api/assess" || req.method !== "POST") {
            next();
            return;
          }

          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            res.statusCode = 503;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "GEMINI_API_KEY not set" }));
            return;
          }

          try {
            const body = await readBody(req);
            const { persona, dataset, context } = JSON.parse(body);

            const systemPrompt =
              `You are an executive assistant editorial planner. ` +
              `Given a user's playbooks and personal context, produce an ` +
              `editorial plan for a morning briefing layout.\n\n` +
              (persona ?? "");

            const userPrompt =
              `## Task\n\n` +
              `Analyze these playbooks and produce an editorial plan.\n\n` +
              `## Personal Context\n\n${context}\n\n` +
              `${dataset}\n\n` +
              `## Output Format\n\n` +
              `Return a structured editorial plan:\n\n` +
              `### Headline\n` +
              `The main headline for today (e.g. "Wednesday Morning")\n\n` +
              `### Editorial Summary\n` +
              `2-3 sentence editorial greeting.\n\n` +
              `### Feature Spread\n` +
              `Which ONE playbook gets the hero treatment and why. ` +
              `Include the playbook title and a 1-sentence editorial pitch.\n\n` +
              `### Attention Line\n` +
              `3-4 urgent playbooks as one-sentence editorial summaries ` +
              `with the action needed.\n\n` +
              `### Progress Ticker\n` +
              `5-8 playbooks that are running/progressing, as short phrases.\n\n` +
              `### Quiet Corner\n` +
              `Remaining playbooks that are idle/complete.\n\n` +
              `### Design Direction\n` +
              `1-2 sentences describing the overall visual mood, what ` +
              `editorial techniques would work best (overlaps, pull quotes, etc).`;

            const url = `${GENAI_API_BASE}/${ASSESS_MODEL}:generateContent?key=${apiKey}`;
            const geminiBody = {
              system_instruction: {
                parts: [{ text: systemPrompt }],
              },
              contents: [
                {
                  role: "user",
                  parts: [{ text: userPrompt }],
                },
              ],
              generationConfig: {
                temperature: 0.3,
                topP: 0.9,
              },
            };

            console.log("[Assess] calling Gemini...");
            const response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(geminiBody),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[Assess] error ${response.status}:`, errorText.slice(0, 300));
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: `Assess failed: ${response.status}` }));
              return;
            }

            const result = await response.json();
            const text =
              result.candidates?.[0]?.content?.parts
                ?.map((p: { text?: string }) => p.text ?? "")
                .join("") ?? "";

            console.log(`[Assess] done, ${text.length} chars`);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ plan: text }));
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("[Assess] error:", message);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: message }));
          }
        });
      };
    },
  };
}


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
      "```sections/FeatureSpread.jsx\n// ... component code\n```\n\n" +
      `Use the provided playbook data verbatim. Be editorially bold and ` +
      `visually striking — this should feel like an art-directed morning ` +
      `briefing, not a dashboard. Overlap text on images, use pull quotes, ` +
      `full-bleed photography, and asymmetric layouts.`
  );

  return parts.join("\n\n");
}

function parseFilesFromResponse(text: string): Record<string, string> {
  const files: Record<string, string> = {};
  const regex = /```([^\n`]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    let filename = match[1].trim();
    const content = match[2];

    if (
      filename === "jsx" ||
      filename === "javascript" ||
      filename === "js" ||
      filename === "css" ||
      filename === "html" ||
      filename === "json"
    ) {
      if (
        filename === "jsx" ||
        filename === "javascript" ||
        filename === "js"
      ) {
        const funcMatch = content.match(/(?:function|const)\s+([A-Z]\w*)/);
        if (funcMatch) {
          filename = `${funcMatch[1]}.jsx`;
          if (funcMatch[1] !== "App") {
            filename = `components/${funcMatch[1]}.jsx`;
          }
        } else {
          continue;
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


const IMAGE_MODELS: Record<string, string> = {
  "nb-pro": "gemini-3-pro-image-preview",
  "nb-2": "gemini-3.1-flash-image-preview",
};
const DEFAULT_IMAGE_MODEL = "nb-pro";
const imageCache = new Map<string, Buffer>();

function imagePlugin(): Plugin {
  return {
    name: "em-image",
    enforce: "pre",
    configureServer(server) {
      // Register BEFORE Vite's middleware (not in the return callback)
      // so /api/image doesn't get caught by Vite's HTML fallback.
      server.middlewares.use(async (req, res, next) => {
        const parsed = new URL(req.url ?? "", "http://localhost");
        if (parsed.pathname !== "/api/image") {
          next();
          return;
        }

        const prompt = parsed.searchParams.get("prompt");
        if (!prompt) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing ?prompt= parameter" }));
          return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          res.statusCode = 503;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "GEMINI_API_KEY not set" }));
          return;
        }

        // Cache by prompt+model hash
        const modelKey =
          parsed.searchParams.get("model") ?? DEFAULT_IMAGE_MODEL;
        const hash = createHash("sha256")
          .update(modelKey + ":" + prompt)
          .digest("hex")
          .slice(0, 16);

        const cached = imageCache.get(hash);
        if (cached) {
          console.log(`[Image] cache hit for ${hash}`);
          res.setHeader("Content-Type", "image/png");
          res.setHeader("Cache-Control", "public, max-age=86400");
          res.end(cached);
          return;
        }

        try {
          const model = IMAGE_MODELS[modelKey] ?? IMAGE_MODELS[DEFAULT_IMAGE_MODEL];
          console.log(`[Image] generating with ${modelKey} for: "${prompt.slice(0, 80)}..."`);
          const url = `${GENAI_API_BASE}/${model}:generateContent?key=${apiKey}`;
          const geminiBody = {
            contents: [
              {
                parts: [
                  {
                    text:
                      `Generate a beautiful, photorealistic image: ${prompt}. ` +
                      `Style: warm, editorial photography, natural lighting, ` +
                      `shallow depth of field. Aspect ratio: 16:9 landscape.`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"],
            },
          };

          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiBody),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Image] Gemini error ${response.status}:`, errorText.slice(0, 300));
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: `Image generation failed: ${response.status}`,
              })
            );
            return;
          }

          const result = await response.json();
          const parts = result.candidates?.[0]?.content?.parts ?? [];

          const imagePart = parts.find(
            (p: { inlineData?: { mimeType: string } }) =>
              p.inlineData?.mimeType?.startsWith("image/")
          );

          if (!imagePart?.inlineData?.data) {
            console.error("[Image] No image data in response");
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({ error: "No image data in Gemini response" })
            );
            return;
          }

          const imageBuffer = Buffer.from(
            imagePart.inlineData.data,
            "base64"
          );
          imageCache.set(hash, imageBuffer);
          console.log(
            `[Image] cached ${hash} (${imageBuffer.length} bytes)`
          );

          const mimeType = imagePart.inlineData.mimeType ?? "image/png";
          res.setHeader("Content-Type", mimeType);
          res.setHeader("Cache-Control", "public, max-age=86400");
          res.end(imageBuffer);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[Image] error:", message);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}


export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    plugins: [transformPlugin(), generatePlugin(), assessPlugin(), imagePlugin()],
  };
});
