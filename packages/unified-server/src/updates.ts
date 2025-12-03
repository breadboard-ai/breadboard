/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response } from "express";

export { createUpdatesHandler };

const UPDATES_URL =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/refs/heads/main/docs/updates.json";
const UPDATE_CACHE_DURATION_MS = 10 * 60 * 1000;

function createUpdatesHandler() {
  let fetching = fetchUpdates();
  let expiresOn = Date.now() + UPDATE_CACHE_DURATION_MS;

  return async (req: Request, res: Response) => {
    if (!req.path || req.path === "/") {
      if (Date.now() > expiresOn) {
        fetching = fetchUpdates();
      }
      const updates = await fetching;
      res.send(updates);
      return;
    }
    res.status(404).send("Page not found");
  };

  async function fetchUpdates() {
    try {
      const response = await fetch(UPDATES_URL);
      return await response.text();
    } catch (e) {
      console.warn("Unable to fetch update", (e as Error).message);
      return JSON.stringify("error");
    } finally {
      expiresOn = Date.now() + UPDATE_CACHE_DURATION_MS;
    }
  }
}
