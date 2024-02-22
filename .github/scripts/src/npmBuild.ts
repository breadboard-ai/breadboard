import { workspace } from "src/main";
import { execWrapper } from "./execWrapper";

export async function npmBuild(cwd = workspace) {
  await execWrapper("npm", ["run", "build"], { cwd });
}
