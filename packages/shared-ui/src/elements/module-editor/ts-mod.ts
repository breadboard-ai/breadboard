export function getModList() {
  return [
    "/lib.d.ts",
    "/lib.decorators.d.ts",
    "/lib.decorators.legacy.d.ts",
    "/lib.dom.d.ts",
    "/lib.dom.iterable.d.ts",
    "/lib.webworker.d.ts",
    "/lib.webworker.importscripts.d.ts",
    "/lib.webworker.iterable.d.ts",
    "/lib.scripthost.d.ts",
    "/lib.es5.d.ts",
    "/lib.es6.d.ts",
    "/lib.es2015.collection.d.ts",
    "/lib.es2015.core.d.ts",
    "/lib.es2015.d.ts",
    "/lib.es2015.generator.d.ts",
    "/lib.es2015.iterable.d.ts",
    "/lib.es2015.promise.d.ts",
    "/lib.es2015.proxy.d.ts",
    "/lib.es2015.reflect.d.ts",
    "/lib.es2015.symbol.d.ts",
    "/lib.es2015.symbol.wellknown.d.ts",
    "/lib.es2016.array.include.d.ts",
    "/lib.es2016.d.ts",
    "/lib.es2016.full.d.ts",
    "/lib.es2017.d.ts",
    "/lib.es2017.date.d.ts",
    "/lib.es2017.full.d.ts",
    "/lib.es2017.intl.d.ts",
    "/lib.es2017.object.d.ts",
    "/lib.es2017.sharedmemory.d.ts",
    "/lib.es2017.string.d.ts",
    "/lib.es2017.typedarrays.d.ts",
    "/lib.es2018.asyncgenerator.d.ts",
    "/lib.es2018.asynciterable.d.ts",
    "/lib.es2018.d.ts",
    "/lib.es2018.full.d.ts",
    "/lib.es2018.intl.d.ts",
    "/lib.es2018.promise.d.ts",
    "/lib.es2018.regexp.d.ts",
    "/lib.es2019.array.d.ts",
    "/lib.es2019.d.ts",
    "/lib.es2019.full.d.ts",
    "/lib.es2019.intl.d.ts",
    "/lib.es2019.object.d.ts",
    "/lib.es2019.string.d.ts",
    "/lib.es2019.symbol.d.ts",
    "/lib.es2020.bigint.d.ts",
    "/lib.es2020.d.ts",
    "/lib.es2020.date.d.ts",
    "/lib.es2020.full.d.ts",
    "/lib.es2020.intl.d.ts",
    "/lib.es2020.number.d.ts",
    "/lib.es2020.promise.d.ts",
    "/lib.es2020.sharedmemory.d.ts",
    "/lib.es2020.string.d.ts",
    "/lib.es2020.symbol.wellknown.d.ts",
    "/lib.es2021.d.ts",
    "/lib.es2021.full.d.ts",
    "/lib.es2021.intl.d.ts",
    "/lib.es2021.promise.d.ts",
    "/lib.es2021.string.d.ts",
    "/lib.es2021.weakref.d.ts",
    "/lib.es2022.array.d.ts",
    "/lib.es2022.d.ts",
    "/lib.es2022.error.d.ts",
    "/lib.es2022.full.d.ts",
    "/lib.es2022.intl.d.ts",
    "/lib.es2022.object.d.ts",
    "/lib.es2022.regexp.d.ts",
    "/lib.es2022.sharedmemory.d.ts",
    "/lib.es2022.string.d.ts",
    "/lib.es2023.array.d.ts",
    "/lib.es2023.collection.d.ts",
    "/lib.es2023.d.ts",
    "/lib.es2023.full.d.ts",
  ];
}

