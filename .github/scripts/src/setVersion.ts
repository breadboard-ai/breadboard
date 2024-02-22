import * as fs from "fs";

import { Package } from "src/types/package";

export function setVersion(packagePath: string, version: string) {
  console.log(`Setting version of ${packagePath} to ${version}`);
  const packageJson: Package = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  packageJson.version = version;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  return packageJson;
}
