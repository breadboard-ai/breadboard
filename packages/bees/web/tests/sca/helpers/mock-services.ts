/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { mock } from "node:test";
import { AppServices } from "../../../src/sca/types.js";

export function makeTestServices(): { services: AppServices } {
  return {
    services: {
      api: {
        getPulse: mock.fn(),
        listFiles: mock.fn(async () => []),
        getFile: mock.fn(),
        createTicket: mock.fn(),
        respond: mock.fn(),
        sendEvent: mock.fn(),
      },
      sse: {
        connect: mock.fn(),
        close: mock.fn(),
      },
      hostCommunication: {
        connect: mock.fn(),
        dispose: mock.fn(),
        send: mock.fn(async () => {}),
      },
    } as unknown as AppServices,
  };
}
