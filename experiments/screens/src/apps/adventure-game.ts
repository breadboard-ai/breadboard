/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Screen } from "../types";

export const spec = `
Make a turn-based adventure game.

First
- user enters inspiration for the game
- the initial plot line of the game is generated, inventing the character and the story and the objective (the boon, in hero's journey terms) of the story.
- the user is presented with bio and picture of their character. To create a picture, a detailed text prompt of the character suitable for an image generation is generated as well.
- the user can decide to accept the character or re-generate a new one
- once the user accepts, the game begins

For each turn:
-  present the user with a generated picture of the scene that follows the plot of the game, along with:
   - brief text description of what is happening in the scene
   - four choices for the user on what they could do next
- the user makes a choice
- based on the choice the user made, update the plot of the game ensuring that there's a path to the boon for the user.

Once the user secures the boon, show a celebratory screen that includes a generated picture of the final scene and a text that describes that scene.`;

export const screens: Screen[] = [
  {
    screenId: "controls",
    description: "Displays game status and game controls",
    inputSchema: {
      type: "object",
      properties: {
        gameStatus: {
          type: "string",
          description:
            'A short sentence that describes current game status, like "Saving game state" or "Generating next turn"',
        },
      },
      required: ["gameStatus"],
    },
    events: [
      {
        eventId: "recap_game",
        description:
          "Indicates that the user requested to recap the game so far",
      },
    ],
  },
  {
    screenId: "game_recap",
    description: "Displays recap of the game so far",
    inputSchema: {
      type: "object",
      properties: {
        recap: {
          type: "string",
          description: "Recap of the game so far, in markdown",
        },
      },
      required: ["recap"],
    },
    events: [],
  },
  {
    screenId: "start_game",
    description:
      "Shows at the start of the game, allowing the user to specify the inspiration for the game or ask to generate the inspration.",
    inputSchema: {
      type: "object",
      properties: {
        generatedInspiration: {
          type: "string",
          description:
            "The optional generated inspiration for the game, provided upon user request",
        },
      },
    },
    events: [
      {
        eventId: "generate_inspiration",
        description:
          "Indicates that the user requested to generate an inspiration and pre-fill it for them",
      },
      {
        eventId: "start",
        description: "Indicates that the user chose to start the game",
        outputSchema: {
          type: "object",
          properties: {
            inspiration: {
              type: "string",
              description:
                "The inspiration for the game. Will be used to generate the character, the setting, and the initial plot of the game.",
            },
          },
          required: ["inspiration"],
        },
      },
    ],
  },
  {
    screenId: "choose_character",
    description:
      "Presents the user with a generated picture and bio of the character they will play, allowing the user to regenerate a different character until they find what they like.",
    inputSchema: {
      type: "object",
      properties: {
        bio: {
          type: "string",
          description: "The generated bio of the player's character",
        },
        picture: {
          type: "string",
          description:
            "The VFS path to generated picture of the player's character",
        },
      },
      required: ["bio", "picture"],
    },
    events: [
      {
        eventId: "regenerate",
        description: "Indicates that the user decided to regenerate the game",
      },
      {
        eventId: "choose",
        description: "Indicates taht the user chose the provided character",
      },
    ],
  },
  {
    screenId: "scene",
    description:
      "Show the user the current scene (aka the turn) of the game and allows the user to select one of four options for what to do next",
    inputSchema: {
      type: "object",
      properties: {
        image: {
          type: "string",
          description: "The VFS path to generated scene image",
        },
        text: {
          type: "string",
          description:
            "A brief description of what is happening in the scene to help the user orient and make the next choice",
        },
        choice1: {
          type: "string",
          description: "Text of the first choice for the user to select",
        },
        choice2: {
          type: "string",
          description: "Text of the second choice for the user to select",
        },
        choice3: {
          type: "string",
          description: "Text of the third choice for the user to select",
        },
        choice4: {
          type: "string",
          description: "Text of the fourth choice for the user to select",
        },
      },
      required: ["image", "text", "choice1", "choice2", "choice3", "choice4"],
    },
    events: [
      {
        eventId: "choose",
        description:
          "Indicates that the user has made their choice for this scene",
        outputSchema: {
          type: "object",
          properties: {
            choice: {
              type: "number",
              description: "The 1-based index of the choice (1, 2, 3, or 4)",
            },
          },
          required: ["choice"],
        },
      },
    ],
  },
  {
    screenId: "finale",
    description:
      "Show the user the final scene of the game and allows the user to start a new game",
    inputSchema: {
      type: "object",
      properties: {
        image: {
          type: "string",
          description: "The VFS path to generated scene image",
        },
        text: {
          type: "string",
          description:
            "A brief description of what is happening in the scene to help the user orient and make the next choice",
        },
      },
      required: ["image", "text"],
    },
    events: [
      {
        eventId: "restart",
        description: "Indicates that the user has decide to restart the game",
      },
    ],
  },
];
