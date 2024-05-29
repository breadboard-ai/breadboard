/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export async function loadSecretsFromDisk(
  folder: string
): Promise<Map<string, OAuthClientSecretData>> {
  let filenames: string[];
  try {
    filenames = await readdir(folder);
  } catch (e) {
    if ((e as { code: string }).code !== "ENOENT") {
      throw e;
    }
    filenames = [];
  }
  const configs = new Map(
    await Promise.all(
      filenames.map(async (filename) => {
        const text = await readFile(join(folder, filename), "utf8");
        const config = JSON.parse(text) as OAuthClientSecretData;
        const id = filename.replace(/\.json$/, "");
        return [id, config] as const;
      })
    )
  );
  return configs;
}
export interface OAuthClientSecretData {
  web: {
    client_id: string;
    project_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_secret: string;
    redirect_uris: string[];
    javascript_origins: string[];
  };
  __metadata?: {
    title?: string;
    description?: string;
    icon?: string;
    scopes?: string[];
  };
}
