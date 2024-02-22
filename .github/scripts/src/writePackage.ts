import * as fs from "fs";
import path from "path";

import { Package } from "src/types/package";

export function writePackage(packagePath: string, packageJson: Package) {
  if (fs.lstatSync(packagePath).isDirectory()) {
    packagePath = path.resolve(packagePath, "package.json");
  }
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
}
