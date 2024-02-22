import { execWrapper } from "./execWrapper";

export async function gitClean({ cwd = process.cwd() }: { cwd?: string; } = {}) {
  await execWrapper("git", ["clean", "-dfx"], { cwd });
}
