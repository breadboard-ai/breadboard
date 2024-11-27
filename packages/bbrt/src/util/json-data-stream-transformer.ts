/**
 * @license
 * Copyright 2024 Alexander Marks
 * SPDX-License-Identifier: Apache-2.0
 */

const DATA_PREFIX_LENGTH = "data:".length;
const D_BYTE = "d".charCodeAt(0);
const A_BYTE = "a".charCodeAt(0);
const T_BYTE = "t".charCodeAt(0);
const COLON_BYTE = ":".charCodeAt(0);
const NEWLINE_BYTE = "\n".charCodeAt(0);

function hasDataPrefix(chunk: Uint8Array): boolean {
  return (
    chunk.length >= 5 &&
    chunk[0] === D_BYTE &&
    chunk[1] === A_BYTE &&
    chunk[2] === T_BYTE &&
    chunk[3] === A_BYTE &&
    chunk[4] === COLON_BYTE
  );
}

export class JsonDataStreamTransformer<T> extends TransformStream<
  Uint8Array,
  T
> {
  #tail?: Uint8Array;
  #textDecoder = new TextDecoder();

  constructor() {
    super({
      transform: (chunk, controller) => this.#transform(chunk, controller),
      flush: (controller) => this.#flush(controller),
    });
  }

  #transform(
    chunk: Uint8Array,
    controller: TransformStreamDefaultController<T>
  ) {
    let lineStart = 0;
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] === NEWLINE_BYTE) {
        const tail = this.#tail;
        if (tail === undefined || tail.length === 0) {
          if (i !== lineStart) {
            this.#parse(chunk.subarray(lineStart, i), controller);
          }
        } else {
          const concat = new Uint8Array(tail.length + i - lineStart);
          concat.set(tail, 0);
          concat.set(chunk.subarray(lineStart, i), tail.length);
          this.#parse(concat, controller);
          this.#tail = undefined;
        }
        lineStart = i + 1;
      }
    }
    if (lineStart < chunk.length) {
      this.#tail = chunk.subarray(lineStart);
    }
  }

  #flush(controller: TransformStreamDefaultController<T>) {
    if (this.#tail !== undefined && this.#tail.length > 0) {
      this.#parse(this.#tail, controller);
    }
  }

  #parse(array: Uint8Array, controller: TransformStreamDefaultController<T>) {
    if (hasDataPrefix(array)) {
      const bytes = array.subarray(DATA_PREFIX_LENGTH);
      const text = this.#textDecoder.decode(bytes);
      if (!text.match(/^\s*\[DONE\]\s*$/)) {
        controller.enqueue(JSON.parse(text) as T);
      }
    } else {
      console.warn("Unknown data format", this.#textDecoder.decode(array));
    }
  }
}
