import { Board, BoardRunner } from "@google-labs/breadboard";
import { Loader } from "../loader.js";
import { pathToFileURL } from "url";

export class JSONLoader extends Loader {
  async load(filePath: string): Promise<BoardRunner> {
    const board = await Board.load(filePath, {
      base: new URL(pathToFileURL(process.cwd()).toString()),
    });

    return board;
  }
}
