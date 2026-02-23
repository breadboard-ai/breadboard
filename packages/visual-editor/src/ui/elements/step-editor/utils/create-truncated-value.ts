/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectablePort } from "@breadboard-ai/types";
import { Template } from "@breadboard-ai/utils";
import {
  isConfigurableBehavior,
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../../../utils/schema/behaviors.js";
import { summarizeLLMContentValue } from "../../../../utils/summarize-llm-content.js";

export { truncateString, createTruncatedValue };

const TOTAL_STRING_LENGTH = 150;
const SUBSTRING_SUFFIX = "... ";
const SUBSTRING_LIMIT = TOTAL_STRING_LENGTH - SUBSTRING_SUFFIX.length;

function truncateString(s: string): string {
  if (s.length < TOTAL_STRING_LENGTH) return s;

  try {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "sentence",
    });
    const segments = segmenter.segment(s);

    let result = "";

    for (const { segment } of segments) {
      if ((result + segment).length <= SUBSTRING_LIMIT) {
        result += segment;
      } else {
        break;
      }
    }

    if (result.length === 0) {
      const wordSegmenter = new Intl.Segmenter(undefined, {
        granularity: "word",
      });
      const words = wordSegmenter.segment(s.substring(0, SUBSTRING_LIMIT));

      for (const { segment } of words) {
        if ((result + segment).length <= SUBSTRING_LIMIT) {
          result += segment;
        } else {
          break;
        }
      }
      return `${result.trimEnd()}${SUBSTRING_SUFFIX}`;
    }

    return result.trimEnd();
  } catch (e) {
    console.warn("Intl.Segmenter failed, falling back to basic truncation", e);
  }
  return `${s.substring(0, SUBSTRING_LIMIT).trimEnd()}${SUBSTRING_SUFFIX}`;
}

function createTruncatedValue(port: InspectablePort | null) {
  const MAX_SIZE = 220;

  if (!port) {
    return "";
  }

  let { value } = port;
  if (value === null || value === undefined) {
    if (isConfigurableBehavior(port.schema)) {
      const isLLMContent =
        isLLMContentBehavior(port.schema) ||
        isLLMContentArrayBehavior(port.schema);
      if (isLLMContent && port.schema.default) {
        try {
          value = JSON.parse(port.schema.default);
        } catch {
          return "(empty)";
        }
      } else {
        if (port.status === "missing" && !port.schema.default) {
          return "(not configured)";
        }

        if (port.schema.default !== undefined && !isLLMContent) {
          if (port.schema.type === "array") {
            try {
              const items = JSON.parse(port.schema.default);
              if (items.length === 0) {
                return "(Empty list)";
              }
            } catch {
              return "(Empty)";
            }
          }

          let defaultValue =
            typeof port.schema.default === "object"
              ? JSON.stringify(port.schema.default)
              : `${port.schema.default}`;

          if (defaultValue.length > MAX_SIZE - 3) {
            defaultValue = `${defaultValue.slice(0, MAX_SIZE)}...`;
          }

          return defaultValue;
        }

        return "";
      }
    }
  }

  // Catch the cases where we still fail to refine the preview value.
  if (value === null || value === undefined) {
    return "";
  }

  let valStr = "";
  if (typeof value === "object") {
    const summary = summarizeLLMContentValue(value, "(Empty)");
    if (summary !== null) {
      valStr = summary;
    } else if (Array.isArray(value)) {
      valStr = `${value.length} item${value.length === 1 ? "" : "s"}`;
    } else if ("preview" in value) {
      valStr = value.preview as string;
    }
  } else {
    valStr = "";
  }

  const template = new Template(valStr);
  template.substitute((part) => part.title);

  return truncateString(template.renderable);
}
