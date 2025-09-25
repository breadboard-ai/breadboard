/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type LanguagePack,
  SETTINGS_TYPE,
} from "@breadboard-ai/shared-ui/types/types.js";
import { SigninAdapter } from "@breadboard-ai/shared-ui/utils/signin-adapter";
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
} from "@breadboard-ai/shared-ui/utils/urls.js";

const parsedUrl = parseUrl(window.location.href) as LandingUrlInit;
if (parsedUrl.page !== "landing") {
  console.warn("unexpected parse of landing page url", parsedUrl);
}

const deploymentConfiguration = CLIENT_DEPLOYMENT_CONFIG;

function redirect() {
  window.location.href = makeUrl(parsedUrl.redirect);
}

if (deploymentConfiguration?.MEASUREMENT_ID) {
  initializeAnalytics(deploymentConfiguration.MEASUREMENT_ID, false);
}

async function init() {
  Shell.showLandingImages();

  const globalConfig = {
    connectionServerUrl: new URL("/connection/", window.location.href).href,
    connectionRedirectUrl: "/oauth/",
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
      get: (conectionId: string) => {
        return settingsHelper.get(SETTINGS_TYPE.CONNECTIONS, conectionId)
          ?.value as string;
      },
      set: async (connectionId: string, grant: string) => {
        await settingsHelper.set(SETTINGS_TYPE.CONNECTIONS, connectionId, {
          name: connectionId,
          value: grant,
        });
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
      sharedFlowDialog,
      sharedFlowDialogSignInButton,
      sharedFlowDialogTitle,
    } = Shell.obtainElements();

    const setSignInUrls = async () => {
      // Note we need a new sign-in URL for each attempt, because it has a unique
      // nonce.
      const signInUrl = await signinAdapter.getSigninUrl();
      signInButton.href = signInUrl;
      signInHeaderButton.href = signInUrl;
      scopesErrorSignInButton.href = signInUrl;
      sharedFlowDialogSignInButton.href = signInUrl;
    };

    const showGeoRestrictionDialog = () => {
      genericErrorDialogTitle.textContent = `${Strings.from("APP_NAME")} is not available in your country yet`;
      genericErrorDialog.showModal();
    };

    const onClickSignIn = async () => {
      if (!signinAdapter) {
        return;
      }

      const result = await signinAdapter.signIn();
      if (!result.ok) {
        const { error } = result;
        console.warn(error);
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
          genericErrorDialog.showModal();
        }
        return;
      }

      ActionTracker.signInSuccess();
      redirect();
    };

    await setSignInUrls();
    signInHeaderButton.innerText = "Sign in";
    signInButton.innerText = `Sign in with Google`;
    signInHeaderButton.addEventListener("click", onClickSignIn);
    signInButton.addEventListener("click", onClickSignIn);
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
