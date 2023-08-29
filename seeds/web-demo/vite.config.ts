import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import Kits from "./build/graph.js";

// https://vitejs.dev/config/
export default defineConfig({
  assetsInclude: ["**/*.graph"],
  plugins: [preact(), Kits(["@google-labs/llm-starter"])],
});
