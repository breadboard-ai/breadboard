import {
  ScreenInput,
  UserEvent,
  LLMContent,
  GeminiOutputs,
  Invoke,
} from "../src/types.js";
import { MockCapabilities } from "./mock-capabilities.js";

export function findLastScreen(
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

export class TestHarness {
  #capabilities: MockCapabilities;
  #gamePromise: Promise<LLMContent>;

  constructor(app: Invoke) {
    this.#capabilities = new MockCapabilities();
    this.#gamePromise = app(this.#capabilities);
    this.#gamePromise.catch(() => {
      // Do nothing. This is expected when the test finishes.
    });
  }

  cannedResponse(request: LLMContent[], response: GeminiOutputs) {
    this.#capabilities.cannedResponse(request, response);
  }

  async next(events: UserEvent[]) {
    this.#capabilities.injectEvents(events);
    // Give the game loop a moment to process the event.
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  get history() {
    return this.#capabilities.getScreenHistory();
  }

  destroy() {
    this.#capabilities.destroy();
  }
}
