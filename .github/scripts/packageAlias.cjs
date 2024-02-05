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
  console.log(inputs);
  const packageNames = inputs.package;

  const existingScope = "@google-labs";
  const newScope = process.env.OWNER_LC;
  console.log({ existingScope, newScope });
  if (!newScope) {
    throw new Error("OWNER_LC is not set");
  }
  const depTypes = ["dependencies", "devDependencies"];

  const fs = require("fs");
  console.log({ cwd: process.cwd() });
  const basePackageDir = "./packages";

  for (const p of packageNames) {
    const packageDir = `${basePackageDir}/${p}`;
    const packageJsonPath = `${packageDir}/package.json`;
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    console.log({ "package.json": packageJsonPath, name: packageJson.name });

    for (const dtype of depTypes) {
      const depsOfType = packageJson[dtype];
      if (depsOfType) {
        console.log({ dtype, depsOfType });
        const keys = Object.entries(depsOfType);
        for (const [key, value] of keys) {
          if (key.startsWith(existingScope)) {
            const alias = `npm:@${newScope}/${key.replace(
              existingScope,
              ""
            )}@*`;
            console.log(`${key} -> ${alias}`);
            depsOfType[alias] = value;
          }
        }
        packageJson[dtype] = depsOfType;
      }
    }
    fs.writeFileSync(`${p}/package.json`, JSON.stringify(packageJson, null, 2));
  }
};
