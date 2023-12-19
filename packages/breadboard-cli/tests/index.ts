/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { ExecException, exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";

const packageDir = process.cwd();

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = path.resolve(path.join(__dirname, "../src/index.js"));

type ChildProcessCallback = {
  error?: ExecException | null;
  stdout: string;
  stderr: string;
};

function execCli(args = ""): Promise<ChildProcessCallback> {
  return new Promise((resolve, reject) => {
    exec(`node "${cliPath}" ${args}`, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

const testBoardData = {
  title: "Echo",
  description: "Echo cho cho cho ho o",
  version: "0.0.3",
  edges: [
    {
      from: "input",
      to: "output-1",
      out: "text",
      in: "text",
    },
  ],
  nodes: [
    {
      id: "input",
      type: "input",
      configuration: {
        schema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              title: "Echo",
              description: "What shall I say back to you?",
            },
          },
        },
      },
    },
    {
      id: "output-1",
      type: "output",
    },
  ],
  kits: [],
};

// language=typescript
const typescriptTestBoardContent = `
import { Board, BreadboardNode } from "@google-labs/breadboard";

const board: Board = new Board();
const input: BreadboardNode<unknown, unknown> = board.input({
  message: "Hello World!",
});
const output: BreadboardNode<unknown, unknown> = board.output();
input.wire("message", output);
export default board;
`;

// language=javascript
const jsTestBoardContent = `
import { Board } from "@google-labs/breadboard";
const board = new Board();
const input = board.input({
  message: "Hello World!",
});
const output = board.output();
input.wire("message", output);
export default board;
`;

const testDataDir = path.resolve(path.join(packageDir, "tests/data"));
const originalBoardPath = path.join(testDataDir, "echo.json");

const relativeBoardPath = path.relative(process.cwd(), originalBoardPath);
const absoluteBoardPath = path.resolve(relativeBoardPath);

const filenameWithSpaces = path.resolve(
  path.join(testDataDir, "test board.json")
);

const directoryWithSpaces = path.resolve(
  path.join(testDataDir, "test folder", "board.json")
);

const srcTemp = [process.cwd(), "src", "temp"];

const typescriptBoardPath = path.resolve(path.join(...srcTemp, "ts_board.ts"));
const dist = [process.cwd(), "dist"];
const jsBoardPath = path.resolve(path.join(...dist, "js_board.js"));

const testFiles: {
  path: string;
  content: string;
}[] = [
  {
    path: path.resolve(originalBoardPath),
    content: JSON.stringify(testBoardData, null, 2),
  },
  {
    path: path.resolve(filenameWithSpaces),
    content: JSON.stringify(testBoardData, null, 2),
  },
  {
    path: path.resolve(directoryWithSpaces),
    content: JSON.stringify(testBoardData, null, 2),
  },
  {
    path: path.resolve(typescriptBoardPath),
    content: typescriptTestBoardContent,
  },
  {
    path: path.resolve(jsBoardPath),
    content: jsTestBoardContent,
  },
];

//////////////////////////////////////////////////

test.before(() => {
  testFiles.forEach((p) => {
    fs.mkdirSync(path.dirname(p.path), { recursive: true });
    fs.writeFileSync(p.path, p.content);
    console.debug(`Wrote ${p.content.length} characters to "${p.path}"`);
  });
});

test.after.always(() => {
  testFiles.forEach((p) => {
    fs.unlinkSync(p.path);
  });
  const jsBoardPath = typescriptBoardPath.replace(".ts", ".js");
  fs.unlinkSync(jsBoardPath);
  fs.rmdirSync(path.resolve(...srcTemp));
});

//////////////////////////////////////////////////
test("all test files exist", (t) => {
  testFiles.forEach((p) => {
    t.true(fs.existsSync(p.path));
    t.true(fs.readFileSync(p.path).length > 0);
  });
});

//////////////////////////////////////////////////
test("relative path is relative and valid", (t) => {
  t.false(relativeBoardPath == path.resolve(relativeBoardPath));
  t.true(fs.existsSync(relativeBoardPath));
});

test("calling CLI with no parameters shows usage text", async (t) => {
  const expected = "Usage: index [options] [command]";
  try {
    await execCli();
  } catch (error: unknown) {
    const output = error as ChildProcessCallback;
    t.assert(output.stderr);
    if (output.stderr) {
      t.true(output.stderr.length > expected.length);
      t.true(output.stderr.includes(expected));
    }
  }
});

test("'mermaid' command produces mermaid diagram from relative path to board.json", async (t) => {
  const commandString = ["mermaid", `"${relativeBoardPath}"`].join(" ");
  const output = await execCli(commandString);
  t.assert(output.stdout);
  t.true(output.stdout.length > 0);
  t.true(output.stdout.includes("graph TD"));
});

test("'mermaid' command produces mermaid diagram from absolute path to board.json", async (t) => {
  t.false(absoluteBoardPath.startsWith("tests"));
  t.true(fs.existsSync(absoluteBoardPath));

  const commandString = ["mermaid", `"${absoluteBoardPath}"`].join(" ");
  const output = await execCli(commandString);
  t.assert(output.stdout);
  t.true(output.stdout.length > 0);
  t.true(output.stdout.includes("graph TD"));
});

//////////////////////////////////////////////////

test("filename does contain spaces", (t) => {
  t.true(path.basename(filenameWithSpaces).includes(" "));
});

test("can handle a relative file with spaces in the file name", async (t) => {
  const relativePath = path.relative(packageDir, filenameWithSpaces);
  t.true(relativePath.includes(" "));
  t.true(fs.existsSync(filenameWithSpaces));

  const commandString = ["mermaid", `"${relativePath}"`].join(" ");
  const output = await execCli(commandString);
  t.true(output.stdout.length > 0);
  t.true(output.stdout.includes("graph TD"));
});

test("can handle an absolute file with spaces in the name", async (t) => {
  const commandString = ["mermaid", `"${filenameWithSpaces}"`].join(" ");
  const output = await execCli(commandString);
  t.true(output.stdout.length > 0);
  t.true(output.stdout.includes("graph TD"));
});

//////////////////////////////////////////////////

test("directory name with spaces does contain spaces", (t) => {
  t.true(path.dirname(directoryWithSpaces).includes(" "));
});

test("board file exists in dictory with spaces in the name", (t) => {
  t.true(fs.existsSync(directoryWithSpaces));
});

test("can handle a relative path with spaces in the directory name", async (t) => {
  const relativePath = path.relative(packageDir, directoryWithSpaces);
  t.true(relativePath.includes(" "));
  t.true(fs.existsSync(directoryWithSpaces));

  const commandString = ["mermaid", `"${relativePath}"`].join(" ");
  const output = await execCli(commandString);
  t.true(output.stdout.length > 0);
  t.true(output.stdout.includes("graph TD"));
});

test("can handle an absolute path with spaces in the directory name", async (t) => {
  const commandString = ["mermaid", `"${directoryWithSpaces}"`].join(" ");
  const output = await execCli(commandString);
  t.true(output.stdout.length > 0);
  t.true(output.stdout.includes("graph TD"));
});

//////////////////////////////////////////////////

test("can make a graph from a typescript file", async (t) => {
  const tscCommand = [
    "npx",
    "-y",
    "tsc",
    "--target ES2022",
    "--module NodeNext",
    `--outDir "${path.dirname(typescriptBoardPath)}"`,
    `"${typescriptBoardPath}"`,
  ].join(" ");
  await new Promise((resolve, reject) => {
    exec(tscCommand, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });

  const jsPath = typescriptBoardPath.replace(".ts", ".js");
  t.true(fs.existsSync(jsPath));

  const commandString = ["make", `"${jsPath}"`].join(" ");
  const output = await execCli(commandString);
  t.true(output.stdout.length > 0);
});

//////////////////////////////////////////////////

test("can make a graph from a javascript file", async (t) => {
  const commandString = ["make", `"${jsBoardPath}"`].join(" ");
  const output = await execCli(commandString);
  t.true(output.stdout.length > 0);
});

test("can run a json board", async (t) => {
  const inputData = {
    text: "Hi",
  };
  const commandString = [
    "run",
    `"${absoluteBoardPath}"`,
    `--input "${JSON.stringify(inputData).replaceAll('"', '\\"')}"`,
  ].join(" ");
  const output = await execCli(commandString);
  t.true(output.stdout.length > 0);

  let resultString = output.stdout;

  // remove ANSI escape codes
  // eslint-disable-next-line no-control-regex
  resultString = resultString.replace(/\u001b\[[0-9]{1,2}m/g, "");

  // replace single quotes with double quotes
  resultString = resultString
    .replace(/(\w+)(?=:)/g, '"$1"')
    .replace(/:\s*'([^']+)'/g, ': "$1"');

  t.deepEqual(JSON.parse(resultString), inputData);
});
