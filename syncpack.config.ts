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
      packages: ["**"],
      // dependencies: ["@google-labs/**"], // it would also be possible to ignore all dependencies from a specific scope, but that would not catch any local dependencies that are not scoped
      isIgnored: true,
      dependencyTypes: ["local"],
    },
  ],
};

export default config;
