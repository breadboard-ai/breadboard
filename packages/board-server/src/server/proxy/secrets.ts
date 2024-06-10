/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import type { Kit } from "@google-labs/breadboard";

const url = import.meta.url;

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;

if (!PROJECT_ID) {
  throw new Error("Please set GOOGLE_CLOUD_PROJECT environment variable.");
}

type SecretInputs = {
  keys: string[];
};

const secretManager = new SecretManagerServiceClient();

const secretsMap = new Map<string, string>();

const getKey = async (key: string) => {
  if (secretsMap.has(key)) {
    return [key, secretsMap.get(key)];
  }
  const name = secretManager.secretVersionPath(PROJECT_ID, key, "latest");
  const [version] = await secretManager.accessSecretVersion({ name });
  const payload = version?.payload?.data;
  if (!payload) {
    throw new Error(`Missing secret: ${key}`);
  }
  const value = payload.toString();
  secretsMap.set(key, value);
  return [key, value];
};

/**
 * The simplest possible Kit that contains a "secrets" node that talks to the
 * Google Cloud Secret Manager.
 */
export const secretsKit: Kit = {
  url,
  handlers: {
    secrets: async (inputs) => {
      const { keys } = inputs as SecretInputs;
      const entries = await Promise.all(keys.map(getKey));
      return Object.fromEntries(entries);
    },
  },
};
