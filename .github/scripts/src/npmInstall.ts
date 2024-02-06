import { workspace } from "src";
import { execWrapper } from "./execWrapper";

export async function npmInstall(cwd = workspace) {
  await execWrapper("npm", ["install"], { cwd });
}
