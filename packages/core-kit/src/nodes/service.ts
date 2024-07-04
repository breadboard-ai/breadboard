/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType, fromJSONSchema } from "@breadboard-ai/build";
import { InputValues } from "@google-labs/breadboard";

export type ServiceStaticInputs = {
  $service?: string;
};

const normalize = (serviceURL: string) => {
  if (serviceURL.endsWith("/")) {
    return serviceURL.slice(0, -1);
  }
  return serviceURL;
};

const describe = async (
  { $service }: ServiceStaticInputs,
  dynamicInputs: InputValues
) => {
  if (!$service || typeof $service !== "string") {
    return { inputs: {}, outputs: {} };
  }
  const service = normalize($service);
  const describeURL = `${service}/describe`;
  try {
    const schemas = await (
      await fetch(describeURL, {
        method: "POST",
        body: JSON.stringify({ dynamicInputs }),
      })
    ).json();
    const inputs = fromJSONSchema(schemas?.inputs ?? {});
    const outputs = fromJSONSchema(schemas?.outputs ?? {});
    return { inputs, outputs };
  } catch {
    // Eat any exceptions.
    // This is a describer, and it must always return some valid value.
  }
  return { inputs: {}, outputs: {} };
};

const invoke = async (inputs: InputValues) => {
  const { $service, ...rest } = inputs;
  if (!$service || typeof $service !== "string") {
    throw new Error("Service URL is required.");
  }

  const service = normalize($service);
  const invokeURL = `${service}/invoke`;
  return await (
    await fetch(invokeURL, {
      method: "POST",
      body: JSON.stringify(rest),
    })
  ).json();
};

export default defineNodeType({
  name: "service",
  metadata: {
    title: "Service",
    description:
      "Represents an external service that can be used from the board.",
  },
  inputs: {
    $service: {
      title: "Service URL",
      description: "The URL of the service to use.",
      behavior: ["config"],
      type: "string",
    },
    "*": {
      type: "unknown",
    },
  },
  outputs: {
    "*": {
      type: "unknown",
    },
  },
  invoke,
  describe,
});
