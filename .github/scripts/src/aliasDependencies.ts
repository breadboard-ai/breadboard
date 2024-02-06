import * as fs from "fs";
import { Package, depTypes, spacer } from "src";
import { writePackage } from "./writePackage";

export async function aliasDependencies(packagePath: string, packagesToRescope: string[], fromScope: string, toScope: string, dependencyVersion = "*") {
  spacer({ count: 40 });
  console.log(`Renaming dependencies in ${packagePath}`);
  const packageJson: Package = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  for (const depType of depTypes) {
    const deps = packageJson[depType];
    if (deps) {
      for (const [dep, version] of Object.entries(deps)) {
        for (const pkg of packagesToRescope) {
          if (dep === pkg) {
            const newVersion = `npm:${dep.replace(fromScope, toScope)}@${dependencyVersion}`;
            console.log(`${depType}.${dep}: "${newVersion}"`);
            deps[dep] = newVersion;
            spacer({ count: 10 });
          }
        }
      }
    }
    packageJson[depType] = deps;
  }
  writePackage(packagePath, packageJson);
  return packageJson;
}
