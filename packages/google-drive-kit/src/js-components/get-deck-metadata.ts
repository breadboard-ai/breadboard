/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JsonSerializable } from "@breadboard-ai/build";

export type Inputs = {
  presentation: JsonSerializable;
};

export type Outputs = {
  presentationId: string;
  slideId: string;
};

type PresentationMetadata = {
  presentationId: string;
  slides: { objectId: string }[];
};

export function run(inputs: Inputs): Outputs {
  const presentation = inputs.presentation as PresentationMetadata;
  return {
    presentationId: presentation.presentationId,
    slideId: presentation.slides[0]?.objectId || "Slide_0",
  };
}
