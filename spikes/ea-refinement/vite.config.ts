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

// ─── Plugin 1: JSX Transform (from context-gradient) ─────────────────────

function transformPlugin(): Plugin {
  return {
    name: "refine-transform",
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
  if (!entry) throw new Error("No App.jsx found in bundle files");

  const entrySource = autoExportComponent(entry);

  const result = await esbuild.build({
    stdin: { contents: entrySource, loader: "jsx", resolveDir: "/" },
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
                ? args.importer.substring(0, args.importer.lastIndexOf("/") + 1)
                : "";
              const joined = importerDir + args.path;
              const parts = joined.split("/");
              const resolved: string[] = [];
              for (const part of parts) {
                if (part === "..") resolved.pop();
                else if (part !== ".") resolved.push(part);
              }
              normalized = resolved.join("/");
            } else {
              normalized = normalized.replace(/^\.\//, "");
            }

            const cssKey =
              findFileKey(normalized, files, [".css"]) ??
              findFileKey(normalized + ".css", files, []);
            if (cssKey) return { path: cssKey, namespace: "virtual-css" };

            const assetUrl = resolveAssetUrl(normalized, assets);
            if (assetUrl !== undefined) {
              return { path: normalized, namespace: "virtual-asset" };
            }

            const jsxKey =
              findFileKey(normalized, files, [".jsx", ".js"]) ??
              findFileKey(normalized + ".jsx", files, []) ??
              findFileKey(normalized + ".js", files, []);
            if (jsxKey) return { path: jsxKey, namespace: "virtual-jsx" };

            return undefined;
          });

          build.onLoad({ filter: /.*/, namespace: "virtual-jsx" }, (args) => ({
            contents: autoExportComponent(files[args.path] ?? ""),
            loader: "jsx",
          }));

          build.onLoad({ filter: /.*/, namespace: "virtual-css" }, (args) => ({
            contents: [
              `const style = document.createElement("style");`,
              `style.textContent = ${JSON.stringify(files[args.path])};`,
              `document.head.appendChild(style);`,
            ].join("\n"),
            loader: "js",
          }));

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
  if (!output) throw new Error("esbuild.build produced no output");
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
    if (key.endsWith(`/${basename}`) || key === basename) return url;
  }
  return undefined;
}

// ─── Plugin 2: Gemini Generation ──────────────────────────────────────────

const GENAI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.1-pro-preview";

function generatePlugin(): Plugin {
  return {
    name: "refine-generate",
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
            const { objective, context, skill, persona, dataset, memory, model } =
              JSON.parse(body);

            const userPrompt = buildGeneratePrompt(objective, context, dataset, memory);
            const systemInstruction = [persona, skill]
              .filter(Boolean)
              .join("\n\n---\n\n");

            await streamGeminiSSE(
              res,
              apiKey,
              model ?? DEFAULT_MODEL,
              systemInstruction,
              userPrompt
            );
          } catch (err: unknown) {
            handleError(res, err);
          }
        });
      };
    },
  };
}

// ─── Plugin 3: Refinement ─────────────────────────────────────────────────

function refinePlugin(): Plugin {
  return {
    name: "refine-refine",
    enforce: "pre",
    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.url !== "/api/refine" || req.method !== "POST") {
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
            const {
              files,
              feedback,
              memory,
              skill,
              refinementSkill,
              persona,
              model,
            } = JSON.parse(body);

            const userPrompt = buildRefinePrompt(files, feedback, memory);
            const systemInstruction = [persona, skill, refinementSkill]
              .filter(Boolean)
              .join("\n\n---\n\n");

            await streamGeminiSSE(
              res,
              apiKey,
              model ?? "gemini-3.1-flash-lite-preview",
              systemInstruction,
              userPrompt
            );
          } catch (err: unknown) {
            handleError(res, err);
          }
        });
      };
    },
  };
}

// ─── Plugin 4: Chat ───────────────────────────────────────────────────────

