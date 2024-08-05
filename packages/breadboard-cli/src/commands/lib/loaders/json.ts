import { createLoader, GraphDescriptor } from "@google-labs/breadboard";
import { Loader } from "../loader.js";
import { pathToFileURL } from "url";

export class JSONLoader extends Loader {
  async load(filePath: string): Promise<GraphDescriptor | null> {
    const graph = await createLoader().load(filePath, {
      base: new URL(pathToFileURL(process.cwd()).toString()),
    });
    return graph;
  }
}
