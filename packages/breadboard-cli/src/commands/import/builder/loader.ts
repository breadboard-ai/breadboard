import yaml from "yaml";
import { readFile } from "fs/promises";
import { AtLeastV3Document } from "./types.js";

export async function loadOpenAPI(url: string): Promise<AtLeastV3Document> {
  let openAPIData = "";
  try {
    if (url.startsWith("file://")) {
      openAPIData = await readFile(url.replace("file://", ""), {
        encoding: "utf-8",
      });
    } else {
      openAPIData = await (await fetch(url)).text();
    }
  } catch (e) {
    throw new Error(`Unable to fetch OpenAPI spec from ${url}`);
  }

  try {
    return yaml.parse(openAPIData);
  } catch (yamlLoadError) {
    try {
      return JSON.parse(openAPIData);
    } catch (jsonLoadError) {
      throw new Error(
        `Unable to parse OpenAPI spec from ${url}. It's not a valid JSON or YAML file.`
      );
    }
  }
}
