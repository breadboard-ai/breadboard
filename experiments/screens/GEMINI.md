# TypeScript

Prefer to put classes in their own files. If a class implements a type, name the
file after the name of the type (lowercase, dash-separated), and add "Impl" to
the end of the class. For example, if a class implements type `Foo`, it goes
into `src/foo.ts` and is named `FooImpl`.

All types go into the `src/types.ts` file. This file must only contain plain
types. Prefer `type` to `interface`, and only use `interface` when it is
actually necessary: when we declaration merging.
