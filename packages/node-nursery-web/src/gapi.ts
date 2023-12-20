/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type GAPI = typeof gapi;
export type GoogleClient = typeof gapi.client;

export type DiscoveryDoc = string;
export type APIKey = string;
export type APIs = Record<DiscoveryDoc, APIKey>;
export type ClientWithAPIs = GoogleClient & Record<APIKey, object>;

export const loadGapi = async (): Promise<GAPI> => {
  if (!globalThis.document) {
    throw new Error("Cannot load gapi outside of a browser environment");
  }
  return (
    globalThis.gapi ||
    new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.onload = () => {
        resolve(globalThis.gapi);
      };
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    })
  );
};

export const loadClient = async (gapi: GAPI): Promise<GoogleClient> => {
  return (
    gapi.client ||
    new Promise((resolve) => {
      gapi.load("client", () => {
        resolve(gapi.client);
      });
    })
  );
};

export const loadAPIs = async (client: GoogleClient, apis: APIs) => {
  const scopesToInitialize = Object.entries(apis)
    .filter(([_, key]) => {
      return !(client as ClientWithAPIs)[key];
    })
    .map(([url, _]) => url);
  await client.init({
    discoveryDocs: scopesToInitialize,
  });
  return client as ClientWithAPIs;
};
