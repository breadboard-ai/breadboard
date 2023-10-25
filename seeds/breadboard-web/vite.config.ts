export default {
  build: {
    lib: {
      entry: {
        worker: "src/worker.ts",
        sample: "./index.html",
      },
      name: "Breadboard Web Runtime",
      formats: ["es"],
    },
    target: "esnext",
  },
  test: {
    include: ["tests/**/*.ts"],
  },
};
