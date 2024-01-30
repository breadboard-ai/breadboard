// This is based on https://www.npmjs.com/package/base-create. It's been updated to use TypeScript and for the needs of this project.

import { spawnSync } from "child_process";
import { mkdir, writeFile, stat } from "fs/promises";
import path from "path";
import chalk from "chalk";

type FileParams = {
  nameWithScope: string;
  nameWithoutScope: string;
  dirName: string;
};

type Package = {
  name?: string;
  version?: string;
  private?: boolean;
  main?: string;
  type?: string;
  files?: string[];
  bin?: Record<string, string> | string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  publishConfig?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
} & { [key: string]: any };

type CreatePackageOptions = {
  name?: string;
  scope?: string;
  skipGitignore?: boolean;
  skipReadme?: boolean;
  skipInstall?: boolean;
  scripts?: Record<string, string>;
  commands?: string[];
  dependencies?: string[];
  devDependencies?: string[];
  package?: Package;
  files?: Asset[];
};

type tmp = {
  options: CreatePackageOptions;
  params: FileParams;
};

type Asset = { path: string; contents: string | ((...args: any[]) => string) };

const startCwd = process.cwd();

const fileExists = async (path: string) => {
  try {
    await stat(path);
    return true;
  } catch (e) {
    return false;
  }
};

const getRelativeCwd = () => path.relative(startCwd, process.cwd());

const runCommand = (command: string) => {
  const relativeCwd = getRelativeCwd();
  console.log(
    chalk.green.bold(`Command (in "${relativeCwd}"):`),
    chalk.cyan(command)
  );

  const split = command.split(" ");

  const name = split.shift();

  if (name == undefined) {
    throw new Error(`No name found in command: ${command}`);
  }

  spawnSync(name, split, {
    stdio: "inherit",
  });
};

const addScopeToPackageName = (scope: string, packageName: string) =>
  `@${scope.replace(/^@/, "")}/${packageName}`;

const normalizeFile = (file: Asset, params: FileParams): Asset => {
  // Following `vinyl` file schema.
  const filepath = typeof file === "string" ? file : file.path;

  let contents = typeof file === "string" ? "" : file.contents;
  contents = typeof contents === "function" ? contents(params) : contents;
  contents =
    typeof contents === "string"
      ? contents
      : JSON.stringify(contents, undefined, 2);

  return {
    path: filepath,
    contents,
  };
};

const createFile = async (file: Asset, params: FileParams) => {
  const { path: filepath, contents } = normalizeFile(file, params);

  const relativeCwd = getRelativeCwd();

  console.log(
    chalk.green.bold("Creating file:"),
    chalk.cyan(path.join(relativeCwd, filepath))
  );

  await mkdir(path.dirname(filepath), { recursive: true });
  await writeFile(filepath, <string>contents, { encoding: "utf8" });
};

const createFiles = async (files: Asset[], { options, params }: tmp) => {
  const { skipReadme } = options;

  const normalizedFiles =
    files && files.map((file) => normalizeFile(file, params));

  const hasReadmeFile =
    normalizedFiles &&
    normalizedFiles.find((file) => file.path === "README.md");

  if (!hasReadmeFile && !skipReadme) {
    await createFile(
      {
        path: "README.md",
        contents: `# ${params.nameWithScope}\n\n`,
      },
      params
    );
  }

  if (!files) return;

  for (const file of files) {
    await createFile(file, params);
  }
};

const makeCreateFileParams = (options: CreatePackageOptions): FileParams => {
  const { scope, name } = options;

  if (name == undefined) {
    throw new Error("name is undefined");
  }

  const nameWithScope = scope ? addScopeToPackageName(scope, name) : name;

  const nameWithoutScope = name.replace(/^@.*\//, "");

  const dirName = nameWithoutScope;

  const createFileParams = {
    nameWithScope,
    nameWithoutScope,
    dirName,
  };

  return createFileParams;
};

const createPackage = async (options: CreatePackageOptions) => {
  const {
    skipInstall,
    commands,
    dependencies,
    devDependencies,
    package: packageInfo = {},
    files = [],
  } = options;

  const cwd = process.cwd();

  const packageDir = path.resolve(process.cwd(), process.argv[2]);

  if (!packageDir) {
    console.error(chalk.red("Must provide directory as an argument."));
    process.exit(1);
  }

  if (await fileExists(packageDir)) {
    console.error(
      chalk.red(
        `Directory "${packageDir}" already exists. Please only create projects in a new directory.`
      )
    );
    process.exit(1);
  }

  // The project name will be either the directory name or the name provided in the options.
  options.name = options.name || path.basename(packageDir);

  const createFileParams = makeCreateFileParams(options);

  console.log(
    chalk.green.bold(`Creating "project" directory:`),
    chalk.cyan(path.join(getRelativeCwd(), packageDir))
  );

  await mkdir(packageDir, { recursive: true });

  process.chdir(packageDir);

  runCommand(`npm init -y`);

  const newPackage = (
    await import(`${packageDir}/package.json`, {
      assert: { type: "json" },
    })
  ).default;

  newPackage.scripts = {
    ...newPackage.scripts,
    ...packageInfo.scripts,
  };

  if (packageInfo) {
    Object.entries(packageInfo).forEach(([key, value]) => {
      newPackage[key] = value;
    });
  }

  newPackage.name = createFileParams.nameWithScope;

  await createFiles(files, { options, params: createFileParams });

  await createFile(
    { path: "package.json", contents: newPackage },
    createFileParams
  );

  if (!skipInstall) {
    if (devDependencies) {
      runCommand("npm add -D " + devDependencies.join(" "));
    }

    if (dependencies) {
      runCommand("npm add " + dependencies.join(" "));
    }
  }

  if (commands) {
    commands.forEach((command) => runCommand(command));
  }

  process.chdir(cwd);

  return { name: packageDir, packageDir };
};

const create = async (options: CreatePackageOptions) => {
  const result = await createPackage(options);

  return result;
};

export { create };
