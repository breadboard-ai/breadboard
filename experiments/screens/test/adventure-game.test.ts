import { test } from "node:test";
import assert from "node:assert";
import { MockCapabilities } from "./mock-capabilities.js";
import adventureGame from "../out/adventure-game.js";
import { ScreenInput } from "../src/types.js";

test("adventure-game", async (t) => {
  const capabilities = new MockCapabilities();
  const gamePromise = adventureGame(capabilities);
  // We expect the game to throw an error when we destroy the capabilities.
  gamePromise.catch(() => {
    // Do nothing.
  });

  try {
    // Canned responses for character generation
    capabilities.cannedResponse(
      [
        {
          role: "user",
          parts: [
            {
              text: "Generate a one-sentence inspiration for a fantasy adventure game.",
            },
          ],
        },
      ],
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "A quest to find a lost city of gold.",
                },
              ],
            },
          },
        ],
      }
    );
    capabilities.cannedResponse(
      [
        {
          role: "user",
          parts: [
            {
              text: 'You are a master storyteller creating a new turn-based adventure game. The user\'s inspiration is: "A quest to find a lost city of gold.". Generate the initial setup: a compelling character, a rich world, and a clear objective (the \'boon\'). Respond with a JSON object matching the provided schema.',
            },
          ],
        },
      ],
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    plot: "The lost city of El Dorado is real...",
                    characterBio: "A daring explorer.",
                    characterImagePrompt: "An explorer.",
                  }),
                },
              ],
            },
          },
        ],
      }
    );
    capabilities.cannedResponse(
      [
        {
          role: "user",
          parts: [{ text: "An explorer." }],
        },
      ],
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  fileData: {
                    fileUri: "path/to/explorer.png",
                    mimeType: "image/png",
                  },
                },
              ],
            },
          },
        ],
      }
    );

    // Canned responses for the first turn
    capabilities.cannedResponse(
      [
        {
          role: "user",
          parts: [
            {
              text: 'You are the Dungeon Master for a turn-based adventure game.\n      **The Story So Far:**\n      The lost city of El Dorado is real...\n      **Character:**\n      A daring explorer.\n      **Player History:**\n      The adventure is just beginning.\n      Generate the next scene. It must logically follow the story and present the player with four meaningful, distinct choices. Respond with a JSON object matching the provided schema.',
            },
          ],
        },
      ],
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    sceneText: "You stand at the edge of a dense jungle.",
                    sceneImagePrompt: "A dense jungle.",
                    choices: ["Go left", "Go right", "Go straight", "Go back"],
                  }),
                },
              ],
            },
          },
        ],
      }
    );
    capabilities.cannedResponse(
      [
        {
          role: "user",
          parts: [{ text: "A dense jungle." }],
        },
      ],
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  fileData: {
                    fileUri: "path/to/jungle.png",
                    mimeType: "image/png",
                  },
                },
              ],
            },
          },
        ],
      }
    );

    // Canned responses for the second turn (leading to finale)
    capabilities.cannedResponse(
      [
        {
          role: "user",
          parts: [
            {
              text: 'You are the Dungeon Master, updating the story based on the player\'s actions.\n      **The Story So Far:**\n      The lost city of El Dorado is real...\n      **Current Scene:**\n      You stand at the edge of a dense jungle.\n      **Player\'s Choice:**\n      Go right\n      Now, write the next part of the story. Describe the outcome and advance the plot toward the objective. Determine if this action results in securing the boon. Respond with a JSON object matching the provided schema.',
            },
          ],
        },
      ],
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    updatedPlot:
                      "You follow a hidden path to the right and discover the city!",
                    boonSecured: true,
                  }),
                },
              ],
            },
          },
        ],
      }
    );
    capabilities.cannedResponse(
      [
        {
          role: "user",
          parts: [
            {
              text: 'You are the Dungeon Master. The player has won!\n      **Final Story State:**\n      You follow a hidden path to the right and discover the city!\n      **The Hero:**\n      A daring explorer.\n      Write the final, celebratory scene. Describe the hero\'s triumph. This is the epilogue. Respond with a JSON object matching the provided schema.',
            },
          ],
        },
      ],
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    finaleText: "You have found El Dorado!",
                    finaleImagePrompt: "The city of gold.",
                  }),
                },
              ],
            },
          },
        ],
      }
    );
    capabilities.cannedResponse(
      [
        {
          role: "user",
          parts: [{ text: "The city of gold." }],
        },
      ],
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  fileData: {
                    fileUri: "path/to/eldorado.png",
                    mimeType: "image/png",
                  },
                },
              ],
            },
          },
        ],
      }
    );

    await t.test("start game and generate inspiration", async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      capabilities.injectEvents([
        { screenId: "start_game", eventId: "generate_inspiration" },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 20));

      const history = capabilities.getScreenHistory();
      const startGame = findLastScreen(history, "start_game");
      assert(startGame, "start_game screen not found");
      assert.strictEqual(
        (startGame.inputs as { generatedInspiration: string })
          .generatedInspiration,
        "A quest to find a lost city of gold."
      );
    });

    await t.test("start and generate character", async () => {
      capabilities.injectEvents([
        {
          screenId: "start_game",
          eventId: "start",
          output: { inspiration: "A quest to find a lost city of gold." },
        },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 20));

      const history = capabilities.getScreenHistory();
      const chooseCharacter = findLastScreen(history, "choose_character");
      assert(chooseCharacter, "choose_character screen not found");
      const inputs = chooseCharacter.inputs as {
        bio: string;
        picture: string;
      };
      assert.strictEqual(inputs.bio, "A daring explorer.");
      assert.strictEqual(inputs.picture, "path/to/explorer.png");
    });

    await t.test("play through a turn", async () => {
      capabilities.injectEvents([
        { screenId: "choose_character", eventId: "choose" },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 20));

      const history = capabilities.getScreenHistory();
      const scene = findLastScreen(history, "scene");
      assert(scene, "scene screen not found");
      const inputs = scene.inputs as { text: string };
      assert.strictEqual(
        inputs.text,
        "You stand at the edge of a dense jungle."
      );
    });

    await t.test("reach the finale", async () => {
      capabilities.injectEvents([
        { screenId: "scene", eventId: "choose", output: { choice: 2 } },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 20));

      const history = capabilities.getScreenHistory();
      const finale = findLastScreen(history, "finale");
      assert(finale, "finale screen not found");
      const inputs = finale.inputs as { text: string };
      assert.strictEqual(inputs.text, "You have found El Dorado!");
    });
  } finally {
    capabilities.destroy();
  }
});

function findLastScreen(
  history: ScreenInput[][],
  screenId: string
): ScreenInput | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const update = history[i];
    const screen = update.find((item) => item.screenId === screenId);
    if (screen) {
      return screen;
    }
  }
  return null;
}
