import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const BOARD_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/math.json";

try {
  const board = await Board.load(BOARD_URL, {
    kits: {
      "@google-labs/llm-starter": Starter,
    },
  });

  for await (const stop of board.run()) {
    switch (stop.type) {
      case "input":
        {
          stop.inputs = { text: "What is the square root of e?" };
        }
        break;
      case "output":
        {
          self.postMessage({
            type: "output",
            data: stop.outputs,
          });
        }
        break;
      case "beforehandler": {
        self.postMessage({
          type: "beforehandler",
          data: stop.node,
        });
      }
    }
  }
} catch (e) {
  const error = e as Error;
  self.postMessage(error.message);
}
