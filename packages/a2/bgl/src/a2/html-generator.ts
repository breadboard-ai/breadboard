/**
 * @fileoverview Utility for calling generate_webpage tool.
 */

import type { ContentMap, ExecuteStepRequest } from "./step-executor";
import { executeStep } from "./step-executor";
import {
  decodeBase64,
  encodeBase64,
  err,
  ok,
  toLLMContent,
  toLLMContentInline,
} from "./utils";

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
  for (const val of content) {
    for (const part of val.parts) {
      i++;
      if ("text" in part) {
        const key = `text_${i}`;
        inputParameters.push(key);
        executionInputs[key] = {
          chunks: [
            {
              mimetype: "text/plain",
              data: encodeBase64(part.text),
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
              data: encodeBase64(handle),
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
  const outputChunk = response.executionOutputs[OUTPUT_KEY];
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
