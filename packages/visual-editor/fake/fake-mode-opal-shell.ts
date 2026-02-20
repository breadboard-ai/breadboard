/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CheckAppAccessResult,
  FindUserOpalFolderResult,
  GetDriveCollectorFileResult,
  GuestConfiguration,
  ListUserOpalsResult,
  OpalShellHostProtocol,
  PickDriveFilesOptions,
  PickDriveFilesResult,
  ShareDriveFilesOptions,
  SignInResult,
  SignInState,
  ValidateScopesResult,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import type { BreadboardMessage } from "@breadboard-ai/types/embedder.js";
import { showFakeModeToast } from "./fake-mode-toast.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../src/ui/config/client-deployment-configuration.js";

export { FakeModeOpalShell };

const FAKE_SIGNED_IN_STATE: SignInState = {
  status: "signedin",
  id: "fake-user@example.com",
  domain: "example.com",
  name: "Fake User",
  picture: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="80" font-size="80">🥸</text></svg>`,
  scopes: [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/generative-language.retriever",
  ],
  // TODO: Add authuser once types package is rebuilt.
} as SignInState;

/**
 * A fake implementation of {@link OpalShellHostProtocol} that bypasses real
 * OAuth and returns fake or stub data. Used for local development and automated
 * testing where real authentication or other services are not available or
 * not desired.
 *
 * Starts in a signed-in state. Sign-out/sign-in are supported but bypass OAuth.
 */
class FakeModeOpalShell implements OpalShellHostProtocol {
  #signedIn = true;

  get #currentState(): SignInState {
    return this.#signedIn ? FAKE_SIGNED_IN_STATE : { status: "signedout" };
  }

  getSignInState = async (): Promise<SignInState> => {
    return this.#currentState;
  };

  validateScopes = async (): Promise<ValidateScopesResult> => {
    return { ok: true };
  };

  getConfiguration = async (): Promise<GuestConfiguration> => {
    return {
      consentMessage: "",
      isTestApi: false,
      shareSurface: undefined,
      shareSurfaceUrlTemplates:
        CLIENT_DEPLOYMENT_CONFIG.SHARE_SURFACE_URL_TEMPLATES,
    };
  };

  fetchWithCreds: typeof fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    // In fake mode, just use regular fetch with no auth headers.
    // Drive API calls will be routed to the fake Drive server via the
    // GOOGLE_DRIVE_API_ENDPOINT deployment config.
    return fetch(input, init);
  };

  signIn = async (_scopes: string[] = []): Promise<SignInResult> => {
    this.#signedIn = true;
    return { ok: true, state: this.#currentState };
  };

  signOut = async (): Promise<void> => {
    this.#signedIn = false;
  };

  setUrl = (url: string): void => {
    const { pathname, search, hash } = new URL(url);
    history.replaceState(
      null,
      "",
      new URL(
        (CLIENT_DEPLOYMENT_CONFIG.SHELL_PREFIX || "") +
          pathname +
          search +
          hash,
        window.location.origin
      )
    );
  };

  pickDriveFiles = async (
    _options: PickDriveFilesOptions
  ): Promise<PickDriveFilesResult> => {
    showFakeModeToast("Drive picker is not yet available in fake mode.");
    return { action: "cancel" };
  };

  shareDriveFiles = async (_options: ShareDriveFilesOptions): Promise<void> => {
    showFakeModeToast("Drive sharing is not yet available in fake mode.");
  };

  findUserOpalFolder = async (): Promise<FindUserOpalFolderResult> => {
    return { ok: true, id: "fake-opal-folder" };
  };

  listUserOpals = async (): Promise<ListUserOpalsResult> => {
    return { ok: true, files: [] };
  };

  checkAppAccess = async (): Promise<CheckAppAccessResult> => {
    return { canAccess: true, accessStatus: "ACCESS_STATUS_OK" };
  };

  sendToEmbedder = async (_message: BreadboardMessage): Promise<void> => {
    console.debug("[fake-mode] sendToEmbedder skipped");
  };

  getDriveCollectorFile = async (
    _mimeType: string,
    _connectorId: string,
    _graphId: string
  ): Promise<GetDriveCollectorFileResult> => {
    return { ok: true, id: null };
  };

  trackAction = async (
    _event: string,
    _payload?: Record<string, string | undefined>
  ): Promise<void> => {
    console.debug("[fake-mode] trackAction skipped");
  };

  trackProperties = async (
    _payload: Record<string, string | undefined>
  ): Promise<void> => {
    console.debug("[fake-mode] trackProperties skipped");
  };

  setTitle = (title: string | null): void => {
    const tag = "Opal [Experiment]";
    window.document.title = title ? `${title} - ${tag}` : tag;
  };
}
