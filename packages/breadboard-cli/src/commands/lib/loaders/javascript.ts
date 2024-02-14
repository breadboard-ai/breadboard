import { BoardRunner } from "@google-labs/breadboard";
import { Loader } from "../loader.js";
import { resolve } from "path";

export class JSLoader extends Loader {
  async load(filePath: string): Promise<BoardRunner> {
    const board = await this.loadBoardFromModule(
      resolve(process.cwd(), filePath)
    );
    return board;
  }
}
