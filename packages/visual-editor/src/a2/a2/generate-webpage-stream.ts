/**
 * @fileoverview Utilities to execute streaming webpage generation on the
 * AppCatalyst backend server.
 */

export { executeWebpageStream, buildStreamingRequestBody, parseStoredDataUrl };
export type { StreamingRequestBody, StreamChunk };

import {
  Capabilities,
  FileSystemReadWritePath,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import { iteratorFromStream } from "@breadboard-ai/utils";
import { getCurrentStepState, StreamableReporter } from "./output.js";
import { err, ok, progressFromThought, toLLMContentInline } from "./utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";

const DEFAULT_STREAM_BACKEND_ENDPOINT =
  "https://staging-appcatalyst.sandbox.googleapis.com/v1beta1/generateWebpageStream";

type StreamChunk = {
  parts?: Array<{
    text?: string;
    partMetadata?: {
      chunk_type?: string;
    };
  }>;
  role?: string;
};

type StreamingRequestPart = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  fileData?: { mimeType: string; fileUri: string };
  partMetadata?: { input_name: string };
};

type StreamingRequestBody = {
  intent: string;
  modelName: string;
  userInstruction: string;
  contents: Array<{
    parts: StreamingRequestPart[];
    role: string;
  }>;
  driveResourceKeys?: Record<string, string>;
};

async function getStreamBackendUrl(caps: Capabilities): Promise<string> {
  type BackendSettings = { endpoint_url: string };
  const reading = await caps.read({ path: "/env/settings/backend" });
  if (ok(reading)) {
    const part = reading.data?.at(0)?.parts?.at(0);
    if (part && "json" in part) {
      const settings = part.json as BackendSettings;
      if (settings?.endpoint_url) {
        // Extract base URL and append the streaming endpoint path
        const url = new URL(settings.endpoint_url);
        url.pathname = "/v1beta1/generateWebpageStream";
        return url.toString();
      }
    }
  }
  return DEFAULT_STREAM_BACKEND_ENDPOINT;
}

/**
 * Build the request body for the streaming API.
 *
 * TODO(jiayuhuang): Add support for passing previous output titles as input_name.
 * Currently using generic names (text_N, media_N). Need to update media generation
 * steps (image, audio, etc.) to include title metadata in their outputs, then
 * use that title here as the input_name for better tracking.
 */
function buildStreamingRequestBody(
  instruction: string,
  content: LLMContent[],
  modelName: string
): StreamingRequestBody {
  const contents: StreamingRequestBody["contents"] = [];
  const driveResourceKeys: StreamingRequestBody["driveResourceKeys"] = {};

  let textCount = 0;
  let mediaCount = 0;
  for (const val of content) {
    if (!val.parts) continue;
    for (const part of val.parts) {
      if ("text" in part) {
        textCount++;
        contents.push({
          parts: [
            {
              text: part.text,
              partMetadata: { input_name: `text_${textCount}` },
            },
          ],
          role: "user",
        });
      } else if ("inlineData" in part) {
        mediaCount++;
        contents.push({
          parts: [
            {
              inlineData: {
                mimeType: part.inlineData.mimeType,
                data: part.inlineData.data,
              },
              partMetadata: { input_name: `media_${mediaCount}` },
            },
          ],
          role: "user",
        });
      } else if ("storedData" in part) {
        mediaCount++;
        const handle = part.storedData.handle;
        const mimeType = part.storedData.mimeType;
        const resourceKey = part.storedData.resourceKey;
        if (resourceKey) {
          driveResourceKeys[handle] = resourceKey;
        }

        // Parse URL into appropriate fileUri format
        const fileUri = parseStoredDataUrl(handle);

        contents.push({
          parts: [
            {
              fileData: {
                mimeType,
                fileUri,
              },
              partMetadata: { input_name: `media_${mediaCount}` },
            },
          ],
          role: "user",
        });
      }
    }
  }

  const requestBody: StreamingRequestBody = {
    intent: "",
    modelName,
    userInstruction: instruction,
    contents,
  };
  if (Object.keys(driveResourceKeys).length > 0) {
    requestBody.driveResourceKeys = driveResourceKeys;
  }
  return requestBody;
}

