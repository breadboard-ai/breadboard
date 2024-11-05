/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "./code-editor";

const source = `/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { fetch, secrets } from "breadboard:capabilities";

export default async function ({ id }) {
  if (!id) {
    throw new Error("Please supply file id");
  }
  const connectionId = "connection:google-drive-limited";
  const { [connectionId]: token } = await secrets({ keys: [connectionId] });
  const url = \`https://www.googleapis.com/drive/v3/files/\${id}\`;
  const { response, $error } = await fetch({
    url,
    method: "GET",
    headers: {
      Authorization: \`Bearer \${token}\`,
    },
  });
  if ($error) {
    return { info: $error };
  }
  return { info: response };
}`;

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("bb-main")
export class Main extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    return html`<bb-code-editor
      .language=${"typescript"}
      .value=${source}
    ></bb-code-editor>`;
  }
}
