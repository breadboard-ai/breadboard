import { expect } from "@playwright/test";

import { test, BreadboardTestHarness } from "./test-harness";

test("smoke test", async ({ harness }) => {
  await verifyMainPage(harness);
  await harness.newFlow();
  // Adding 2 simple steps.
  await harness.newUserInput({
    name: "USER_NAME",
    content: "What's your name?",
  });
  await harness
    .fromNode("USER_NAME")
    .newOutput({ content: ["Hello, ", harness.createRef("USER_NAME")] });
  // Now lets run the flow.
  await harness.run();
  expect(await harness.getOutputs()).toEqual(["What's your name?"]);
  await harness.writeResponse("Volodya");
  expect(await harness.getOutputs()).toEqual(["Hello, Volodya"]);

  // Simulate NL chat prompt.
  await harness.mockChatGenerateApp("{}");
  await harness.sendNL("an example app");
});

/** Checking the main page headings are present.  */
async function verifyMainPage(harness: BreadboardTestHarness) {
  await expect(harness.page).toHaveTitle("Breadboard [Dev]");
  expect(await harness.getHeadings()).toEqual([
    "Breadboard",
    "Build, edit and share mini-AI apps using natural language",
    "Your Flows",
    "Gallery",
  ]);
}