function chatPlugin(): Plugin {
  return {
    name: "refine-chat",
    enforce: "pre",
    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.url !== "/api/chat" || req.method !== "POST") {
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
            const { message, memory, currentFiles, chatSkill } =
              JSON.parse(body);

            const systemInstruction = chatSkill;

            let userPrompt = "";
            if (currentFiles) {
              userPrompt += "## Current UI Files\n\n";
              for (const [name, content] of Object.entries(currentFiles)) {
                userPrompt += `### ${name}\n\`\`\`jsx\n${content}\n\`\`\`\n\n`;
              }
            }
            if (memory) {
              userPrompt += `## Accumulated Preferences\n\n${memory}\n\n`;
            }
            userPrompt += `## User says\n\n${message}\n\n`;
            userPrompt +=
              `## Response format\n\n` +
              `Reply in JSON: { "reply": "your conversational response", ` +
              `"memoryUpdate": "preference note or null", ` +
              `"complexity": "minor" or "major" }\n` +
              `If no preference signal was detected, omit memoryUpdate.\n` +
              `Always include complexity — "minor" for surface tweaks, ` +
              `"major" for structural changes.`;

            const selectedModel = "gemini-3.1-flash-lite-preview";
            const url = `${GENAI_API_BASE}/${selectedModel}:generateContent?key=${apiKey}`;

            const geminiBody = {
              system_instruction: {
                parts: [{ text: systemInstruction }],
              },
              contents: [
                { role: "user", parts: [{ text: userPrompt }] },
              ],
              generationConfig: {
                temperature: 0.6,
                topP: 0.9,
                responseMimeType: "application/json",
              },
            };

            const response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(geminiBody),
            });

            if (!response.ok) {
              const errorText = await response.text();
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error: `Gemini error ${response.status}: ${errorText.slice(0, 500)}`,
                })
              );
              return;
            }

            const data = await response.json();
            const text =
              data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

            try {
              const parsed = JSON.parse(text);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(parsed));
            } catch {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ reply: text }));
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: message }));
          }
        });
      };
    },
  };
}

// ─── Shared Gemini Helpers ────────────────────────────────────────────────

function buildGeneratePrompt(
  objective: string,
  context: string,
  dataset?: string,
  memory?: string
): string {
  const parts = [`## Objective\n\n${objective}`];
  if (context.trim()) {
    parts.push(`## Personal Context\n\n${context}`);
  }
  if (memory?.trim()) {
    parts.push(`## User Preferences (from previous iterations)\n\n${memory}`);
  }
  if (dataset) {
    parts.push(dataset);
  }
  parts.push(
    `\n## Output\n\n` +
      `Generate a multi-file React component bundle. Return each file in a ` +
      `fenced code block with the filename as the language identifier.\n\n` +
      "```App.jsx\n// ... component code\n```\n\n" +
      "```styles.css\n/* ... styles */\n```\n\n" +
      "```components/ScoreCard.jsx\n// ... component code\n```\n\n" +
      `Use realistic, plausible sample data — no "Lorem ipsum". ` +
      `Be creative and visually impressive.`
  );
  return parts.join("\n\n");
}

function buildRefinePrompt(
  files: Record<string, string>,
  feedback: string,
  memory: string
): string {
  const parts: string[] = [];

  parts.push("## Current Bundle\n\nHere is the existing UI you need to modify:\n");
  for (const [name, content] of Object.entries(files)) {
    parts.push(`### ${name}\n\`\`\`${name}\n${content}\n\`\`\``);
  }

  parts.push(`## User Feedback\n\n${feedback}`);

  if (memory.trim()) {
    parts.push(
      `## User Preferences (from conversation)\n\n${memory}\n\n` +
        `These are preference signals gathered from chatting with the user. ` +
        `Let them influence your choices, but the explicit feedback above ` +
        `takes priority.`
    );
  }

  parts.push(
    `\n## Output\n\n` +
      `Return the complete modified bundle. Every file, modified or not, ` +
      `in fenced code blocks with the filename as the language identifier. ` +
      `Use the same format as the original bundle above.`
  );

  return parts.join("\n\n");
}

