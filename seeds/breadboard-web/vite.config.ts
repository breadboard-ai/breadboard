export default {
  build: {
    lib: {
      entry: `src/worker.ts`,
      name: "Worker",
      fileName: "worker",
      formats: ["es"],
    },
    target: "esnext",
  },
};
