/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorResponse, RunErrorEvent } from "@breadboard-ai/types";
import { ErrorMetadata, RunError } from "../types";
import { formatError } from "../../utils/format-error";
import { ActionTracker } from "../../utils/action-tracker";

export { decodeError, decodeErrorData };

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
  "This prompt might volate our policies about generating";

const NEW_PROMPT_POSTAMBLE = "Please try a different prompt or send feedback.";

const TRY_AGAIN_POSTAMBLE = "Please try again or send feedback.";

const TRY_LATER_POSTAMBLE = "Please try again later.";

function policy(type: string) {
  return `${POLICY_PREAMBLE} ${type} content.`;
}

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

function decodeErrorData(error: ErrorResponse["error"]) {
  const metadata =
    !(typeof error === "string") &&
    "metadata" in error &&
    (error.metadata as ErrorMetadata);

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
      ActionTracker.errorUnknown();
      return {
        message: `Something went wrong. ${TRY_AGAIN_POSTAMBLE}`,
        details: `${richError.message}\n\n${richError.details || ""}`,
      };
    }
    case "config": {
      ActionTracker.errorConfig();
      return {
        message: richError.message,
      };
    }
    case "recitation": {
      ActionTracker.errorRecitation();
      return {
        message: `The generated ${medium.singular} was too similar to existing content. ${NEW_PROMPT_POSTAMBLE}`,
      };
    }
    case "capacity": {
      ActionTracker.errorCapacity(medium.singular);
      return {
        message: `No ${medium.plural} generated. Opal has limited quota and it was exceeded. ${TRY_LATER_POSTAMBLE}`,
      };
    }
    case "safety": {
      ActionTracker.errorSafety();
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
        };
      } else if (reasonDescriptions.length === 1) {
        // The most common case, just stuff it into the snack bar.
        return {
          message: `${preamble}. ${reasonDescriptions.at(0)} ${NEW_PROMPT_POSTAMBLE}`,
        };
      } else {
        return {
          message: `${preamble}.`,
          details: `${preamble} for the following reasons:\n\n ${reasonDescriptions.map((reason) => `- ${reason}`).join("\n")}`,
        };
      }
    }
  }
}

function decodeError(event: RunErrorEvent): RunError {
  return decodeErrorData(event.data.error);
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
