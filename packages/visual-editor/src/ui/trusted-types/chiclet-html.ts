/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Template } from "@breadboard-ai/utils";
import { chicletHtml } from "../elements/input/text-editor/text-editor.js";
import type { Project } from "../state/types.js";
import { escapeNodeText } from "../../utils/sanitizer.js";
import { SCA } from "../../sca/sca.js";

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
  sca?: SCA,
  projectState?: Project | null,
  subGraphId?: string | null,
): string {
  if (!value) {
    return "";
  }


  // Explanation:
  //
  // - Untrusted strings are split into two types via a regex: "parts" that are
  //   parsed as JSON data, and "strings".
  //
  // - String parts are always escaped.
  //
  // - JSON data parts are converted into trusted HTML using chicletHtml.
  //
  // - chicletHtml uses DOM APIs to construct a DOM tree (which are subject to
  //   Trusted Type policies themselves) before serializing with outerHTML. Even
  //   though the JSON data is untrusted, because the DOM construction is
  //   guaranteed to not use unsafe sinks, the outerHTML is also trusted.
  const template = new Template(value);
  template.substitute(
    (part) => chicletHtml(part, projectState ?? null, subGraphId ?? null, sca),
    (part) => escapeNodeText(part)
  );
  return template.renderable;
}
