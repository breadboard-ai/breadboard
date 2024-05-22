import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const MODULE_PATH = dirname(fileURLToPath(import.meta.url));

export const root = () => {
  return MODULE_PATH;
};
