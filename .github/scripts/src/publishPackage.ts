import path from "path";
import { execWrapper } from "./execWrapper";
import { updatePackageRegistry } from "./updatePackageRegistry";

export async function publishPackage(cwd: string, registry: string, flags: string[] = []) {
  console.log(`Publishing`, { cwd, registry, flags });
  const packageDir = path.dirname(cwd);
  console.log({ packageDir });

  updatePackageRegistry(cwd, registry);

  console.log(`Publishing ${packageDir}`);
  await execWrapper("npm", ["publish", ...flags], { cwd: packageDir });
}
