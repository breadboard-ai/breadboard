/**
 * @fileoverview Add a description for your module here.
 */

import describeGraph from "@describe";
import invokeGraph from "@invoke";

import { ok } from "./a2/utils";
import { type Params } from "./a2/common";

export { invoke as default, describe };

type GenerationModes = (typeof MODES)[number];

type ModeId = GenerationModes["id"];

type Inputs = {
  context?: LLMContent[];
  "generation-mode"?: ModeId;
} & Record<string, unknown>;

type DescribeInputs = {
  inputs: Inputs;
  asType?: boolean;
};

const MODES = [
  {
    id: "text",
    url: "embed://a2/generate-text.bgl.json#daf082ca-c1aa-4aff-b2c8-abeb984ab66c",
    title: "Gemini 2.0 Flash",
    description: "For everyday tasks, plus more",
    icon: "text_analysis",
  },
  {
    id: "think",
    url: "embed://a2/go-over-list.bgl.json#module:main",
    title: "Plan and Execute with Gemini 2.0 Flash",
    description: "Plans and executes complex tasks",
    icon: "spark",
  },
  {
    id: "image-gen",
    url: "embed://a2/a2.bgl.json#module:image-generator",
    title: "Imagen 3",
    description: "Generates images from text",
    icon: "photo_spark",
  },
  {
    id: "image",
    url: "embed://a2/a2.bgl.json#module:image-editor",
    title: "Gemini 2.0 Flash: Image Generation",
    description: "Generates images from text and images",
    icon: "photo_spark",
  },
  {
    id: "audio",
    url: "embed://a2/audio-generator.bgl.json#module:main",
    title: "AudioLM",
    description: "Generates speech from text",
    icon: "audio_magic_eraser",
  },
  {
    id: "video",
    url: "embed://a2/video-generator.bgl.json#module:main",
    title: "Veo 2",
    description: "Generates videos from text and images",
    icon: "videocam_auto",
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
      [PROMPT_PORT, "plan"],
      [LIST_PORT, "z-list"],
    ]),
  ],
  [MODES[2].id, new Map([[PROMPT_PORT, "instruction"]])],
  [MODES[3].id, new Map([[PROMPT_PORT, "instruction"]])],
  [MODES[4].id, new Map([[PROMPT_PORT, "text"]])],
  [MODES[5].id, new Map([[PROMPT_PORT, "instruction"]])],
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

async function invoke({ "generation-mode": mode, ...rest }: Inputs) {
  const { url: $board, id } = getMode(mode);
  return await invokeGraph({ $board, ...forwardPorts(id, rest) });
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

  const { url, id } = getMode(mode);
  const describing = await describeGraph({ url, inputs: rest });
  let behavior: BehaviorSchema[] = [];
  let modeSchema: Record<string, Schema> = {};
  if (ok(describing)) {
    modeSchema = receivePorts(
      id,
      describing.inputSchema.properties || modeSchema
    );
    behavior = describing.inputSchema.behavior || [];
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
