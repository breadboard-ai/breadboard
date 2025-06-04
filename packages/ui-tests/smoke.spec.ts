import { expect } from "@playwright/test";

import { test, BreadboardTestHarness } from "./test-harness";

test("smoke test", async ({ harness }) => {
  await verifyMainPage(harness);
  await harness.newFlow();
  await verifyEditorButtons(harness);
  // Adding 2 simple steps.
  await harness.newUserInput({
    name: "USER_NAME",
    content: "What's your name?",
  });
  await harness
    .fromNode("USER_NAME")
    .newDisplay({ content: ["Hello, ", harness.createRef("USER_NAME")] });
  // Now lets run the flow.
  await harness.run();
  expect(await harness.getOutputs()).toEqual(["What's your name?"]);
  await harness.writeResponse("Volodya");
  expect(await harness.getOutputs()).toEqual(["Hello, Volodya"]);
});

/** Checking the main page headings are present.  */
async function verifyMainPage(harness: BreadboardTestHarness) {
  await expect(harness.page).toHaveTitle(/Breadboard - Flows/);
  expect(await harness.getHeadings()).toEqual([
    "Breadboards are mini AI apps anyone can build",
    "Your Flows",
    "Gallery",
  ]);
}

/** Checking for important interface buttons to be present. */
async function verifyEditorButtons(harness: BreadboardTestHarness) {
  const buttons = await harness.getButtonsTexts();
  const executedButtons: Array<string | RegExp> = [
    "Asset",
    "User Input",
    "Generate",
    "Display Output",
    "Edit Theme",
    "Console",
    "Zoom to fit",
    "Zoom in",
    "Zoom out",
    "history",
    "URL", // Share button
    /Start/,
  ];
  for (const expectedButton of executedButtons) {
    if (typeof expectedButton === "string") {
      expect(buttons, expectedButton).toContain(expectedButton);
    } else {
      expect(
        buttons.findIndex((button) => expectedButton.test(button)),
        expectedButton.toString()
      ).toBeGreaterThanOrEqual(0);
    }
  }
}
