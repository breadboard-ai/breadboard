/**
 * @fileoverview Tools for working with Sheets.
 */
import {
  Capabilities,
  JSONPart,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import { type GeminiSchema } from "../a2/gemini";
import { GeminiPrompt } from "../a2/gemini-prompt";
import { err, llm, ok } from "../a2/utils";
import type { SheetValues } from "./types";
import { A2ModuleFactoryArgs } from "../runnable-module-factory";

export { inferSheetValues, SHEETS_MIME_TYPE };

const SHEETS_MIME_TYPE = "application/vnd.google-apps.spreadsheet";

function sheetSchema(): GeminiSchema {
  return {
    type: "object",
    properties: {
      spreadsheet_values: {
        type: "array",
        items: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },
    },
    required: ["spreadsheet_values"],
  };
}

async function inferSheetValues(
  caps: Capabilities,
  moduleArgs: A2ModuleFactoryArgs,
  contents?: LLMContent[]
): Promise<Outcome<unknown[][]>> {
  if (!contents) {
    return err(
      `Unable to infer spreadsheet values. No information was provided.`
    );
  }
  const prompt = new GeminiPrompt(caps, moduleArgs, {
    body: {
      contents,
      systemInstruction:
        llm`Your job is to generate spreadsheet values from the provided input.
Make sure that the values you generate reflect the input as precisely as possible`.asContent(),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: sheetSchema(),
      },
    },
  });
  const invoking = await prompt.invoke();
  if (!ok(invoking)) return invoking;
  const result = (invoking.last.parts?.at(0) as JSONPart)?.json;
  if (!result) {
    return err(
      `Unable to infer spreadsheet values. Invalid response from Gemini.`
    );
  }
  return (result as SheetValues).spreadsheet_values;
}
