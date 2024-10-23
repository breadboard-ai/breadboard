/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task } from "@lit/task";
import type { ReactiveControllerHost } from "lit";
import type {
  Connection,
  ConnectionEnvironment,
  ListConnectionsResponse,
} from "./types.js";

export function fetchAvailableConnections(
  host: ReactiveControllerHost,
  environment: () => ConnectionEnvironment | undefined,
  autoRun: boolean
): Task<readonly unknown[], Connection[]> {
  return new Task(host, {
    autoRun,
    args: () => [environment()?.connectionServerUrl],
    task: async ([connectionServerUrl], { signal }) => {
      if (!connectionServerUrl) {
        return [];
      }
      const httpRes = await fetch(new URL("list", connectionServerUrl), {
        signal,
        credentials: "include",
      });
      if (!httpRes.ok) {
        throw new Error(String(httpRes.status));
      }
      const jsonRes = (await httpRes.json()) as ListConnectionsResponse;
      return jsonRes.connections;
    },
  });
}
