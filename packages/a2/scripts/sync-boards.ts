// Synchronizes TypeScript source files with corresponding `.bgl.json` board files.
//
// It's designed to:
//   1. Only process `.bgl.json` files that ALREADY EXIST. It does not create new ones.
//   2. For each existing board file, find its corresponding TypeScript source directory.
//   3. For each TypeScript file found, if a module entry with the same key ALREADY EXISTS
//      in the board's JSON, it will update ONLY two specific fields:
//      - `modules[moduleKey].code` (with transpiled JavaScript)
//      - `modules[moduleKey].metadata.source.code` (with raw TypeScript content)
//   4. If a TypeScript file is found but its corresponding module key does not exist in the
//      JSON, that TS file is SKIPPED, and no new module entry is created.
//   5. All other data within the JSON (other module metadata, nodes, edges, board-level
//      metadata, imports, exports, etc.) is PRESERVED.
//   6. The script saves a board file back only if actual changes to the targeted fields
//      were made.
import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { globSync } from "glob";
import {
  GraphDescriptor,
  Module,
  ModuleMetadata as GraphModuleMetadata,
  ModuleCode,
  ModuleLanguage,
} from "@breadboard-ai/types";

// --- Script-level Constants and Initialized Compiler Options ---
const SCRIPT_PROJECT_ROOT = process.cwd();
let SCRIPT_COMPILER_OPTIONS: ts.CompilerOptions;

function initializeCompilerOptions(): ts.CompilerOptions {
  const defaultOptions: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ESNext,
    esModuleInterop: true,
    sourceMap: false, // Script specifically wants no source maps for embedded code
    // Add any other non-negotiable defaults for the script here
  };

  const tsConfigPath = ts.findConfigFile(
    SCRIPT_PROJECT_ROOT,
    ts.sys.fileExists,
    "tsconfig.json"
  );

  if (!tsConfigPath) {
    console.warn(
      "Warning: tsconfig.json not found at project root. Using default transpilation options for the script."
    );
    return defaultOptions;
  }

  console.log(`Attempting to load compiler options from: ${tsConfigPath}`);
  const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);

  if (configFile.error) {
    console.warn(
      `Warning: Error reading tsconfig.json: ${ts.flattenDiagnosticMessageText(
        configFile.error.messageText,
        "\n"
      )}. Using default transpilation options for the script.`
    );
    return defaultOptions;
  }

  const parsedCmd = ts.parseJsonConfigFileContent(
    configFile.config, // The raw JSON object from tsconfig.json
    ts.sys, // System interface for file operations
    path.dirname(tsConfigPath) // Base path to resolve 'extends' and other relative paths
  );

  if (parsedCmd.errors.length > 0) {
    console.warn(
      "Warning: Errors parsing tsconfig.json. This might be due to issues in the tsconfig itself or referenced files (e.g., 'extends'). Using default transpilation options for the script."
    );
    parsedCmd.errors.forEach((err) =>
      console.warn(
        `  - ${ts.flattenDiagnosticMessageText(err.messageText, "\n")}`
      )
    );
    return defaultOptions;
  }

  console.log("Successfully loaded and parsed tsconfig.json compiler options.");

  // Merge options:
  // 1. Start with script's essential defaults.
  // 2. Override with options from tsconfig.json.
  // 3. Apply any final, non-negotiable script overrides.
  return {
    ...defaultOptions, // Script defaults
    ...parsedCmd.options, // Options from tsconfig.json (parsed and resolved)
    sourceMap: false, // Ensure sourceMap is false, overriding tsconfig if it sets it to true
    // listFiles: undefined, // Avoid options not relevant to transpileModule if they cause issues
    // noEmit: undefined,    // Ensure these are not set to true if they come from tsconfig
    // declaration: undefined,
    // declarationMap: undefined,
    // emitDeclarationOnly: undefined,
  };
}

SCRIPT_COMPILER_OPTIONS = initializeCompilerOptions();

// --- Main Processing Logic ---

/**
 * Processes a single .bgl.json board file.
 * - Skips if the board file doesn't exist.
 * - Reads the board JSON.
 * - Finds corresponding TS files in `bgl/src/BOARD_NAME/`.
 * - For each TS file matching an existing module key in the JSON:
 * - Updates `module.code` and `module.metadata.source.code`.
 * - Preserves all other data.
 * - Writes back to the file ONLY if modifications were made.
 * @param boardFilePath Absolute path to the .bgl.json file.
 */
