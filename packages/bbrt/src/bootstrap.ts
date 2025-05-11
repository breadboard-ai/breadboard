/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

import { BBRTMain } from "./components/main.js";

document.body.appendChild(
  new BBRTMain({
    connectionServerUrl: import.meta.env["VITE_CONNECTION_SERVER_URL"],
    connectionRedirectUrl: "/oauth/",
    plugins: {
      input: [],
    },
    googleDrive: {
      publishPermissions: [],
      publicApiKey: "",
    },
  })
);
