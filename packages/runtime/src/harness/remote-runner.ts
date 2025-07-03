/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type {
  AsRemoteMessage,
  HarnessRunner,
  HarnessRunResult,
  InputRemoteMessage,
  RemoteMessage,
  RemoteRunConfig,
  RunDiagnosticsLevel,
  RunEventTarget,
  SecretResult,
} from "@breadboard-ai/types";
import {
  GraphDescriptor,
  InputValues,
  InspectableRunObserver,
  Schema,
} from "@breadboard-ai/types";
import { chunkRepairTransform } from "@breadboard-ai/utils";
import { serverStreamEventDecoder } from "../remote/http.js";
import { timestamp } from "../timestamp.js";
import {
  EndEvent,
  GraphEndEvent,
  GraphStartEvent,
  InputEvent,
  NodeEndEvent,
  NodeStartEvent,
  OutputEvent,
  PauseEvent,
  ResumeEvent,
  RunnerErrorEvent,
  SkipEvent,
  StartEvent,
} from "./events.js";

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
        throw new Error(
          `Error transforming remote message: ${e}, message: ${chunk}`
        );
      }
    },
  });
};

export const emptyGraph = () => ({}) as GraphDescriptor;

export class HttpClient {
  #url: string;
  /**
   * The API key for the remote service.
   */
  #key: string;
  #diagnostics: RunDiagnosticsLevel;
  #fetch: FetchType | undefined;
  #writer: MessageConsumer;
  #fetching = false;
  #lastMessage: InputRemoteMessage | null = null;
  #signal: AbortSignal | null = null;

  constructor(
    url: string,
    key: string,
    diagnostics: RunDiagnosticsLevel,
    writer: MessageConsumer,
    signal: AbortSignal | null,
    fetch?: FetchType
  ) {
    this.#url = url;
    this.#key = key;
    this.#diagnostics = diagnostics;
    this.#writer = writer;
    this.#signal = signal;
    this.#fetch = fetch;
  }

  async #sendError(message: string) {
    await this.#writer([
      "graphstart",
      {
        path: [],
        timestamp: timestamp(),
        graph: emptyGraph(),
        graphId: "",
      },
    ]);

    await this.#writer(["error", { error: message, timestamp: timestamp() }]);

    await this.#writer([
      "graphend",
      {
        path: [],
        timestamp: timestamp(),
      },
    ]);
  }

  #createBody(inputs: InputValues): string {
    const body: InputValues = {
      ...inputs,
      $key: this.#key,
    };
    if (this.#lastMessage) {
      const [, , next] = this.#lastMessage;
      if (next) {
        body.$next = next;
      }
    }
    if (this.#diagnostics) {
      body.$diagnostics = this.#diagnostics;
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
    const response = await (this.#fetch ? this.#fetch : fetch)(this.#url, {
      method: "POST",
      body: this.#createBody(inputs),
    });
    this.#lastMessage = null;

    if (!response.ok) {
      await this.#sendError(`HTTP error: ${response.status}`);
    }

    await response.body
      ?.pipeThrough(new TextDecoderStream())
      .pipeThrough(chunkRepairTransform())
      .pipeThrough(serverStreamEventDecoder())
      .pipeThrough(remoteMessageTransform())
      .pipeTo(
        new WritableStream({
          write: async (message) => {
            this.#signal?.throwIfAborted();
            console.log(
              "%cServer-Sent Event",
              "background: #009; color: #FFF",
              message
            );
            const [type] = message;
            if (type === "input") {
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
  #abortSignal: AbortSignal | null = null;
  #fetch: FetchType;
  #error = false;

  constructor(config: RemoteRunConfig, fetch?: FetchType) {
    super();
    this.#config = config;
    this.#fetch = fetch || globalThis.fetch;
    this.#abortSignal = config.signal || null;
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
    console.warn("Secret keys are not sent over to the client.");
    return null;
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
    this.#client = new HttpClient(
      url,
      remote.key!,
      this.#config.diagnostics || false,
      async (message) => {
        await this.#processMessage(message);
      },
      this.#abortSignal,
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
          this.dispatchEvent(
            new PauseEvent(false, {
              timestamp: timestamp(),
            })
          );
        }
        break;
      }
      case "error": {
        this.dispatchEvent(new RunnerErrorEvent(data));
        this.#error = true;
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
    }
  }

  async run(inputs?: InputValues): Promise<boolean> {
    if (this.#error) {
      return true;
    }
    if (this.#abortSignal?.aborted) {
      this.#error = true;
      return true;
    }

    const starting = !this.#client;
    if (!this.#client) {
      this.#initializeClient();
    }

    const eventArgs = {
      inputs,
      timestamp: timestamp(),
    };

    this.dispatchEvent(
      starting ? new StartEvent(eventArgs) : new ResumeEvent(eventArgs)
    );

    return this.#client!.send(inputs || {});
  }
}