export function getTypeScriptMod(mod: string) {
  switch (mod) {
    case "/lib.d.ts":
      return import("typescript/lib/lib.d.ts?raw");

    case "/lib.decorators.d.ts":
      return import("typescript/lib/lib.decorators.d.ts?raw");

    case "/lib.decorators.legacy.d.ts":
      return import("typescript/lib/lib.decorators.legacy.d.ts?raw");

    case "/lib.dom.d.ts":
      return import("typescript/lib/lib.dom.d.ts?raw");

    case "/lib.dom.iterable.d.ts":
      return import("typescript/lib/lib.dom.iterable.d.ts?raw");

    case "/lib.webworker.d.ts":
      return import("typescript/lib/lib.webworker.d.ts?raw");

    case "/lib.webworker.importscripts.d.ts":
      return import("typescript/lib/lib.webworker.importscripts.d.ts?raw");

    case "/lib.webworker.iterable.d.ts":
      return import("typescript/lib/lib.webworker.iterable.d.ts?raw");

    case "/lib.scripthost.d.ts":
      return import("typescript/lib/lib.scripthost.d.ts?raw");

    case "/lib.es5.d.ts":
      return import("typescript/lib/lib.es5.d.ts?raw");

    case "/lib.es6.d.ts":
      return import("typescript/lib/lib.es6.d.ts?raw");

    case "/lib.es2015.collection.d.ts":
      return import("typescript/lib/lib.es2015.collection.d.ts?raw");

    case "/lib.es2015.core.d.ts":
      return import("typescript/lib/lib.es2015.core.d.ts?raw");

    case "/lib.es2015.d.ts":
      return import("typescript/lib/lib.es2015.d.ts?raw");

    case "/lib.es2015.generator.d.ts":
      return import("typescript/lib/lib.es2015.generator.d.ts?raw");

    case "/lib.es2015.iterable.d.ts":
      return import("typescript/lib/lib.es2015.iterable.d.ts?raw");

    case "/lib.es2015.promise.d.ts":
      return import("typescript/lib/lib.es2015.promise.d.ts?raw");

    case "/lib.es2015.proxy.d.ts":
      return import("typescript/lib/lib.es2015.proxy.d.ts?raw");

    case "/lib.es2015.reflect.d.ts":
      return import("typescript/lib/lib.es2015.reflect.d.ts?raw");

    case "/lib.es2015.symbol.d.ts":
      return import("typescript/lib/lib.es2015.symbol.d.ts?raw");

    case "/lib.es2015.symbol.wellknown.d.ts":
      return import("typescript/lib/lib.es2015.symbol.wellknown.d.ts?raw");

    case "/lib.es2016.array.include.d.ts":
      return import("typescript/lib/lib.es2016.array.include.d.ts?raw");

    case "/lib.es2016.d.ts":
      return import("typescript/lib/lib.es2016.d.ts?raw");

    case "/lib.es2016.full.d.ts":
      return import("typescript/lib/lib.es2016.full.d.ts?raw");

    case "/lib.es2017.d.ts":
      return import("typescript/lib/lib.es2017.d.ts?raw");

    case "/lib.es2017.date.d.ts":
      return import("typescript/lib/lib.es2017.date.d.ts?raw");

    case "/lib.es2017.full.d.ts":
      return import("typescript/lib/lib.es2017.full.d.ts?raw");

    case "/lib.es2017.intl.d.ts":
      return import("typescript/lib/lib.es2017.intl.d.ts?raw");

    case "/lib.es2017.object.d.ts":
      return import("typescript/lib/lib.es2017.object.d.ts?raw");

    case "/lib.es2017.sharedmemory.d.ts":
      return import("typescript/lib/lib.es2017.sharedmemory.d.ts?raw");

    case "/lib.es2017.string.d.ts":
      return import("typescript/lib/lib.es2017.string.d.ts?raw");

    case "/lib.es2017.typedarrays.d.ts":
      return import("typescript/lib/lib.es2017.typedarrays.d.ts?raw");

    case "/lib.es2018.asyncgenerator.d.ts":
      return import("typescript/lib/lib.es2018.asyncgenerator.d.ts?raw");

    case "/lib.es2018.asynciterable.d.ts":
      return import("typescript/lib/lib.es2018.asynciterable.d.ts?raw");

    case "/lib.es2018.d.ts":
      return import("typescript/lib/lib.es2018.d.ts?raw");

    case "/lib.es2018.full.d.ts":
      return import("typescript/lib/lib.es2018.full.d.ts?raw");

    case "/lib.es2018.intl.d.ts":
      return import("typescript/lib/lib.es2018.intl.d.ts?raw");

    case "/lib.es2018.promise.d.ts":
      return import("typescript/lib/lib.es2018.promise.d.ts?raw");

    case "/lib.es2018.regexp.d.ts":
      return import("typescript/lib/lib.es2018.regexp.d.ts?raw");

    case "/lib.es2019.array.d.ts":
      return import("typescript/lib/lib.es2019.array.d.ts?raw");

    case "/lib.es2019.d.ts":
      return import("typescript/lib/lib.es2019.d.ts?raw");

    case "/lib.es2019.full.d.ts":
      return import("typescript/lib/lib.es2019.full.d.ts?raw");

    case "/lib.es2019.intl.d.ts":
      return import("typescript/lib/lib.es2019.intl.d.ts?raw");

    case "/lib.es2019.object.d.ts":
      return import("typescript/lib/lib.es2019.object.d.ts?raw");

    case "/lib.es2019.string.d.ts":
      return import("typescript/lib/lib.es2019.string.d.ts?raw");

    case "/lib.es2019.symbol.d.ts":
      return import("typescript/lib/lib.es2019.symbol.d.ts?raw");

    case "/lib.es2020.bigint.d.ts":
      return import("typescript/lib/lib.es2020.bigint.d.ts?raw");

    case "/lib.es2020.d.ts":
      return import("typescript/lib/lib.es2020.d.ts?raw");

    case "/lib.es2020.date.d.ts":
      return import("typescript/lib/lib.es2020.date.d.ts?raw");

    case "/lib.es2020.full.d.ts":
      return import("typescript/lib/lib.es2020.full.d.ts?raw");

    case "/lib.es2020.intl.d.ts":
      return import("typescript/lib/lib.es2020.intl.d.ts?raw");

    case "/lib.es2020.number.d.ts":
      return import("typescript/lib/lib.es2020.number.d.ts?raw");

    case "/lib.es2020.promise.d.ts":
      return import("typescript/lib/lib.es2020.promise.d.ts?raw");

    case "/lib.es2020.sharedmemory.d.ts":
      return import("typescript/lib/lib.es2020.sharedmemory.d.ts?raw");

    case "/lib.es2020.string.d.ts":
      return import("typescript/lib/lib.es2020.string.d.ts?raw");

    case "/lib.es2020.symbol.wellknown.d.ts":
      return import("typescript/lib/lib.es2020.symbol.wellknown.d.ts?raw");

    case "/lib.es2021.d.ts":
      return import("typescript/lib/lib.es2021.d.ts?raw");

    case "/lib.es2021.full.d.ts":
      return import("typescript/lib/lib.es2021.full.d.ts?raw");

    case "/lib.es2021.intl.d.ts":
      return import("typescript/lib/lib.es2021.intl.d.ts?raw");

    case "/lib.es2021.promise.d.ts":
      return import("typescript/lib/lib.es2021.promise.d.ts?raw");

    case "/lib.es2021.string.d.ts":
      return import("typescript/lib/lib.es2021.string.d.ts?raw");

    case "/lib.es2021.weakref.d.ts":
      return import("typescript/lib/lib.es2021.weakref.d.ts?raw");

    case "/lib.es2022.array.d.ts":
      return import("typescript/lib/lib.es2022.array.d.ts?raw");

    case "/lib.es2022.d.ts":
      return import("typescript/lib/lib.es2022.d.ts?raw");

    case "/lib.es2022.error.d.ts":
      return import("typescript/lib/lib.es2022.error.d.ts?raw");

    case "/lib.es2022.full.d.ts":
      return import("typescript/lib/lib.es2022.full.d.ts?raw");

    case "/lib.es2022.intl.d.ts":
      return import("typescript/lib/lib.es2022.intl.d.ts?raw");

    case "/lib.es2022.object.d.ts":
      return import("typescript/lib/lib.es2022.object.d.ts?raw");

    case "/lib.es2022.regexp.d.ts":
      return import("typescript/lib/lib.es2022.regexp.d.ts?raw");

    case "/lib.es2022.sharedmemory.d.ts":
      return import("typescript/lib/lib.es2022.sharedmemory.d.ts?raw");

    case "/lib.es2022.string.d.ts":
      return import("typescript/lib/lib.es2022.string.d.ts?raw");

    case "/lib.es2023.array.d.ts":
      return import("typescript/lib/lib.es2023.array.d.ts?raw");

    case "/lib.es2023.collection.d.ts":
      return import("typescript/lib/lib.es2023.collection.d.ts?raw");

    case "/lib.es2023.d.ts":
      return import("typescript/lib/lib.es2023.d.ts?raw");

    case "/lib.es2023.full.d.ts":
      return import("typescript/lib/lib.es2023.full.d.ts?raw");

    default:
      console.warn(`Unexpected import ${mod}`);
      return Promise.resolve({ default: "" });
  }
}
