/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DataPart,
  FileDataPart,
  FunctionCallCapabilityPart,
  FunctionResponseCapabilityPart,
  InlineDataCapabilityPart,
  JSONPart,
  ListPart,
  LLMContent,
  NodeValue,
  OutputValues,
  StoredDataCapabilityPart,
  TextCapabilityPart,
} from "@breadboard-ai/types";
import {
  Chunk,
  DataCapability,
  DataPartTransformer,
  DataPartTransformType,
  Outcome,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";

// Helpers for handling DataCapability objects.

export function isImageURL(
  nodeValue: unknown
): nodeValue is { image_url: string } {
  if (typeof nodeValue !== "object" || !nodeValue) {
    return false;
  }

  return "image_url" in nodeValue;
}

export function isTextCapabilityPart(
  part: unknown
): part is TextCapabilityPart {
  if (typeof part !== "object" || part === null) return false;
  return "text" in part;
}

export function isFileDataCapabilityPart(part: unknown): part is FileDataPart {
  if (typeof part !== "object" || part === null) return false;
  return "fileData" in part;
}

export function isFunctionCallCapabilityPart(
  part: unknown
): part is FunctionCallCapabilityPart {
  if (typeof part !== "object" || part === null) return false;
  return "functionCall" in part;
}

export function isFunctionResponseCapabilityPart(
  part: unknown
): part is FunctionResponseCapabilityPart {
  if (typeof part !== "object" || part === null) return false;
  return "functionResponse" in part;
}

export function isJSONPart(part: unknown): part is JSONPart {
  if (typeof part !== "object" || part === null) return false;
  return "json" in part;
}

export function isListPart(part: unknown): part is ListPart {
  if (typeof part !== "object" || part === null) return false;
  return "list" in part;
}

export function isLLMContent(nodeValue: unknown): nodeValue is LLMContent {
  if (typeof nodeValue !== "object" || !nodeValue) return false;
  if (nodeValue === null || nodeValue === undefined) return false;

  return "parts" in nodeValue && Array.isArray(nodeValue.parts);
}

export function isLLMContentArray(
  nodeValue: unknown
): nodeValue is LLMContent[] {
  if (typeof nodeValue !== "object" || !nodeValue) return false;
  if (!Array.isArray(nodeValue)) return false;
  if (nodeValue === null || nodeValue === undefined) return false;

  nodeValue = nodeValue.filter((item) => {
    if (item === null || item === undefined) return false;
    return item.role !== "$metadata";
  });

  return (
    Array.isArray(nodeValue) && nodeValue.every((entry) => isLLMContent(entry))
  );
}

export function isMetadataEntry(nodeValue: LLMContent) {
  return nodeValue.role === "$metadata";
}

export const isDataCapability = (value: unknown): value is DataCapability => {
  if (typeof value !== "object" || value === null) return false;
  const data = value as DataCapability;
  if (data.kind !== "data") return false;
  if ("inlineData" in data) return true;
  if ("storedData" in data) return true;
  return false;
};

export const asBlob = async (
  part: InlineDataCapabilityPart | StoredDataCapabilityPart | Chunk
) => {
  let url: string;
  if (isStoredData(part)) {
    url = part.storedData.handle;
  } else if (isChunk(part)) {
    const { mimetype } = part;
    let { data } = part;
    if (mimetype.startsWith("text")) {
      data = btoa(data);
    }
    url = `data:${mimetype};base64,${data}`;
  } else {
    const { mimeType } = part.inlineData;
    let { data } = part.inlineData;
    if (mimeType.startsWith("text")) {
      data = btoa(data);
    }
    url = `data:${mimeType};base64,${data}`;
  }
  const response = await fetch(url);
  const data = await response.blob();
  return data;
};

export const isStoredData = (
  value: unknown
): value is StoredDataCapabilityPart => {
  if (typeof value !== "object" || value === null) return false;
  const data = value as DataCapability;
  if (!("storedData" in data)) return false;
  if (typeof data.storedData.handle !== "string") return false;
  return true;
};

export const isChunk = (value: unknown): value is Chunk => {
  if (typeof value !== "object" || value === null) return false;
  if (!("mimetype" in value)) return false;
  if (!("data" in value)) return false;
  return true;
};

export const isInlineData = (
  value: unknown
): value is InlineDataCapabilityPart => {
  if (typeof value !== "object" || value === null) return false;
  const data = value as DataCapability;
  if (!("inlineData" in data)) return false;
  if (typeof data.inlineData.data !== "string") return false;
  return true;
};

export const isSerializedData = (
  value: unknown
): value is InlineDataCapabilityPart => {
  if (typeof value !== "object" || value === null) return false;
  const data = value as DataCapability;
  if (!("inlineData" in data)) return false;
  if (!("handle" in data)) return false;
  if (typeof data.inlineData.data !== "string") return false;
  return true;
};

export async function asBase64(file: File | Blob): Promise<string> {
  if ("Buffer" in globalThis) {
    // Node.js implementation, since Node.js doesn't have FileReader.
    return Buffer.from(await file.arrayBuffer())
      .toString("base64")
      .replace(/=+$/, "");
  } else {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject("Reader result is not a string");
          return;
        }

        const [, content] = reader.result.split(",");
        resolve(content.replace(/=+$/, ""));
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }
}

