/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkItem } from "./types";
import { signal } from "signal-utils";
import {
  LLMContent,
  NodeEndResponse,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";
import { SignalMap } from "signal-utils/map";
import { InputResponse, OutputResponse, Schema } from "@google-labs/breadboard";
import { idFromPath, toLLMContentArray } from "./common";

export { ReactiveWorkItem };

const DEFAULT_OUTPUT_ICON = "responsive_layout";
const DEFAULT_OUTPUT_TITLE = "Output";

const DEFAULT_INPUT_ICON = "chat_mirror";

class ReactiveWorkItem implements WorkItem {
  @signal
  accessor end: number | null = null;

  @signal
  get awaitingUserInput() {
    return this.type === "input" && this.end === null;
  }

  schema?: Schema | undefined;
  product: Map<string, LLMContent> = new SignalMap();

  constructor(
    public readonly type: NodeTypeIdentifier,
    public readonly title: string,
    public readonly icon: string | undefined,
    public readonly start: number,
    public readonly chat: boolean
  ) {}

  static fromInput(
    data: InputResponse,
    start: number
  ): [string, ReactiveWorkItem] {
    const { path, node, inputArguments } = data;
    const { schema } = inputArguments;
    const id = idFromPath(path);
    const { type, metadata = {} } = node; // always "input"
    const { title = "Input", icon = DEFAULT_INPUT_ICON } = metadata;
    const item = new ReactiveWorkItem(type, title, icon, start, true);
    item.schema = schema;
    return [id, item];
  }

  static fromOutput(
    data: OutputResponse,
    start: number
  ): [string, ReactiveWorkItem] {
    const { path, node, outputs } = data;
    const { configuration = {}, metadata } = node;
    const { schema = {} } = configuration;
    const id = idFromPath(path);
    const { type } = node; // always "output"
    const title =
      metadata?.description || metadata?.title || DEFAULT_OUTPUT_TITLE;
    const icon = metadata?.icon || DEFAULT_OUTPUT_ICON;
    const { products, chat } = toLLMContentArray(schema as Schema, outputs);
    const item = new ReactiveWorkItem(type, title, icon, start, chat);
    for (const [name, product] of Object.entries(products)) {
      item.product.set(name, product);
    }
    return [id, item];
  }

  static completeInput(item: WorkItem, data: NodeEndResponse) {
    const { schema = {} } = item;
    const { products } = toLLMContentArray(schema, data.outputs);
    for (const [name, product] of Object.entries(products)) {
      item.product.set(name, product);
    }
  }
}
