import type { RcFile } from "syncpack";

// https://jamiemason.github.io/syncpack
// https://jamiemason.github.io/syncpack/config/syncpackrc/

const config: RcFile = {
  semverGroups: [
    {
      dependencies: ["@google-labs/**"],
      isIgnored: true,
    },
    {
      // this can be used to ignore a given dependency in a given package
      packages: [],
      dependencies: [],
      isIgnored: true,
    }
  ],
};

export default config;