async function streamGeminiSSE(
  res: import("http").ServerResponse,
  apiKey: string,
  model: string,
  systemInstruction: string,
  userPrompt: string
): Promise<void> {
  const url = `${GENAI_API_BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const geminiBody = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0.4, topP: 0.95 },
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

  let fullText = "";
  let thinkingSent = false;

  const nodeStream = Readable.fromWeb(
    response.body as import("stream/web").ReadableStream
  );
  let buffer = "";

  await new Promise<void>((resolve, reject) => {
    nodeStream.on("data", (raw: Buffer) => {
      buffer += raw.toString();
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
              } else if (!fullText.includes("<thinking>") || thinkingSent) {
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
    nodeStream.on("end", () => resolve());
    nodeStream.on("error", (err) => reject(err));
  });

  const cleanText = fullText.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, "");
  const files = parseFilesFromResponse(cleanText);
  res.write(`data: ${JSON.stringify({ type: "done", files })}\n\n`);
  res.end();
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
      if (filename === "jsx" || filename === "javascript" || filename === "js") {
        const funcMatch = content.match(/(?:function|const)\s+([A-Z]\w*)/);
        if (funcMatch) {
          filename =
            funcMatch[1] === "App"
              ? `${funcMatch[1]}.jsx`
              : `components/${funcMatch[1]}.jsx`;
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

function handleError(res: import("http").ServerResponse, err: unknown) {
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

// ─── Export ───────────────────────────────────────────────────────────────

// ─── Image Generation ─────────────────────────────────────────────────────

const IMAGE_MODELS: Record<string, string> = {
  "nb-pro": "gemini-3-pro-image-preview",
  "nb-2": "gemini-3.1-flash-image-preview",
};
const DEFAULT_IMAGE_MODEL = "nb-pro";
const imageCache = new Map<string, Buffer>();

function imagePlugin(): Plugin {
  return {
    name: "er-image",
    enforce: "pre",
    configureServer(server) {
      // Register BEFORE Vite's middleware so /api/image doesn't get
      // caught by Vite's HTML fallback.
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

        const modelKey =
          parsed.searchParams.get("model") ?? DEFAULT_IMAGE_MODEL;
        const hash = createHash("sha256")
          .update(modelKey + ":" + prompt)
          .digest("hex")
          .slice(0, 16);

        const cached = imageCache.get(hash);
        if (cached) {
          res.setHeader("Content-Type", "image/png");
          res.setHeader("Cache-Control", "public, max-age=86400");
          res.end(cached);
          return;
        }

        try {
          const model =
            IMAGE_MODELS[modelKey] ?? IMAGE_MODELS[DEFAULT_IMAGE_MODEL];
          console.log(
            `[Image] generating with ${modelKey} for: "${prompt.slice(0, 80)}..."`
          );
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
            console.error(
              `[Image] Gemini error ${response.status}:`,
              errorText.slice(0, 300)
            );
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

function universalsPlugin(): Plugin {
  return {
    name: "refine-universals",
    enforce: "pre",
    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.url !== "/api/infer-universals" || req.method !== "POST") {
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
            const { surfaces } = JSON.parse(body);

            let prompt = `You are analysing a user's design preferences across multiple UI surfaces.\n\n`;
            for (const [name, notes] of Object.entries(surfaces)) {
              prompt += `## ${name} preferences\n${notes}\n\n`;
            }
            prompt +=
              `## Task\n\n` +
              `Extract the cross-cutting design principles that apply universally ` +
              `across ALL surfaces. These are style preferences, not content preferences.\n\n` +
              `Focus on:\n` +
              `- Typography preferences (size, weight, serif vs sans)\n` +
              `- Spacing and density preferences\n` +
              `- Color and contrast preferences\n` +
              `- Layout tendencies (dense vs spacious, symmetry vs asymmetry)\n` +
              `- Widget/component preferences\n` +
              `- General aesthetic direction\n\n` +
              `Ignore surface-specific details (e.g. "wants weather widget" is editorial-specific, ` +
              `but "prefers integrated widgets over standalone cards" is universal).\n\n` +
              `Reply in JSON: { "universals": "bulleted list of universal principles" }\n` +
              `Use a simple dash-prefixed list. Be concise — each principle in one line.`;

            const model = "gemini-3.1-flash-lite-preview";
            const url = `${GENAI_API_BASE}/${model}:generateContent?key=${apiKey}`;

            const geminiBody = {
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.4,
                topP: 0.9,
                responseMimeType: "application/json",
              },
            };

            const response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(geminiBody),
            });

            if (!response.ok) {
              const errorText = await response.text();
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error: `Gemini error ${response.status}: ${errorText.slice(0, 500)}`,
                })
              );
              return;
            }

            const data = await response.json();
            const text =
              data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

            try {
              const parsed = JSON.parse(text);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(parsed));
            } catch {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ universals: text }));
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: message }));
          }
        });
      };
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    plugins: [
      transformPlugin(),
      generatePlugin(),
      refinePlugin(),
      chatPlugin(),
      imagePlugin(),
      universalsPlugin(),
    ],
  };
});
