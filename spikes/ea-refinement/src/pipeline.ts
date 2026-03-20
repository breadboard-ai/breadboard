/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generation, refinement, and chat pipelines.
 *
 * - generate(): Initial UI generation (same as context-gradient)
 * - refine(): Send existing bundle + feedback → modified bundle
 * - chat(): Lightweight preference-extraction chat
 */

export { generate, refine, chat };

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
  memory?: string;
  model?: string;
  onChunk?: (text: string) => void;
  onThought?: (text: string) => void;
}

interface RefineOptions {
  files: Record<string, string>;
  feedback: string;
  memory: string;
  skill: string;
  refinementSkill: string;
  persona: string;
  model?: string;
  onChunk?: (text: string) => void;
  onThought?: (text: string) => void;
}

interface ChatOptions {
  message: string;
  memory: string;
  currentFiles: Record<string, string> | null;
  chatSkill: string;
}

interface ChatResult {
  reply: string;
  memoryUpdate?: string;
  complexity?: "minor" | "major";
}

/**
 * Generate an initial mini-app from objective + personal context.
 */
async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const { objective, context, skill, persona, dataset, memory, model, onChunk, onThought } = opts;

  const genRes = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objective, context, skill, persona, dataset, memory, model }),
  });

  if (!genRes.ok) {
    const err = await genRes.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Generation failed: ${genRes.status}`);
  }

  const files = await readSSEStream(genRes, onChunk, onThought);

  if (!files || Object.keys(files).length === 0) {
    throw new Error("Gemini returned no files");
  }
  if (!files["App.jsx"]) {
    throw new Error(`No App.jsx. Got: ${Object.keys(files).join(", ")}`);
  }

  const code = await transform(files);
  return { code, files };
}

/**
 * Refine an existing bundle based on user feedback.
 */
async function refine(opts: RefineOptions): Promise<GenerateResult> {
  const { files, feedback, memory, skill, refinementSkill, persona, model, onChunk, onThought } = opts;

  const genRes = await fetch("/api/refine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files, feedback, memory, skill, refinementSkill, persona, model }),
  });

  if (!genRes.ok) {
    const err = await genRes.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Refinement failed: ${genRes.status}`);
  }

  const newFiles = await readSSEStream(genRes, onChunk, onThought);

  if (!newFiles || Object.keys(newFiles).length === 0) {
    throw new Error("Gemini returned no files");
  }
  if (!newFiles["App.jsx"]) {
    throw new Error(`No App.jsx. Got: ${Object.keys(newFiles).join(", ")}`);
  }

  const code = await transform(newFiles);
  return { code, files: newFiles };
}

/**
 * Chat with the EA about the current output. Extracts preferences.
 */
async function chat(opts: ChatOptions): Promise<ChatResult> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Chat failed: ${res.status}`);
  }

  return res.json();
}

// ─── Shared Helpers ───────────────────────────────────────────────────────

/** Read an SSE stream and collect files from the "done" event. */
async function readSSEStream(
  response: Response,
  onChunk?: (text: string) => void,
  onThought?: (text: string) => void
): Promise<Record<string, string> | null> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let files: Record<string, string> | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
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

  return files;
}

/** Transform a file map into a bundled CJS string. */
async function transform(files: Record<string, string>): Promise<string> {
  const res = await fetch("/api/transform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files, assets: {} }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Transform failed: ${res.status}`);
  }

  const { code } = (await res.json()) as { code: string };
  return code;
}