async function processBoard(boardFilePath: string): Promise<void> {
  const boardFileName = path.basename(boardFilePath);
  const boardName = path.basename(boardFileName, ".bgl.json");

  // Edge Case Handling: Script only operates on .bgl.json files that already exist.
  // It will not create a new .bgl.json file if one isn't found.
  if (!fs.existsSync(boardFilePath)) {
    console.log(
      `[${boardName}] Skipping: Board file ${boardFileName} does not exist at ${boardFilePath}.`
    );
    return;
  }

  console.log(`[${boardName}] Processing existing board file...`);

  let boardJsonData: GraphDescriptor;
  try {
    // Read the existing JSON content.
    boardJsonData = JSON.parse(
      fs.readFileSync(boardFilePath, "utf-8")
    ) as GraphDescriptor;
  } catch (error: any) {
    // Edge Case Handling: If JSON is malformed, log error and skip this board.
    console.error(
      `[${boardName}] Error parsing existing JSON: ${error.message}. Please check its format. Skipping this board.`
    );
    return;
  }

  // Define paths relative to the project root where the script is expected to run.
  const PROJECT_ROOT = process.cwd();
  const BGL_ROOT_DIR = path.join(PROJECT_ROOT, "bgl");
  const SRC_ROOT_DIR = path.join(BGL_ROOT_DIR, "src");

  // Convention: TypeScript source files for a board are located in a subdirectory
  // named after the board within `bgl/src/`.
  const tsSourceDir = path.join(SRC_ROOT_DIR, boardName);
  let boardWasModified = false; // Flag to track if any actual changes are made to this board.

  // Check if the corresponding TypeScript source directory exists.
  if (fs.existsSync(tsSourceDir) && fs.lstatSync(tsSourceDir).isDirectory()) {
    // Find all .ts files in the board's source directory.
    if (!boardJsonData.modules) {
      console.log(
        `  [${boardName}] No 'modules' object found in the JSON. Skipping TypeScript module synchronization for this board.`
      );
    } else {
      const tsFiles = globSync("*.ts", { cwd: tsSourceDir, absolute: false });

      if (tsFiles.length === 0) {
        console.log(
          `  [${boardName}] No TypeScript files found in ${tsSourceDir}.`
        );
      }

      for (const tsFile of tsFiles) {
        // tsFile is relative path like 'main.ts'
        const moduleKey = path.basename(tsFile, ".ts"); // e.g., 'main' from 'main.ts'
        const fullTsFilePath = path.join(tsSourceDir, tsFile);

        // --- Core Logic: Only update if moduleKey already exists in JSON ---
        // If a .ts file exists but there's no corresponding entry in the .bgl.json's 'modules'
        // object, this .ts file is SKIPPED. No new module entry will be created in the JSON.
        // This ensures we only update targeted fields of PRE-EXISTING modules.
        if (!boardJsonData.modules[moduleKey]) {
          console.log(
            `  [${boardName}] Skipping TS file "${tsFile}": Module key "${moduleKey}" not found in existing JSON. No new module will be created.`
          );
          continue;
        }

        console.log(
          `  [${boardName}] Updating existing module "${moduleKey}" from "${tsFile}"...`
        );
        const moduleEntry: Module = boardJsonData.modules[moduleKey]; // Type is Module from graph-descriptor.ts
        const tsContent = fs.readFileSync(fullTsFilePath, "utf-8"); // Read raw TS content.

        const transpileOutput = ts.transpileModule(tsContent, {
          compilerOptions: SCRIPT_COMPILER_OPTIONS,
        });

        // Edge Case Handling: Log TypeScript transpilation errors/warnings if any occur.
        // The script will still proceed with the (potentially flawed) transpiled output.
        if (
          transpileOutput.diagnostics &&
          transpileOutput.diagnostics.length > 0
        ) {
          console.warn(
            `    [${boardName}] TypeScript transpilation issues for "${fullTsFilePath}":`
          );
          transpileOutput.diagnostics.forEach((diagnostic) => {
            const message = ts.flattenDiagnosticMessageText(
              diagnostic.messageText,
              "\n"
            );
            if (diagnostic.file && typeof diagnostic.start === "number") {
              // Check if start is a number
              const { line, character } =
                diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
              console.warn(
                `      Error ${diagnostic.code} at ${line + 1},${character + 1}: ${message}`
              );
            } else {
              console.warn(`      Error ${diagnostic.code}: ${message}`);
            }
          });
        }
        const jsCode: ModuleCode = transpileOutput.outputText; // Get the transpiled JavaScript code.

        // --- Perform Targeted Updates ---
        // 1. Update the `code` field (transpiled JavaScript).
        moduleEntry.code = jsCode;

        // 2. Update `metadata.source.code` (raw TypeScript).
        //    Ensure the parent `metadata` and `metadata.source` objects exist.
        //    Any other pre-existing fields within `metadata` or `metadata.source` are preserved.

        // Ensure metadata object exists on the module entry
        if (!moduleEntry.metadata) {
          console.log(
            `    [${boardName}] Initializing 'metadata' for module "${moduleKey}" as it was missing.`
          );
          moduleEntry.metadata = {} as GraphModuleMetadata;
        }

        // Ensure metadata.source object exists and update/set its properties
        if (!moduleEntry.metadata.source) {
          console.log(
            `    [${boardName}] Initializing 'metadata.source' for module "${moduleKey}".`
          );
          moduleEntry.metadata.source = {
            code: tsContent,
            language: "typescript" as ModuleLanguage,
          };
        } else {
          moduleEntry.metadata.source.code = tsContent;
          // Ensure language is set, in case it was different or missing
          moduleEntry.metadata.source.language = "typescript" as ModuleLanguage;
        }
        boardWasModified = true; // Mark that this board has been changed.
      }
    }
  } else {
    // Edge Case Handling: No TypeScript source directory found for this board.
    // No modules will be updated from TS files. The JSON is preserved as is.
    console.log(
      `  [${boardName}] No source directory found at "${tsSourceDir}". No modules updated from TS sources.`
    );
  }

  // Workflow: Only write back to the .bgl.json file if actual modifications
  // to the targeted `code` or `metadata.source.code` fields were made.
  if (boardWasModified) {
    try {
      fs.writeFileSync(
        boardFilePath,
        JSON.stringify(boardJsonData, null, 2),
        "utf-8"
      );
      console.log(
        `[${boardName}] Successfully synchronized and saved changes.`
      );
    } catch (error: any) {
      // Edge Case Handling: Error during file writing (e.g., permissions, disk full).
      console.error(
        `[${boardName}] Error writing updated JSON: ${error.message}`
      );
    }
  } else {
    console.log(`[${boardName}] No relevant changes to save.`);
  }
}

