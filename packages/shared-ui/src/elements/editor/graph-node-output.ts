/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";
import { getGlobalColor } from "./utils";
import { LLMContent, OutputValues } from "@breadboard-ai/types";
import MarkdownIt from "markdown-it";
import {
  isInlineData,
  isLLMContentArray,
  isTextCapabilityPart,
} from "@google-labs/breadboard";
import { GraphAssets } from "./graph-assets";

const markdown = MarkdownIt();
const outputTextColor = getGlobalColor("--bb-neutral-700");
const placeholderColor = getGlobalColor("--bb-neutral-100");

const ICON_SCALE = 0.42;

function create(text: string, tag: string) {
  const opts: PIXI.HTMLTextStyleOptions = {
    fontWeight: "400",
    fontFamily: "Arial",
    fontSize: 12,
    lineHeight: 18,
    wordWrap: true,
    breakWords: true,
    wordWrapWidth: 220,
    fill: outputTextColor,
    align: "left",
  };

  const metrics = { marginBottom: 8 };

  switch (tag) {
    case "h1": {
      opts.fontSize = 16;
      opts.lineHeight = 24;
      opts.fontWeight = "500";
      break;
    }

    case "h2": {
      opts.fontSize = 14;
      opts.lineHeight = 22;
      opts.fontWeight = "500";
      break;
    }

    case "h3": {
      opts.fontSize = 13;
      opts.lineHeight = 20;
      opts.fontWeight = "500";
      break;
    }

    case "h4": {
      opts.fontSize = 12;
      opts.lineHeight = 18;
      opts.fontWeight = "500";
      break;
    }

    case "h5": {
      opts.fontSize = 12;
      opts.lineHeight = 18;
      opts.fontWeight = "500";
      break;
    }
  }

  return {
    textPart: new PIXI.HTMLText({
      text,
      style: { ...opts },
    }),
    metrics: { ...metrics },
  };
}

