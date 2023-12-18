import { BoardRunner } from "@google-labs/breadboard";
import { Loader } from "../loader.js";

export class JSLoader extends Loader {
  async load(filePath: string): Promise<BoardRunner> {
    const { board } = await this.makeFromFile(filePath);
    return board;
  }
}
