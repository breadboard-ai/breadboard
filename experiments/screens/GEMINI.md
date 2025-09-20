# TypeScript

## How to create classes

Prefer to put classes in their own files. If a class implements a type, name the
file after the name of the type (lowercase, dash-separated), and add "Impl" to
the end of the class. For example, if a class implements type `Foo`, it goes
into `src/foo.ts` and is named `FooImpl`.

All types go into the `src/types.ts` file. This file must only contain plain
types. Prefer `type` to `interface`, and only use `interface` when it is
actually necessary: when we declaration merging.

Avoid using `any` type. Only use it as a last resort.

## Exports

Use ES Module syntax for imports/exports.

Define exports explicitly at the top of the file, right below the imports.

```ts
import { foo } from "./foo";
// ... more imports

export { bar, baz };

function bar() {
  // function impl.
}

function baz() {
  // function impl.
}

// not exported
function quz() {
  // function impl.
}
```

# Running

Use `tsx` for running code. This project is an experiment and does not need a
separate build step.

This project uses vite for the web frontend.

# Testing

To write tests, use node's built-in test framework.
