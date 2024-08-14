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
