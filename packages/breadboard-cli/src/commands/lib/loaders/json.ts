import { Board, BoardRunner } from "@google-labs/breadboard";
import { readFile } from "fs/promises";
import { Loader } from "../loader.js";

export class JSONLoader extends Loader {
  async load(filePath: string): Promise<BoardRunner> {
    const fileContents = await readFile(filePath, "utf-8");
    const board = await Board.fromGraphDescriptor(JSON.parse(fileContents));

    return board;
  }
}
