import { Package } from "src";
import { readPackage } from "./readPackage";
import { writePackage } from "./writePackage";

export function renamePackage(packagePath: string, fromScope: string, toScope: string) {
  const packageJson: Package = readPackage(packagePath);
  const currentName = packageJson.name;
  const newName = currentName?.replace(fromScope, toScope);

  console.log(`name`, ` ${currentName} -> ${newName}`);
  packageJson.name = newName;
  writePackage(packagePath, packageJson);
  return packageJson;
}
