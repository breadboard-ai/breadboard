/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generation + transform pipeline.
 *
 * 1. POST /api/generate with objective + context + skill → file map from Gemini
 * 2. POST /api/transform with file map → bundled CJS
 * 3. Return the CJS code ready for iframe rendering
 */

export { generate };

interface GenerateResult {
  code: string;
  files: Record<string, string>;
}

interface GenerateOptions {
  objective: string;
  context: string;
  skill: string;
  persona: string;
  dataset?: string;
  onChunk?: (text: string) => void;
  onThought?: (text: string) => void;
}

/**
 * Generate a mini app from an objective + personal context + skill.
 * Streams chunks via SSE for live progress, then transforms when complete.
 */
async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const { objective, context, skill, persona, dataset, onChunk, onThought } =
    opts;

  // Step 1: Stream from Gemini via SSE.

  console.log("[SSE client] fetching");

  const genRes = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objective, context, skill, persona, dataset }),
  });

  console.log("[SSE client] checking response");

  if (!genRes.ok) {
    const err = await genRes.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Generation failed: ${genRes.status}`);
  }

  console.log(
    "[SSE client] response content-type:",
    genRes.headers.get("content-type")
  );

  // Read the SSE stream
  const reader = genRes.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let files: Record<string, string> | null = null;
  let clientChunkCount = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const decoded = decoder.decode(value, { stream: true });
    clientChunkCount++;
    if (clientChunkCount <= 3) {
      console.log(
        `[SSE client] chunk #${clientChunkCount} (${decoded.length} chars):`,
        decoded.slice(0, 200)
      );
    }

    buffer += decoded;
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const dataLine = event.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;

      try {
        const parsed = JSON.parse(dataLine.slice(6));
        if (parsed.type === "thought" && onThought) {
          onThought(parsed.text);
        } else if (parsed.type === "chunk" && onChunk) {
          onChunk(parsed.text);
        } else if (parsed.type === "done") {
          files = parsed.files;
        } else if (parsed.type === "error") {
          throw new Error(parsed.error);
        }
      } catch (e) {
        if (
          e instanceof Error &&
          e.message !== "Unexpected end of JSON input"
        ) {
          throw e;
        }
      }
    }
  }
  console.log(
    `[SSE client] stream complete. ${clientChunkCount} chunks received.`
  );

  if (!files || Object.keys(files).length === 0) {
    throw new Error("Gemini returned no files");
  }

  if (!files["App.jsx"]) {
    throw new Error(
      `No App.jsx in generated files. Got: ${Object.keys(files).join(", ")}`
    );
  }

  // Step 2: Transform the file map into bundled CJS.
  const transformRes = await fetch("/api/transform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files, assets: {} }),
  });

  if (!transformRes.ok) {
    const err = await transformRes
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Transform failed: ${transformRes.status}`);
  }

  const { code } = (await transformRes.json()) as { code: string };

  return { code, files };
}
