export default {
  build: {
    lib: {
      entry: {
        worker: "src/worker.ts",
        runtime: "src/runtime.ts",
      },
      name: "Breadboard Web Runtime",
      formats: ["es"],
    },
    target: "esnext",
  },
};
