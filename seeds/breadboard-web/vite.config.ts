export default {
  build: {
    lib: {
      entry: {
        worker: "src/worker.ts",
        runtime: "src/runtime.ts",
        sample: "./index.html",
      },
      name: "Breadboard Web Runtime",
      formats: ["es"],
    },
    target: "esnext",
  },
};
