/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function setPageTitle(
  title: string | null,
  appName: string,
  appSubName: string
) {
  const pageTitle = document.body.querySelector("#title");
  if (pageTitle) {
    pageTitle.textContent = appName;
  }

  const suffix = `${appName} [${appSubName}]`;
  if (title) {
    title = title.trim();
    window.document.title = `${title} - ${suffix}`;
    return;
  }

  window.document.title = suffix;
}

export function setPageInfo() {
  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.type = "image/svg+xml";
  icon.href = MAIN_ICON;
  document.head.appendChild(icon);

  if (FONT_LINK !== undefined) {
    const fonts = document.createElement("link");
    fonts.rel = "stylesheet";
    fonts.href = FONT_LINK;
    document.head.appendChild(fonts);
  }

  const fontPack = document.createElement("style");
  fontPack.textContent = FONT_PACK;
  document.head.appendChild(fontPack);
}

export function showExperimental() {
  const exp = document.body.querySelector("#experiment");
  if (!exp) {
    return;
  }

  exp.classList.add("visible");
}
