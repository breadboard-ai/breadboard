/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType, fromJSONSchema } from "@breadboard-ai/build";
import { PortConfigMap } from "@breadboard-ai/build/internal/common/port.js";
import { InputValues } from "@google-labs/breadboard";

export type ServiceDescriptionMap = Map<
  string,
  { inputs: PortConfigMap; outputs: PortConfigMap }
>;

export type ServiceStaticInputs = {
  $service?: string;
};

// TODO: This cache should be cleared periodically.
const cache: ServiceDescriptionMap = new Map();

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
  if (cache.has(service)) {
    return cache.get(service)!;
  }
  const describeURL = `${service}/describe`;
  try {
    const schemas = await (
      await fetch(describeURL, {
        method: "POST",
        body: JSON.stringify({ ...dynamicInputs }),
      })
    ).json();
    const inputs = fromJSONSchema(schemas?.inputSchema ?? {});
    const outputs = fromJSONSchema(schemas?.outputSchema ?? {});
    const result = { inputs, outputs };
    cache.set(service, result);
    return result;
  } catch {
    // Eat any exceptions.
    // This is a describer, and it must always return some valid value.
  }
  return { inputs: {}, outputs: {} };
};

const invoke = async (inputs: InputValues, dynamicInputs: InputValues) => {
  const { $service } = inputs;
  if (!$service || typeof $service !== "string") {
    throw new Error("Service URL is required.");
  }

  const service = normalize($service);
  const invokeURL = `${service}/invoke`;
  return await (
    await fetch(invokeURL, {
      method: "POST",
      body: JSON.stringify(dynamicInputs),
    })
  ).json();
};

export default defineNodeType({
  name: "service",
  metadata: {
    title: "Service",
    description:
      "Represents an external service that can be used by the board.",
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
