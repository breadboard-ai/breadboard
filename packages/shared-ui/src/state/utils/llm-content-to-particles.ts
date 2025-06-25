/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GroupParticle, Particle } from "@breadboard-ai/particles";
import { LLMContent } from "@breadboard-ai/types";
import { err, ok, Outcome } from "@google-labs/breadboard";

export { llmContentToParticles };

/**
 * Produces a GroupParticle that represents the LLMContent.
 * @param content - the LLMContent to convert
 */
function llmContentToParticles(content?: LLMContent): Outcome<GroupParticle> {
  const result = content?.parts
    ?.map<Particle | null>((part) => {
      switch (true) {
        case "inlineData" in part: {
          // InlineDataCapabilityPart
          const { mimeType, data } = part.inlineData;
          return { data: `data:${mimeType};base64,${data}`, mimeType };
        }
        case "storedData" in part: {
          // StoredDataCapabilityPart
          const { mimeType, handle: data } = part.storedData;
          return { data, mimeType };
        }
        case "fileData" in part: {
          // FileDataPart
          const { mimeType, fileUri: data } = part.fileData;
          return { data, mimeType };
        }
        case "executableCode" in part: {
          // ExecutableCodePart
          const { code, language } = part.executableCode;
          const mimeType =
            language === "PYTHON" ? "text/x-python" : "text/plain";
          return { text: code, mimeType };
        }
        case "codeExecutionResult" in part:
          // CodeExecutionResultPart
          return {
            text: JSON.stringify(part.codeExecutionResult),
            mimeType: "application/json",
          };
        case "functionCall" in part:
          // FunctionCallCapabilityPart
          return {
            text: JSON.stringify(part.functionCall),
            mimeType: "application/json",
          };
        case "functionResponse" in part:
          // FunctionResponseCapabilityPart
          return {
            text: JSON.stringify(part.functionResponse),
            mimeType: "application/json",
          };
        case "json" in part:
          // JSONPart
          return {
            text: JSON.stringify(part.json),
            mimeType: "application/json",
          };
        case "list" in part: {
          // ListPart
          const group = new Map(
            part.list
              ?.map<[string, GroupParticle] | null>((item, index) => {
                // By convention, only look at the first item in LLMContent[].
                const group = llmContentToParticles(item.content.at(0));
                if (!ok(group)) return null;
                return [`${index}`, group];
              })
              .filter((item) => !!item)
          );
          if (group.size === 0) return null;
          // TODO: Figure out what the right type/presentation is here.
          return { group };
        }
        case "text" in part: {
          // TextCapabilityPart
          return { text: part.text };
        }
        default:
          return null;
      }
    })
    .filter((item) => !!item);
  if (!result) {
    return err(`Unable to convert LLMContent to Particles`);
  }
  const group = new Map(
    result.map((particle, index) => [`${index}`, particle])
  );
  // TODO: Figure out what the right type/presentation is here.
  return { group };
}
