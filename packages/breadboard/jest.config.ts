// https://kulshekhar.github.io/ts-jest/docs/guides/esm-support/

import { JestConfigWithTsJest } from "ts-jest";
import preset from "ts-jest/presets/index.js";

const jestConfig: JestConfigWithTsJest = {
  ...preset.defaultsESM,
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        useESM: true,
      },
    ],
  },
  testPathIgnorePatterns: [".*/node_modules/.*", ".*/dist/.*"],
};

export default jestConfig;
