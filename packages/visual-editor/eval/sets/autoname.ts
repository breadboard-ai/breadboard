/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { session } from "../eval.js";
import { LLMContent } from "@breadboard-ai/types";
import { Arguments } from "../../src/a2/autoname/types.js";
import { ok, toJson } from "@breadboard-ai/utils";

function generateArgs(mode: string, text: string): LLMContent[] {
  const json: Arguments = {
    nodeConfigurationUpdate: {
      configuration: {
        config$prompt: {
          role: "user",
          parts: [
            {
              text,
            },
          ],
        },
        "generation-mode": mode,
      },
      type: "embed://a2/generate.bgl.json#module:main",
    },
  };
  return [{ parts: [{ json }] }];
}

session({ name: "Autoname" }, async (s) => {
  const autonamer = (await import("../../src/a2/autoname/main.js")).default;

  function evalAutonamingGenerate(title: string, mode: string, text: string) {
    s.eval(title, async ({ moduleArgs, caps, logger }) => {
      const context = generateArgs(mode, text);
      const result = await autonamer({ context }, caps, moduleArgs);
      if (!ok(result)) {
        logger.log({ type: "error", data: result.$error });
        return;
      }
      return toJson(result.context);
    });
  }

  evalAutonamingGenerate(
    "Image Edit",
    "image",
    `Combine these two:\n{{"type":"in","path":"594c2e3c-35f7-432d-a651-c2577682fb52","title":"Generate Apple Image"}}\n{{"type":"in","path":"fdb47e0f-04cf-45ac-b58b-5dfcb0c7db3e","title":"Generate Banana"}}`
  );

  evalAutonamingGenerate(
    "Spooky Tale Images",
    "image",
    '\n# Step by Step instructions\n1. Read the Spooky Story Text and Halloween Theme to understand the narrative and overall tone.\n2. Identify four key scenes or elements from the Spooky Story Text that would make  compelling illustrations.\n3. Think of a detailed visual description for each illustration, considering the Character and Action, Progression from the previous scene (if applicable), Shot and Setting, and Style and Mood, ensuring they align with the Halloween Theme.\n4. After coming up the description, check if all key scenes or elements from the Spooky Story Text have been covered with an illustration. If not, go back to step 2 and choose another scene, making sure to maintain visual consistency and narrative progression.\n5. Once all illustrations have been described, generate four images for each scene\n\nSpooky Story Text:\n"""\n{{"type":"in","path":"node_step_spooky_story_text","title":"Generate Spooky Story"}}\n"""\nHalloween Theme:\n"""\n{{"type":"in","path":"ask_user_halloween_theme","title":"Halloween Theme"}}\n"""\n'
  );

  evalAutonamingGenerate(
    "Music",
    "music",
    `Write a song inspired by the movement of {{"type":"in","path":"de20fa09-f236-4594-95f0-988737f294e2","title":"Animal"}}`
  );
});
