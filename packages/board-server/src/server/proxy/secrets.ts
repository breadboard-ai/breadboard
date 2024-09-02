/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import type { Kit } from "@google-labs/breadboard";
import type { SecretInputs } from "../types.js";
import { hasOrigin, type TunnelSpec } from "@google-labs/breadboard/remote";

const url = import.meta.url;

const getProjectId = async () => {
  let backend = process.env.STORAGE_BACKEND;
  if (backend !== "firestore") {
    // For now, return "none" if we're not using Firestore
    // backend.
    // TODO: Implement support for secret managers outside
    // of Cloud Run.
    return "none";
  }
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

export type SecretMapEntry = {
  secret: string;
  origin: string | null;
};

const secretsMap = new Map<string, SecretMapEntry>();

const getAnnotation = async (name: string) => {
  const secretName = secretManager.secretPath(PROJECT_ID, name);
  const [secret] = await secretManager.getSecret({ name: secretName });
  if (!secret) {
    throw new Error(`Missing secret: ${name}`);
  }
  const origin = secret.annotations?.["origin"] || null;
  return origin;
};

const getKey = async (key: string) => {
  if (secretsMap.has(key)) {
    const entry = secretsMap.get(key);
    return [key, entry?.secret, entry?.origin];
  }
  const name = secretManager.secretVersionPath(PROJECT_ID, key, "latest");
  const secretName = secretManager.secretPath(PROJECT_ID, key);
  try {
    const [secret] = await secretManager.getSecret({ name: secretName });
    const origin = secret.annotations?.["origin"] || null;
    const [version] = await secretManager.accessSecretVersion({ name });
    const payload = version?.payload?.data;
    if (!payload) {
      throw new Error(`Missing secret: ${key}`);
    }
    const value = payload.toString();
    secretsMap.set(key, { secret: value, origin });
    return [key, value, origin];
  } catch (e) {
    throw new Error(`Failed to get secret: ${key}`);
  }
};

export const getSecretList = async (): Promise<SecretMapEntry[]> => {
  const [secrets] = await secretManager.listSecrets({
    parent: `projects/${PROJECT_ID}`,
  });
  const secretNames = secrets
    .map((s) => s.name?.split("/").pop())
    .filter(Boolean) as string[];
  const entries = await Promise.all(
    secretNames.map(async (name) => {
      const origin = await getAnnotation(name);
      if (!origin) {
        return null;
      }
      return { secret: name, origin };
    })
  );
  return entries.filter(Boolean) as SecretMapEntry[];
};

export const buildSecretsTunnel = async (): Promise<TunnelSpec> => {
  const secrets = await getSecretList();
  return Object.fromEntries(
    secrets.map(({ secret, origin }) => {
      return [
        secret,
        {
          to: "fetch",
          when: {
            url: hasOrigin(origin!),
          },
        },
      ];
    })
  );
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
