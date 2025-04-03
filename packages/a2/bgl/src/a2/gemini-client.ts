import invokeGemini, { type GeminiInputs, type GeminiOutputs } from "./gemini";
import { ok, err } from "./utils";

export type ValidatorFunction = (response: GeminiOutputs) => Outcome<void>;

export { callGemini };

async function callGemini(
  inputs: Omit<GeminiInputs, "model">,
  model: string,
  validator: ValidatorFunction,
  retries: number
): Promise<Outcome<GeminiOutputs>> {
  // TODO: Add more nuanced logic around retries
  for (let i = 0; i < retries; ++i) {
    const nextStep = i == retries ? "bailing" : "will retry";
    const response = await invokeGemini(inputs);
    if (!ok(response)) {
      console.error(`Error from model, ${nextStep}`);
      return response;
    } else {
      const validating = validator(response);
      if (!ok(validating)) {
        console.error(`Validation error, ${nextStep}`, validating.$error);
        continue;
      }
      return response;
    }
  }
  return err(`Failed to get valid response after ${retries} tries`);
}
