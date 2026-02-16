/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { llm } from "../src/a2/a2/utils.js";
import { A2ModuleArgs } from "../src/a2/runnable-module-factory.js";
import {
  defineFunction,
  mapDefinitions,
} from "../src/a2/agent/function-definition.js";
import {
  ChatChoice,
  ChatChoiceLayout,
  ChatChoiceSelectionMode,
  ChatChoicesResponse,
  ChatManager,
  ChatResponse,
  FunctionGroup,
  FunctionGroupConfigurator,
  VALID_INPUT_TYPES,
} from "../src/a2/agent/types.js";
import { Loop, LoopController } from "../src/a2/agent/loop.js";
import { tr } from "../src/a2/a2/utils.js";
import z from "zod";
import { taskIdSchema } from "../src/a2/agent/functions/system.js";

export { SimulatedUserChatManager, createSimulatedUserConfigurator };

const CHAT_REQUEST_USER_INPUT = "chat_request_user_input";
const CHAT_PRESENT_CHOICES = "chat_present_choices";

// -- ChatBridge: connects two concurrent agent loops --

type InteractionRequest = {
  type: "chat" | "choices";
  message: string;
  inputType?: string;
  choices?: ChatChoice[];
  selectionMode?: ChatChoiceSelectionMode;
};

/**
 * A bidirectional channel connecting the main agent loop and the
 * simulated user loop. Queues messages to handle timing differences.
 */
class ChatBridge {
  #messageQueue: (InteractionRequest | null)[] = [];
  #messageResolve: ((req: InteractionRequest | null) => void) | null = null;
  #responseResolve: ((response: string) => void) | null = null;
  #closed = false;

  /**
   * Agent side: send a message to the simulated user and wait for a response.
   */
  async exchange(request: InteractionRequest): Promise<string> {
    if (this.#closed) throw new Error("Bridge closed");

    // Deliver or queue the request
    if (this.#messageResolve) {
      this.#messageResolve(request);
      this.#messageResolve = null;
    } else {
      this.#messageQueue.push(request);
    }

    // Wait for response from simulated user
    return new Promise<string>((resolve) => {
      this.#responseResolve = resolve;
    });
  }

  /**
   * User side: wait for the next message from the agent.
   * Returns null when the bridge is closed.
   */
  async waitForMessage(): Promise<InteractionRequest | null> {
    if (this.#closed) return null;

    // Check queue first
    if (this.#messageQueue.length > 0) {
      return this.#messageQueue.shift()!;
    }

    // Wait for next message
    return new Promise<InteractionRequest | null>((resolve) => {
      this.#messageResolve = resolve;
    });
  }

  /**
   * User side: send a response back to the agent.
   */
  sendResponse(response: string): void {
    if (this.#responseResolve) {
      this.#responseResolve(response);
      this.#responseResolve = null;
    }
  }

  /**
   * Close the bridge, terminating any pending waits.
   */
  close(): void {
    this.#closed = true;
    if (this.#messageResolve) {
      this.#messageResolve(null);
      this.#messageResolve = null;
    }
  }
}

// -- SimulatedUserChatManager: owns a persistent Loop --

/**
 * A ChatManager backed by a persistent agent Loop. The simulated user
 * agent runs for the entire conversation, communicating with the main
 * agent through a ChatBridge.
 */
class SimulatedUserChatManager implements ChatManager {
  readonly #bridge = new ChatBridge();
  readonly #loopPromise: Promise<unknown>;

  constructor(userObjective: string, moduleArgs: A2ModuleArgs) {
    const loop = new Loop(moduleArgs);
    const functionGroups = buildUserAgentFunctionGroups(
      this.#bridge,
      loop.controller
    );

    const objective =
      llm`You are simulating a human user interacting with an AI assistant.

Your persona and goal: ${userObjective}

Your conversation flow:
1. Call "wait_for_agent_message" to receive the next message
2. Read the message and decide how to respond based on your persona
3. Call "respond_to_chat" for text responses, or "select_from_choices" for choice selections
4. Go back to step 1

Stay in character. Keep responses concise and natural. Do NOT explain that you are simulated.`.asContent();

    // Start the loop — it will immediately call wait_for_agent_message and block
    this.#loopPromise = loop.run({
      objective,
      functionGroups,
    });
  }

