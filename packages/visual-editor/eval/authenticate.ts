/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { readFile, writeFile } from "fs/promises";
import { Credentials } from "google-auth-library/build/src/auth/credentials.js";
import { OAuth2Client } from "google-auth-library/build/src/auth/oauth2client.js";
import { createServer } from "http";
import path from "path";

export { getAuthenticatedClient };

const ROOT_DIR = path.join(import.meta.dirname, "../../..");

const SCOPES: string[] = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/generative-language.retriever",
];
const TOKEN_PATH = path.join(ROOT_DIR, "token.local.json");
const PORT = 3000;
const REDIRECT_URL = `http://localhost:${PORT}`;

async function getAuthenticatedClient(): Promise<OAuth2Client> {
  config({ quiet: true });

  const clientId = process.env.OAUTH_CLIENT;
  const clientSecret = process.env.OAUTH_SECRET;

  const oAuth2Client = new OAuth2Client(clientId, clientSecret, REDIRECT_URL);

  try {
    const tokenFile = await readFile(TOKEN_PATH, "utf-8");
    const tokens: Credentials = JSON.parse(tokenFile);
    oAuth2Client.setCredentials(tokens);
    return oAuth2Client;
  } catch {
    return await authenticateWithServer(oAuth2Client);
  }
}

function authenticateWithServer(
  oAuth2Client: OAuth2Client
): Promise<OAuth2Client> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        if (!req.url) return;

        const urlParams = new URL(req.url, REDIRECT_URL).searchParams;
        const code = urlParams.get("code");

        if (!code) {
          res.end("Authentication failed: No code found.");
          return;
        }

        res.end("Authentication successful! You can return to your terminal.");
        server.close();

        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        resolve(oAuth2Client);
      } catch (err) {
        reject(err);
      }
    });

    server.listen(PORT, () => {
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent",
      });

      console.log("\x1b[36m%s\x1b[0m", "--- ACTION REQUIRED ---");
      console.log("Authorize this app by visiting this URL:");
      console.log("\x1b[34m%s\x1b[0m", authUrl);
    });
  });
}
