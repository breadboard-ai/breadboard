import { test } from "node:test";
import assert from "node:assert";
import { TestHarness, findLastScreen } from "./test-harness.js";
import adventureGame from "../out/adventure-game.js";
import { Invoke, Prompt, SchemaValidated } from "../src/types.js";
import { prompts } from "../src/apps/adventure-game.js";

const promptMap = new Map<string, Prompt>(
  prompts.map((prompt) => [prompt.id, prompt])
);

export const replacer = (
  value: string,
  substitutions: Record<string, SchemaValidated>
): string => {
  return value.replace(/{{(.*?)}}/g, (match, key) => {
    const parts = key.trim().split(".");
    let current: SchemaValidated | undefined = substitutions;
    for (const part of parts) {
      if (
        current &&
        typeof current === "object" &&
        !Array.isArray(current) &&
        part in current
      ) {
        current = current[part];
      } else {
        return match;
      }
    }
    return String(current);
  });
};

test("adventure-game", async (t) => {
  const harness = new TestHarness(adventureGame as unknown as Invoke);
  try {
    // Canned responses for character generation
    harness.cannedResponse(
      [
        {
          role: "user",
          parts: [
            {
              text: promptMap.get("generate-inspiration")?.value,
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
    harness.cannedResponse(
      [
        {
          role: "user",
          parts: [
            {
              text: replacer(
                promptMap.get("generate-plot-and-character")?.value || "",
                {
                  inspiration: "A quest to find a lost city of gold.",
                }
              ),
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
    harness.cannedResponse(
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
    harness.cannedResponse(
      [
        {
          role: "user",
          parts: [
            {
              text: replacer(promptMap.get("generate-next-turn")?.value || "", {
                plot: "The lost city of El Dorado is real...",
                character: {
                  bio: "A daring explorer.",
                },
                history: "The adventure is just beginning.",
              }),
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
    harness.cannedResponse(
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
    harness.cannedResponse(
      [
        {
          role: "user",
          parts: [
            {
              text: replacer(
                promptMap.get("update-plot-based-on-choice")?.value || "",
                {
                  plot: "The lost city of El Dorado is real...",
                  currentScene: {
                    text: "You stand at the edge of a dense jungle.",
                  },
                  choice: "Go right",
                }
              ),
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
    harness.cannedResponse(
      [
        {
          role: "user",
          parts: [
            {
              text: replacer(promptMap.get("generate-finale")?.value || "", {
                plot: "You follow a hidden path to the right and discover the city!",
                character: {
                  bio: "A daring explorer.",
                },
              }),
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
    harness.cannedResponse(
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
      await harness.next([
        { screenId: "start_game", eventId: "generate_inspiration" },
      ]);

      const startGame = findLastScreen(harness.history, "start_game");
      assert(startGame, "start_game screen not found");
      assert.strictEqual(
        (startGame.inputs as { generatedInspiration: string })
          .generatedInspiration,
        "A quest to find a lost city of gold."
      );
    });

    await t.test("start and generate character", async () => {
      await harness.next([
        {
          screenId: "start_game",
          eventId: "start",
          output: { inspiration: "A quest to find a lost city of gold." },
        },
      ]);

      const chooseCharacter = findLastScreen(
        harness.history,
        "choose_character"
      );
      assert(chooseCharacter, "choose_character screen not found");
      const inputs = chooseCharacter.inputs as {
        bio: string;
        picture: string;
      };
      assert.strictEqual(inputs.bio, "A daring explorer.");
      assert.strictEqual(inputs.picture, "path/to/explorer.png");
    });

    await t.test("play through a turn", async () => {
      await harness.next([{ screenId: "choose_character", eventId: "choose" }]);

      const scene = findLastScreen(harness.history, "scene");
      assert(scene, "scene screen not found");
      const inputs = scene.inputs as { text: string };
      assert.strictEqual(
        inputs.text,
        "You stand at the edge of a dense jungle."
      );
    });

    await t.test("reach the finale", async () => {
      await harness.next([
        { screenId: "scene", eventId: "choose", output: { choice: 2 } },
      ]);

      const finale = findLastScreen(harness.history, "finale");
      assert(finale, "finale screen not found");
      const inputs = finale.inputs as { text: string };
      assert.strictEqual(inputs.text, "You have found El Dorado!");
    });
  } finally {
    harness.destroy();
  }
});
