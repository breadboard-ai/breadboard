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

const markdown = MarkdownIt();
const outputTextColor = getGlobalColor("--bb-neutral-700");

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

  constructor() {
    super();

    this.eventMode = "none";

    this.addChild(this.#label);

    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }

      this.#isDirty = false;
      this.#clean();

      this.#draw();
    };
  }

  set values(values: OutputValues[] | null) {
    this.#values = values;
    this.#isDirty = true;
  }

  get values() {
    return this.#values;
  }

  #clean() {
    const children = this.removeChildren();
    for (const child of children) {
      child.destroy();
    }
  }

  #draw() {
    if (!this.values) {
      const text = new PIXI.Text({
        text: "...",
        style: {
          fontFamily: "Arial",
          fontSize: 12,
          fill: outputTextColor,
        },
      });

      this.addChild(text);
      return;
    }

    const newestItem = this.values.at(-1);
    if (!newestItem) {
      return;
    }

    let y = 0;
    for (const entry of Object.values(newestItem)) {
      if (!isLLMContentArray(entry)) {
        continue;
      }

      const llmEntry: LLMContent[] = entry;
      const newestAddition = llmEntry.at(-1);
      if (!newestAddition) {
        continue;
      }

      Promise.all(
        newestAddition.parts.map((part) => {
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

                  resolve(item);
                };
              } else {
                resolve(null);
              }
            } else if (isTextCapabilityPart(part)) {
              const partText =
                part.text.length < 500
                  ? part.text
                  : `${part.text.slice(0, 500)}...`;
              const text = new PIXI.HTMLText({
                text: `${markdown.renderInline(partText)}`,
                style: {
                  fontSize: 12,
                  fontFamily: "Arial",
                  fill: outputTextColor,
                  wordWrap: true,
                  breakWords: true,
                  wordWrapWidth: 220,
                  tagStyles: {
                    h1: {
                      fontSize: 14,
                    },
                  },
                },
              });

              resolve(text);
            } else {
              resolve(null);
            }
          });
        })
      ).then((renderables: Array<PIXI.ContainerChild | null>) => {
        for (const renderable of renderables) {
          console.log(renderable);
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
