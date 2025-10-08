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
    {
      label: "Ignore express because we're using both v4 and v5 and that's ok",
      dependencies: ["express", "@types/express"],
      isIgnored: true,
    },
  ],
};

export default config;
