import { BoardRunner } from "@google-labs/breadboard";
import esbuild from "esbuild";
import { readFile } from "fs/promises";
import { Loader, Options } from "../loader.js";

export class TypeScriptLoader extends Loader {
  async load(filePath: string, options: Options): Promise<BoardRunner> {
    const fileContents = await readFile(filePath, "utf-8");
    const result = await esbuild.transform(fileContents, { loader: "ts" });
    const { board } = await this.makeFromSource(filePath, result.code, options);
    return board;
  }
}
