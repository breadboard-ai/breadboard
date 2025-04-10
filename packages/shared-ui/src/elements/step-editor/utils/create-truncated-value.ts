/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InspectablePort,
  isInlineData,
  isLLMContent,
  isLLMContentArray,
  isStoredData,
  isTextCapabilityPart,
  Template,
} from "@google-labs/breadboard";
import {
  escapeHTMLEntities,
  isConfigurableBehavior,
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../../utils";

export function createTruncatedValue(port: InspectablePort | null) {
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
        } catch (err) {
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
            } catch (err) {
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
    if (isLLMContent(value)) {
      value = [value];
    }

    if (isLLMContentArray(value)) {
      const firstValue = value[0];
      if (firstValue) {
        const firstPart = firstValue.parts[0];
        if (isTextCapabilityPart(firstPart)) {
          valStr = firstPart.text;
          if (valStr === "") {
            valStr = "(Empty)";
          }
        } else if (isInlineData(firstPart)) {
          valStr = firstPart.inlineData.mimeType;
        } else if (isStoredData(firstPart)) {
          valStr = firstPart.storedData.mimeType;
        } else {
          valStr = "LLM Content Part";
        }
      } else {
        valStr = "0 items";
      }
    } else if (Array.isArray(value)) {
      valStr = `${value.length} item${value.length === 1 ? "" : "s"}`;
    } else if ("preview" in value) {
      valStr = value.preview as string;
    }
  } else {
    valStr = "";
  }

  valStr = escapeHTMLEntities(valStr);
  const template = new Template(valStr);
  template.substitute((part) => {
    return part.title;
  });

  valStr = template.renderable;
  if (valStr.length >= 35) {
    valStr = `${valStr.substring(0, 32)}...`;
  }

  return valStr;
}
