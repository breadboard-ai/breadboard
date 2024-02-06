import * as exec from "@actions/exec";
import * as fs from "fs";
import path from "path";

export async function execWrapper(
  command: string,
  args: string[],
  options: { cwd: string }
) {
  let cwd = options.cwd;
  if (fs.existsSync(cwd) && fs.lstatSync(cwd).isFile()) {
    cwd = path.dirname(cwd);
  }

  console.log(`${cwd} $ ${command} ${args.join(" ")}`);
  const listeners = {
    stdout: (data: Buffer) => {
      // console.log(data.toString());
    },
    stderr: (data: Buffer) => {
      // console.error(data.toString());
    },
  };
  await exec.exec(command, args, { cwd, listeners }).catch((err: any) => {
    console.error(err);
    throw err;
  });
}
