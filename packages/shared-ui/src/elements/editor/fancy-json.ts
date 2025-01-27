/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { JsonSerializable } from "@breadboard-ai/build/internal/type-system/type.js";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

export interface FancyJsonAnnotation {
  path: Array<string | number>;
  partName: string;
}

/**
 * Displays some JSON with highlighting.
 */
@customElement("bb-fancy-json")
export class FancyJson extends LitElement {
  @property({ type: Object })
  accessor json: JsonSerializable | undefined = undefined;

  @property({ type: Number })
  accessor indent = 2;

  #annotations?: FancyJsonAnnotation[];
  #annotationsBySerializedPath = new Map<string, FancyJsonAnnotation[]>();

  get annotations(): FancyJsonAnnotation[] | undefined {
    return this.#annotations;
  }
  @property({ type: Array })
  set annotations(annotations: FancyJsonAnnotation[] | undefined) {
    this.#annotations = annotations;
    this.#annotationsBySerializedPath.clear();
    if (annotations !== undefined) {
      for (const annotation of annotations) {
        const key = JSON.stringify(annotation.path);
        const val = this.#annotationsBySerializedPath.get(key);
        if (val === undefined) {
          this.#annotationsBySerializedPath.set(key, [annotation]);
        } else {
          val.push(annotation);
        }
      }
    }
  }

  static styles = css`
    pre {
      text-wrap: wrap;
    }
  `;

  override render() {
    if (!this.json) {
      return nothing;
    }
    return this.#renderJsonValue(this.json, 1, []);
  }

  #renderJsonValue(
    value: JsonSerializable,
    indent: number,
    path: Array<string | number>
  ): unknown {
    const parts = [];

    switch (typeof value) {
      case "string": {
        parts.push(JSON.stringify(value));
        break;
      }
      case "number":
      case "boolean": {
        parts.push(value);
        break;
      }

      case "object": {
        if (value === null) {
          parts.push("null");
        } else if (Array.isArray(value)) {
          parts.push("[");
          if (value.length > 0) {
            for (let v = 0; v < value.length; v++) {
              parts.push("\n");
              for (let i = 0; i < indent; i++) {
                parts.push("  ");
              }
              const val = value[v];
              path.push(v);
              parts.push(this.#renderJsonValue(val, indent + 1, path));
              path.pop();
              if (v < value.length - 1) {
                parts.push(",");
              } else {
                parts.push("\n");
              }
            }
            for (let i = 1; i < indent; i++) {
              parts.push("  ");
            }
          }
          parts.push("]");
        } else {
          parts.push("{");
          const entries = Object.entries(value);
          if (entries.length > 0) {
            for (let e = 0; e < entries.length; e++) {
              parts.push("\n");
              for (let i = 0; i < indent; i++) {
                parts.push("  ");
              }
              const [key, val] = entries[e];
              parts.push(JSON.stringify(key), ": ");
              path.push(key);
              parts.push(this.#renderJsonValue(val, indent + 1, path));
              path.pop();
              if (e < entries.length - 1) {
                parts.push(",");
              } else {
                parts.push("\n");
              }
            }
            for (let i = 1; i < indent; i++) {
              parts.push("  ");
            }
          }
          parts.push("}");
        }
        break;
      }
      default: {
        value satisfies never;
      }
    }

    if (this.annotations !== undefined) {
      const serializedPath = JSON.stringify(path);
      const annotations = this.#annotationsBySerializedPath.get(serializedPath);
      if (annotations !== undefined) {
        const partNames = [];
        for (const annotation of annotations) {
          if (annotation.partName) {
            partNames.push(annotation.partName);
          }
        }
        return html`<span part=${partNames.join(" ")}>${parts}</span>`;
      }
    }

    return parts;
  }
}
