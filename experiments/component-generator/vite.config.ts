/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig, type Plugin } from "vite";
import { config } from "dotenv";

config();

/**
 * The Gemini API base URL.
 * Using v1beta for preview model access.
 */
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

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
 * Vite plugin that proxies Gemini API calls server-side so the API key
 * never reaches the browser.
 *
 * Single endpoint: POST /api/generate
 *   Body: { model, contents, systemInstruction, generationConfig }
 *   Returns: Gemini generateContent response
 */
function geminiProxy(): Plugin {
  const apiKey = process.env.GEMINI_API_KEY;

  return {
    name: "gemini-proxy",
    configureServer(server) {
      // Streaming proxy — SSE endpoint for real-time thought streaming.
      // MUST be registered BEFORE /api/generate because connect uses
      // prefix matching and /api/generate/stream would match /api/generate.
      server.middlewares.use("/api/generate/stream", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "GEMINI_API_KEY is not set." }));
          return;
        }

        try {
          const body = await readBody(req);
          const parsed = JSON.parse(body);
          const { model, contents, systemInstruction, generationConfig } =
            parsed;

          const geminiBody: Record<string, unknown> = {
            contents,
            generationConfig: {
              thinkingConfig: { includeThoughts: true },
              ...generationConfig,
            },
          };

          if (systemInstruction) {
            geminiBody.systemInstruction = {
              parts: [{ text: systemInstruction }],
            };
          }

          const url = `${GEMINI_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
          const geminiRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiBody),
          });

          if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            console.error(`[gemini-stream] ${geminiRes.status}: ${errText}`);
            res.statusCode = geminiRes.status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: errText }));
            return;
          }

          // Set SSE headers.
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.flushHeaders();

          const reader = geminiRes.body;
          if (!reader) {
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }

          let buffer = "";
          const decoder = new TextDecoder();
          const streamReader = reader.getReader();

          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await streamReader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

            let boundary: number;
            while ((boundary = buffer.indexOf("\n\n")) !== -1) {
              const event = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);

              const json = event
                .split("\n")
                .filter((l) => l.startsWith("data: "))
                .map((l) => l.slice(6))
                .join("");
              if (!json) continue;

              try {
                const chunk = JSON.parse(json);
                const candidates = chunk.candidates ?? [];
                const chunkPayload = JSON.stringify({ candidates });
                res.write(`data: ${chunkPayload}\n\n`);
              } catch {
                // Malformed chunk — skip.
              }
            }
          }

          res.write("data: [DONE]\n\n");
          res.end();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: message }));
          } else {
            res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
          }
        }
      });

      server.middlewares.use("/api/generate", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error:
                "GEMINI_API_KEY is not set. Create a .env file with your key.",
            })
          );
          return;
        }

        try {
          const body = await readBody(req);
          const parsed = JSON.parse(body);
          const { model, contents, systemInstruction, generationConfig } =
            parsed;

          const geminiBody: Record<string, unknown> = {
            contents,
            generationConfig: {
              ...generationConfig,
            },
          };

          if (systemInstruction) {
            geminiBody.systemInstruction = {
              parts: [{ text: systemInstruction }],
            };
          }

          const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`;
          const geminiRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiBody),
          });

          const data = await geminiRes.json();

          if (!geminiRes.ok) {
            const errorMessage = data.error?.message ?? JSON.stringify(data);
            console.error(
              `[gemini-proxy] ${geminiRes.status} ${geminiRes.statusText}: ${errorMessage}`
            );
            res.statusCode = geminiRes.status;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: errorMessage,
                status: geminiRes.status,
              })
            );
            return;
          }

          // Extract text from the response.
          const candidates = data.candidates ?? [];
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ candidates }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: message }));
        }
      });

      // Transform JSX → JS and convert module syntax to CJS using esbuild.
      // This converts `import X from 'react'` → `var X = require("react")`
      // at the AST level. The iframe provides a `require` shim that returns
      // the global React. No regex stripping needed.
      server.middlewares.use("/api/transform", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        try {
          const body = await readBody(req);
          const { code } = JSON.parse(body);

          const esbuild = await import("esbuild");
          const result = await esbuild.transform(code, {
            loader: "jsx",
            format: "cjs",
            jsx: "transform",
            jsxFactory: "React.createElement",
            jsxFragment: "React.Fragment",
          });

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ code: result.code }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: message }));
        }
      });

      // ─── Image Generation ───────────────────────────────────────────
      // GET /api/image?prompt=<url-encoded text>
      // Returns raw PNG image bytes. Cached in memory per prompt so
      // repeated iframe renders don't hit the API.
      const imageCache = new Map<string, Buffer>();

      server.middlewares.use("/api/image", async (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        if (!apiKey) {
          res.statusCode = 500;
          res.end("GEMINI_API_KEY is not set.");
          return;
        }

        const url = new URL(req.url ?? "", "http://localhost");
        const prompt = url.searchParams.get("prompt");
        if (!prompt) {
          res.statusCode = 400;
          res.end("Missing ?prompt= parameter");
          return;
        }

        // Check cache first.
        if (imageCache.has(prompt)) {
          res.setHeader("Content-Type", "image/png");
          res.setHeader("Cache-Control", "public, max-age=86400");
          res.end(imageCache.get(prompt));
          return;
        }

        try {
          console.log(`[image-proxy] Generating: "${prompt.slice(0, 60)}..."`);

          const geminiUrl = `${GEMINI_BASE}/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
          const geminiRes = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                responseModalities: ["IMAGE", "TEXT"],
              },
            }),
          });

          const data = await geminiRes.json();

          if (!geminiRes.ok) {
            const msg = data.error?.message ?? JSON.stringify(data);
            console.error(`[image-proxy] ${geminiRes.status}: ${msg}`);
            res.statusCode = geminiRes.status;
            res.end(msg);
            return;
          }

          // Extract inline image data from the response.
          const parts = data.candidates?.[0]?.content?.parts ?? [];
          const imagePart = parts.find(
            (p: Record<string, unknown>) => p.inlineData
          );

          if (!imagePart?.inlineData) {
            res.statusCode = 404;
            res.end("No image generated");
            return;
          }

          const buf = Buffer.from(imagePart.inlineData.data, "base64");
          imageCache.set(prompt, buf);

          console.log(`[image-proxy] Cached (${imageCache.size} total)`);

          res.setHeader(
            "Content-Type",
            imagePart.inlineData.mimeType ?? "image/png"
          );
          res.setHeader("Cache-Control", "public, max-age=86400");
          res.end(buf);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[image-proxy] Error: ${message}`);
          res.statusCode = 500;
          res.end(message);
        }
      });

      // ─── Concept Image Generation ─────────────────────────────────
      // POST /api/concept-image
      // Body: { prompt: string }
      // Returns: { base64: string, mimeType: string }
      //
      // Uses Nano Banana Pro (gemini-3-pro-image-preview) to generate
      // a high-quality UI concept image from a text description.
      // The result is then fed into the component decomposition flow.
      server.middlewares.use("/api/concept-image", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "GEMINI_API_KEY is not set." }));
          return;
        }

        try {
          const body = await readBody(req);
          const { prompt, referenceImage } = JSON.parse(body);
          if (!prompt) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Missing prompt" }));
            return;
          }

          console.log(
            `[concept-image] Generating: "${prompt.slice(0, 60)}..."${referenceImage ? " (with reference image)" : ""}`
          );

          const enhancedPrompt = `Generate a UI component mockup for: ${prompt}. Render EXACTLY ONE design — do NOT show multiple variations, options, or a grid of alternatives. Render ONLY the component itself — no browser chrome, no address bars, no window frames, no device bezels, no surrounding desktop. Just the single isolated UI element on a plain dark background. Use clean layout, realistic sample data, professional typography, and a cohesive color palette. Do not include any wireframe elements.`;

          // Build content parts: reference image (if provided) + text prompt.
          const contentParts: Array<Record<string, unknown>> = [];
          if (referenceImage?.base64 && referenceImage?.mimeType) {
            contentParts.push({
              inlineData: {
                mimeType: referenceImage.mimeType,
                data: referenceImage.base64,
              },
            });
          }
          contentParts.push({ text: enhancedPrompt });

          const geminiUrl = `${GEMINI_BASE}/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;
          const geminiRes = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: contentParts }],
              generationConfig: {
                responseModalities: ["IMAGE", "TEXT"],
              },
            }),
          });

          const data = await geminiRes.json();

          if (!geminiRes.ok) {
            const msg = data.error?.message ?? JSON.stringify(data);
            console.error(`[concept-image] ${geminiRes.status}: ${msg}`);
            res.statusCode = geminiRes.status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: msg }));
            return;
          }

          const parts = data.candidates?.[0]?.content?.parts ?? [];
          const imagePart = parts.find(
            (p: Record<string, unknown>) => p.inlineData
          );

          if (!imagePart?.inlineData) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "No image generated" }));
            return;
          }

          console.log(`[concept-image] Generated successfully`);

          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              base64: imagePart.inlineData.data,
              mimeType: imagePart.inlineData.mimeType ?? "image/png",
            })
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[concept-image] Error: ${message}`);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [geminiProxy()],
});
