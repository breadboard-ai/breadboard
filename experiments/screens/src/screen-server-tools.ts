import { FunctionDeclaration } from "./types";

export { tools };

const updateScreen: FunctionDeclaration = {
  name: "screens_update_screens",
  description: `Part of the screen server, which manages a set of pre-defined application screens and allows the application to render them and to obtain user inputs from those screens.

For best results, call \`screens_get_user_events\` prior to \`screens_update_screens\` to capture any events and then act on them to render the right screen. Combined together, \`screens_get_user_events\` and \`screens_update_screens\` form the rendering loop for the application UI.

This function Updates screens with specified ids. This call does not block on user input. To collect user input from the screen, call \`screens_get_user_events\`. To make updates more efficiens, multiple screens can be updated in a single call.`,
  parameters: {
    type: "object",
    properties: {
      screenInputs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            screenId: {
              type: "string",
              description: "The id of the screen to update",
            },
            inputs: {
              type: "object",
              description:
                "JSON object of the inputs. The shape of the JSON object must conform to the JSON schema specified in the screen definition's `inputSchema` property",
            },
          },
        },
      },
    },
  },
};

const getUserEvents: FunctionDeclaration = {
  name: "screens_get_user_events",
  description: `Part of the screen server, which manages a set of pre-defined application screens and allows the application to render them and to obtain user inputs from those screens.

For best results, call \`screens_get_user_events\` prior to \`screens_update_screens\` to capture any events and then act on them to render the right screen. Combined together, \`screens_get_user_events\` and \`screens_update_screens\` form the rendering loop for the application UI.

Gets the list of user events across all screens. Will block until it receives at least one user event. Accumulates and drains the queue of user events when called.`,
  parameters: {
    type: "object",
  },
  response: {
    type: "object",
    properties: {
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            screenId: {
              type: "string",
              description:
                "The id of the screen from which the event originated",
            },
            eventId: {
              type: "string",
              description: "The id of the event that was sent",
            },
            output: {
              type: "object",
              description:
                "Structured outputs emitted by event as a JSON object, conforming to the JSON schema specified `outputSchema` property of screen's definition",
            },
          },
          required: ["screenId", "eventId"],
        },
      },
    },
  },
};

const tools = [updateScreen, getUserEvents];
