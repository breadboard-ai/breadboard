module.exports = async ({ github, context, core, glob, io, exec, require }) => {
  for (const [key, value] of Object.entries(core)) {
    console.log(`core.${key}: ${value}`);
  }
  for (const [key, value] of Object.entries(github)) {
    console.log(`github.${key}: ${value}`);
  }
  for (const [key, value] of Object.entries(context)) {
    console.log(`context.${key}: ${value}`);
  }
};
