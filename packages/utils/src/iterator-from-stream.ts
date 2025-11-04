/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { iteratorFromStream };

/**
 * Takes a ReadableStream from fetch and turns it into an async iterator.
 *
 * @param source - ReadableStream to turn into an iterator
 * @returns
 */
function iteratorFromStream<T>(
  source: ReadableStream<Uint8Array<ArrayBuffer>>
): AsyncIterable<T> {
  let buffer = "";
  const decoder = new TextDecoder();

  const stream = source.pipeThrough(
    new TransformStream<Uint8Array<ArrayBuffer>, T>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (trimmedLine.length === 0 || trimmedLine.startsWith(":")) {
            continue;
          }

          if (trimmedLine.startsWith("data: ")) {
            const jsonString = trimmedLine.substring(6).trim();
            if (jsonString === "[DONE]") {
              continue;
            }

            try {
              const parsedObject = JSON.parse(jsonString) as T;
              controller.enqueue(parsedObject);
            } catch (e) {
              console.error("Failed to parse JSON chunk:", jsonString, e);
              controller.error(
                new Error(`Failed to parse JSON: ${jsonString}`)
              );
            }
          }
        }
      },
      flush(controller) {
        buffer += decoder.decode(undefined, { stream: false });

        const trimmedLine = buffer.trim();
        if (trimmedLine.startsWith("data: ")) {
          const jsonString = trimmedLine.substring(6).trim();
          if (jsonString.length > 0 && jsonString !== "[DONE]") {
            try {
              const parsedObject = JSON.parse(jsonString) as T;
              controller.enqueue(parsedObject);
            } catch (e) {
              console.error("Failed to parse final JSON chunk:", jsonString, e);
              controller.error(
                new Error(`Failed to parse final JSON: ${jsonString}`)
              );
            }
          }
        }
      },
    })
  );
  return {
    [Symbol.asyncIterator]: async function* () {
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) return;
          yield value;
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}
