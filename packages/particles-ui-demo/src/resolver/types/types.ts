/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Presentation, Segment } from "@breadboard-ai/particles";

export type ParticleTemplate = {
  presentation: Presentation & {
    segments?: Segment[];
  };
  group?: [string, ParticleTemplate][];
};
