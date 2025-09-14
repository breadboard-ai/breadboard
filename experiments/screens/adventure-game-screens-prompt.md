The following screens are defined for this program.

```typescript
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
```
