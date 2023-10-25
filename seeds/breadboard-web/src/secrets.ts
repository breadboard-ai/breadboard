/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeValue, OutputValues } from "@google-labs/breadboard";

const PROXIED_PREFIX = "PROXIED_";

const SECRET_SCANNER = new RegExp(`${PROXIED_PREFIX}([0-9a-f]{12})`, "gm");

type Secret = {
  token: string;
  value?: string;
};

export const secretReplacer = (
  value: NodeValue,
  secrets: Record<string, string>
) => {
  const json = JSON.stringify(value);
  return JSON.parse(
    json.replace(SECRET_SCANNER, (substring: string, token: string) => {
      const secret = secrets[token];
      console.log("secretReplacer", substring, token, secret);
      return secret ?? substring;
    })
  );
};

export const generateToken = () => {
  return Array.from(
    globalThis.crypto.getRandomValues(new Uint8Array(6)),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
};

export class SecretKeeper {
  secrets: Record<string, Secret> = {};

  hasSecrets(value: NodeValue) {
    const s = typeof value === "string" ? value : "";
    return s.startsWith(PROXIED_PREFIX);
  }

  addSecretValue(name: string, value: string) {
    const secret = this.secrets[name];
    if (!secret)
      throw new Error(
        `No secret named ${name} was found. This means that the secret value was requested before it was set, which is probably a bug.`
      );
    secret.value = value;
  }

  getSecretValue(name: string) {
    const secret = this.secrets[name];
    return secret?.value;
  }

  addSecretToken(name: string) {
    const token = `${PROXIED_PREFIX}${generateToken()}`;
    this.secrets[name] = { token };
    return token;
  }

  addSecretTokens(keys: string[]) {
    return keys.reduce((acc, key) => {
      acc[key] = this.addSecretToken(key);
      return acc;
    }, {} as OutputValues);
  }
}
