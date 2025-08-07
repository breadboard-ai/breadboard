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
import { discoverClientDeploymentConfiguration } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";
import * as Shell from "./shell.js";

const deploymentConfiguration = discoverClientDeploymentConfiguration();

function redirect() {
  // Redirect to the main page.
  const redirectUrl = new URL("/", window.location.href);
  redirectUrl.searchParams.set("redirect-from-landing", "true");

  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.has("flow")) {
    redirectUrl.searchParams.set("flow", currentUrl.searchParams.get("flow")!);
  }
  if (currentUrl.searchParams.has("mode")) {
    redirectUrl.searchParams.set("mode", currentUrl.searchParams.get("mode")!);
  }
  if (currentUrl.searchParams.has("shared")) {
    redirectUrl.searchParams.set(
      "shared",
      currentUrl.searchParams.get("shared")!
    );
  }

  window.location.href = redirectUrl.href;
}

if (deploymentConfiguration?.MEASUREMENT_ID) {
  initializeAnalytics(deploymentConfiguration.MEASUREMENT_ID, false);
}

async function init() {
  Shell.showLandingImages();

  const globalConfig = {
    connectionServerUrl: new URL("/connection/", window.location.href).href,
    connectionRedirectUrl: "/oauth/",
    requiresSignin: true,
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
    signInButton.innerText = `Sign in to ${Strings.from("APP_NAME")}`;
    signInButton.addEventListener("click", onClickSignIn);
    scopesErrorSignInButton.addEventListener("click", () => {
      onClickSignIn();
      scopesErrorDialog.close();
    });

    const url = new URL(window.location.href);
    if (url.searchParams.has("geo-restriction")) {
      url.searchParams.delete("geo-restriction");
      window.history.replaceState(null, "", url);
      showGeoRestrictionDialog();
    } else if (url.searchParams.has("missing-scopes")) {
      scopesErrorDialog.showModal();
      url.searchParams.delete("missing-scopes");
      window.history.replaceState(null, "", url);
    } else if (url.searchParams.has("flow")) {
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
