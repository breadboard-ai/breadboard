/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DRIVE_PROPERTY_OPAL_SHARE_SURFACE } from "@breadboard-ai/utils/google-drive/operations.js";
import { customElement } from "lit/decorators.js";
import { MainBase } from "./main-base.js";
import { makeUrl, parseUrl } from "./ui/navigation/urls.js";
import { makeShareLinkFromTemplate } from "./utils/make-share-link-from-template.js";

@customElement("bb-open-main")
export class OpenMain extends MainBase {
  override async handleAppAccessCheckResult(): Promise<void> {
    // Intentionally do nothing on open -- let the final destination handle it.
  }

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

    // Check if there is a share surface identifier written to this Opal's Drive
    // file properties, and redirect to it if we have a matching URL template in
    // our config.
    let fileMetadata = undefined;
    try {
      fileMetadata = await this.sca.services.googleDriveClient.getFileMetadata(
        { id: url.fileId, resourceKey: url.resourceKey },
        { fields: ["properties"] }
      );
    } catch (e) {
      // TODO(aomarks) Add a user-visible not-found error here. Currently we
      // just continue and rely on the fallback to render an error.
      console.error(`[open] Error reading drive file ${url.fileId}`, e);
    }
    const shareSurface =
      fileMetadata?.properties?.[DRIVE_PROPERTY_OPAL_SHARE_SURFACE];
    const shareSurfaceUrlTemplate =
      shareSurface &&
      this.sca.services.guestConfig.shareSurfaceUrlTemplates?.[shareSurface];
    if (shareSurfaceUrlTemplate) {
      const redirectUrl = makeShareLinkFromTemplate({
        urlTemplate: shareSurfaceUrlTemplate,
        fileId: url.fileId,
        resourceKey: url.resourceKey,
      });
      console.log(`[open] Redirecting to share surface`, redirectUrl);
      window.parent.location.href = redirectUrl;
      return;
    }

    // Check if the user is from a domain with a special configuration, and
    // redirect to the /open/ page on that domain's preferred url if set.
    const userDomain = await this.sca.services.signinAdapter.domain;
    const userDomainPreferredUrl =
      userDomain &&
      this.sca.services.globalConfig.domains?.[userDomain]?.preferredUrl;
    if (userDomainPreferredUrl) {
      const url = new URL(
        window.location.pathname.replace(/^\/_app\//, "") +
          window.location.search +
          window.location.hash,
        userDomainPreferredUrl
      ).href;
      console.log(`[open] Redirecting user to preferred domain`, url);
      window.parent.location = url;
      return;
    }

    // Fallback to viewing the Opal on this same deployment (note that we don't
    // need window.parent.location here).
    window.location.href = makeUrl({
      page: "graph",
      mode: "app",
      flow: `drive:/${url.fileId}`,
      resourceKey: url.resourceKey,
      guestPrefixed: true,
    });
  }

  override render() {
    return this.renderSignInModal();
  }
}
