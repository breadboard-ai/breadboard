module.exports = async ({
  github,
  context,
  core,
  glob,
  io,
  exec,
  require,
  inputs,
}) => {
  console.log({ inputs });
  const packageNames = inputs.package;

  const existingScope = "@google-labs";
  if (!process.env.OWNER_LC) {
    throw new Error("OWNER_LC is not set");
  }
  const newScope = `@${process.env.OWNER_LC}`;
  console.log({ existingScope, newScope });
  const depTypes = ["dependencies", "devDependencies"];

  const fs = require("fs");
  const path = require("path");

  console.log({ cwd: process.cwd() });
  const basePackageDir = "./packages";

  for (const p of packageNames) {
    console.log("=".repeat(80));
    const packageDir = path.join(basePackageDir, p);
    const packageJsonPath = path.join(packageDir, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    console.log({ package: packageJsonPath, name: packageJson.name });

    const currentName = packageJson.name;
    if (currentName.startsWith(existingScope)) {
      const newName = currentName.replace(existingScope, newScope);
      console.log({ name: currentName, newName });
      packageJson.name = newName;
    }

    for (const dtype of depTypes) {
      const depsOfType = packageJson[dtype];
      if (depsOfType) {
        console.log({ type: dtype });
        const keys = Object.entries(depsOfType);
        for (const [key, value] of keys) {
          if (key.startsWith(existingScope)) {
            const alias = `npm:${newScope}${key.replace(existingScope, "")}@*`;
            console.log(`${key} -> ${alias}`);
            depsOfType[key] = value;
          }
        }
        packageJson[dtype] = depsOfType;
        console.log({ [dtype]: packageJson[dtype] });
      }
    }
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log("=".repeat(80));
  }
};
