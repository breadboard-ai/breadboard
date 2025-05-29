/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { projectRunContext } from "../../../contexts/project-run";
import { ProjectRun } from "../../../state/types";

@customElement("bb-streamable-llm-content")
export class StreamableLLMContent extends LitElement {
  @property()
  accessor url: string | null = null;

  @consume({ context: projectRunContext })
  accessor run: ProjectRun | null = null;

  render() {
    return html`Streamable LLM Content: ${this.url}`;
  }
}
