/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JsonSerializable } from "@breadboard-ai/build";

export type Inputs = {
  response: JsonSerializable;
};

export type Outputs = {
  url: string;
};

type BatchUpdateAPIResponse = {
  presentationId: string;
};

export function run(inputs: Inputs): Outputs {
  const response = inputs.response as BatchUpdateAPIResponse;
  return {
    url: `https://docs.google.com/presentation/d/${response.presentationId}/edit?usp=sharing`,
  };
}
