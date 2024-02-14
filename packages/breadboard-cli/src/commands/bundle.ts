/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { build } from "vite";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import readline from "readline/promises";

export async function bundle(board: string, flags: { output: string }) {
  let breadboardWebPublic;
  if (typeof import.meta.resolve === 'function') {
    const publicPath = await import.meta.resolve(
      "@google-labs/breadboard-web/public"
    );
    breadboardWebPublic = fileURLToPath(publicPath);
  }

  if (!breadboardWebPublic) {
    console.error("Unable to locate Breadboard files");
    process.exit(1);
  }

  const dirName = fileURLToPath(import.meta.url);
  const bundleDir = path.join(dirName, "..", "..", "..", "..", "src", "bundle");

  if (!path.isAbsolute(flags.output)) {
    flags.output = path.join(process.cwd(), flags.output);
  }

  if (!path.isAbsolute(board)) {
    board = path.join(process.cwd(), board);
  }

  const query = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await query.question(`Write to ${flags.output}? Y/n: `);
  if (!(answer === "" || answer === "Y" || answer == "y")) {
    process.exit(1);
  }
  query.close();

  await Promise.all([
    fs.mkdir(flags.output, { recursive: true }),
    fs.mkdir(path.join(flags.output, "graphs"), { recursive: true }),
  ]);

  console.log("✨ Bundling...");
  const bundle = await build({
    build: {
      lib: {
        entry: {
          index: path.join(bundleDir, "index.html"),
          worker: path.join(bundleDir, "worker.ts"),
        },
        name: "Breaboard",
        formats: ["es"],
      },
      target: "esnext",
      write: false,
    },
    root: bundleDir,
    publicDir: breadboardWebPublic,
    logLevel: "silent",
  });

  console.log("🔨 Writing files...");
  if (Array.isArray(bundle)) {
    const [{ output }] = bundle;
    await Promise.all([
      // Bundler outputs.
      ...output.map(async (file) => {
        const filePath = path.join(flags.output, file.fileName);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        switch (file.type) {
          case "asset":
            if (typeof file.source === "string") {
              return fs.writeFile(filePath, file.source, { encoding: "utf-8" });
            } else {
              return fs.writeFile(filePath, file.source);
            }

          case "chunk":
            return fs.writeFile(filePath, file.code, { encoding: "utf-8" });
        }
      }),

      // The board.
      fs.copyFile(
        board,
        path.join(flags.output, "graphs", "bundled-board.json")
      ),

      // Styles.
      fs.cp(
        path.join(breadboardWebPublic, "styles"),
        path.join(flags.output, "styles"),
        { recursive: true }
      ),

      // Third Party.
      fs.cp(
        path.join(breadboardWebPublic, "third_party"),
        path.join(flags.output, "third_party"),
        { recursive: true }
      ),

      // Images.
      fs.cp(
        path.join(breadboardWebPublic, "images"),
        path.join(flags.output, "images"),
        { recursive: true }
      ),

      // Boards.
      fs.cp(
        path.join(breadboardWebPublic, "graphs"),
        path.join(flags.output, "graphs"),
        { recursive: true }
      ),
    ]);
  } else {
    console.error("Unable to generate bundle - unexpected bundler output");
    process.exit(1);
  }

  console.log(`🥳 Written to ${flags.output}`);
}
