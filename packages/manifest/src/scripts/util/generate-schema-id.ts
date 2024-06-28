import fs from "fs";
import path from "path";
import {
  ABSOLUTE_PACKAGE_JSON_PATH,
  GITHUB_OWNER,
  GITHUB_REPO,
  PACKAGE_NAME,
  REPO_PACKAGE_PATH,
  SCHEMA_FILE_NAME
} from "./constants";

/**
 *
 * @param mode "head" | "tag" - "head" for the main branch, "tag" for the tag associated with the current package version
 * @returns The schema ID for the Breadboard Manifest schema.
 */
export function generateSchemaId(
  mode: "head" | "tag" = "head",
  schemaPath: string = SCHEMA_FILE_NAME
): string {
  const ref = mode === "head" ? "main" : getTagRef();

  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${ref}/${REPO_PACKAGE_PATH}/${schemaPath}`;
}

export function getTagRef(): string {
  const packageVersion = loadPackageJson().version;
  if (!packageVersion) {
    throw new Error("Package version not found in package.json");
  }
  return `${PACKAGE_NAME}@${packageVersion}`;
}

function loadPackageJson() {
  return JSON.parse(fs.readFileSync(ABSOLUTE_PACKAGE_JSON_PATH, "utf-8"));
}
