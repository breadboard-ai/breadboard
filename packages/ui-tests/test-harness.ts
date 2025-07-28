import { Locator, Page, test as base } from "playwright/test";

export const test = base.extend<{ harness: BreadboardTestHarness }>({
  harness: async ({ page }, use) => {
    await page.goto("/");
    await use(new BreadboardTestHarness(page));
  },
});

type HarnessFunction = (harness: BreadboardTestHarness) => Promise<void>;

interface NodeOptions {
  name?: string;
  content?: string | Array<string | HarnessFunction>;
}

export interface NodeHarness {
  newUserInput(options?: NodeOptions): Promise<void>;
  newOutput(options?: NodeOptions): Promise<void>;
}

/** UI Testing harness that wraps playwright commands into higher level functions for common operations.  */
export class BreadboardTestHarness implements NodeHarness {
  // TODO(volodya): Split this into separate harnesses per page.
  constructor(
    public page: Page,
    private withContext?: () => Promise<Locator | undefined>
  ) {}

  async getHeadings() {
    const headings = await this.page.getByRole("heading").allInnerTexts();
    return headings.filter((h) => !!h);
  }

  async newFlow() {
    await this.page.getByRole("button", { name: "Create New" }).click();
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
    return new BreadboardTestHarness(this.page, async () => {
      const node = this.page.locator("bb-graph-node header", { hasText: name });
      await node.click();
      return node;
    });
  }

  async newUserInput(options?: NodeOptions) {
    const context = await this.waitForContext();
    if (context) {
      await this.openConnection(context);
    }
    await this.page.getByRole("button", { name: "User Input" }).click();
    await this.setNodeName(options?.name);
    await this.addNodeContent("#editor", options?.content);
    await this.saveNodeEdit();
  }

  async newOutput(options?: NodeOptions) {
    const context = await this.waitForContext();
    let locator: Locator | Page = this.page;
    if (context) {
      await this.openConnection(context);
      locator = this.page.locator("bb-component-selector-overlay");
    }
    await locator
      .getByRole("listitem")
      .filter({ hasText: "Output" })
      .first()
      .click();
    await this.setNodeName(options?.name);
    await this.addNodeContent("#text #editor", options?.content);
    await this.saveNodeEdit();
  }

  async openConnection(locator?: Locator) {
    (locator ?? this.page)
      .getByRole("button", { name: "Connect to.." })
      .click();
  }

  async run() {
    await this.page.getByRole("button", { name: "Start" }).click();
    await this.waitForOutput();
  }

  async getLastOutput(): Promise<Locator> {
    return this.page
      .getByTestId("activity")
      .locator("particle-viewer-text section p")
      .filter({ visible: true })
      .last();
  }

  async getOutputs(): Promise<Array<string>> {
    return this.page
      .getByTestId("activity")
      .locator("particle-viewer-text section p")
      .filter({ visible: true })
      .allInnerTexts();
  }

  async writeResponse(response: string) {
    await this.page
      .getByRole("textbox", { name: "Type or upload your response." })
      .fill(response);
    await this.page.getByRole("button", { name: "send" }).click();
    await this.waitForOutput();
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
    if (!this.withContext) {
      return undefined;
    }
    return await this.withContext();
  }

  waitForOutput() {
    return this.page.waitForSelector("particle-viewer-text section p");
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
