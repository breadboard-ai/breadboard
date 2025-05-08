import { test, expect } from "@playwright/test";

import { BreadboardTestHarness } from "./test-harness";

test("smoke test", async ({ page }) => {
  const harness = new BreadboardTestHarness(page);
  await page.goto("/");
  await verifyMainPage(harness);
  await harness.newFlow();
  await verifyEditorButtons(harness);
  // Adding 2 simple steps.
  await harness.newUserInput({name: "USER_NAME", content: "What's your name?"});
  await harness
    .fromNode("USER_NAME")
    .newDisplay({content: ["Hello, ", harness.createRef("USER_NAME")]});
  // Now lets run the flow.
  await harness.run();
  expect(await harness.getOutputs()).toEqual(["What's your name?"]);
  await harness.writeResponse("Volodya");
  expect(await harness.getOutputs()).toEqual(["Hello, Volodya"]);
});

/** Checking the main page headings are present.  */
async function verifyMainPage(harness: BreadboardTestHarness) {
  await expect(harness.page).toHaveTitle(/Breadboard - Flows/);
  const headings = await harness.page.getByRole("heading").allInnerTexts();
  expect(headings.filter((h) => !!h)).toEqual([
    "Breadboards are mini AI apps anyone can build",
    "Your Flows",
    "Gallery",
  ]);
}

/** Checking for important interface buttons to be present. */
async function verifyEditorButtons(harness: BreadboardTestHarness) {
  const buttons = await harness.page.getByRole("button").allInnerTexts();
  for (const expectedButton of [
    "App view",
    "Activity",
    "User Input",
    "Generate",
    "Display",
    "Edit Theme",
    "Zoom to fit",
    "Zoom in",
    "Zoom out",
  ]) {
    expect(buttons, expectedButton).toContain(expectedButton);
  }

  // Ensuring weird "asset" button is present.
  expect(
    await harness.page.locator("css=button span.title").allInnerTexts()
  ).toContain("Asset");
  // Start button.
  expect(await harness.page.getByTestId("run").innerText()).toEqual("Start");

  // Icons - history and share.
  expect(await harness.page.getByLabel("Edit History").innerText()).toEqual(
    "history"
  );
  expect(await harness.page.getByText("URL").count()).toEqual(1); // Share button.
}
