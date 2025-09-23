/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Screen, Prompt } from "../types";

export const spec = `
Create a game called "AI Slop or Not".

1.  **Start**: The application will first ask the user to provide a topic for image generation.
2.  **Initial Round**: Once the topic is submitted, the application will generate two images based on that topic.
3.  **Game Loop (10 Rounds)**:
    *   The user is presented with the two images and the current round number.
    *   The user must choose which of the two images is better (i.e., "not slop").
    *   The image that was *not* chosen (the "loser") is discarded.
    *   The image that was chosen (the "winner") advances to the next round. A counter for this image's "survival" is incremented.
    *   A new image is generated based on the original topic to compete against the previous round's winner.
    *   This continues for a total of 10 rounds.
4.  **End Game**: After 10 rounds, the game ends.
5.  **Winner Screen**: The application identifies the single image that survived the most rounds. This image is displayed to the user with a "Winner" message. The user is then given the option to play again.
`;

export const screens: Screen[] = [
  {
    screenId: "start_screen",
    description:
      "The initial screen where the user enters a topic for the image generation game.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    events: [
      {
        eventId: "start_game",
        description: "Starts the game with the provided topic.",
        outputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "The topic for the images to be generated.",
            },
          },
          required: ["topic"],
        },
      },
    ],
  },
  {
    screenId: "game_screen",
    description:
      "Displays two images for the user to choose from and shows the current round number.",
    inputSchema: {
      type: "object",
      properties: {
        roundNumber: {
          type: "number",
          description: "The current round number, from 1 to 10.",
        },
        imageA: {
          type: "string",
          description: "VFS path to the first image for comparison.",
        },
        imageB: {
          type: "string",
          description: "VFS path to the second image for comparison.",
        },
      },
      required: ["roundNumber", "imageA", "imageB"],
    },
    events: [
      {
        eventId: "choose",
        description: "Event fired when the user chooses their preferred image.",
        outputSchema: {
          type: "object",
          properties: {
            choice: {
              type: "string",
              enum: ["A", "B"],
              description:
                "The image chosen by the user, corresponding to imageA or imageB.",
            },
          },
          required: ["choice"],
        },
      },
    ],
  },
  {
    screenId: "winner_screen",
    description:
      "Displays the final winning image after 10 rounds of competition.",
    inputSchema: {
      type: "object",
      properties: {
        winnerText: {
          type: "string",
          description: "A celebratory message, like 'Winner!'",
        },
        winningImage: {
          type: "string",
          description: "VFS path to the image that survived the most rounds.",
        },
      },
      required: ["winnerText", "winningImage"],
    },
    events: [
      {
        eventId: "play_again",
        description:
          "Indicates the user wants to start a new game, returning them to the start screen.",
      },
    ],
  },
];

export const prompts: Prompt[] = [
  {
    name: "generate-image",
    description: "Generates an image based on a user-provided topic.",
    format: "image",
    arguments: [
      {
        name: "topic",
        description: "The subject for the image generation.",
        required: true,
      },
    ],
    value:
      "A vibrant, high-detail, artistic masterpiece digital painting of the following topic: {{topic}}. Cinematic lighting, epic composition, visually stunning.",
  },
];
