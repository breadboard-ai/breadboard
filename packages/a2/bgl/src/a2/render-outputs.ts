/**
 * @fileoverview Renders multiple outputs into single display.
 */

import { Template } from "./template";
import {
  ok,
  err,
  llm,
  toText,
  isEmpty,
  mergeContent,
  toLLMContent,
} from "./utils";
import { callGenWebpage } from "./html-generator";
import { fanOutContext, flattenContext } from "./lists";

import read from "@read";

export { invoke as default, describe };

const MANUAL_MODE = "Manual layout";
const AUTO_MODE_LEGACY = "Webpage with auto-layout";
const FLASH_MODE = "Webpage with auto-layout by 2.5 Flash";
const PRO_MODE = "Webpage with auto-layout by 2.5 Pro";

function defaultSystemInstruction(): LLMContent {
  return llm`You are a skilled web developer specializing in creating intuitive and visually appealing HTML web pages based on user instructions and data. Your task is to generate a valid HTML webpage that will be rendered in an iframe. The generated code must be valid and functional HTML with JavaScript and CSS embedded inline within <script> and <style> tags respectively. Return only the code, and open the HTML codeblock with the literal string '\`\`\`html'. Render content as a clean, well-structured webpage, paying careful attention to user instructions. Use a responsive or mobile-friendly layout whenever possible and minimize unnecessary padding or margins.`.asContent();
}

type InvokeInputs = {
  text?: LLMContent;
  "p-render-mode": string;
  "b-system-instruction"?: LLMContent;
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
  "p-render-mode": renderMode,
  "b-system-instruction": systemInstruction,
  ...params
}: InvokeInputs) {
  if (!text) {
    text = toLLMContent("");
  }
  if (!systemInstruction) {
    systemInstruction = defaultSystemInstruction();
  }
  let systemText = toText(systemInstruction);
  const template = new Template(text);
  const substituting = await template.substitute(params, async () => "");
  if (!ok(substituting)) {
    return substituting;
  }

  const context = mergeContent(
    flattenContext([substituting], true, "\n\n"),
    "user"
  );
  let modelName = "";
  // TODO(askerryryan): Clean up after backend backwards compatibility window.
  if (renderMode == MANUAL_MODE) {
    renderMode = "Manual";
  } else if (renderMode == FLASH_MODE || renderMode == AUTO_MODE_LEGACY) {
    modelName = "gemini-2.5-flash-preview-04-17";
    renderMode = "HTML";
  } else if (renderMode == PRO_MODE) {
    modelName = "gemini-2.5-pro-preview-03-25";
    renderMode = "Interactive";
  } else if (!renderMode) {
    renderMode = "Manual";
  }
  console.log("Rendering mode: " + renderMode);
  let out = context;
  if (renderMode != "Manual") {
    systemText += themeColorsPrompt(await getThemeColors());
    const webPage = await callGenWebpage(
      systemText,
      [context],
      renderMode,
      modelName
    );
    if (!ok(webPage)) {
      console.error("Failed to generated html output");
      return webPage;
    } else {
      out = await webPage;
      console.log(out);
    }
  }
  if (!ok(out)) return err(out);
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
          enum: [MANUAL_MODE, FLASH_MODE, PRO_MODE],
          title: "Display format",
          behavior: ["config", "hint-preview"],
          default: MANUAL_MODE,
          description: "Choose how to combine and display the outputs",
        },
        "b-system-instruction": {
          type: "object",
          behavior: ["llm-content", "config", "hint-advanced"],
          title: "System Instruction",
          description: "The system instruction used for auto-layout",
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
