/**
 * @fileoverview Renders multiple outputs into single display.
 */

import { Template } from "./template";
import { ok, err, toText, isEmpty, toLLMContent } from "./utils";
import { callGenWebpage } from "./html-generator";
import { fanOutContext, flattenContext } from "./lists";

import read from "@read";

export { invoke as default, describe };

const MANUAL_MODE = "Layout manually";
const AUTO_MODE = "Display with autolayout";

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

type GraphMetadata = {
  title?: string;
  description?: string;
  version?: string;
  url?: string;
  icon?: string;
  visual?: {
    presentation?: Presentation;
  };
  userModified?: boolean;
  tags?: string[];
  comments: Comment[];
};

type Comment = {
  id: string;
  text: string;
  metadata: {
    title: string;
    visual: {
      x: number;
      y: number;
      collapsed: "expanded";
      outputHeight: number;
    };
  };
};

type Presentation = {
  themes?: Record<string, Theme>;
  theme?: string;
};

type Theme = {
  themeColors?: ThemeColors;
  template?: string;
  splashScreen?: StoredDataCapabilityPart;
};

type ThemeColors = {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  primaryTextColor?: string;
};

function defaultThemeColors(): ThemeColors {
  return {
    primaryColor: "#246db5",
    secondaryColor: "#5cadff",
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    primaryTextColor: "#ffffff",
  };
}

async function getThemeColors(): Promise<ThemeColors> {
  const readingMetadata = await read({ path: "/env/metadata" });
  if (!ok(readingMetadata)) return defaultThemeColors();
  const metadata = (readingMetadata.data?.at(0)?.parts?.at(0) as JSONPart)
    ?.json as GraphMetadata;
  if (!metadata) return defaultThemeColors();
  const currentThemeId = metadata?.visual?.presentation?.theme;
  if (!currentThemeId) return defaultThemeColors();
  const themeColors =
    metadata?.visual?.presentation?.themes?.[currentThemeId]?.themeColors;
  if (!themeColors) return defaultThemeColors();
  return { ...defaultThemeColors(), ...themeColors };
}

function themeColorsPrompt(colors: ThemeColors): string {
  return `Unless otherwise specified, use the following theme colors:

- primary color: ${colors.primaryColor}
- secondary color: ${colors.secondaryColor}
- background color: ${colors.backgroundColor}
- text color: ${colors.textColor}
- primary text color: ${colors.primaryTextColor}

`;
}

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
  // TODO(askerryryan): Further cleanup modes once FlowGen is fully in sync.
  if (renderMode == MANUAL_MODE) {
    renderMode = "Manual";
  } else if (renderMode == AUTO_MODE) {
    renderMode = "HTML";
  } else if (!renderMode) {
    renderMode = "Manual";
  }
  console.log("Rendering mode: " + renderMode);
  let out = context;
  if (renderMode != "Manual") {
    let instruction = "Render content with markdown format.";
    if (renderMode === "HTML" || renderMode === "Interactive") {
      instruction = `Render content as a mobile webpage.

${themeColorsPrompt(await getThemeColors())}
`;
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
          enum: [MANUAL_MODE, AUTO_MODE],
          title: "Display",
          behavior: ["config", "hint-preview"],
          default: MANUAL_MODE,
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
    title: "Display",
    metadata: {
      icon: "display",
      tags: ["quick-access", "core", "output"],
      order: 100,
    },
  };
}
