/**
 * @fileoverview Mega step for generation capabilities.
 */

import describeGraph from "@describe";
import invokeGraph from "@invoke";

import { ok } from "../a2/utils";
import { readFlags } from "../a2/settings";
import { forEach } from "../a2/for-each";

export { invoke as default, describe };

type GenerationModes = (typeof MODES)[number];

type ModeId = GenerationModes["id"];

type Inputs = {
  context?: LLMContent[];
  "generation-mode"?: ModeId;
  "p-for-each"?: boolean;
  [PROMPT_PORT]: LLMContent;
} & Record<string, unknown>;

type DescribeInputs = {
  inputs: Inputs;
  asType?: boolean;
};

type Mode = {
  id: string;
  type: string;
  url: string;
  title: string;
  description: string;
  icon: string;
  modelName?: string;
  promptPlaceholderText?: string;
  /**
   * A brief message that can be presented to the user.
   * Currently used to provide proactive quota notification.
   */
  info?: string;
};

const MODES: Mode[] = [
  {
    id: "text-2.0-flash",
    type: "text",
    url: "embed://a2/generate-text.bgl.json#daf082ca-c1aa-4aff-b2c8-abeb984ab66c",
    title: "Gemini 2.0 Flash",
    description: "For everyday tasks, plus more",
    icon: "text_analysis",
    modelName: "gemini-2.0-flash",
    promptPlaceholderText:
      "Type your prompt here. Use @ to include other content.",
  },
  {
    id: "text",
    type: "text",
    url: "embed://a2/generate-text.bgl.json#daf082ca-c1aa-4aff-b2c8-abeb984ab66c",
    title: "Gemini 2.5 Flash",
    description: "Uses advanced reasoning",
    icon: "text_analysis",
    modelName: "gemini-2.5-flash-preview-05-20",
    promptPlaceholderText:
      "Type your prompt here. Use @ to include other content.",
  },
  {
    id: "text-2.5-pro",
    type: "text",
    url: "embed://a2/generate-text.bgl.json#daf082ca-c1aa-4aff-b2c8-abeb984ab66c",
    title: "Gemini 2.5 Pro",
    description: "Best for complex tasks",
    icon: "text_analysis",
    modelName: "gemini-2.5-pro-preview-06-05",
    promptPlaceholderText:
      "Type your prompt here. Use @ to include other content.",
  },
  {
    id: "think",
    type: "think",
    url: "embed://a2/go-over-list.bgl.json#module:main",
    title: "Plan and Execute with Gemini 2.0 Flash",
    description: "Plans and executes complex tasks",
    icon: "spark",
    modelName: "gemini-2.0-flash",
    promptPlaceholderText:
      "Type your goal here. Use @ to include other content.",
  },
  {
    id: "deep-research",
    type: "deep-research",
    url: "embed://a2/deep-research.bgl.json#module:main",
    title: "Deep Research with Gemini 2.5 Flash",
    description: "In-depth research on your topic",
    icon: "spark",
    modelName: "gemini-2.5-flash",
    promptPlaceholderText:
      "Type your research query here. Use @ to include other content.",
  },
  {
    id: "image-gen",
    type: "image-gen",
    url: "embed://a2/a2.bgl.json#module:image-generator",
    title: "Imagen 4",
    description: "Generates images from text",
    icon: "photo_spark",
    promptPlaceholderText:
      "Type your image prompt here. Use @ to include other content.",
    info: "Image generation has limited free quota",
  },
  {
    id: "image",
    type: "image",
    url: "embed://a2/a2.bgl.json#module:image-editor",
    title: "Gemini 2.0 Flash: Image Generation",
    description: "Generates images from text and images",
    icon: "photo_spark",
    promptPlaceholderText:
      "Type your image prompt here. Use @ to include other content.",
    info: "Image generation has limited free quota",
  },
  {
    id: "audio",
    type: "audio",
    url: "embed://a2/audio-generator.bgl.json#module:main",
    title: "AudioLM",
    description: "Generates speech from text",
    icon: "audio_magic_eraser",
    promptPlaceholderText:
      "Type the text to speak here. Use @ to include other content.",
    info: "Audio generation has limited free quota",
  },
  {
    id: "video",
    type: "video",
    url: "embed://a2/video-generator.bgl.json#module:main",
    title: "Veo",
    description: "Generates videos from text and images",
    icon: "videocam_auto",
    promptPlaceholderText:
      "Type your video prompt here. Use @ to include other content.",
    info: "Video generation has limited free quota",
  },
  {
    id: "music",
    type: "music",
    url: "embed://a2/music-generator.bgl.json#module:main",
    title: "Lyria 2",
    description: "Generates instrumental music from text",
    icon: "audio_magic_eraser",
    promptPlaceholderText:
      "Type your music prompt here. Use @ to include other content.",
    info: "Music generation has limited free quota",
  },
] as const;

const DEFAULT_MODE = MODES[0];

const modeMap = new Map(MODES.map((mode) => [mode.id, mode]));

const PROMPT_PORT = "config$prompt";
const ASK_USER_PORT = "config$ask-user";
const LIST_PORT = "config$list";

