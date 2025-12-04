/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sanitizer, Template } from "@breadboard-ai/utils";
import { chicletHtml } from "../elements/input/text-editor/text-editor.js";
import type { Project } from "../state/types.js";

// Note: As of December 2025, Firefox doesn't support Trusted Types.
const chicletHTMLPolicy = window.trustedTypes?.createPolicy(
  "opal-chiclet-html",
  { createHTML: createTrustedChicletHTMLImpl }
);

export const createTrustedChicletHTML =
  chicletHTMLPolicy?.createHTML?.bind(chicletHTMLPolicy) ??
  (createTrustedChicletHTMLImpl as unknown as (html: string) => TrustedHTML);

function createTrustedChicletHTMLImpl(
  value: string,
  projectState?: Project | null,
  subGraphId?: string | null
): string {
  if (!value) {
    return "";
  }
  const template = new Template(value);
  template.substitute(
    (part) => chicletHtml(part, projectState ?? null, subGraphId ?? null),
    (part) => Sanitizer.escapeNodeText(part)
  );
  return template.renderable;
}
