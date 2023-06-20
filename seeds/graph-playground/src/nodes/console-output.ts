import { log } from "@clack/prompts";
import type { InputValues } from "../graph.js";

export default async (inputs?: InputValues) => {
  if (!inputs) return {};
  log.step(inputs["text"] as string);
  return {};
};
