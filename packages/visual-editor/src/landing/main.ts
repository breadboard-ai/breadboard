/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  LandingUrlInit,
  MakeUrlInit,
  LanguagePack,
  GraphInit,
} from "@breadboard-ai/shared-ui/types/types.js";
import { SigninAdapter } from "@breadboard-ai/shared-ui/utils/signin-adapter";
import {
  ActionTracker,
  initializeAnalytics,
} from "@breadboard-ai/shared-ui/utils/action-tracker.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";
import { connectToOpalShellHost } from "@breadboard-ai/shared-ui/utils/opal-shell-guest.js";
import * as Shell from "./shell.js";
import { parseUrl, makeUrl } from "@breadboard-ai/shared-ui/utils/urls.js";
import "./carousel.js";

const parsedUrl = parseUrl(window.location.href) as LandingUrlInit;
if (parsedUrl.page !== "landing") {
  console.warn("unexpected parse of landing page url", parsedUrl);
}

const deploymentConfiguration = CLIENT_DEPLOYMENT_CONFIG;

function redirect(target?: MakeUrlInit) {
  if (target) {
    window.location.href = makeUrl(target);
    return;
  }

  window.location.href = makeUrl(parsedUrl.redirect);
}

if (deploymentConfiguration?.MEASUREMENT_ID) {
  initializeAnalytics(deploymentConfiguration.MEASUREMENT_ID, false);
}

let lastVideo = 0;
function embedIntroVideo(target: HTMLDivElement) {
  let newVideo = 0;
  do {
    newVideo = 1 + Math.floor(Math.random() * 3);
  } while (newVideo === lastVideo);
  lastVideo = newVideo;

  const formFactor = window.innerWidth < 800 ? "mobile" : "desktop";
  const video = document.createElement("video");
  video.setAttribute(
    "src",
    `/styles/landing/videos/${formFactor}-${lastVideo}.mp4`
  );
  video.setAttribute(
    "poster",
    `/styles/landing/videos/${formFactor}-poster.png`
  );
  video.muted = true;
  video.playsInline = true;
  video.load();

  // Wait for the video to load, then add it in (at zero opacity thanks to the
  // CSS). After the fade in animation has finished we remove any other videos
  // and start playing the new one.
  video.addEventListener(
    "canplaythrough",
    () => {
      target.appendChild(video);

      video.addEventListener(
        "animationend",
        () => {
          // Remove old videos.
          for (const el of target.querySelectorAll("*")) {
            if (el === video) {
              continue;
            }

            el.remove();
          }

          video.play();
        },
        { once: true }
      );
    },
    { once: true }
  );
}

async function init() {
  const { shellHost, embedHandler } = await connectToOpalShellHost();
  const signinAdapter = new SigninAdapter(
    shellHost,
    await shellHost.getSignInState()
  );

  if (signinAdapter.state === "signedin") {
    redirect();
    return;
  }

  ActionTracker.signInPageView();

  embedHandler?.sendToEmbedder({
    type: "home_loaded",
    isSignedIn: false,
  });

  const StringsHelper = await import("@breadboard-ai/shared-ui/strings");
  await StringsHelper.initFrom(LANGUAGE_PACK as LanguagePack);
  const Strings = StringsHelper.forSection("Global");

  if (
    Strings.from("PROVIDER_NAME") !== "PROVIDER_NAME" &&
    Strings.from("PROVIDER_NAME") !== ""
  ) {
    Shell.showExperimental();
  }

  Shell.setPageInfo();
  Shell.setPageTitle(
    "Welcome",
    Strings.from("APP_NAME"),
    Strings.from("SUB_APP_NAME")
  );
  try {
    const {
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
      secondaryVideo,
      secondaryVideoContainer,
    } = Shell.obtainElements();

    Shell.setAllAppNameHolders(Strings.from("APP_NAME"));
    landingCarousel.appName = Strings.from("APP_NAME");

    const showGeoRestrictionDialog = () => {
      genericErrorDialogTitle.textContent = `${Strings.from("APP_NAME")} is not available in your country yet`;
      genericErrorDialog.showModal();
    };

    const onClickSignIn = async (event: Event, destination?: MakeUrlInit) => {
      event.preventDefault();
      console.info(`[landing] Awaiting sign-in result`);
      const result = await signinAdapter.signIn();
      console.info(`[landing] Received sign-in result`, result);
      if (!result.ok) {
        const { error } = result;
        if (error.code === "missing-scopes") {
          scopesErrorDialog.showModal();
        } else if (error.code === "geo-restriction") {
          showGeoRestrictionDialog();
        } else if (error.code === "user-cancelled") {
          // Do nothing. The user can click sign-in again if they want.
        } else {
          error.code satisfies "other";
          genericErrorDialogTitle.textContent = `An unexpected signin error occured`;
          if (error.userMessage) {
            genericErrorDialogDetail.textContent = error.userMessage;
          }
          genericErrorDialog.showModal();
        }
        return;
      }

      ActionTracker.signInSuccess();
      console.info(`[landing] Redirecting after sign-in`, event.target);
      redirect(destination);
    };

    embedIntroVideo(introVideo);

    const signInHeaderLabel = signInHeaderButton.querySelector("span");
    if (signInHeaderLabel) {
      signInHeaderLabel.textContent = "Sign in";
    }
    signInButton.innerText = `Try ${Strings.from("APP_NAME")}`;
    signInHeaderButton.addEventListener("click", onClickSignIn);
    signInButton.addEventListener("click", onClickSignIn);
    document.addEventListener("loadgalleryflow", (event: Event) => {
      const urlEvent = event as CustomEvent<GraphInit>;
      onClickSignIn(event, urlEvent.detail);
    });
    scopesErrorSignInButton.addEventListener("click", (event) => {
      onClickSignIn(event);
      scopesErrorDialog.close();
    });

    if (parsedUrl.geoRestriction) {
      window.history.replaceState(
        null,
        "",
        makeUrl({ ...parsedUrl, geoRestriction: false })
      );
      showGeoRestrictionDialog();
    } else if (parsedUrl.missingScopes) {
      scopesErrorDialog.showModal();
      window.history.replaceState(
        null,
        "",
        makeUrl({ ...parsedUrl, missingScopes: false })
      );
    } else if (parsedUrl.redirect.page === "graph") {
      sharedFlowDialogTitle.textContent = Strings.from("LABEL_SHARE");
      sharedFlowDialog.showModal();
      sharedFlowDialogSignInButton.addEventListener("click", (event) => {
        onClickSignIn(event);
        sharedFlowDialog.close();
      });
    }

    const handleSecondaryVideoIframeClick = () => {
      setTimeout(() => {
        if (document.activeElement === secondaryVideo) {
          if (secondaryVideoContainer) {
            const secondaryVideoCover = secondaryVideoContainer.querySelector(".dimmed-cover");
            secondaryVideoCover?.remove();
          }
          window.removeEventListener('blur', handleSecondaryVideoIframeClick);
        }
      }, 0);
    }

    // gain window focus so that blur even will fire without any user interaction
    if (document.hasFocus() === false) {
      window.focus();
      document.body?.focus?.();
    }

    window.addEventListener('blur', handleSecondaryVideoIframeClick);
  } catch (err) {
    console.warn(err);
    return;
  }
}

init();
