import { Page, test as base } from "playwright/test";

export const test = base.extend<{harness: BreadboardTestHarness}>({
  harness: async ({ page }, use) => {
    await page.goto("/");
    await use(new BreadboardTestHarness(page));
  }
});

type HarnessFunction = (harness: BreadboardTestHarness) => Promise<void>;

interface NodeOptions {
  name?: string;
  content?: string|Array<string|HarnessFunction>;
}

export interface NodeHarness {
  newUserInput(options?: NodeOptions): Promise<void>;
  newDisplay(options?: NodeOptions): Promise<void>;
}

/** UI Testing harness that wraps playwright commands into higher level functions for common operations.  */
export class BreadboardTestHarness implements NodeHarness {
  // TODO(volodya): Split this into separate harnesses per page.
  constructor(
    public page: Page,
    private withContext?: Array<Promise<void>>
  ) {}

  async getHeadings() {
    const headings = await this.page.getByRole("heading").allInnerTexts();
    return headings.filter((h) => !!h);
  }

  async getButtonsTexts() {
    const buttons = await this.page.getByRole("button").allInnerTexts();
    // Adding more weird buttons such as "asset" to the list
    buttons.push(
      ...(await this.page.locator("css=button span.title").allInnerTexts())
    );
    // Run button.
    buttons.push(await this.page.getByTestId("run").innerText());
    // Icons - history and share.
    buttons.push(await this.page.getByLabel("Edit History").innerText());
    if ((await this.page.getByText("URL").count()) > 0) {
      buttons.push("Share");
    }
    return buttons;
  }

  async newFlow() {
    await this.page.getByText(/Create New/).click();
  }

  async saveNodeEdit() {
    // Very finicky - has to be clicked on the renderer, but not on any of the nodes in the graph,
    // otherwise we loose all the changes.
    await this.page.locator("bb-renderer").click({ position: { x: 1, y: 1 } });
  }

  /**
   * Fluent method that allows executing operations out of the context of a given node.
   *
   * Example usage:
   *
   * harness.fromNode('My node').newDisplay('My display); // The resulting display will be attached to 'My node'.
   *
   */
  fromNode(name: string): NodeHarness {
    return new BreadboardTestHarness(this.page, [
      this.page.locator("bb-graph-node header", { hasText: name }).click(),
    ]);
  }

  async newUserInput(options?: NodeOptions) {
    await this.waitForContext();
    await this.page.getByRole("button", { name: "User Input" }).click();
    await this.page.getByTestId("default-add").click();
    await this.setNodeName(options?.name);
    await this.addNodeContent("#editor", options?.content);
    await this.saveNodeEdit();
  }

  async newDisplay(options?: NodeOptions) {
    await this.waitForContext();
    await this.page.getByRole("button", { name: "Add Step" }).click();
    await this.page
      .getByRole("listitem")
      .filter({ hasText: "Display" })
      .click();
    await this.setNodeName(options?.name);
    await this.addNodeContent("#text #editor", options?.content);
    await this.saveNodeEdit();
  }

  async run() {
    if (
      (
        await this.page.locator("bb-app-preview").getAttribute("class")
      )?.indexOf("active") ??
      0 < 0
    ) {
      await this.page.getByRole("button", { name: "App view" }).click();
    }

    await this.page.getByRole("button", { name: "Start" }).click();
  }

  async getOutputs() {
    return this.page
      .getByTestId("activity")
      .locator("div.content span.value p")
      .allTextContents();
  }

  async writeResponse(response: string) {
    await this.page
      .getByRole("textbox", { name: "Type or upload your response." })
      .fill(response);
    await this.page.getByRole("button", { name: "Continue" }).click();
  }

  createRef(name: string): HarnessFunction {
    return async (harness: BreadboardTestHarness): Promise<void> => {
      await harness.page
        .getByTestId("text")
        .getByTestId("editor")
        .pressSequentially("@");
      await harness.page.getByRole("button", { name }).click();
    };
  }

  async waitForContext() {
    for (const context of this.withContext ?? []) {
      await context;
    }
    // Reset the context after it was all run.
    this.withContext = undefined;
  }

  private async setNodeName(name?: string) {
    if (name) {
      const title = this.page.getByTestId("node-title");
      await title.click();
      await title.fill(name);
    }
  }

  private async addNodeContent(
    editorLocatorStr: string,
    content?: string | Array<string | HarnessFunction>
  ) {
    if (content) {
      if (typeof content === "string") {
        content = [content];
      }
      const editor = this.page.locator(editorLocatorStr);
      await editor.click();
      await editor.fill("");
      for (const item of content) {
        if (typeof item === "string") {
          await editor.pressSequentially(item);
        } else {
          await item(this);
        }
      }
    }
  }
}