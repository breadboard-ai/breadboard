import { readPackage } from "./readPackage";
import { writePackage } from "./writePackage";

export function updatePackageRegistry(cwd: string, registry: string) {
  const packageJson = readPackage(cwd);
  packageJson.publishConfig = { registry };
  console.log(`Setting publishConfig.registry to ${registry}`);
  writePackage(cwd, packageJson);
}
