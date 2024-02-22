import { execWrapper } from "./execWrapper";
import { gitClean } from "./gitClean";
import { workspace } from "./main";

export async function clean({ cwd = workspace }: { cwd?: string; } = { cwd: workspace }) {
  await gitClean({ cwd: workspace });
  await execWrapper("rm", ["-rfv", "node_modules"], { cwd });
  await execWrapper("rm", ["-rfv", "packages/*/node_modules"], { cwd });
  await execWrapper("rm", ["-fv", "package-lock.json"], { cwd });
}
