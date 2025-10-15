/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type LanguagePack,
  SETTINGS_TYPE,
} from "@breadboard-ai/shared-ui/types/types.js";
import {
  SIGN_IN_CONNECTION_ID,
  SigninAdapter,
} from "@breadboard-ai/shared-ui/utils/signin-adapter";
import { SettingsHelperImpl } from "@breadboard-ai/shared-ui/data/settings-helper.js";
import { createTokenVendor } from "@breadboard-ai/connection-client";
import { GlobalConfig } from "@breadboard-ai/shared-ui/contexts";
import {
  ActionTracker,
  initializeAnalytics,
} from "@breadboard-ai/shared-ui/utils/action-tracker.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";
import * as Shell from "./shell.js";
import {
  parseUrl,
  makeUrl,
  LandingUrlInit,
  MakeUrlInit,
  GraphInit,
} from "@breadboard-ai/shared-ui/utils/urls.js";

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
  const globalConfig = {
    connectionServerUrl: new URL("/connection/", window.location.href).href,
    connectionRedirectUrl: new URL("/oauth/", window.location.href).href,
    signinMode: "required",
    ...deploymentConfiguration,
  } as GlobalConfig;

  const { SettingsStore } = await import(
    "@breadboard-ai/shared-ui/data/settings-store.js"
  );
  const settings = await SettingsStore.restoredInstance();
  const settingsHelper = new SettingsHelperImpl(settings);
  const tokenVendor = createTokenVendor(
    {
      get: () => {
        return settingsHelper.get(
          SETTINGS_TYPE.CONNECTIONS,
          SIGN_IN_CONNECTION_ID
        )?.value as string;
      },
      set: async (grant: string) => {
        await settingsHelper.set(
          SETTINGS_TYPE.CONNECTIONS,
          SIGN_IN_CONNECTION_ID,
          {
            name: SIGN_IN_CONNECTION_ID,
            value: grant,
          }
        );
      },
    },
    globalConfig
  );

  const signinAdapter = new SigninAdapter(
    tokenVendor,
    globalConfig as GlobalConfig,
    settingsHelper
  );

  if (
    signinAdapter.state === "anonymous" ||
    signinAdapter.state === "signedin"
  ) {
    redirect();
    return;
  }

  ActionTracker.signInPageView();

  Shell.dispatchToEmbed({
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
    } = Shell.obtainElements();

    Shell.setAllAppNameHolders(Strings.from("APP_NAME"));
    landingCarousel.appName = Strings.from("APP_NAME");

    let autoSignInUrl = "";
    const setSignInUrls = async () => {
      // Note we need a new sign-in URL for each attempt, because it has a unique
      // nonce.
      const signInUrl = await signinAdapter.getSigninUrl();
      signInButton.href = signInUrl;
      signInHeaderButton.href = signInUrl;
      scopesErrorSignInButton.href = signInUrl;
      sharedFlowDialogSignInButton.href = signInUrl;

      // Track the last known sign in URL so that if we receieve the notice that
      // the user wants to see a gallery item we can trigger the sign-in flow
      // without any further interaction.
      autoSignInUrl = signInUrl;
    };

    const showGeoRestrictionDialog = () => {
      genericErrorDialogTitle.textContent = `${Strings.from("APP_NAME")} is not available in your country yet`;
      genericErrorDialog.showModal();
    };

    const onClickSignIn = async (target?: MakeUrlInit) => {
      console.info(`[landing] Awaiting sign-in result`);
      const result = await signinAdapter.signIn();
      console.info(`[landing] Received sign-in result`, result);
      if (!result.ok) {
        const { error } = result;
        await setSignInUrls();
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
      console.info(`[landing] Redirecting after sign-in`, target);
      redirect(target);
    };

    embedIntroVideo(introVideo);

    await setSignInUrls();
    const signInHeaderLabel = signInHeaderButton.querySelector("span");
    if (signInHeaderLabel) {
      signInHeaderLabel.textContent = "Sign in";
    }
    signInButton.innerText = `Try ${Strings.from("APP_NAME")}`;
    signInHeaderButton.addEventListener("click", () => onClickSignIn());
    signInButton.addEventListener("click", () => onClickSignIn());
    document.addEventListener("loadgalleryflow", (evt: Event) => {
      const urlEvent = evt as CustomEvent<GraphInit>;
      onClickSignIn(urlEvent.detail);
      window.open(autoSignInUrl, "_blank");
    });
    scopesErrorSignInButton.addEventListener("click", () => {
      onClickSignIn();
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
      sharedFlowDialogSignInButton.addEventListener("click", () => {
        onClickSignIn();
        sharedFlowDialog.close();
      });
    }
  } catch (err) {
    console.warn(err);
    return;
  }
}

init();
