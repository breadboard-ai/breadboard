import { Loader } from "../loader.js";
import { execSync } from "child_process";
import { Board, BoardRunner } from "@google-labs/breadboard";
import { pathToFileURL } from "url";

export class PythonLoader extends Loader {
  async load(filePath: string): Promise<BoardRunner> {
    let a = execSync(`python3 ${filePath} > test.json`);
    console.log(pathToFileURL(process.cwd()).toString());
    const outputFile = pathToFileURL(process.cwd()).toString() + "/test.json";
    const board = await Board.load(outputFile, {
      base: new URL(pathToFileURL(process.cwd()).toString()),
    });

    return board;
  }
}
