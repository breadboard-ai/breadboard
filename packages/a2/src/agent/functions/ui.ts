/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v0_8 } from "@breadboard-ai/a2ui";
import { GeminiSchema } from "../../a2/gemini";
import { UI_SCHEMA } from "../../a2/render-consistent-ui";
import { tr } from "../../a2/utils";
import {
  defineFunction,
  defineFunctionLoose,
  FunctionDefinition,
} from "../function-definition";
import { A2UIClientEventParameters } from "../a2ui/schemas";
import { AgentUI } from "../ui";

export { defineA2UIFunctions };

const UI_RENDER_FUNCTION = "ui_render_user_interface";
const UI_AWAIT_USER_FUNCTION = "ui_await_user_input";

export type A2UIFunctionArgs = {
  ui: AgentUI;
};

function defineA2UIFunctions(args: A2UIFunctionArgs): FunctionDefinition[] {
  const serverSchema: GeminiSchema = {
    type: "object",
    properties: { messages: { type: "array", items: UI_SCHEMA } },
  };

  return [
    defineFunctionLoose(
      {
        name: UI_RENDER_FUNCTION,
        description: tr`

Allows to dynamically construct and update the user interface. This function
is best used in conjuction with "${UI_AWAIT_USER_FUNCTION}". First, use the
"${UI_RENDER_FUNCTION}" to create the UI, then call "${UI_AWAIT_USER_FUNCTION}"
to get user's response. The "${UI_RENDER_FUNCTION}" may be call multiple
times to update the UI without being blocked on the user response.

`,
        parametersJsonSchema: serverSchema,
        responseJsonSchema: {
          type: "object",
          properties: { success: { type: "boolean" } },
        },
      },
      async ({ messages }) => {
        console.log(`A2UI MESSAGES`, messages);
        args.ui.renderUserInterface(
          messages as v0_8.Types.ServerToClientMessage[]
        );
        return { success: true };
      },
      () => "Designing User Interface"
    ),
    defineFunction(
      {
        name: UI_AWAIT_USER_FUNCTION,
        description: tr`

Awaits user's response. The response will be one of the actions that were
specified in the UI, rendered with "${UI_RENDER_FUNCTION}".

`,
        parameters: {},
        response: A2UIClientEventParameters,
      },
      async () => {
        return args.ui.awaitUserInput();
      },
      () => "Processing user input"
    ),
  ];
}
