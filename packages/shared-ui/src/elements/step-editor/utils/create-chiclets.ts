/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InspectablePort,
  isInlineData,
  isLLMContent,
  isLLMContentArray,
  isStoredData,
  isTextCapabilityPart,
  Template,
} from "@google-labs/breadboard";
import { escapeHTMLEntities } from "../../../utils";
import { getAssetType } from "../../../utils/mime-type";
import { html, HTMLTemplateResult, nothing } from "lit";
import { expandChiclet } from "../../../utils/expand-chiclet";
import { Project } from "../../../state";

export function createChiclets(
  port: InspectablePort | null,
  projectState: Project | null = null,
  subGraphId: string
): HTMLTemplateResult[] {
  if (!port) {
    return [];
  }

  let { value } = port;
  if (value === null || value === undefined) {
    return [];
  }

  let valStr = "";
  if (typeof value === "object") {
    if (isLLMContent(value)) {
      value = [value];
    }

    if (isLLMContentArray(value)) {
      const firstValue = value[0];
      if (firstValue) {
        const firstPart = firstValue.parts[0];
        if (isTextCapabilityPart(firstPart)) {
          valStr = firstPart.text;
          if (valStr === "") {
            valStr = "(empty text)";
          }
        } else if (isInlineData(firstPart)) {
          valStr = firstPart.inlineData.mimeType;
        } else if (isStoredData(firstPart)) {
          valStr = firstPart.storedData.mimeType;
        } else {
          valStr = "LLM Content Part";
        }
      } else {
        valStr = "0 items";
      }
    } else if (Array.isArray(value)) {
      valStr = `${value.length} item${value.length === 1 ? "" : "s"}`;
    } else if ("preview" in value) {
      valStr = value.preview as string;
    }
  } else {
    valStr = "";
  }

  valStr = escapeHTMLEntities(valStr);
  const chiclets: HTMLTemplateResult[] = [];
  const template = new Template(valStr);
  template.placeholders.forEach((part) => {
    const { type, title, invalid, mimeType } = part;
    const assetType = getAssetType(mimeType) ?? "";

    const { icon: metadataIcon, tags: metadataTags } = expandChiclet(
      part,
      projectState,
      subGraphId
    );

    chiclets.push(
      html`<label
        class="chiclet ${metadataTags
          ? metadataTags.join(" ")
          : ""} ${type} ${assetType} ${invalid ? "invalid" : ""}"
      >
        ${metadataIcon
          ? html`<span
              class="g-icon filled round"
              data-icon="${metadataIcon}"
            ></span>`
          : nothing}
        <span>${Template.preamble(part)}</span
        ><span class="visible">${title}</span
        ><span>${Template.postamble()}</span></label
      >`
    );
  });

  return chiclets;
}
