export type PromptTemplateInputs = {
  template: string;
  [x: string]: string;
};

export type PromptTemplateOutputs = {
  prompt: string;
};

export const promptTemplate = async (
  _inputs: PromptTemplateInputs
): Promise<PromptTemplateOutputs> => {
  return { prompt: "foo" };
};

export type GenerateTextInputs = {
  PALM_KEY: string;
  prompt: string;
};

export type GenerateTextOutputs = {
  completion: string;
};

export const generateText = async (
  _inputs: GenerateTextInputs
): Promise<GenerateTextOutputs> => {
  return {} as GenerateTextOutputs;
};

export type RunJavascriptInputs = {
  code: string;
  name: string;
  raw: boolean;
};

export type RunJavascriptOutputs = {
  result: string;
};

export const runJavascript = async (
  _inputs: RunJavascriptInputs
): Promise<RunJavascriptOutputs> => {
  return {} as RunJavascriptOutputs;
};

export type SecretsInputs = {
  keys: string[];
};

export type SecretsOutputs = {
  [key: string]: string;
};

export const secrets = async (
  _inputs: SecretsInputs
): Promise<SecretsOutputs> => {
  return {} as SecretsOutputs;
};
