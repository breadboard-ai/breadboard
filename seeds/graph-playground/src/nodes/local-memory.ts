import type { InputValues } from "../graph.js";

const context: string[] = [];

export default async (inputs?: InputValues) => {
  if (!inputs) return {};
  Object.entries(inputs).forEach(([key, value]) => {
    context.push(`${key}: ${value}`);
  });
  // TODO: This is a hack to get around the fact that we don't have a way to
  //       exit the graph when it's cycling indefinitely.
  if (context.length > 10) return { exit: true };
  return { context: context.join("\n") };
};
