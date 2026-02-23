/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorResponse, RunError } from "@breadboard-ai/types";
import type { ErrorMetadata } from "../types.js";
import { formatError } from "./format-error.js";
import { ActionTracker } from "../types.js";

export { decodeErrorData, trackError };

type Medium = {
  title: string;
  plural: string;
  singular: string;
};

const VIDEO_MEDIUM: Readonly<Medium> = {
  title: "Video",
  plural: "videos",
  singular: "video",
};

const TEXT_MEDIUM: Readonly<Medium> = {
  title: "Text",
  plural: "text",
  singular: "text",
};

const IMAGE_MEDIUM: Readonly<Medium> = {
  title: "Image",
  plural: "images",
  singular: "image",
};

const AUDIO_MEDIUM: Readonly<Medium> = {
  title: "Audio",
  plural: "audio",
  singular: "audio",
};

const POLICY_PREAMBLE =
  "This prompt might violate our policies about generating";

const NEW_PROMPT_POSTAMBLE = "Please try a different prompt or send feedback.";

const TRY_AGAIN_POSTAMBLE = "Please try again or send feedback.";

const TRY_LATER_POSTAMBLE = "Please try again later.";

function policy(type: string) {
  return `${POLICY_PREAMBLE} ${type} content.`;
}

// This is the shape of the error that AppCat serializes into error_message
type RichError = {
  code?: string;
  message: string;
  details?: string;
};

function maybeExtractRichError(s: string): RichError {
  try {
    return JSON.parse(s);
  } catch {
    return { message: s };
  }
}

/**
 * Pure function that decodes a raw error into a user-facing RunError.
 * No side effects — analytics tracking is handled separately by `trackError`.
 */
function decodeErrorData(
  error: ErrorResponse["error"],
  metadata?: ErrorMetadata
): RunError {
  metadata ??=
    (!(typeof error === "string") &&
      "metadata" in error &&
      (error.metadata as ErrorMetadata)) ||
    undefined;

  const richError = maybeExtractRichError(formatError(error));
  if (!metadata) {
    // Return simple message if there's no metadata.
    return { message: richError.message };
  }

  // Otherwise, create a rich message with details.
  const { kind = "unknown", reasons, model } = metadata;
  const medium = mediumFromModel(model);
  switch (kind) {
    case "unknown":
    case "bug": {
      return {
        message: `Something went wrong. ${TRY_AGAIN_POSTAMBLE}`,
        details: `${richError.message}\n\n${richError.details || ""}`,
        metadata,
      };
    }
    case "config": {
      return {
        message: richError.message,
        metadata,
      };
    }
    case "recitation": {
      return {
        message: `The generated ${medium.singular} was too similar to existing content. ${NEW_PROMPT_POSTAMBLE}`,
        metadata,
      };
    }
    case "capacity": {
      return {
        message: `The model currently is experiencing high demand. ${TRY_LATER_POSTAMBLE}`,
        metadata,
      };
    }
    case "free-quota-exhausted": {
      return {
        message: `You have reached the ${medium.singular} generation quota. To generate more ${medium.plural}, upgrade to a Google AI plan`,
        metadata,
      };
    }
    case "paid-quota-exhausted": {
      return {
        message: `You need more AI credits to generate more ${medium.plural}. To generate more ${medium.plural}, add AI credits to your account.`,
        metadata,
      };
    }
    case "safety": {
      const preamble = `No ${medium.plural} generated`;
      const reasonDescriptions =
        reasons?.map((reason) => {
          switch (reason) {
            case "child":
              return `${medium.title} generation with minors is not supported.`;
            case "celebrity":
              return `${medium.title} generation with prominent people is not supported.`;
            case "violence":
              return policy("violent");
            case "dangerous":
            case "hate":
              return policy("harmful");
            case "sexual":
              return policy("sexual");
            default:
              return policy("unsafe");
          }
        }) || [];
      if (reasonDescriptions.length === 0) {
        return {
          message: `${preamble}. ${policy("unsafe")} ${NEW_PROMPT_POSTAMBLE}`,
          metadata,
        };
      } else if (reasonDescriptions.length === 1) {
        // The most common case, just stuff it into the snack bar.
        return {
          message: `${preamble}. ${reasonDescriptions.at(0)} ${NEW_PROMPT_POSTAMBLE}`,
          metadata,
        };
      } else {
        return {
          message: `${preamble}.`,
          details: `${preamble} for the following reasons:\n\n ${reasonDescriptions.map((reason) => `- ${reason}`).join("\n")}`,
          metadata,
        };
      }
    }
    default: {
      return { message: richError.message, metadata };
    }
  }
}

/**
 * Tracks error analytics based on error metadata.
 * Separated from `decodeErrorData` to keep decoding pure.
 */
function trackError(
  actionTracker: ActionTracker | undefined,
  metadata: ErrorMetadata | undefined
): void {
  if (!actionTracker || !metadata) return;
  const medium = mediumFromModel(metadata.model);
  switch (metadata.kind) {
    case "unknown":
    case "bug":
      actionTracker.errorUnknown();
      break;
    case "config":
      actionTracker.errorConfig();
      break;
    case "recitation":
      actionTracker.errorRecitation();
      break;
    case "free-quota-exhausted": // TODO: Add separate tracking for free vs paid quota exhaustion.
    case "paid-quota-exhausted":
    case "capacity":
      actionTracker.errorCapacity(medium.singular);
      break;
    case "safety":
      actionTracker.errorSafety();
      break;
  }
}

function mediumFromModel(model?: string): Readonly<Medium> {
  const lc = model?.toLocaleLowerCase();
  if (lc) {
    if (lc.includes("veo")) return VIDEO_MEDIUM;
    if (lc.includes("image")) return IMAGE_MEDIUM;
    if (lc.includes("audio")) return AUDIO_MEDIUM;
  }
  return TEXT_MEDIUM;
}