export async function asBase64DataUrl(blob: Blob): Promise<string> {
  return `data:${blob.type};base64,${await asBase64(blob)}`;
}

export async function retrieveAsBlob(
  part: StoredDataCapabilityPart,
  graphUrl?: URL
): Promise<Blob> {
  if (!isStoredData(part)) {
    throw new Error("Invalid stored data");
  }

  let { handle } = part.storedData;
  if (handle.startsWith(".") && graphUrl) {
    handle = new URL(handle, graphUrl).href;
  } else {
    let url: URL | null = null;
    try {
      url = new URL(handle);
      if (!allowedBlobUrl(url)) {
        throw new Error(`Unknown stored data URL: ${url.href}`);
      }
    } catch {
      throw new Error("Invalid stored data URL");
    }
    handle = url.href;
  }
  const response = await fetch(handle);
  return await response.blob();

  function allowedBlobUrl(url: URL) {
    // Allow blob:/ URLs.
    if (url.protocol === "blob:") return true;
    // Allow drive:/ URLs
    if (url.protocol === "drive:") return true;
    // Allow board server URLs
    if (url.href.match(/https?:\/\/[^/]+\/board\/blobs\/([a-z0-9-]+)/)) {
      return true;
    }
    return false;
  }
}

export async function toInlineDataPart(
  part: StoredDataCapabilityPart,
  graphUrl?: URL
): Promise<InlineDataCapabilityPart> {
  const raw = await retrieveAsBlob(part, graphUrl);
  const mimeType = part.storedData.mimeType;
  let data;
  if (mimeType.startsWith("text/")) {
    data = await raw.text();
  } else {
    data = await asBase64(raw);
  }
  return { inlineData: { mimeType, data } };
}

export async function toStoredDataPart(
  part: InlineDataCapabilityPart | StoredDataCapabilityPart | Blob
): Promise<StoredDataCapabilityPart> {
  if (isStoredData(part)) {
    if (
      part.storedData.handle.startsWith("https://") ||
      part.storedData.handle.startsWith(".")
    ) {
      return part;
    }
  }
  const blob = part instanceof Blob ? part : await asBlob(part);
  const handle = URL.createObjectURL(blob);

  return {
    storedData: {
      handle,
      mimeType: blob.type,
    },
  };
}

