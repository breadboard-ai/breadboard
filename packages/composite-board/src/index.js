/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "node:fs/promises";
import url from "node:url";
import path from "node:path";
import chalk from "chalk";

import * as Utils from "./utils.js";

const ignoreNextChange = new Set();

async function createModuleDir(rootDir, boardFile) {
  const moduleDir = Utils.createModuleDirectoryName(rootDir, boardFile);
  await deleteModuleDir(rootDir, boardFile);
  await fs.mkdir(moduleDir);
  return moduleDir;
}

async function deleteModuleDir(rootDir, boardFile) {
  const moduleDir = Utils.createModuleDirectoryName(rootDir, boardFile);
  try {
    await fs.stat(moduleDir);
    await fs.rm(moduleDir, { recursive: true, force: true });
  } catch (err) {
    // Module dir doesn't exist - carry on.
  }
}

async function populateModuleDirs(rootDir) {
  const files = await fs.readdir(rootDir, { withFileTypes: true });
  const moduleDirs = files
    .filter((file) => file.isFile())
    .map(async (file) => {
      try {
        await createModuleFilesFromBoard(rootDir, file.name);
      } catch (err) {
        console.warn(err);
      }
    });

  await Promise.all(moduleDirs);
}

async function createModuleFilesFromBoard(rootDir, boardFile) {
  console.info(chalk.greenBright("[Deconstructing]"), boardFile);

  // Wait a while for all OS operations to have completed.
  await pause(100);

  const fullPath = path.join(rootDir, boardFile);
  const moduleDir = await createModuleDir(rootDir, boardFile);
  const graph = await fs.readFile(fullPath, {
    encoding: "utf-8",
  });

  const descriptor = JSON.parse(graph);
  if (!descriptor.modules) {
    return;
  }

  return Promise.all(
    Object.entries(descriptor.modules).map(([id, module]) => {
      const fileName = `${id}.js`;
      const { code } = module;

      return fs.writeFile(path.join(moduleDir, fileName), code, {
        encoding: "utf-8",
      });
    })
  );
}

async function createBoardFileWithModules(rootDir, boardFile) {
  console.info(chalk.magentaBright("[Reconstructing]"), boardFile);

  const fullPath = path.join(rootDir, boardFile);
  const graph = await fs.readFile(fullPath, {
    encoding: "utf-8",
  });

  const descriptor = JSON.parse(graph);
  descriptor.modules = {};

  const moduleDir = Utils.createModuleDirectoryName(rootDir, boardFile);
  try {
    const moduleFiles = await fs.readdir(moduleDir, { withFileTypes: true });
    const moduleDescriptors = moduleFiles
      .filter((module) => module.isFile())
      .map(async (moduleFile) => {
        const modulePath = path.join(moduleDir, moduleFile.name);
        const moduleContents = await fs.readFile(modulePath, {
          encoding: "utf8",
        });
        const name = Utils.parseModuleName(moduleFile.name);
        const description = Utils.parseModuleDescription(moduleContents);
        const code = moduleContents;
        return {
          [name]: {
            metadata: {
              description,
              url: moduleFile.name,
            },
            code,
          },
        };
      });

    const modules = await Promise.all(moduleDescriptors);
    for (const module of modules) {
      descriptor.modules = { ...descriptor.modules, ...module };
    }

    const updatedDescriptor = JSON.stringify(descriptor, null, 2);
    await fs.writeFile(fullPath, updatedDescriptor, {
      encoding: "utf-8",
    });
  } catch (err) {
    console.warn("Unable to create board file");
    console.warn(err);
  }
}

async function handleWatchEvent(rootDir, event) {
  if (event.eventType !== "change" && event.eventType !== "rename") {
    return;
  }

  const boardFile = event.filename;
  if (boardFile.endsWith(".crswap")) {
    return;
  }

  if (ignoreNextChange.has(boardFile)) {
    ignoreNextChange.delete(boardFile);
    return;
  }

  const initiateCreateBoardFile = async (rootDir, boardFile) => {
    const { boardName } = Utils.parseModuleDirectoryName(boardFile);
    ignoreNextChange.add(boardName);

    await createBoardFileWithModules(rootDir, boardName);
  };

  try {
    const stats = await fs.stat(path.join(rootDir, boardFile));

    // Skip directory renames.
    if (event.eventType === "rename" && stats.isDirectory()) {
      return;
    }
  } catch (err) {
    // Failing to stat means the file was removed, so either remove the module
    // directory or start the rebagel process.
    console.log(chalk.bgCyan("[Delete]"), `${boardFile} removed`);

    if (path.dirname(boardFile) === ".") {
      await deleteModuleDir(rootDir, boardFile);
    } else {
      await initiateCreateBoardFile(rootDir, boardFile);
    }

    return;
  }

  if (path.dirname(boardFile) === ".") {
    await createModuleFilesFromBoard(rootDir, boardFile);
  } else {
    await initiateCreateBoardFile(rootDir, boardFile);
  }
}

async function watch(dir) {
  const controller = new AbortController();
  const { signal } = controller;

  try {
    const watcher = fs.watch(dir, { signal, recursive: true });
    for await (const event of watcher) {
      await handleWatchEvent(dir, event);
    }
  } catch (err) {
    if (err.name === "AbortError") {
      return;
    }

    console.warn(err);
    process.exit(1);
  }
}

async function pause(duration = 100) {
  return new Promise((r) => setTimeout(r, duration));
}

async function init() {
  const __dir = path.dirname(url.fileURLToPath(import.meta.url));
  const PROJECTS_DIR = path.join(__dir, "..", "projects");

  try {
    await fs.stat(PROJECTS_DIR);
  } catch (err) {
    console.log(chalk.bgCyan("[Creating projects]"));
    await fs.mkdir(PROJECTS_DIR);
  }

  await populateModuleDirs(PROJECTS_DIR);

  // Wait a while for all OS operations to have completed.
  await pause(100);
  await watch(PROJECTS_DIR);
}

init();
