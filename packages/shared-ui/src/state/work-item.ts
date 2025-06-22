/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkItem } from "./types";
import { signal } from "signal-utils";
import {
  FileDataPart,
  LLMContent,
  NodeEndResponse,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";
import { Signal } from "signal-polyfill";
import { SignalMap } from "signal-utils/map";
import {
  FileSystem,
  FileSystemPath,
  InputResponse,
  ok,
  OutputResponse,
  Schema,
} from "@google-labs/breadboard";
import { idFromPath, toJson, toLLMContentArray } from "./common";
import { DataParticle, Particle, TextParticle } from "@breadboard-ai/particles";

export { ReactiveWorkItem };

const DEFAULT_OUTPUT_ICON = "responsive_layout";
const DEFAULT_OUTPUT_TITLE = "Output";

const DEFAULT_INPUT_ICON = "chat_mirror";

const now = new Signal.State(performance.now());

setInterval(() => now.set(performance.now()), 500);

class ReactiveWorkItem implements WorkItem {
  @signal
  accessor end: number | null = null;

  @signal
  get elapsed(): number {
    const end = this.end ?? now.get();
    return end - this.start;
  }

  @signal
  get awaitingUserInput() {
    return this.type === "input" && this.end === null;
  }

  schema?: Schema | undefined;
  product: Map<string, LLMContent | Particle> = new SignalMap();

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
    fileSystem: FileSystem | undefined,
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
    const { products, chat, particleMode } = toLLMContentArray(
      schema as Schema,
      outputs
    );
    let item: ReactiveWorkItem;
    if (particleMode) {
      if (!fileSystem) {
        console.warn(
          "Particle emitted, but no file system was provided, ignoring"
        );
      } else {
        const part = Object.values(products).at(0)!.parts.at(0) as FileDataPart;
        item = new ParticleWorkItem(
          type,
          title,
          icon,
          start,
          chat,
          fileSystem,
          part
        );
        return [id, item];
      }
    }
    item = new ReactiveWorkItem(type, title, icon, start, chat);
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

// This is a hack to mashall the data over the sandbox boundary.
// TODO: Make this a series of updates, rather than snapshot-based.
type SerializedParticle = TextParticle | DataParticle | SerializedGroupParticle;

type SerializedGroupParticle = [key: string, value: SerializedParticle][];

function toParticle(serialized: SerializedParticle): Particle {
  return convert(serialized);

  function convert(serialized: SerializedParticle): Particle {
    if ("text" in serialized) return serialized;
    if ("data" in serialized) return serialized;
    if ("group" in serialized && Array.isArray(serialized.group)) {
      const group = new Map<string, Particle>();
      for (const [key, value] of serialized.group) {
        group.set(key, convert(value));
      }
      return { ...serialized, group };
    }
    console.warn("Unrecognized serialized particle", serialized);
    return { text: "Unrecognized serialized particle" };
  }
}

class ParticleWorkItem implements WorkItem {
  @signal
  accessor end: number | null = null;

  @signal
  get elapsed(): number {
    const end = this.end ?? now.get();
    return end - this.start;
  }

  readonly awaitingUserInput = false;

  product: Map<string, LLMContent | Particle> = new SignalMap();

  constructor(
    public readonly type: NodeTypeIdentifier,
    public readonly title: string,
    public readonly icon: string | undefined,
    public readonly start: number,
    public readonly chat: boolean,
    private readonly fileSystem: FileSystem,
    part: FileDataPart
  ) {
    this.#start(part);
  }

  async #start(part: FileDataPart) {
    const path = part.fileData.fileUri as FileSystemPath;

    const readingStart = await this.fileSystem.read({ path });
    if (!ok(readingStart)) {
      console.warn(
        `Failed to read start of streamable report`,
        readingStart.$error
      );
      return;
    }
    if (toJson(readingStart.data) !== "start") {
      console.warn(
        `Invalid start sequence of streamable report`,
        readingStart.data
      );
      return;
    }

    for (;;) {
      const reading = await this.fileSystem.read({ path });
      if (!ok(reading)) {
        console.warn(`Failed to read from streamable report`, reading.$error);
        return;
      }
      if ("done" in reading && reading.done) {
        // We're done, yay!
        this.end = performance.now();
        return;
      }
      // TODO: Keys should be supplied by the report provider.
      const key = `${this.product.size + 1}`;
      const particle = toJson(reading.data) as SerializedParticle;
      if (!particle) {
        console.warn(`Invalid streamable report`, reading.data);
        continue;
      }
      this.product.set(key, toParticle(particle));
    }
  }
}
