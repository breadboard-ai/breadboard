import { workspace } from "src/main";
import { execWrapper } from "./execWrapper";

export async function npmInstall(cwd = workspace) {
  await execWrapper("npm", ["install"], { cwd });
}