/**
 * Main function to orchestrate the synchronization of all boards.
 * - Finds all .bgl.json files in the BGL_ROOT_DIR.
 * - Calls processBoard for each found file.
 */
async function syncAllBoards(): Promise<void> {
  console.log(
    "Starting board synchronization (TypeScript version, targeted updates)..."
  );
  const PROJECT_ROOT = process.cwd();
  const BGL_ROOT_DIR = path.join(PROJECT_ROOT, "bgl"); // e.g., './bgl'

  // Discover all .bgl.json files in the specified root directory.
  const boardFilePaths = globSync("*.bgl.json", {
    cwd: BGL_ROOT_DIR,
    absolute: true,
  });

  // Edge Case Handling: No .bgl.json files found.
  if (boardFilePaths.length === 0) {
    console.warn(
      `No *.bgl.json files found in "${BGL_ROOT_DIR}". Nothing to sync.`
    );
    return;
  }

  console.log(`Found ${boardFilePaths.length} board file(s) to process.`);

  // Process each board file sequentially.
  // Using a loop with await ensures one board finishes before the next starts,
  // which is good for clearer logs and avoiding race conditions if any existed.
  for (const boardFilePath of boardFilePaths) {
    await processBoard(boardFilePath);
  }
  console.log("All boards synchronization process finished.");
}

// Execute the main synchronization function.
syncAllBoards().catch((error) => {
  // Catch any unhandled errors from the async operations.
  console.error(
    "An unhandled error occurred during the synchronization process:",
    error
  );
  process.exit(1); // Exit with a non-zero code to indicate failure.
});
