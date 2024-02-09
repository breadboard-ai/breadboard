import type { RcFile } from "syncpack";

// https://jamiemason.github.io/syncpack

const config: RcFile = {
  semverGroups: [
    {
      packages: ["@google-labs/*"],
      range: "^",
    },
  ],
};

export default config;