  async chat(
    pidginString: string,
    _inputType: string
  ): Promise<Outcome<ChatResponse>> {
    const response = await this.#bridge.exchange({
      type: "chat",
      message: pidginString,
    });
    return { input: { role: "user", parts: [{ text: response }] } };
  }

  async presentChoices(
    message: string,
    choices: ChatChoice[],
    selectionMode: ChatChoiceSelectionMode,
    _layout?: ChatChoiceLayout,
    _noneOfTheAboveLabel?: string
  ): Promise<Outcome<ChatChoicesResponse>> {
    const response = await this.#bridge.exchange({
      type: "choices",
      message,
      choices,
      selectionMode,
    });

    let selected: string[];
    try {
      selected = JSON.parse(response);
    } catch {
      // Fallback: try parsing comma-separated IDs
      const validIds = new Set(choices.map((c) => c.id));
      selected = response
        .split(/[,\n]/)
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter((id) => validIds.has(id));
      if (selected.length === 0) selected = [choices[0].id];
    }
    return { selected };
  }

  /**
   * Close the bridge and wait for the simulated user loop to terminate.
   */
  async close(): Promise<void> {
    this.#bridge.close();
    await this.#loopPromise.catch(() => {}); // Suppress termination errors
  }
}

// -- Inner configurator: mirror functions for the simulated user's Loop --

const userAgentInstruction = tr`
You are simulating a human user interacting with an AI assistant.

Your available functions form a conversation loop:

1. "wait_for_agent_message" — Receives the next message from the AI assistant. Always start here and always return here after responding.

2. "respond_to_chat" — Send a text response when the agent asks you a freeform question.

3. "select_from_choices" — Select from presented choices when the agent gives you options.

IMPORTANT: Always call "wait_for_agent_message" first, then respond, then call "wait_for_agent_message" again. Never call two response functions in a row.
`;

function buildUserAgentFunctionGroups(
  bridge: ChatBridge,
  controller: LoopController
): FunctionGroup[] {
  const functions = [
    defineFunction(
      {
        name: "wait_for_agent_message",
        title: "Waiting for message",
        icon: "hourglass_empty",
        description:
          "Wait for the next message from the AI assistant. Call this first and after each response.",
        parameters: {},
        response: {
          interaction_type: z
            .enum(["chat", "choices", "ended"])
            .describe(
              "Type of interaction: 'chat' for freeform, 'choices' for selection, 'ended' when conversation is over"
            ),
          message: z
            .string()
            .describe("The message from the AI assistant")
            .optional(),
          choices: z
            .string()
            .describe(
              "JSON-encoded array of {id, label} objects when interaction_type is 'choices'"
            )
            .optional(),
          selection_mode: z
            .string()
            .describe("'single' or 'multiple' for choice selection")
            .optional(),
        },
      },
      async () => {
        const request = await bridge.waitForMessage();
        if (request === null) {
          // Bridge closed — conversation ended, terminate the loop
          controller.terminate({
            success: true,
            href: "/",
            outcomes: undefined,
          });
          return { interaction_type: "ended" as const };
        }
        if (request.type === "chat") {
          return {
            interaction_type: "chat" as const,
            message: request.message,
          };
        }
        return {
          interaction_type: "choices" as const,
          message: request.message,
          choices: JSON.stringify(request.choices),
          selection_mode: request.selectionMode,
        };
      }
    ),

    defineFunction(
      {
        name: "respond_to_chat",
        title: "Responding",
        icon: "chat_bubble",
        description:
          "Send your text response to the AI assistant. Call wait_for_agent_message afterwards.",
        parameters: {
          response_text: z.string().describe("Your response as the user"),
        },
        response: {
          status: z
            .string()
            .describe("Confirmation that the response was sent"),
        },
      },
      async ({ response_text }) => {
        bridge.sendResponse(response_text);
        return { status: "sent" };
      }
    ),

    defineFunction(
      {
        name: "select_from_choices",
        title: "Selecting",
        icon: "list",
        description:
          "Select from the presented choices. Call wait_for_agent_message afterwards.",
        parameters: {
          selected_ids: z
            .array(z.string())
            .describe("The IDs of the choices you want to select"),
        },
        response: {
          status: z
            .string()
            .describe("Confirmation that the selection was sent"),
        },
      },
      async ({ selected_ids }) => {
        bridge.sendResponse(JSON.stringify(selected_ids));
        return { status: "sent" };
      }
    ),
  ];

  return [
    {
      ...mapDefinitions(functions),
      instruction: userAgentInstruction,
    },
  ] satisfies FunctionGroup[];
}

