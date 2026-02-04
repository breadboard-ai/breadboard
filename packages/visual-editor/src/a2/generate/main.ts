/**
 * @fileoverview Mega step for generation capabilities.
 */

import { ok } from "../a2/utils.js";
import { readFlags } from "../a2/settings.js";
import {
  Capabilities,
  InputValues,
  LLMContent,
  RuntimeFlags,
  Schema,
} from "@breadboard-ai/types";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { makeTextInstruction } from "../generate-text/main.js";
import { makeGoOverListInstruction } from "../go-over-list/main.js";
import agent, { computeAgentSchema, type AgentInputs } from "../agent/main.js";
import { makeDeepResearchInstruction } from "../deep-research/main.js";
import { makeImageInstruction } from "../a2/image-generator.js";
import { makeSpeechInstruction } from "../audio-generator/main.js";
import { makeVideoInstruction } from "../video-generator/main.js";
import { makeMusicInstruction } from "../music-generator/main.js";
import type { ModelConstraint } from "../agent/functions/generate.js";

export { invoke as default, describe };

type Inputs = {
  context?: LLMContent[];
  "generation-mode"?: string;
  [PROMPT_PORT]: LLMContent;
} & Record<string, unknown>;

type DescribeInputs = {
  inputs: Inputs;
  asType?: boolean;
};

type ResolvedModes = {
  modes: Mode[];
  current: Mode;
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
  /**
   * When true, the item does not appear in the drop-down. Useful when we want
   * to deprecate an item in the drop-down: still use it for existing values,
   * but stop showing it for new values.
   */
  hidden?: boolean;
  portMap: Map<string, string>;
  /**
   * The instruction to supply as a hint of user's intention.
   * This instruction is added to the overall objective of the step,
   */
  makeInstruction: (inputs: Record<string, unknown>) => string;
  /**
   * A model constraint, to narrow the kinds of models the agent can call
   * when in this mode.
   */
  modelConstraint: ModelConstraint;
};

const PROMPT_PORT = "config$prompt";
const ASK_USER_PORT = "config$ask-user";
const LIMIT_MSG = "generation has a daily limit";

