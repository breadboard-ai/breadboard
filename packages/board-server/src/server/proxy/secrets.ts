/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import type { Kit } from "@google-labs/breadboard";
import type { SecretInputs } from "../types.js";

const url = import.meta.url;

const getProjectId = async () => {
  let projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (projectId) return projectId;

  const service = process.env.K_SERVICE;
  if (service) {
    // Try metadata paths for Cloud Run.
    const metadataServer = "http://metadata.google.internal";
    const projectIdPath = "/computeMetadata/v1/project/project-id";
    try {
      const response = await fetch(`${metadataServer}${projectIdPath}`, {
        headers: {
          "Metadata-Flavor": "Google",
        },
      });
      projectId = await response.text();
    } catch (e) {
      throw new Error(`Failed to fetch project ID from metadata server: ${e}`);
    }
  }
  if (!projectId) {
    throw new Error("Please set GOOGLE_CLOUD_PROJECT environment variable.");
  }
  return projectId;
};

const PROJECT_ID = await getProjectId();

const secretManager = new SecretManagerServiceClient();

type SecretMapEntry = {
  secret: string;
  origin: string | null;
};

const secretsMap = new Map<string, SecretMapEntry>();

const getKey = async (key: string) => {
  if (secretsMap.has(key)) {
    const entry = secretsMap.get(key);
    return [key, entry?.secret, entry?.origin];
  }
  const name = secretManager.secretVersionPath(PROJECT_ID, key, "latest");
  const secretName = secretManager.secretPath(PROJECT_ID, key);
  const [secret] = await secretManager.getSecret({ name: secretName });
  if (!secret) {
    throw new Error(`Missing secret: ${key}`);
  }
  const origin = secret.annotations?.["origin"] || null;
  const [version] = await secretManager.accessSecretVersion({ name });
  const payload = version?.payload?.data;
  if (!payload) {
    throw new Error(`Missing secret: ${key}`);
  }
  const value = payload.toString();
  secretsMap.set(key, { secret: value, origin });
  return [key, value, origin];
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
