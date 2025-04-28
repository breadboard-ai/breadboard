/**
 * @fileoverview Renders multiple outputs into single display.
 */

import { Template } from "./template";
import { ok, err, toText, isEmpty, mergeContent, toLLMContent } from "./utils";
import { callGenWebpage } from "./html-generator";
import { fanOutContext, flattenContext } from "./lists";

import read from "@read";

export { invoke as default, describe };

const MANUAL_MODE = "Manual layout";
const AUTO_MODE_LEGACY = "Webpage with auto-layout";
const FLASH_MODE = "Webpage with auto-layout by 2.5 Flash";
const PRO_MODE = "Webpage with auto-layout by 2.5 Pro";

type InvokeInputs = {
  text?: LLMContent;
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
    let instruction = `Render content as a mobile webpage.
${themeColorsPrompt(await getThemeColors())}
`;
    instruction +=
      " Use a responsive or mobile-friendly layout whenever possible and minimize unnecessary padding or margins.";
    console.log("Generating output based on instruction: ", instruction);
    const webPage = await callGenWebpage(
      instruction,
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
