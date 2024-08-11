/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { InspectableRunObserver } from "../inspector/types.js";
import { Schema, InputValues } from "../types.js";
import type {
  HarnessRunner,
  HarnessRunResult,
  RunEventTarget,
  SecretResult,
} from "./types.js";
import {
  chunkRepairTransform,
  serverStreamEventDecoder,
} from "../remote/http.js";
import type {
  AsRemoteMessage,
  InputRemoteMessage,
  RemoteMessage,
  RemoteRunConfig,
} from "../remote/types.js";
import {
  EndEvent,
  InputEvent,
  GraphEndEvent,
  GraphStartEvent,
  NodeEndEvent,
  NodeStartEvent,
  OutputEvent,
  RunnerErrorEvent,
  SecretEvent,
  SkipEvent,
  PauseEvent,
  ResumeEvent,
  StartEvent,
} from "./events.js";
import { timestamp } from "../timestamp.js";

export type SecretRemoteMessage = AsRemoteMessage<SecretResult>;

export type HarnessRemoteMessage = RemoteMessage | SecretRemoteMessage;

export type MessageConsumer = (message: HarnessRemoteMessage) => Promise<void>;

export type FetchType = typeof globalThis.fetch;

export const remoteMessageTransform = () => {
  return new TransformStream<string, HarnessRemoteMessage>({
    transform(chunk, controller) {
      try {
        const message = JSON.parse(chunk) as HarnessRemoteMessage;
        controller.enqueue(message);
      } catch (e) {
        throw new Error("Chunk parsing error.");
      }
    },
  });
};

export const now = () => ({ timestamp: timestamp() });

export class HttpClient {
  #url: string;
  /**
   * The API key for the remote service.
   */
  #key: string;
  #diagnostics: boolean;
  #fetch: FetchType;
  #writer: MessageConsumer;
  #fetching = false;
  #lastMessage: SecretRemoteMessage | InputRemoteMessage | null = null;

  constructor(
    url: string,
    key: string,
    diagnostics: boolean,
    writer: MessageConsumer,
    fetch: FetchType = globalThis.fetch
  ) {
    this.#url = url;
    this.#key = key;
    this.#diagnostics = diagnostics;
    this.#writer = writer;
    this.#fetch = fetch;
  }

  #createBody(inputs: InputValues): string {
    const body: InputValues = {
      ...inputs,
      $key: this.#key,
    };
    if (this.#lastMessage) {
      console.log("🌻 lastMessage in createBody", this.#lastMessage);
      const [, , next] = this.#lastMessage;
      if (next) {
        body.$next = next;
      }
    }
    if (this.#diagnostics) {
      body.$diagnostics = true;
    }
    return JSON.stringify(body);
  }

  fetching(): boolean {
    return this.#fetching;
  }

  lastMessage(): HarnessRemoteMessage | null {
    return this.#lastMessage;
  }

  async send(inputs: InputValues): Promise<boolean> {
    if (this.#fetching) {
      throw new Error("Fetch is already in progress.");
    }
    this.#fetching = true;
    const response = await this.#fetch(this.#url, {
      method: "POST",
      body: this.#createBody(inputs),
    });
    this.#lastMessage = null;

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    await response.body
      ?.pipeThrough(new TextDecoderStream())
      .pipeThrough(chunkRepairTransform())
      .pipeThrough(serverStreamEventDecoder())
      .pipeThrough(remoteMessageTransform())
      .pipeTo(
        new WritableStream({
          write: async (message) => {
            const [type] = message;
            if (type === "secret" || type === "input") {
              this.#lastMessage = message;
            }
            await this.#writer(message);
          },
          close: async () => {
            if (!this.#lastMessage && !this.#diagnostics) {
              await this.#writer(["end", { timestamp: timestamp() }]);
            }
          },
        })
      );

    this.#fetching = false;
    return this.#lastMessage === null;
  }
}

