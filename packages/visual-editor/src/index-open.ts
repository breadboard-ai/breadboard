/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { customElement } from "lit/decorators.js";
import { MainBase } from "./main-base.js";
import { makeUrl, parseUrl } from "./ui/utils/urls.js";

@customElement("bb-open-main")
export class OpenMain extends MainBase {
  override async doPostInitWork() {
    const url = parseUrl(window.location.href);
    if (url.page !== "open") {
      window.location.href = "/_app/";
      return;
    }

    const signin = await this.askUserToSignInIfNeeded();
    if (signin !== "success") {
      window.location.href = "/_app/";
      return;
    }

    window.location.href = makeUrl({
      page: "graph",
      mode: "app",
      flow: `drive:/${url.fileId}`,
      resourceKey: url.resourceKey,
    });
  }

  override render() {
    return this.renderSignInModal();
  }
}