const ALL_MODES: Mode[] = [
  {
    id: "agent",
    type: "text",
    url: "embed://a2/generate-text.bgl.json#daf082ca-c1aa-4aff-b2c8-abeb984ab66c",
    title: "Agent",
    description: "Agent can use any models",
    icon: "button_magic",
    modelName: "gemini-3-flash-preview",
    promptPlaceholderText:
      "Type your prompt here. Use @ to include other content.",
    portMap: new Map([
      [PROMPT_PORT, "description"],
      [ASK_USER_PORT, "p-chat"],
    ]),
    makeInstruction: makeTextInstruction({ pro: false }),
    modelConstraint: "none",
  },
  {
    id: "text-2.0-flash",
    type: "text",
    url: "embed://a2/generate-text.bgl.json#daf082ca-c1aa-4aff-b2c8-abeb984ab66c",
    title: "Gemini 2.0 Flash",
    description: "Older model, use sparingly",
    hidden: true,
    icon: "text_analysis",
    modelName: "gemini-2.0-flash",
    promptPlaceholderText:
      "Type your prompt here. Use @ to include other content.",
    portMap: new Map([
      [PROMPT_PORT, "description"],
      [ASK_USER_PORT, "p-chat"],
    ]),
    makeInstruction: makeTextInstruction({ pro: false }),
    modelConstraint: "text-flash",
  },
  {
    id: "text-3-flash",
    type: "text",
    url: "embed://a2/generate-text.bgl.json#daf082ca-c1aa-4aff-b2c8-abeb984ab66c",
    title: "Gemini 3 Flash",
    description: "Best for everyday tasks",
    icon: "text_analysis",
    modelName: "gemini-3-flash-preview",
    promptPlaceholderText:
      "Type your prompt here. Use @ to include other content.",
    portMap: new Map([
      [PROMPT_PORT, "description"],
      [ASK_USER_PORT, "p-chat"],
    ]),
    makeInstruction: makeTextInstruction({ pro: false }),
    modelConstraint: "text-flash",
  },
  {
    id: "text",
    type: "text",
    url: "embed://a2/generate-text.bgl.json#daf082ca-c1aa-4aff-b2c8-abeb984ab66c",
    title: "Gemini 2.5 Flash",
    description: "Good model for everyday tasks",
    icon: "text_analysis",
    modelName: "gemini-2.5-flash",
    promptPlaceholderText:
      "Type your prompt here. Use @ to include other content.",
    portMap: new Map([
      [PROMPT_PORT, "description"],
      [ASK_USER_PORT, "p-chat"],
    ]),
    makeInstruction: makeTextInstruction({ pro: false }),
    modelConstraint: "text-flash",
  },
  {
    id: "text-2.5-pro",
    type: "text",
    url: "embed://a2/generate-text.bgl.json#daf082ca-c1aa-4aff-b2c8-abeb984ab66c",
    title: "Gemini 2.5 Pro",
    description: "Good model for complex tasks",
    icon: "text_analysis",
    modelName: "gemini-2.5-pro",
    promptPlaceholderText:
      "Type your prompt here. Use @ to include other content.",
    portMap: new Map([
      [PROMPT_PORT, "description"],
      [ASK_USER_PORT, "p-chat"],
    ]),
    makeInstruction: makeTextInstruction({ pro: true }),
    modelConstraint: "text-pro",
  },
  {
    id: "text-3-pro",
    type: "text",
    url: "embed://a2/generate-text.bgl.json#daf082ca-c1aa-4aff-b2c8-abeb984ab66c",
    title: "Gemini 3 Pro",
    description: "Best for complex tasks",
    icon: "text_analysis",
    modelName: "gemini-3-pro-preview",
    promptPlaceholderText:
      "Type your prompt here. Use @ to include other content.",
    portMap: new Map([
      [PROMPT_PORT, "description"],
      [ASK_USER_PORT, "p-chat"],
    ]),
    makeInstruction: makeTextInstruction({ pro: true }),
    modelConstraint: "text-pro",
  },
  {
    id: "think",
    type: "think",
    url: "embed://a2/go-over-list.bgl.json#module:main",
    title: "Plan and Execute with Gemini 2.5 Flash",
    description: "Plans and executes complex tasks",
    icon: "spark",
    modelName: "gemini-2.5-flash",
    promptPlaceholderText:
      "Type your goal here. Use @ to include other content.",
    portMap: new Map([[PROMPT_PORT, "plan"]]),
    makeInstruction: makeGoOverListInstruction,
    modelConstraint: "none",
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
    portMap: new Map([[PROMPT_PORT, "query"]]),
    makeInstruction: makeDeepResearchInstruction,
    modelConstraint: "none",
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
    info: `Image ${LIMIT_MSG}`,
    portMap: new Map([[PROMPT_PORT, "instruction"]]),
    makeInstruction: makeImageInstruction({ pro: false }),
    modelConstraint: "image",
  },
  {
    id: "image",
    type: "image",
    url: "embed://a2/a2.bgl.json#module:image-editor",
    title: "Nano Banana",
    description: "For image editing and generation",
    icon: "photo_spark",
    modelName: "ai_image_tool",
    promptPlaceholderText:
      "Type your image prompt here. Use @ to include other content.",
    info: "Image generation has limited free quota",
    portMap: new Map([[PROMPT_PORT, "instruction"]]),
    makeInstruction: makeImageInstruction({ pro: false }),
    modelConstraint: "image",
  },
  {
    id: "image-pro",
    type: "image",
    url: "embed://a2/a2.bgl.json#module:image-editor",
    title: "Nano Banana Pro",
    description: "For complex visuals with text",
    icon: "photo_spark",
    modelName: "gemini-3-pro-image-preview",
    promptPlaceholderText:
      "Type your image prompt here. Use @ to include other content.",
    info: `Image ${LIMIT_MSG}`,
    portMap: new Map([[PROMPT_PORT, "instruction"]]),
    makeInstruction: makeImageInstruction({ pro: true }),
    modelConstraint: "image",
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
    info: `Audio ${LIMIT_MSG}`,
    portMap: new Map([[PROMPT_PORT, "text"]]),
    makeInstruction: makeSpeechInstruction,
    modelConstraint: "speech",
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
    info: `Video ${LIMIT_MSG}`,
    portMap: new Map([[PROMPT_PORT, "instruction"]]),
    makeInstruction: makeVideoInstruction,
    modelConstraint: "video",
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
    info: `Music ${LIMIT_MSG}`,
    portMap: new Map([[PROMPT_PORT, "text"]]),
    makeInstruction: makeMusicInstruction,
    modelConstraint: "music",
  },
] as const;

