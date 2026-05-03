/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Browser-side OAuth 2.0 consent flow for MCP servers.
 *
 * Orchestrates the Authorization Code + PKCE flow entirely from the
 * browser:
 *
 * 1. Read `.env` from the hive root to expand `${VAR}` references.
 * 2. Build the authorization URL with PKCE challenge.
 * 3. Open a popup to the OAuth consent page.
 * 4. Receive the authorization code via `postMessage` from the callback
 *    page (`/oauth-callback.html`).
 * 5. Exchange the code for tokens via `fetch` to the token endpoint.
 * 6. Write the token file to `hive/.mcp-tokens/<name>.json`.
 *
 * The token file format matches what `HiveTokenStorage` (Python) reads,
 * so the box can consume tokens written by hivetool and vice versa.
 */

import type { OAuthConfig } from "./system-store.js";

export { startOAuthFlow, checkTokenStatus, type OAuthFlowResult };

// Google's OAuth endpoints.
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const MCP_TOKENS_DIR = ".mcp-tokens";

/** Result of a consent flow attempt. */
interface OAuthFlowResult {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// PKCE
// ---------------------------------------------------------------------------

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64urlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return base64urlEncode(new Uint8Array(digest));
}

function base64urlEncode(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateState(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return base64urlEncode(array);
}

// ---------------------------------------------------------------------------
// .env file reading
// ---------------------------------------------------------------------------

/**
 * Read and parse a `.env` file from the hive root directory.
 * Returns a map of VAR_NAME → value.
 */
async function readEnvFile(
  hiveHandle: FileSystemDirectoryHandle,
): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  try {
    const fileHandle = await hiveHandle.getFileHandle(".env");
    const file = await fileHandle.getFile();
    const text = await file.text();

    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;

      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();

      // Strip surrounding quotes.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  } catch {
    // .env file doesn't exist — that's fine.
  }
  return env;
}

/**
 * Expand `${VAR}` references in a string using the provided env map.
 */
function expandEnvRefs(value: string, env: Record<string, string>): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, name) => env[name] ?? "");
}

// ---------------------------------------------------------------------------
// Token file I/O
// ---------------------------------------------------------------------------

async function writeTokenFile(
  hiveHandle: FileSystemDirectoryHandle,
  serverName: string,
  data: Record<string, unknown>,
): Promise<void> {
  const tokensDir = await hiveHandle.getDirectoryHandle(MCP_TOKENS_DIR, {
    create: true,
  });
  const fileHandle = await tokensDir.getFileHandle(`${serverName}.json`, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2) + "\n");
  await writable.close();
}

async function readTokenFile(
  hiveHandle: FileSystemDirectoryHandle,
  serverName: string,
): Promise<Record<string, unknown> | null> {
  try {
    const tokensDir = await hiveHandle.getDirectoryHandle(MCP_TOKENS_DIR);
    const fileHandle = await tokensDir.getFileHandle(`${serverName}.json`);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Token status
// ---------------------------------------------------------------------------

/**
 * Check whether a token file exists for the given MCP server.
 * Returns "authenticated" if tokens exist, "none" otherwise.
 */
async function checkTokenStatus(
  hiveHandle: FileSystemDirectoryHandle,
  serverName: string,
): Promise<"authenticated" | "none"> {
  const data = await readTokenFile(hiveHandle, serverName);
  if (data && data.tokens) return "authenticated";
  return "none";
}

// ---------------------------------------------------------------------------
// OAuth flow
// ---------------------------------------------------------------------------

/**
 * Start the OAuth consent flow for an MCP server.
 *
 * Opens a popup window to Google's consent page, waits for the callback,
 * exchanges the code for tokens, and writes the token file.
 */
async function startOAuthFlow(
  hiveHandle: FileSystemDirectoryHandle,
  serverName: string,
  oauth: OAuthConfig,
): Promise<OAuthFlowResult> {
  // 1. Read .env to expand credential references.
  const env = await readEnvFile(hiveHandle);
  const clientId = expandEnvRefs(oauth.client_id, env);
  const clientSecret = expandEnvRefs(oauth.client_secret, env);

  if (!clientId) {
    return {
      success: false,
      error: `Could not resolve client_id from "${oauth.client_id}". ` +
        "Check your .env file.",
    };
  }

  // 2. Generate PKCE parameters and state.
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();
  const redirectUri = `${window.location.origin}/oauth-callback.html`;

  // 3. Build authorization URL.
  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: oauth.scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  });
  const authUrl = `${GOOGLE_AUTH_ENDPOINT}?${authParams}`;

  // 4. Open popup and wait for callback.
  const callbackResult = await openPopupAndWaitForCallback(authUrl, state);
  if (!callbackResult.success) return callbackResult;
  const { code } = callbackResult;

  // 5. Exchange code for tokens.
  const tokenResult = await exchangeCodeForTokens(
    code!,
    clientId,
    clientSecret,
    redirectUri,
    codeVerifier,
  );
  if (!tokenResult.success) return tokenResult;

  // 6. Write token file.
  const tokenData = {
    tokens: tokenResult.tokens,
    client_info: {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: null,
    },
  };

  try {
    await writeTokenFile(hiveHandle, serverName, tokenData);
  } catch (e) {
    return {
      success: false,
      error: `Failed to write token file: ${e instanceof Error ? e.message : e}`,
    };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Popup management
// ---------------------------------------------------------------------------

function openPopupAndWaitForCallback(
  authUrl: string,
  expectedState: string,
): Promise<OAuthFlowResult & { code?: string }> {
  return new Promise((resolve) => {
    const popup = window.open(
      authUrl,
      "oauth-consent",
      "width=600,height=700,scrollbars=yes,resizable=yes",
    );

    if (!popup) {
      resolve({
        success: false,
        error: "Popup was blocked. Please allow popups for this site.",
      });
      return;
    }

    // Timeout after 5 minutes.
    const timeout = setTimeout(() => {
      cleanup();
      resolve({
        success: false,
        error: "Authentication timed out. Please try again.",
      });
    }, 5 * 60 * 1000);

    // Poll for popup closed by user.
    const pollInterval = setInterval(() => {
      if (popup.closed) {
        cleanup();
        resolve({
          success: false,
          error: "Authentication window was closed.",
        });
      }
    }, 500);

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "oauth-callback") return;

      cleanup();

      const { code, state } = event.data;
      if (state !== expectedState) {
        resolve({
          success: false,
          error: "State mismatch — possible CSRF attack. Please try again.",
        });
        return;
      }

      resolve({ success: true, code });
    }

    function cleanup() {
      clearTimeout(timeout);
      clearInterval(pollInterval);
      window.removeEventListener("message", onMessage);
      try {
        popup?.close();
      } catch {
        // Already closed.
      }
    }

    window.addEventListener("message", onMessage);
  });
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<OAuthFlowResult & { tokens?: Record<string, unknown> }> {
  try {
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        error: `Token exchange failed (${response.status}): ${body}`,
      };
    }

    const tokens = await response.json();
    return { success: true, tokens };
  } catch (e) {
    return {
      success: false,
      error: `Token exchange error: ${e instanceof Error ? e.message : e}`,
    };
  }
}
