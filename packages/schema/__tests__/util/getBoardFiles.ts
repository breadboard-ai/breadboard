import fs from "fs";
import { getJsonFiles } from "./getJsonFiles.js";

export function getBoardFiles(directory: string) {
  return getJsonFiles(directory).filter((file: fs.PathOrFileDescriptor) => {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      return Array.isArray(data.edges) && Array.isArray(data.nodes);
    } catch (e) {
      return false;
    }
  });
}