const AGENT_MODE_IDS = [
  "agent",
  "text-3-flash",
  "text-3-pro",
  "image",
  "image-pro",
  "audio",
  "video",
  "music",
];

const AGENT_MODES = ALL_MODES.filter(({ id }) => AGENT_MODE_IDS.includes(id));

const PRE_AGENT_MODES = ALL_MODES.filter(({ id }) => id !== "agent");

const modeMap = new Map(ALL_MODES.map((mode) => [mode.id, mode]));

// Maps the prompt port to various names of the other ports.
const portMapForward = new Map<string, Map<string, string>>(
  ALL_MODES.map((mode) => [mode.id, mode.portMap])
);

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
  mode: string,
  ports: T
): T {
  const forwardingMap = portMapForward.get(mode);
  if (!forwardingMap) return ports;
  return translate(ports, forwardingMap);
}

function receivePorts<T extends Record<string, unknown>>(
  mode: string,
  ports: T
): T {
  const reverseMap = portMapReverse.get(mode);
  if (!reverseMap) return ports;
  return translate(ports, reverseMap);
}

function resolveModes(
  modeId: string | undefined,
  flags: Readonly<RuntimeFlags> | undefined
): ResolvedModes {
  const modes = flags?.agentMode ? AGENT_MODES : PRE_AGENT_MODES;
  const defaultMode = modes[0];
  const current = modeMap.get(modeId || defaultMode.id) || defaultMode;
  return { modes, current };
}

async function invoke(
  { "generation-mode": mode, ...rest }: Inputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
) {
  const flags = await readFlags(moduleArgs);
  const { current } = resolveModes(mode, flags);

  if (flags?.agentMode) {
    if (current.id === "agent") {
      // Only "agent" mode gets full agentic behavior
      const agentInputs: AgentInputs = {
        "b-ui-consistent": false,
        "b-ui-prompt": { parts: [] },
        ...rest,
        "b-si-instruction": current.makeInstruction(rest),
        "b-si-constraint": current.modelConstraint,
      };
      return agent(agentInputs, caps, moduleArgs);
    } else {
      // Other modes dispatch directly to their board URLs
      const { url: $board, type, modelName } = current;
      if (modelName) {
        rest["p-model-name"] = modelName;
      }
      return caps.invoke({ $board, ...forwardPorts(type, rest) });
    }
  } else {
    const { url: $board, type, modelName } = current;
    // Model is treated as part of the Mode, but actually maps N:1
    // on actual underlying step type.
    if (modelName) {
      console.log(`Generating with ${modelName}`);
      rest["p-model-name"] = modelName;
    }
    return caps.invoke({ $board, ...forwardPorts(type, rest) });
  }
}

async function describe(
  { inputs: { "generation-mode": mode, ...rest }, asType }: DescribeInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
) {
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

  const flags = await readFlags(moduleArgs);

  const { current, modes } = resolveModes(mode, flags);
  const { url, type } = current;
  let modeSchema: Schema["properties"] = {};
  let behavior: Schema["behavior"] = [];
  const describing = await caps.describe({
    url,
    inputs: rest as InputValues,
  });
  if (ok(describing)) {
    modeSchema = receivePorts(
      type,
      describing.inputSchema.properties || modeSchema
    );
    behavior = describing.inputSchema.behavior || [];
  }
  if (flags?.agentMode && current.id === "agent") {
    const agentSchema = computeAgentSchema(flags, rest);
    modeSchema = { ...modeSchema, ...agentSchema };
    behavior = [...behavior];
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
          enum: modes,
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
