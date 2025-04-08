/**
 * @fileoverview Renders multiple outputs into single display.
 */

import { Template } from "./template";
import { ok, toText, isEmpty, toLLMContent } from "./utils";
import { callGenWebpage } from "./html-generator";
import { fanOutContext, flattenContext } from "./lists";

export { invoke as default, describe };

type InvokeInputs = {
  text?: LLMContent;
  instruction?: string;
  "p-render-mode": string;
};

type DescribeInputs = {
  inputs: {
    text?: LLMContent;
  };
};

async function invoke({
  text,
  instruction,
  "p-render-mode": renderMode,
  ...params
}: InvokeInputs) {
  if (!text) {
    text = toLLMContent("");
  }
  const template = new Template(text);
  const substituting = await template.substitute(params, async () => "");
  if (!ok(substituting)) {
    return substituting;
  }
  let context = await fanOutContext(
    substituting,
    undefined,
    async (instruction) => instruction
  );
  if (!ok(context)) return context;
  context = flattenContext(context);
  renderMode = renderMode || "Manual";
  console.log("Rendering mode: " + renderMode);
  let out = context;
  if (renderMode != "Manual") {
    let instruction = "Render content with markdown format.";
    if (renderMode === "HTML" || renderMode === "Interactive") {
      instruction = "Render content as a mobile webpage.";
    }
    instruction +=
      " Assume content will render on a mobile device. Use a responsive or mobile-friendly layout whenever possible and minimize unnecessary padding or margins.";
    console.log("Generating output based on instruction: ", instruction);
    const webPage = await callGenWebpage(instruction, context, renderMode);
    if (!ok(webPage)) {
      console.error("Failed to generated html output");
    } else {
      out = [await webPage];
      console.log(out);
    }
  }
  return out;
  if (!ok(out)) return out;
  return { context: out };
}

async function describe({ inputs: { text } }: DescribeInputs) {
  const template = new Template(text);
  return {
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "object",
          behavior: ["llm-content", "hint-preview", "config", "at-wireable"],
          title: "Outputs to render",
          description:
            "Type the @ character to select the outputs to combine. Optionally include style and layout guidlines if using Rendering mode of Markdown or HTML.",
        },
        "p-render-mode": {
          type: "string",
          enum: ["Manual", "Markdown", "HTML", "Interactive"],
          title: "Rendering mode",
          behavior: ["config", "hint-preview"],
          default: "Manual",
          description:
            "Choose how to combine the outputs (Manual: output is rendered exactly as configured below. Markdown: automatically combine the results into a markdown document, HTML: automatically combine the results into a webpage, Interactive: an interactive visualization or widget)",
        },
        ...template.schemas(),
      },
      behavior: ["at-wireable"],
      ...template.requireds(),
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: {
            type: "object",
            behavior: ["llm-content"],
          },
          title: "Context out",
          behavior: ["main-port", "hint-multimodal"],
        },
      },
    } satisfies Schema,
    title: "Render Outputs",
    metadata: {
      icon: "combine-outputs",
      tags: ["quick-access", "core"],
      order: 100,
    },
  };
}
