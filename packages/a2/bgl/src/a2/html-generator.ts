/**
 * @fileoverview Utility for calling generate_webpage tool.
 */

import fetch from "@fetch";
import secrets from "@secrets";

import {
  err,
  ok,
  toLLMContent,
  toLLMContentInline,
  toText,
  decodeBase64,
} from "./utils";
import { executeStep } from "./step-executor";
import type { ExecuteStepRequest, Content, ContentMap } from "./step-executor";
import { report } from "./output";

export { callGenWebpage };

const OUTPUT_KEY = "rendered_outputs";

async function callGenWebpage(
  instruction: string,
  content: LLMContent[],
  renderMode: string,
  modelName: string
): Promise<Outcome<LLMContent>> {
  const executionInputs: ContentMap = {};
  const inputParameters: string[] = [];
  let i = 0;
  for (let val of content) {
    for (let part of val.parts) {
      i++;
      if ("text" in part) {
        const key = `text_${i}`;
        inputParameters.push(key);
        const encodedText = btoa(unescape(encodeURIComponent(part.text)));
        executionInputs[key] = {
          chunks: [
            {
              mimetype: "text/plain",
              data: encodedText,
            },
          ],
        };
      } else if ("inlineData" in part) {
        const key = `media_${i}`;
        inputParameters.push(key);
        executionInputs[key] = {
          chunks: [
            {
              mimetype: part.inlineData.mimeType,
              data: part.inlineData.data,
            },
          ],
        };
      } else if ("storedData" in part) {
        const key = `media_${i}`;
        inputParameters.push(key);
        let handle = part.storedData.handle;
        if (handle.startsWith("drive:/")) {
          const driveId = handle.replace(/^drive:\/+/, "");
          handle = `https://drive.google.com/file/d/${driveId}/preview`;
        }
        executionInputs[key] = {
          chunks: [
            {
              mimetype: "url/" + part.storedData.mimeType,
              data: btoa(unescape(encodeURIComponent(handle))),
            },
          ],
        };
      } else {
        console.error("Skipping unexpected content part");
      }
    }
  }
  const body = {
    planStep: {
      stepName: "GenerateWebpage",
      modelApi: "generate_webpage",
      inputParameters: inputParameters,
      systemPrompt: "",
      stepIntent: "",
      output: OUTPUT_KEY,
      options: {
        disablePromptRewrite: true,
        renderMode: renderMode,
        modelName: modelName,
        systemInstruction: instruction,
      },
    },
    execution_inputs: executionInputs,
  } satisfies ExecuteStepRequest;
  // Add the contents
  // TODO(askerryryan): Remove once functional.
  console.log("request body");
  console.log(body);
  const response = await executeStep(body);
  // TODO(askerryryan): Remove once functional.
  console.log("response");
  console.log(response);
  if (!ok(response)) {
    let errorMessage;
    if (response.$error.includes("The service is currently unavailable")) {
      errorMessage =
        "Request timed out. The model may be experiencing heavy load";
    } else {
      errorMessage = response.$error;
    }
    return err("Webpage generation failed: " + errorMessage);
  }

  let returnVal;
  let outputChunk = response.executionOutputs[OUTPUT_KEY];
  if (!outputChunk) {
    return err("Error: Malformed response. No page generated.");
  }
  const mimetype = outputChunk.chunks[0].mimetype;
  const base64Data = outputChunk.chunks[0].data;
  const data = decodeBase64(base64Data);
  if (mimetype == "text/html") {
    returnVal = toLLMContentInline(mimetype, data);
  } else {
    returnVal = toLLMContent(data);
  }
  if (!returnVal) {
    return err("Error: No webpage returned from backend");
  }
  return returnVal;
}