export class RemoteRunner
  extends (EventTarget as RunEventTarget)
  implements HarnessRunner
{
  #config: RemoteRunConfig;
  #client: HttpClient | null = null;
  #observers: InspectableRunObserver[] = [];
  #fetch: FetchType;

  constructor(config: RemoteRunConfig, fetch?: FetchType) {
    super();
    this.#config = config;
    this.#fetch = fetch || globalThis.fetch;
  }

  addObserver(observer: InspectableRunObserver): void {
    this.#observers.push(observer);
  }

  async #notifyObservers(result: HarnessRunResult) {
    for (const observer of this.#observers) {
      try {
        await observer.observe(result);
      } catch (e) {
        console.error("Observer failed to observe result", result, e);
      }
    }
  }

  running(): boolean {
    return this.#client?.fetching() || false;
  }

  secretKeys(): string[] | null {
    if (this.#client?.fetching()) {
      return null;
    }
    const message = this.#client?.lastMessage();
    if (!message || message[0] !== "secret") {
      return null;
    }
    return message[1].keys;
  }

  inputSchema(): Schema | null {
    if (this.#client?.fetching()) {
      return null;
    }
    const message = this.#client?.lastMessage();
    if (!message || message[0] !== "input") {
      return null;
    }
    return message[1].inputArguments.schema || null;
  }

  #initializeClient() {
    const remote = this.#config.remote;
    if (!remote) {
      throw new Error("Remote configuration isn't specified.");
    }
    if (remote.type !== "http") {
      throw new Error(`This runner only supports "http" remote configuration`);
    }
    const url = remote.url;
    if (!url) {
      throw new Error("Remote URL isn't specified.");
    }
    const key = remote.key;
    if (!key) {
      throw new Error("Remote API Key isn't specified.");
    }
    this.#client = new HttpClient(
      url,
      key,
      this.#config.diagnostics || false,
      async (message) => {
        await this.#processMessage(message);
      },
      this.#fetch
    );
  }

  async #processMessage(message: HarnessRemoteMessage) {
    const [type, data, next] = message;
    await this.#notifyObservers({
      type,
      data,
      async reply() {},
    } as HarnessRunResult);
    switch (type) {
      case "input": {
        const haveInputs = !next;
        this.dispatchEvent(new InputEvent(haveInputs, data));
        if (!haveInputs) {
          // When there are no inputs to consume, pause the run
          // and wait for the next input.
          this.dispatchEvent(new PauseEvent(false, now()));
        }
        break;
      }
      case "error": {
        this.dispatchEvent(new RunnerErrorEvent(data));
        break;
      }
      case "end": {
        this.dispatchEvent(new EndEvent(data));
        this.#client = null;
        break;
      }
      case "skip": {
        this.dispatchEvent(new SkipEvent(data));
        break;
      }
      case "graphstart": {
        this.dispatchEvent(new GraphStartEvent(data));
        break;
      }
      case "graphend": {
        this.dispatchEvent(new GraphEndEvent(data));
        break;
      }
      case "nodestart": {
        this.dispatchEvent(new NodeStartEvent(data));
        break;
      }
      case "nodeend": {
        this.dispatchEvent(new NodeEndEvent(data));
        break;
      }
      case "output": {
        this.dispatchEvent(new OutputEvent(data));
        break;
      }
      case "secret": {
        const haveInputs = !next;
        this.dispatchEvent(new SecretEvent(haveInputs, data));
        if (!haveInputs) {
          // When there are no inputs to consume, pause the run
          // and wait for the next input.
          this.dispatchEvent(new PauseEvent(false, now()));
          return false;
        }
        break;
      }
    }
    return false;
  }

  async run(inputs?: InputValues): Promise<boolean> {
    const starting = !this.#client;
    if (!this.#client) {
      this.#initializeClient();
    }

    this.dispatchEvent(
      starting ? new StartEvent(now()) : new ResumeEvent(now())
    );

    return this.#client!.send(inputs || {});
  }
}
