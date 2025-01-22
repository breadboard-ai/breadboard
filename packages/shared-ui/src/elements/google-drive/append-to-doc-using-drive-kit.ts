/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TokenVendor } from "@breadboard-ai/connection-client";
import GoogleDriveKit from "@breadboard-ai/google-drive-kit/google-drive.kit.json" with { type: "json" };
import { WebSandbox } from "@breadboard-ai/jsandbox/web";
import type {
  GraphDescriptor,
  LLMContent,
  NodeValue,
} from "@breadboard-ai/types";
import {
  addSandboxedRunModule,
  asRuntimeKit,
  createDefaultDataStore,
  createLoader,
  type OutputValues,
} from "@google-labs/breadboard";
import { createRunner } from "@google-labs/breadboard/harness";
import CoreKit from "@google-labs/core-kit";
import webSandboxWasm from "/sandbox.wasm?url";

/**
 * Finds or creates a Google Doc in the root of the signed-in user's Google
 * Drive using the title as a key, and appends the given content to it.
 */
export async function appendToDocUsingDriveKit(
  context: LLMContent,
  title: string,
  tokenVendor: TokenVendor
): Promise<{ fileId: string; url: string }> {
  const runner = createRunner({
    url: window.location.href,
    kits: addSandboxedRunModule(
      new WebSandbox(new URL(webSandboxWasm, window.location.href)),
      [asRuntimeKit(CoreKit)]
    ),
    runner: GoogleDriveKit.graphs.appendToDoc as GraphDescriptor,
    loader: createLoader(),
    store: createDefaultDataStore(),
    interactiveSecrets: true,
  });

  const outputs = await new Promise<OutputValues[]>((resolve, reject) => {
    const outputs: OutputValues[] = [];
    runner.addEventListener("input", () => {
      void runner.run({ context: [context as NodeValue], title });
    });
    runner.addEventListener("output", (event) => {
      outputs.push(event.data.outputs);
    });
    runner.addEventListener("end", () => {
      resolve(outputs);
    });
    runner.addEventListener("error", (event) => {
      reject(event.data.error);
    });
    runner.addEventListener("secret", async (event) => {
      try {
        const secrets = await getSecrets(event.data.keys, tokenVendor);
        void runner.run(secrets);
      } catch (error) {
        reject(error);
      }
    });
    void runner.run();
  });

  if (outputs.length !== 1) {
    throw new Error(`Expected 1 output, got ${JSON.stringify(outputs)}`);
  }
  const first: { id?: unknown } = outputs[0];
  const fileId = first.id;
  if (!fileId || typeof fileId !== "string") {
    throw new Error(
      `Expected {"id": "<fileId>"}, got ${JSON.stringify(first)}`
    );
  }
  return {
    fileId,
    url: `https://docs.google.com/document/d/${fileId}/edit`,
  };
}

async function getSecrets(
  names: string[],
  tokenVendor: TokenVendor
): Promise<Record<string, string>> {
  return Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [name, await getSecret(name, tokenVendor)])
    )
  );
}

async function getSecret(
  name: string,
  tokenVendor: TokenVendor
): Promise<string> {
  if (name.startsWith("connection:")) {
    const connectionId = name.slice("connection:".length);
    const token = tokenVendor.getToken(connectionId);
    if (token.state === "valid") {
      return token.grant.access_token;
    } else if (token.state === "expired") {
      return (await token.refresh()).grant.access_token;
    } else if (token.state === "signedout") {
      const niceName =
        name === "connection:google-drive-limited"
          ? "Google Drive (Limited)"
          : name;
      throw new Error(
        `Please sign in to ${niceName} via Settings > Connections`
      );
    } else {
      throw new Error(`Unexpected token state`, token satisfies never);
    }
  } else {
    throw new Error(
      `Unexpected non-connection secret ${JSON.stringify(name)}.`
    );
  }
}
