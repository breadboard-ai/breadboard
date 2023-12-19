/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Nunjucks from "nunjucks";
import { Template } from "../types/types.js";

Nunjucks.configure("/templates", { autoescape: true });

async function render(
  file: string,
  data: Record<string, unknown>
): Promise<string> {
  return new Promise((resolve, reject) => {
    Nunjucks.render(file, data, (err, output) => {
      if (err) {
        reject(err);
        return;
      }

      if (!output) {
        reject("Error creating output");
        return;
      }

      resolve(output);
    });
  });
}

async function asString(item: unknown): Promise<string> {
  if (typeof item !== "string") {
    throw new Error("Contents of item are not a string");
  }

  return item;
}

async function binaryFile(path: string): Promise<ArrayBuffer> {
  const response = await fetch(path);
  return response.arrayBuffer();
}

async function textFile(path: string): Promise<string> {
  const response = await fetch(path);
  return response.text();
}

function extractEnvFromConfiguration(
  configuration: Record<string, unknown>
): string {
  let env = "";
  for (const [entry, value] of Object.entries(configuration)) {
    if (entry.startsWith("env::") && typeof value === "string") {
      env += `${entry.replace(/^env::/, "")}=${value}`;
    }
  }

  return env;
}

function extractInputPropsFromConfiguration(
  configuration: Record<string, unknown>
): string {
  const props: Record<string, Record<string, Record<string, string>>> = {};
  for (const [entry, value] of Object.entries(configuration)) {
    if (
      !entry.startsWith("env::") &&
      entry.includes("::") &&
      typeof value === "string"
    ) {
      const matches = /^(.*?)::(.*?)::(.*)$/gim.exec(entry);
      if (!matches) {
        continue;
      }

      // id
      if (!props[matches[1]]) {
        props[matches[1]] = {};
      }

      // id::property
      if (!props[matches[1]][matches[2]]) {
        props[matches[1]][matches[2]] = {};
      }

      // id::property::option
      props[matches[1]][matches[2]][matches[3]] = value;
    }
  }

  return JSON.stringify(props, null, 2);
}

export async function createZip(configuration: Record<string, unknown>) {
  configuration.hashedEntryPoint = "/main.ts";
  configuration.hashedStyles = "/styles.css";
  configuration.env = extractEnvFromConfiguration(configuration);
  configuration.props = extractInputPropsFromConfiguration(configuration);

  const template = configuration.template as Template;

  const manifest: Map<
    string,
    { contents: Promise<string | ArrayBuffer>; binary?: boolean }
  > = new Map([
    [
      "index.html",
      { contents: render(`${template}/index.njk`, configuration) },
    ],
    [
      "public/styles.css",
      { contents: render(`${template}/styles.njk`, configuration) },
    ],
    ["main.ts", { contents: render("shared/main.njk", configuration) }],
    ["worker.ts", { contents: render("shared/worker.njk", configuration) }],
    ["package.json", { contents: render("shared/package.njk", configuration) }],
    [
      "vite.config.ts",
      { contents: render("shared/vite.config.njk", configuration) },
    ],
    [
      "tsconfig.json",
      { contents: render("shared/tsconfig.njk", configuration) },
    ],
    [".env", { contents: asString(configuration.env) }],
    ["public/properties.json", { contents: asString(configuration.props) }],
    ["public/board.json", { contents: asString(configuration.board) }],
  ]);

  switch (template) {
    case Template.BASIC:
      manifest.set("public/third_party/firacode/LICENSE", {
        contents: textFile("/templates/basic/third_party/firacode/LICENSE"),
      });

      manifest.set("public/third_party/firacode/FiraCode-Regular.woff2", {
        contents: binaryFile(
          "/templates/basic/third_party/firacode/FiraCode-Regular.woff2"
        ),
        binary: true,
      });

      manifest.set("public/third_party/firacode/FiraCode-Bold.woff2", {
        contents: binaryFile(
          "/templates/basic/third_party/firacode/FiraCode-Bold.woff2"
        ),
        binary: true,
      });

      manifest.set("public/images/pattern.png", {
        contents: binaryFile("/templates/basic/images/pattern.png"),
        binary: true,
      });
      break;

    default:
      break;
  }

  await Promise.all([...manifest.values()]);

  const Zip = await import("jszip");
  const zip = new Zip.default();
  for (const [path, details] of manifest) {
    const { contents, binary } = await details;
    const opts = {
      binary: binary || false,
    };

    zip.file(path, contents, opts);
  }

  return zip.generateAsync({ type: "blob" });
}
