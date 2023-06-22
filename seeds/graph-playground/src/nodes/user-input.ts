/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { text } from "@clack/prompts";
import type { InputValues } from "../graph.js";

export default async (inputs?: InputValues) => {
  const defaultValue = "<Exit>";
  const message = ((inputs && inputs.message) as string) || "Enter some text";
  // If this node is a service, why does it contain experience?
  // It seems like there's some sort of "configuration store" or something
  // that is provided by the experience, but delivered by the service.
  const input = await text({
    message,
    defaultValue,
  });
  if (input === defaultValue) return { exit: true };
  return { text: input };
};
