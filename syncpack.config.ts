/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RcFile } from "syncpack";

// https://jamiemason.github.io/syncpack
// https://jamiemason.github.io/syncpack/config/syncpackrc/

const config: RcFile = {
  versionGroups: [
    {
      label: "Ignore local dependencies as they are managed by changesets",
      dependencies: ["@google-labs/**", "@breadboard-ai/**"],
      isIgnored: true,
    },
  ],
};

export default config;
