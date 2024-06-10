import { OutputValues, code } from "@google-labs/breadboard";

const spread = code<{ object: object }, OutputValues>((inputs) => {
  const object = inputs.object;
  if (typeof object !== "object") {
    throw new Error(`object is of type ${typeof object} not object`);
  }
  return { ...object };
});

type spread = typeof spread;

export { spread };