// -- Outer configurator: chat functions for the main agent --

const instruction = tr`

## Interacting with the User

Use the "${CHAT_PRESENT_CHOICES}" function when you have a discrete set of options for the user to choose from.

Use the "${CHAT_REQUEST_USER_INPUT}" function for freeform text input.

Prefer structured choices over freeform input when the answer space is bounded.

If the user input requires multiple entries, split the conversation into multiple turns.

`;

function createSimulatedUserConfigurator(
  chatManager: ChatManager
): FunctionGroupConfigurator {
  return async (_deps, _flags) => {
    const functions = [
      defineFunction(
        {
          name: CHAT_REQUEST_USER_INPUT,
          title: "Asking the user",
          icon: "chat_bubble",
          description: tr`Requests input from user. Each call corresponds to a conversation turn.`,
          parameters: {
            user_message: z
              .string()
              .describe(
                tr`Message to display to the user when requesting input.`
              ),
            input_type: z
              .enum(VALID_INPUT_TYPES)
              .describe(tr`Input type hint.`)
              .default("any"),
            ...taskIdSchema,
          },
          response: {
            user_input: z
              .string()
              .describe(`Response from the user`)
              .optional(),
            error: z
              .string()
              .describe(`Error description if one occurred`)
              .optional(),
          },
        },
        async ({ user_message, input_type }) => {
          const chatResponse = await chatManager.chat(user_message, input_type);
          if (!ok(chatResponse)) return { error: chatResponse.$error };
          const { input } = chatResponse;
          const text = input.parts
            ?.map((p) => ("text" in p ? p.text : ""))
            .join("");
          return { user_input: text || "" };
        }
      ),
      defineFunction(
        {
          name: CHAT_PRESENT_CHOICES,
          title: "Presenting Choices to the User",
          icon: "list",
          description: tr`Presents the user with choices to select from.`,
          parameters: {
            user_message: z
              .string()
              .describe(tr`Message explaining what the user should choose.`),
            choices: z
              .array(
                z.object({
                  id: z.string().describe(`Unique identifier for this choice`),
                  label: z.string().describe(`Display text for the choice`),
                })
              )
              .describe(`The choices to present`),
            selection_mode: z
              .enum(["single", "multiple"])
              .describe(tr`"single" for choose-one, "multiple" for any-of.`),
            layout: z
              .enum(["list", "row", "grid"])
              .optional()
              .default("list")
              .describe(tr`Layout hint for displaying choices.`),
            none_of_the_above_label: z
              .string()
              .optional()
              .describe(tr`If provided, adds a "none of the above" option.`),
            ...taskIdSchema,
          },
          response: {
            selected: z
              .array(z.string())
              .describe(`Array of selected choice IDs`)
              .optional(),
            error: z
              .string()
              .describe(`Error description if one occurred`)
              .optional(),
          },
        },
        async ({
          user_message,
          choices,
          selection_mode,
          layout,
          none_of_the_above_label,
        }) => {
          const choicesResponse = await chatManager.presentChoices(
            user_message,
            choices as ChatChoice[],
            selection_mode as ChatChoiceSelectionMode,
            layout as ChatChoiceLayout,
            none_of_the_above_label
          );
          if (!ok(choicesResponse)) return { error: choicesResponse.$error };
          return { selected: choicesResponse.selected };
        }
      ),
    ];

    return [{ ...mapDefinitions(functions), instruction }];
  };
}
