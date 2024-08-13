import { GraphDescriptor } from "@google-labs/breadboard";
import { Loader } from "../loader.js";
import { resolve } from "path";

export class JSLoader extends Loader {
  async load(filePath: string): Promise<GraphDescriptor | null> {
    const board = await this.loadBoardFromModule(
      resolve(process.cwd(), filePath)
    );
    return board;
  }
}