export class GraphNodeOutput extends PIXI.Container {
  #isDirty = true;
  #label = new PIXI.Text({
    text: "",
    style: {
      fontFamily: "Arial",
      fontSize: 12,
      fill: outputTextColor,
      align: "left",
    },
  });
  #values: OutputValues[] | null = null;
  #presentationHints: string[] = [];

  constructor() {
    super();

    this.eventMode = "none";

    this.addChild(this.#label);

    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }

      this.#isDirty = false;
      this.#draw();
    };

    this.on("destroyed", () => {
      // Prevent future renderings.
      this.#isDirty = false;

      for (const child of this.children) {
        child.destroy({ children: true });
      }
    });
  }

  set values(values: OutputValues[] | null) {
    if (values === this.#values) {
      return;
    }

    this.#values = values;
    this.#isDirty = true;
  }

  get values() {
    return this.#values;
  }

  set presentationHints(hints: string[]) {
    if (hints === this.#presentationHints) {
      return;
    }

    this.#presentationHints = hints;
    this.#isDirty = true;
  }

  get presentationHints() {
    return this.#presentationHints;
  }

  #clear() {
    for (const child of this.children) {
      child.removeFromParent();
      child.destroy({ children: true });
    }
  }

  #createDefaultPlaceholder(placeholder: PIXI.Container) {
    const text = new PIXI.Text({
      text: "...",
      style: {
        fontFamily: "Arial",
        fontSize: 12,
        fill: outputTextColor,
      },
    });

    text.y = placeholder.height + 12;
    placeholder.addChild(text);
  }

  #createImagePlaceholder(placeholder: PIXI.Container) {
    // Background.
    const image = new PIXI.Graphics();
    image.beginPath();
    image.roundRect(28, 0, 186, 140, 4);
    image.closePath();
    image.fill({ color: placeholderColor });

    if (placeholder.height > 0) {
      image.y = placeholder.height + 24;
    }
    placeholder.addChild(image);

    // Icon.
    if (GraphAssets.instance().has("image")) {
      const texture = GraphAssets.instance().get("image");
      if (texture) {
        const icon = new PIXI.Sprite(texture);
        icon.scale.x = ICON_SCALE;
        icon.scale.y = ICON_SCALE;
        icon.alpha = 0.5;
        icon.x = 109;
        icon.y = image.y + 60;

        placeholder.addChild(icon);
      }
    }
  }

  #createTextPlaceholder(placeholder: PIXI.Container) {
    const lines = new PIXI.Graphics();
    const lengths = [200, 220, 210, 200, 100];
    lines.beginPath();

    for (let l = 0; l < lengths.length; l++) {
      const line = lengths[l];
      lines.moveTo(6, l * 18);
      lines.lineTo(line + 6, l * 18);
      lines.stroke({ width: 12, cap: "round", color: placeholderColor });
    }
    lines.closePath();

    if (placeholder.height > 0) {
      lines.y = placeholder.height + 24;
    } else {
      lines.y = 12;
    }
    placeholder.addChild(lines);
  }

  #draw() {
    if (!this.values) {
      this.#clear();

      const placeholder = new PIXI.Container();
      placeholder.label = "placeholder";

      for (const hint of this.#presentationHints) {
        switch (hint) {
          case "hint-code":
          case "hint-text":
            this.#createTextPlaceholder(placeholder);
            break;

          case "hint-image":
            this.#createImagePlaceholder(placeholder);
            break;

          case "hint-multimodal":
            this.#createTextPlaceholder(placeholder);
            this.#createImagePlaceholder(placeholder);
            break;

          default:
            this.#createDefaultPlaceholder(placeholder);
            break;
        }
      }
      this.addChild(placeholder);
      return;
    } else {
      const placeholder = this.getChildByLabel("placeholder");
      placeholder?.removeFromParent();
      placeholder?.destroy({ children: true });
    }

    const newestItem = this.values.at(-1);
    if (!newestItem) {
      return;
    }

    let y = 0;
    for (const [id, entry] of Object.entries(newestItem)) {
      if (!isLLMContentArray(entry)) {
        continue;
      }

      const llmEntry: LLMContent[] = entry;
      const newestAddition = llmEntry.at(-1);
      if (!newestAddition) {
        continue;
      }

      if (!newestAddition.parts) {
        return Promise.resolve([]);
      }

      Promise.all(
        newestAddition.parts.map((part, idx) => {
          const item = this.getChildByLabel(`${id}-${idx}`);
          if (item) {
            return Promise.resolve(item);
          }

          return new Promise<PIXI.ContainerChild | null>((resolve) => {
            if (isInlineData(part)) {
              if (part.inlineData.mimeType.startsWith("image")) {
                const canvas = document.createElement("canvas");
                const img = new Image();
                img.src = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                img.onload = () => {
                  canvas.width = img.naturalWidth;
                  canvas.height = img.naturalHeight;
                  canvas.getContext("2d")?.drawImage(img, 0, 0);

                  const texture = PIXI.Texture.from(canvas);
                  const item = new PIXI.Sprite(texture);
                  const ratio = 228 / texture.width;
                  item.scale.x = ratio;
                  item.scale.y = ratio;
                  item.label = `${id}-${idx}`;

                  resolve(item);
                };
              } else {
                resolve(null);
              }
            } else if (isTextCapabilityPart(part)) {
              const item = new PIXI.Container();
              const parts = markdown.parse(part.text, {});

              let y = 0;
              let currentTag = "p";
              for (const part of parts) {
                if (part.type === "heading_open") {
                  currentTag = part.tag;
                  continue;
                }

                if (
                  part.type === "heading_close" ||
                  part.type === "paragraph_open" ||
                  part.type === "paragraph_close"
                ) {
                  currentTag = "p";
                  continue;
                }

                if (
                  part.type !== "inline" ||
                  (part.content === "" && part.children?.length === 0)
                ) {
                  continue;
                }

                const { textPart, metrics } = create(
                  markdown.renderInline(part.content),
                  currentTag
                );
                textPart.y = y;

                item.addChild(textPart);
                y += textPart.height + metrics.marginBottom;
              }

              item.label = `${id}-${idx}`;
              resolve(item);
            } else {
              resolve(null);
            }
          });
        })
      ).then((renderables: Array<PIXI.ContainerChild | null>) => {
        for (const renderable of renderables) {
          if (!renderable) {
            continue;
          }

          this.addChild(renderable);
          renderable.y = y;

          y += renderable.height + 16;
        }
      });
    }
  }
}
