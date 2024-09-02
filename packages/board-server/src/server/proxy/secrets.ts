/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import type { Kit } from "@google-labs/breadboard";
import type { SecretInputs } from "../types.js";
import { hasOrigin, type TunnelSpec } from "@google-labs/breadboard/remote";

export type SecretsStore = {
  getList: () => Promise<SecretMapEntry[]>;
  getKey(
    key: string
  ): Promise<[name: string, value: string, origin?: string | null] | null>;
};

export type SecretMapEntry = {
  secret: string;
  origin: string | null;
};

export const buildSecretsTunnel = async (): Promise<TunnelSpec> => {
  const secrets = await SecretsProvider.instance().getList();
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

class SecretManagerProvider implements SecretsStore {
  #projectId: Promise<string>;
  #secretManager = new SecretManagerServiceClient();
  #secretsMap = new Map<string, SecretMapEntry>();

  constructor() {
    this.#projectId = this.#getProjectId();
  }

  async #getProjectId() {
    let backend = process.env.STORAGE_BACKEND;
    if (backend && backend !== "firestore") {
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
        throw new Error(
          `Failed to fetch project ID from metadata server: ${e}`
        );
      }
    }
    if (!projectId) {
      throw new Error("Please set GOOGLE_CLOUD_PROJECT environment variable.");
    }
    return projectId;
  }

  async #getAnnotation(name: string) {
    const projectId = await this.#projectId;
    const secretName = this.#secretManager.secretPath(projectId, name);
    const [secret] = await this.#secretManager.getSecret({ name: secretName });
    if (!secret) {
      throw new Error(`Missing secret: ${name}`);
    }
    const origin = secret.annotations?.["origin"] || null;
    return origin;
  }

  async getList(): Promise<SecretMapEntry[]> {
    const projectId = await this.#projectId;
    try {
      const [secrets] = await this.#secretManager.listSecrets({
        parent: `projects/${projectId}`,
      });
      const secretNames = secrets
        .map((s) => s.name?.split("/").pop())
        .filter(Boolean) as string[];
      const entries = await Promise.all(
        secretNames.map(async (name) => {
          const origin = await this.#getAnnotation(name);
          if (!origin) {
            return null;
          }
          return { secret: name, origin };
        })
      );
      return entries.filter(Boolean) as SecretMapEntry[];
    } catch (e) {
      throw new Error(`Failed to list secrets: ${e}`);
    }
  }

  async getKey(
    key: string
  ): Promise<[name: string, value: string, origin?: string | null] | null> {
    if (this.#secretsMap.has(key)) {
      const entry = this.#secretsMap.get(key);
      return [key, entry?.secret as string, entry?.origin];
    }
    const projectId = await this.#projectId;
    const name = this.#secretManager.secretVersionPath(
      projectId,
      key,
      "latest"
    );
    const secretName = this.#secretManager.secretPath(projectId, key);
    try {
      const [secret] = await this.#secretManager.getSecret({
        name: secretName,
      });
      const origin = secret.annotations?.["origin"] || null;
      const [version] = await this.#secretManager.accessSecretVersion({ name });
      const payload = version?.payload?.data;
      if (!payload) {
        throw new Error(`Missing secret: ${key}`);
      }
      const value = payload.toString();
      this.#secretsMap.set(key, { secret: value, origin });
      return [key, value, origin];
    } catch (e) {
      throw new Error(`Failed to get secret: ${key}`);
    }
  }
}

class SecretsProvider implements SecretsStore {
  #store: SecretsStore;

  constructor() {
    this.#store = new SecretManagerProvider();
    this.getKey = this.getKey.bind(this);
  }

  getList(): Promise<SecretMapEntry[]> {
    return this.#store.getList();
  }

  getKey(
    key: string
  ): Promise<[name: string, value: string, origin?: string | null] | null> {
    return this.#store.getKey(key);
  }

  static #instance: SecretsProvider | null = null;
  static instance() {
    if (!SecretsProvider.#instance) {
      SecretsProvider.#instance = new SecretsProvider();
    }
    return SecretsProvider.#instance;
  }
}

/**
 * The simplest possible Kit that contains a "secrets" node that talks to the
 * Google Cloud Secret Manager.
 */
export const secretsKit: Kit = {
  url: import.meta.url,
  handlers: {
    secrets: async (inputs) => {
      const getKey = SecretsProvider.instance().getKey;
      const { keys } = inputs as SecretInputs;
      const entries = await Promise.all(keys.map(getKey));
      return Object.fromEntries(entries as [string, string][]);
    },
  },
};
