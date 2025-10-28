/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { PidginTranslator } from "./pidgin-translator";
import { StreamableReporter } from "../a2/output";
import { A2UIClientEventMessage } from "./a2ui/schemas";

export { AgentUI };

export type UserInputType =
  | "singleline-text"
  | "multiline-text"
  | "confirm"
  | "image"
  | "video";

export type UserResponse = {
  file_path?: string;
  text?: string;
};

export type RawUserResponse = {
  text: string;
};

class AgentUI {
  #reporter: StreamableReporter;
  #reportedStarted: Promise<Outcome<unknown>> | undefined;

  constructor(
    private readonly caps: Capabilities,
    private readonly translator: PidginTranslator
  ) {
    this.#reporter = new StreamableReporter(this.caps, {
      title: "A2UI",
      icon: "web",
    });
  }

  #start(): Promise<Outcome<unknown>> {
    if (!this.#reportedStarted) {
      this.#reportedStarted = this.#reporter.start();
    }
    return this.#reportedStarted;
  }

  async close() {
    await this.#start();
    return this.#reporter.close();
  }

  async renderUserInterface(payload: unknown) {
    await this.#start();
    return this.#reporter.sendA2UI("Render UI", payload, "web");
  }

  async awaitUserInput(): Promise<Outcome<A2UIClientEventMessage>> {
    return err(`I can't wait to learn how to wait on user's input!!!1`);
  }

  async requestUserInput(
    message: string,
    type: UserInputType
  ): Promise<Outcome<UserResponse>> {
    console.log("REQUEST USER INPUT");
    console.log("MESSAGE", message);
    console.log("TYPE", type);
    await this.caps.output({
      schema: {
        properties: { message: { type: "object", behavior: ["llm-content"] } },
      },
      message: this.translator.fromPidginString(message),
    });
    const response = (await this.caps.input({
      schema: {
        properties: { text: { type: "string", behavior: ["transient"] } },
      },
    })) as Outcome<RawUserResponse>;
    if (!ok(response)) return response;
    return response;
  }
}
