/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

import { bootstrap } from "@breadboard-ai/visual-editor/bootstrap";
import { asRuntimeKit, baseURLFromContext, err } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import { isA2 } from "@breadboard-ai/a2";
import { JsonSerializable, LLMContent } from "@breadboard-ai/types";

const endpoint_url =
  import.meta.env.VITE_BACKEND_API_ENDPOINT ||
  "https://staging-appcatalyst.sandbox.googleapis.com/v1beta1/executeStep";

import { Handler } from "@breadboard-ai/embed";

bootstrap({
  connectionServerUrl: new URL("/connection/", window.location.href),
  requiresSignin: true,
  kits: [asRuntimeKit(Core)],
  defaultBoardService: "/board/",
  moduleInvocationFilter: (context) => {
    if (!import.meta.env.VITE_NO_3P_MODULES) return;
    if (!isA2(baseURLFromContext(context))) {
      return err(`This module is not allowed to run in this configuration`);
    }
  },
  env: [
    {
      path: "/env/settings/backend",
      data: toLLMContent({ endpoint_url }),
    },
  ],
  embedHandler: window.self !== window.top ? new Handler() : undefined,
});

function toLLMContent(json: JsonSerializable): LLMContent[] {
  return [{ parts: [{ json }] }];
}
