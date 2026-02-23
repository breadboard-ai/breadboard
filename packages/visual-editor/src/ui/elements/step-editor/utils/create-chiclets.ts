/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectablePort } from "@breadboard-ai/types";
import { Template, NOTEBOOKLM_TOOL_PATH } from "@breadboard-ai/utils";
import { html, HTMLTemplateResult, nothing } from "lit";
import { expandChiclet } from "../../../utils/expand-chiclet.js";
import { getAssetType } from "../../../../utils/media/mime-type.js";
import { summarizeLLMContentValue } from "../../../../utils/summarize-llm-content.js";
import {
  ROUTE_TOOL_PATH,
  MEMORY_TOOL_PATH,
} from "../../../../a2/a2/tool-manager.js";
import { SCA } from "../../../../sca/sca.js";

export function createChiclets(
  port: InspectablePort | null,
  subGraphId: string,
  sca: SCA
): HTMLTemplateResult[] {
  if (!port) {
    return [];
  }

  const { value } = port;
  if (value === null || value === undefined) {
    return [];
  }

  let valStr = "";
  if (typeof value === "object") {
    const summary = summarizeLLMContentValue(value);
    if (summary !== null) {
      valStr = summary;
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
    const { type, path, title, invalid, mimeType, instance } = part;
    const assetType = getAssetType(mimeType) ?? "";

    if (type !== "tool") return;

    const { icon: srcIcon, tags: metadataTags } = expandChiclet(
      part,
      subGraphId,
      sca
    );

    let sourceTitle = title;
    let targetIcon;
    let targetTitle;
    let metadataIcon = srcIcon;
    if (path === ROUTE_TOOL_PATH) {
      metadataIcon = "start";
      sourceTitle = "Go to";
      if (instance) {
        const { icon, title } = expandChiclet(
          { path: instance, type: "in", title: "unknown" },
          subGraphId,
          sca
        );

        targetIcon = icon;
        targetTitle = title;
      } else {
        targetTitle = " " + "[not set]";
      }
    } else if (path === MEMORY_TOOL_PATH) {
      metadataIcon = "database";
      sourceTitle = "Use Memory";
    } else if (path === NOTEBOOKLM_TOOL_PATH) {
      metadataIcon = "notebooklm";
      sourceTitle = "Use NotebookLM";
    }

    chiclets.push(
      html`<label
        class="chiclet ${metadataTags
          ? metadataTags.join(" ")
          : ""} ${type} ${assetType} ${invalid ? "invalid" : ""}"
      >
        ${metadataIcon
          ? html`<span
              class="g-icon filled round ${metadataIcon === "notebooklm"
                ? "notebooklm"
                : ""}"
              data-icon="${metadataIcon}"
            ></span>`
          : nothing}
        <span>${Template.preamble(part)}</span
        ><span class="visible-after" data-label=${sourceTitle}
          >${sourceTitle}</span
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
