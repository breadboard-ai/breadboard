/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LandingCarousel } from "./carousel";

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

export function obtainElements() {
  // Capture the main sign-in buttons.
  const signInButton = document.querySelector<HTMLAnchorElement>("#sign-in");
  const signInHeaderButton =
    document.querySelector<HTMLAnchorElement>("#sign-in-header");
  if (!signInButton || !signInHeaderButton) {
    throw new Error("Unable to locate sign-in buttons");
  }

  // Scopes Error Dialog.
  const scopesErrorDialog = document.querySelector<HTMLDialogElement>(
    "#scopes-error-dialog"
  );
  if (!scopesErrorDialog) {
    throw new Error("Unable to locate scopes error dialog");
  }
  const scopesErrorSignInButton =
    scopesErrorDialog.querySelector<HTMLAnchorElement>(".sign-in");
  if (!scopesErrorSignInButton) {
    throw new Error("Unable to locate scopes error sign-in button");
  }

  // Generic Error Dialog.
  const genericErrorDialog = document.querySelector<HTMLDialogElement>(
    "#generic-error-dialog"
  );
  if (!genericErrorDialog) {
    throw new Error("Unable to find generic error dialog");
  }
  const genericErrorDialogTitle =
    genericErrorDialog.querySelector<HTMLHeadingElement>(".title");
  if (!genericErrorDialogTitle) {
    throw new Error("Unable to find generic error dialog title");
  }
  const genericErrorDialogDetail =
    genericErrorDialog.querySelector<HTMLParagraphElement>(".detail");
  if (!genericErrorDialogDetail) {
    throw new Error("Unable to find generic error dialog detail");
  }

  // Shared Flow Dialog.
  const sharedFlowDialog = document.querySelector<HTMLDialogElement>(
    "#shared-flow-dialog"
  );
  if (!sharedFlowDialog) {
    throw new Error("Unable to locate shared flow dialog");
  }
  const sharedFlowDialogSignInButton =
    sharedFlowDialog.querySelector<HTMLAnchorElement>(".sign-in");

  if (!sharedFlowDialogSignInButton) {
    throw new Error("Unable to locate scopes error sign-in button");
  }
  const sharedFlowDialogTitle =
    sharedFlowDialog.querySelector<HTMLHeadingElement>(".title");
  if (!sharedFlowDialogTitle) {
    throw new Error("Unable to find generic error dialog title");
  }

  // Intro video.
  const introVideo =
    document.body.querySelector<HTMLDivElement>(".intro-video");
  if (!introVideo) {
    throw new Error("Unable to find generic error dialog title");
  }

  const landingCarousel =
    document.querySelector<LandingCarousel>("landing-carousel");
  if (!landingCarousel) {
    throw new Error("Unable to find carousel");
  }

  return {
    signInButton,
    signInHeaderButton,
    scopesErrorDialog,
    scopesErrorSignInButton,
    genericErrorDialog,
    genericErrorDialogTitle,
    genericErrorDialogDetail,
    sharedFlowDialog,
    sharedFlowDialogSignInButton,
    sharedFlowDialogTitle,
    introVideo,
    landingCarousel,
  };
}

export function setAllAppNameHolders(name: string) {
  const appNameEls = document.body.querySelectorAll(".app-name");
  for (const el of appNameEls) {
    el.textContent = name;
  }
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