// Maps the prompt port to various names of the other ports.
const portMapForward = new Map<ModeId, Map<string, string>>([
  [
    MODES[0].id,
    new Map([
      [PROMPT_PORT, "description"],
      [ASK_USER_PORT, "p-chat"],
      [LIST_PORT, "p-list"],
    ]),
  ],
  [
    MODES[1].id,
    new Map([
      [PROMPT_PORT, "description"],
      [ASK_USER_PORT, "p-chat"],
      [LIST_PORT, "p-list"],
    ]),
  ],
  [
    MODES[2].id,
    new Map([
      [PROMPT_PORT, "description"],
      [ASK_USER_PORT, "p-chat"],
      [LIST_PORT, "p-list"],
    ]),
  ],
  [
    MODES[3].id,
    new Map([
      [PROMPT_PORT, "plan"],
      [LIST_PORT, "z-list"],
    ]),
  ],
  [
    MODES[4].id,
    new Map([
      [PROMPT_PORT, "query"],
      [LIST_PORT, "z-list"],
    ]),
  ],
  [MODES[5].id, new Map([[PROMPT_PORT, "instruction"]])],
  [MODES[6].id, new Map([[PROMPT_PORT, "instruction"]])],
  [MODES[7].id, new Map([[PROMPT_PORT, "text"]])],
  [MODES[8].id, new Map([[PROMPT_PORT, "instruction"]])],
  [MODES[9].id, new Map([[PROMPT_PORT, "text"]])],
]);

const portMapReverse = new Map(
  Array.from(portMapForward.entries()).map(([mode, map]) => {
    const inverted = new Map<string, string>();
    for (const [from, to] of map) {
      inverted.set(to, from);
    }
    return [mode, inverted];
  })
);

function translate<T extends Record<string, unknown>>(
  ports: T,
  map: Map<string, string>
): T {
  return Object.fromEntries(
    Object.entries(ports).map(([name, value]) => [map.get(name) || name, value])
  ) as T;
}

function forwardPorts<T extends Record<string, unknown>>(
  mode: ModeId,
  ports: T
): T {
  const forwardingMap = portMapForward.get(mode);
  if (!forwardingMap) return ports;
  return translate(ports, forwardingMap);
}

function receivePorts<T extends Record<string, unknown>>(
  mode: ModeId,
  ports: T
): T {
  const reverseMap = portMapReverse.get(mode);
  if (!reverseMap) return ports;
  return translate(ports, reverseMap);
}

function getMode(modeId: ModeId | undefined): GenerationModes {
  return modeMap.get(modeId || DEFAULT_MODE.id) || DEFAULT_MODE;
}

async function invoke({
  "generation-mode": mode,
  "p-for-each": useForEach,
  ...rest
}: Inputs) {
  const { url: $board, type, modelName } = getMode(mode);
  const flags = await readFlags();
  let generateForEach = false;
  if (ok(flags)) {
    generateForEach = flags.generateForEach && !!useForEach;
  }
  // Model is treated as part of the Mode, but actually maps N:1
  // on actual underlying step type.
  if (modelName) {
    console.log(`Generating with ${modelName}`);
    rest["p-model-name"] = modelName;
  }
  if (generateForEach) {
    return forEach(rest, async (prompt) => {
      const ports = { ...rest };
      ports[PROMPT_PORT] = prompt;
      return invokeGraph({ $board, ...forwardPorts(type, ports) });
    });
  } else {
    return invokeGraph({ $board, ...forwardPorts(type, rest) });
  }
}

async function describe({
  inputs: { "generation-mode": mode, ...rest },
  asType,
}: DescribeInputs) {
  const metadata = {
    title: "Generate",
    description: "Uses Gemini to generate content and call tools",
    metadata: {
      icon: "generative",
      tags: ["quick-access", "generative", "generate"],
      order: 1,
    },
  };

  // When asked for to be described as type, skip trying to
  // get the detailed schema and just return metadata.
  if (asType) {
    return {
      ...metadata,
      inputSchema: {},
      outputSchema: {},
    };
  }

  const flags = await readFlags();
  let generateForEachSchema: Schema["properties"] = {};
  const generateForEachBehavior: BehaviorSchema[] = [];
  if (ok(flags) && flags.generateForEach) {
    generateForEachSchema = {
      "p-for-each": {
        type: "boolean",
        title: "Generate for each input",
        behavior: ["config", "hint-preview", "hint-advanced"],
        icon: "summarize",
        description:
          "When checked, this step will try to detect a list of items as its input and run for each item in the list",
      },
    };
    generateForEachBehavior.push("hint-for-each-mode");
  }

  const { url, type } = getMode(mode);
  const describing = await describeGraph({ url, inputs: rest });
  const behavior: BehaviorSchema[] = [...generateForEachBehavior];
  let modeSchema: Record<string, Schema> = {};
  if (ok(describing)) {
    modeSchema = receivePorts(
      type,
      describing.inputSchema.properties || modeSchema
    );
    behavior.push(...(describing.inputSchema.behavior || []));
  }

  return {
    title: "Generate",
    description: "Uses Gemini to generate content and call tools",
    metadata: {
      icon: "generative",
      tags: ["quick-access", "generative", "generate"],
      order: 1,
    },
    inputSchema: {
      type: "object",
      properties: {
        "generation-mode": {
          type: "string",
          title: "Mode",
          enum: MODES as unknown as SchemaEnumValue[],
          behavior: ["config", "hint-preview", "reactive", "hint-controller"],
        },
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context in",
          behavior: ["main-port"],
        },
        ...generateForEachSchema,
        ...modeSchema,
      },
      behavior,
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
          behavior: ["main-port"],
        },
      },
    } satisfies Schema,
  };
}
