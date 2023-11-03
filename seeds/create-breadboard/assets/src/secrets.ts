/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeValue, OutputValues } from "@google-labs/breadboard";

const PROXIED_PREFIX = "PROXIED_";

const SECRET_SCANNER = new RegExp(`${PROXIED_PREFIX}([0-9a-f]{12})`, "gm");

type Secret = {
  name: string;
  value?: string;
};

export const secretScanner = (value: NodeValue) => {
  const json = JSON.stringify(value);
  const tokens: string[] = [];
  json.replace(SECRET_SCANNER, (substring: string, token: string) => {
    tokens.push(token);
    return substring;
  });
  return tokens;
};

export const secretReplacer = (
  value: NodeValue,
  secrets: Record<string, string>
) => {
  const json = JSON.stringify(value);
  return JSON.parse(
    json.replace(
      SECRET_SCANNER,
      (substring: string, token: string) => secrets[token] ?? substring
    )
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

  findSecrets(value: NodeValue) {
    return secretScanner(value);
  }

  revealSecrets(value: NodeValue, secrets: string[]) {
    const revealed = secrets.reduce((acc, secret) => {
      acc[secret] = this.secrets[secret]?.value || "";
      return acc;
    }, {} as Record<string, string>);
    return secretReplacer(value, revealed);
  }

  getSecret(token: string) {
    return this.secrets[token];
  }

  addSecretToken(name: string) {
    const token = generateToken();
    const tokenString = `${PROXIED_PREFIX}${token}`;
    this.secrets[token] = { name };
    return tokenString;
  }

  addSecretTokens(keys: string[]) {
    return keys.reduce((acc, key) => {
      acc[key] = this.addSecretToken(key);
      return acc;
    }, {} as OutputValues);
  }
}
