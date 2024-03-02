import { KitConstructor, Kit, asRuntimeKit } from "@google-labs/breadboard";

const fetchAndImportKits = async () => {
  const response = await fetch(`${self.location.origin}/kits.json`);
  const kitList = await response.json();

  const kits = await Promise.all(
    kitList.map(async (kit: string) => {
      const module = await import(/* @vite-ignore */ `${kit}`);

      if (module.default == undefined) {
        throw new Error(`Module ${kit} does not have a default export.`);
      }

      const moduleKeys = Object.getOwnPropertyNames(module.default.prototype);

      if (
        moduleKeys.includes("constructor") == false ||
        moduleKeys.includes("handlers") == false
      ) {
        throw new Error(
          `Module default export '${kit}' does not look like a Kit (either no constructor or no handler).`
        );
      }
      return module.default;
    })
  );

  return kits;
};

export const loadKits = async (kitsToLoad: KitConstructor<Kit>[]) => {
  kitsToLoad.push(...(await fetchAndImportKits()));

  const runtimeKits = kitsToLoad.map((kitConstructor) =>
    asRuntimeKit(kitConstructor)
  );

  // Dedupe kits, last kit with same key wins
  const kits: Kit[] = Array.from(
    new Map(
      runtimeKits.map((kit) => [`${kit.title}${kit.version}${kit.url}`, kit])
    ).values()
  );
  return kits;
};
