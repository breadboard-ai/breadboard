/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generation + transform pipeline.
 *
 * Modes:
 * - one-shot / prefab: POST /api/generate → SSE → POST /api/transform
 * - design-first:
 *     1. POST /api/assess → editorial plan
 *     2. POST /api/image  → design mockup (NB Pro)
 *     3. POST /api/generate (with designImage) → SSE → POST /api/transform
 */

export { generate, generateDesignFirst };
export type { GenerateResult, GenerateOptions, DesignFirstResult };

interface GenerateResult {
  code: string;
  files: Record<string, string>;
}

interface DesignFirstResult extends GenerateResult {
  /** The editorial plan from the assess stage. */
  editorialPlan: string;
  /** Base64 PNG of the design mockup. */
  designImageBase64: string;
  /** Timing breakdown for each stage. */
  stageTimes: {
    assessMs: number;
    designMs: number;
    generateMs: number;
    transformMs: number;
  };
}

interface GenerateOptions {
  objective: string;
  context: string;
  skill: string;
  persona: string;
  dataset?: string;
  /** Optional base64 PNG design image to include in the prompt. */
  designImage?: string;
  /** Which Gemini model to use for code generation. */
  model?: string;
  onChunk?: (text: string) => void;
  onThought?: (text: string) => void;
  onStage?: (stage: string) => void;
}

// ─── Core generate (one-shot / prefab) ───────────────────────────────────────

async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const {
    objective,
    context,
    skill,
    persona,
    dataset,
    designImage,
    onChunk,
    onThought,
  } = opts;

  const genRes = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      objective,
      context,
      skill,
      persona,
      dataset,
      designImage,
      model: opts.model,
    }),
  });

  if (!genRes.ok) {
    const err = await genRes.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Generation failed: ${genRes.status}`);
  }

  const reader = genRes.body?.getReader();
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

  if (!files || Object.keys(files).length === 0) {
    throw new Error("Gemini returned no files");
  }

  if (!files["App.jsx"]) {
    throw new Error(
      `No App.jsx in generated files. Got: ${Object.keys(files).join(", ")}`
    );
  }

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

// ─── Design-first pipeline ───────────────────────────────────────────────────

async function generateDesignFirst(
  opts: GenerateOptions & { designPrompt: string; imageModel?: string }
): Promise<DesignFirstResult> {
  const { onStage } = opts;

  // Stage 1: EA Assessment
  onStage?.("Assessing playbooks…");
  const assessStart = performance.now();

  const assessRes = await fetch("/api/assess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      persona: opts.persona,
      dataset: opts.dataset,
      context: opts.context,
    }),
  });

  if (!assessRes.ok) {
    const err = await assessRes
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Assessment failed: ${assessRes.status}`);
  }

  const { plan: editorialPlan } = (await assessRes.json()) as {
    plan: string;
  };
  const assessEnd = performance.now();

  // Stage 2: Design mockup via NB Pro (image generation)
  onStage?.("Generating design mockup…");
  const designStart = performance.now();

  const designPrompt =
    `High-fidelity editorial UI design for a personal morning briefing app. ` +
    `Warm cream background (#faf8f5). Desktop width, single scrollable page. ` +
    `Design techniques: text overlapping full-bleed images, massive serif headlines, ` +
    `pull quotes bleeding off edges, asymmetric columns, oversized typography, ` +
    `layered elements, generous whitespace. ` +
    `High-end editorial art direction with a clean, modern sensibility. ` +
    `Based on this editorial plan:\n\n${editorialPlan}`;

  const modelParam = opts.imageModel ? `&model=${opts.imageModel}` : "";
  const designUrl = `/api/image?prompt=${encodeURIComponent(designPrompt)}${modelParam}`;
  const designRes = await fetch(designUrl);

  let designImageBase64 = "";
  if (designRes.ok) {
    const blob = await designRes.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    designImageBase64 = btoa(binary);
  }
  const designEnd = performance.now();

  // Stage 3: Generate code with editorial plan + design image
  onStage?.("Building layout from design…");
  const generateStart = performance.now();

  const enrichedObjective =
    opts.objective +
    "\n\n## Editorial Plan (from EA assessment)\n\n" +
    editorialPlan;

  const result = await generate({
    ...opts,
    objective: enrichedObjective,
    designImage: designImageBase64 || undefined,
  });

  const generateEnd = performance.now();

  return {
    ...result,
    editorialPlan,
    designImageBase64,
    stageTimes: {
      assessMs: Math.round(assessEnd - assessStart),
      designMs: Math.round(designEnd - designStart),
      generateMs: Math.round(generateEnd - generateStart),
      transformMs: 0, // included in generateMs
    },
  };
}
