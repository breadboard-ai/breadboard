/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task } from "@lit/task";
import type { ReactiveControllerHost } from "lit";
import type { Environment } from "../../contexts/environment.js";

export function fetchAvailableConnections(
  host: ReactiveControllerHost,
  environment: () => Environment | undefined,
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

// IMPORTANT: Keep in sync with
// breadboard/packages/connection-server/src/api/list.ts
interface ListConnectionsResponse {
  connections: Connection[];
}

export interface Connection {
  id: string;
  authUrl: string;
  title: string;
  description?: string;
  icon?: string;
}
