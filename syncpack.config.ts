/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RcFile } from "syncpack";

// https://jamiemason.github.io/syncpack
// https://jamiemason.github.io/syncpack/config/syncpackrc/

const exampleIgnoredVersionGroup = {
  // this is an example of a dependency that will be ignored in a specific package if added to the version groups array
  packages: ["@google-labs/agent-kit"],
  dependencies: ["@types/node"],
  isIgnored: true,
};

const config: RcFile = {
  versionGroups: [
    {
      label: "Ignore local dependencies as they are managed by changesets",
      dependencies: ["@google-labs/**"],
      isIgnored: true,
    },
  ],
};

export default config;