/**
 * Parse a stored data URL into the appropriate fileUri format.
 * - Drive URLs -> drive://{drive_id}
 * - Blob URLs -> gs://{blob_id}
 * - Other URLs are passed through as-is
 */
function parseStoredDataUrl(handle: string): string {
  // Handle drive:/ prefix (internal format)
  if (handle.startsWith("drive:/")) {
    const driveId = handle.replace(/^drive:\/+/, "");
    return `drive://${driveId}`;
  }

  // Handle Google Drive preview URLs
  // e.g., https://drive.google.com/file/d/1yYlpqk_ClN4QBWA3xQ3FXC7m5K7ZQrou/preview
  const driveMatch = handle.match(
    /https?:\/\/drive\.google\.com\/file\/d\/([^/]+)/
  );
  if (driveMatch) {
    return `drive://${driveMatch[1]}`;
  }

  // Handle blob URLs
  // e.g., http://guest.localhost:3000/board/blobs/10b58671-0026-45d5-a734-39c6c8a22b2c
  const blobMatch = handle.match(/\/board\/blobs\/([^/?#]+)/);
  if (blobMatch) {
    return `gs://${blobMatch[1]}`;
  }

  // Pass through other URLs as-is
  return handle;
}

/**
 * Execute a streaming webpage generation request.
 */
async function executeWebpageStream(
  caps: Capabilities,
  moduleArgs: A2ModuleArgs,
  instruction: string,
  content: LLMContent[],
  modelName: string
): Promise<Outcome<LLMContent>> {
  const reporter = new StreamableReporter(moduleArgs, {
    title: `Generating webpage with ${modelName}`,
    icon: "web",
  });

  const { appScreen } = getCurrentStepState(moduleArgs);

  try {
    await reporter.sendUpdate("Preparing request", { modelName }, "upload");

    if (appScreen) appScreen.progress = "Generating HTML";

    const baseUrl = await getStreamBackendUrl(caps);
    const url = new URL(baseUrl);
    url.searchParams.set("alt", "sse");

    const requestBody = buildStreamingRequestBody(
      instruction,
      content,
      modelName
    );

    // Record model call with action tracker
    caps.write({
      path: `/mnt/track/call_${modelName}` as FileSystemReadWritePath,
      data: [],
    });

    const response = await moduleArgs.fetchWithCreds(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: moduleArgs.context.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return reporter.sendError(
        err(`Streaming request failed: ${response.status} ${errorText}`)
      );
    }

    if (!response.body) {
      return reporter.sendError(err("No response body from streaming API"));
    }

    // Process the SSE stream
    let htmlResult = "";
    let thoughtCount = 0;

    for await (const chunk of iteratorFromStream<StreamChunk>(response.body)) {
      if (!chunk.parts) continue;

      for (const part of chunk.parts) {
        const chunkType = part.partMetadata?.chunk_type;
        const text = part.text || "";

        if (chunkType === "thought") {
          thoughtCount++;

          if (appScreen) {
            appScreen.progress = progressFromThought(text);
            appScreen.expectedDuration = -1;
          }

          await reporter.sendUpdate(
            `Thinking (${thoughtCount})`,
            text,
            "spark"
          );
        } else if (chunkType === "html") {
          htmlResult = text;
          await reporter.sendUpdate(
            "Generated HTML",
            "HTML output ready",
            "download"
          );
        } else if (chunkType === "error") {
          return reporter.sendError(err(`Generation error: ${text}`));
        }
      }
    }

    if (!htmlResult) {
      return reporter.sendError(err("No HTML content received from stream"));
    }

    // Return HTML as inlineData with text/html mimeType to match legacy behavior
    return toLLMContentInline("text/html", htmlResult, "model");
  } catch (e) {
    return reporter.sendError(err((e as Error).message));
  } finally {
    if (appScreen) {
      appScreen.progress = undefined;
      appScreen.expectedDuration = -1;
    }
    reporter.close();
  }
}