async function transformPart(
  graphUrl: URL,
  part: DataPart,
  to: DataPartTransformType,
  transformer: DataPartTransformer
): Promise<Outcome<DataPart>> {
  if ("inlineData" in part) {
    if (to === "ephemeral") {
      // convert inline to ephemeral
      const blob = await asBlob(part);
      return transformer.addEphemeralBlob(blob);
    } else if (to === "persistent" || to === "persistent-temporary") {
      const temporary = to === "persistent-temporary";
      // convert inline to persistent
      return await transformer.persistPart(graphUrl, part, temporary);
    }
  } else if ("storedData" in part) {
    const isEphemeral = part.storedData.handle.startsWith("blob:");
    if (to === "ephemeral") {
      if (!isEphemeral) {
        // convert persistent to ephemeral
        return transformer.persistentToEphemeral(part);
      }
    } else if (to === "inline") {
      // convert persistent or ephemeral to inline
      return await toInlineDataPart(part);
    } else if (to == "persistent" || to === "persistent-temporary") {
      // convert ephemeral to persistent
      // We always start by trying to inline the data and then persisting
      // it.
      try {
        const inline = await toInlineDataPart(part);
        const temporary = to === "persistent-temporary";
        return await transformer.persistPart(graphUrl, inline, temporary);
      } catch (e) {
        return err((e as Error).message);
      }
    } else if (to === "file") {
      return transformer.toFileData(graphUrl, part);
    }
  } else if ("fileData" in part) {
    if (to === "file") {
      return transformer.toFileData(graphUrl, part);
    }
  }
  // Return original part.
  return part;
}

/**
 * Applies the mapper to the given values in parallel.
 * Returns outcome if any of the mapper has failed or the result array of mapped values.
 */
async function parallelApply<T>(
  values: Array<T>,
  mapper: (v: T) => Promise<Outcome<T>>
): Promise<Outcome<Array<T>>> {
  const results: Array<Outcome<Awaited<T>>> = await Promise.all(
    values.map(async (value) => {
      const mappedValue: Outcome<T> = await mapper(value);
      return mappedValue;
    })
  );
  // Check if any of the results is an error and if so - return it.
  for (const result of results) {
    if (!ok(result)) {
      return result;
    }
  }
  // Otherwise all are T.
  return results.map((result) => result as T);
}

async function transformContent(
  graphUrl: URL,
  content: LLMContent,
  to: DataPartTransformType,
  transformer: DataPartTransformer
): Promise<Outcome<LLMContent>> {
  const role = content.role || "user";
  const parts = await parallelApply<DataPart>(content.parts, (part) =>
    transformPart(graphUrl, part, to, transformer)
  );
  if (!ok(parts)) {
    return parts;
  }
  return { parts, role };
}

export async function transformDataParts(
  graphUrl: URL,
  contents: LLMContent[],
  to: DataPartTransformType,
  transformer: DataPartTransformer
): Promise<Outcome<LLMContent[]>> {
  return parallelApply<LLMContent>(contents, (content) =>
    transformContent(graphUrl, content, to, transformer)
  );
}

export function convertStoredPartsToAbsoluteUrls(
  values: OutputValues | undefined,
  graphUrl?: string
): OutputValues {
  const result: OutputValues = {};

  if (!graphUrl) return result;

  const url = parseUrl(graphUrl);

  for (const [key, value] of Object.entries(values || {})) {
    result[key] = convertValue(value);
  }
  return result;

  function convertValue(contents: NodeValue): NodeValue {
    const converted: LLMContent[] = [];
    if (!isLLMContentArray(contents)) return contents;

    for (const content of contents) {
      const role = content.role || "user";
      const parts: DataPart[] = [];
      for (const part of content.parts) {
        let convertedPart = part;
        if ("storedData" in part) {
          if (part.storedData.handle.startsWith(".")) {
            convertedPart = {
              storedData: {
                handle: new URL(part.storedData.handle, url).href,
                mimeType: part.storedData.mimeType,
              },
            };
          }
        }
        parts.push(convertedPart);
      }
      converted.push({ parts, role });
    }
    return converted as NodeValue;
  }
}

function parseUrl(s: string): URL | undefined {
  try {
    return new URL(s);
  } catch {
    return;
  }
}
