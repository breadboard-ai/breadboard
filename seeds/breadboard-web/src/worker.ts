import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

type MailboxMessage = {
  id?: string;
};

export class Mailbox {
  boxes: Record<string, (value: unknown) => void> = {};
  worker: Worker;

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener("message", this.#onMessage.bind(this));
  }

  #onMessage(e: MessageEvent) {
    const message = e.data as MailboxMessage;
    if (!message.id) return;
    const resolve = this.boxes[message.id];
    if (!resolve) return;
    resolve(message);
  }

  async ask(data: unknown) {
    const id = Math.random().toString(36).substring(2, 9);
    this.worker.postMessage({ id, data });
    return new Promise((resolve) => {
      this.boxes[id] = resolve;
    });
  }
}

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
