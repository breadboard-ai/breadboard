/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectablePort } from "@breadboard-ai/types";
import { isStoredData, Template } from "@breadboard-ai/utils";
import { html, HTMLTemplateResult, nothing } from "lit";
import { Project } from "../../../state/index.js";
import { expandChiclet } from "../../../utils/expand-chiclet.js";
import { getAssetType } from "../../../utils/mime-type.js";
import {
  isInlineData,
  isLLMContent,
  isLLMContentArray,
  isTextCapabilityPart,
} from "../../../../data/common.js";

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

  const chiclets: HTMLTemplateResult[] = [];
  const template = new Template(valStr);
  template.placeholders.forEach((part) => {
    const { type, title, invalid, mimeType, parameterType } = part;
    const assetType = getAssetType(mimeType) ?? "";

    const { icon: srcIcon, tags: metadataTags } = expandChiclet(
      part,
      projectState,
      subGraphId
    );

    let targetIcon;
    let targetTitle;
    let metadataIcon = srcIcon;
    if (parameterType) {
      switch (parameterType) {
        case "step":
          metadataIcon = "start";
          if (part.parameterTarget) {
            const { icon, title } = expandChiclet(
              { path: part.parameterTarget, type: "in", title: "unknown" },
              projectState,
              subGraphId
            );

            targetIcon = icon;
            targetTitle = title;
          } else {
            targetTitle = " " + "[not set]";
          }

          break;
      }
    }

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
        ><span class="visible-after" data-label=${title}>${title}</span
        >${targetIcon
          ? html`<span
              class="g-icon filled round target"
              data-icon="${targetIcon}"
            ></span>`
          : nothing}${targetTitle
          ? html`<span
              class="visible-after target"
              data-label=${targetTitle}
            ></span>`
          : nothing}<span>${Template.postamble()}</span></label
      >`
    );
  });

  return chiclets;
}
