---
layout: docs.liquid
title: Breadboard Type Expressions
tags:
  - api
  - wip
---

Breadboard Type Expressions allow you to declare schemas for Breadboard
components with TypeScript, with the added benefit of compile-time type
checking.

Writing a Breadboard Type Expression simultaneously generates both a [JSON
Schema](https://json-schema.org/) and a
[TypeScript](https://www.typescriptlang.org/) type with matching semantics. The
JSON Schema is automatically serialized and used by the Breadboard Runtime and
Visual Editor, while the TypeScript type is used to enforce type safety when
wiring components together with the Breadboard Build API.

## Basic Types

The simplest Breadboard Type Expressions are the JSON primitive types, specified
directly as strings:

<div class="tight-list">

- `"string"`
- `"number"`
- `"boolean"`
- `"null"`

</div>

### Example

```ts
import { input } from "@breadboard-ai/build";

const numImages = input({
  type: "number",
  description: "How many images to generate",
});
```

## Unknown

The `"unknown"` Breadboard Type Expression matches _any JSON value_. In other
words it can be any of: `string`, `number`, `boolean`, `null`, `object`, or
`array`.

### Example

```ts
import { input } from "@breadboard-ai/build";

const fetchResponse = input({
  type: "unknown",
  description: "The response for an HTTP request, could be anything".
});
```

## Objects

Use the `object` function to match a JSON Object.

### Arguments

1. `properties` (required): An object listing the properties the object has
   along with their types. Can be empty (`{}`) to declare that the object has no
   properties. Properties are required by default, but can be wrapped in
   `optional` if needed (see [Optional properties](#optional-properties)).

2. `additional` (optional): Allow the object to have additional properties
   (meaning not declared in `properties`) as long as they match the given type.
   (See [Additional properties](#additional-properties)).

> [!NOTE]
>
> The `object` function declares a _JSON Object_, also known as a _plain
> object_, which should not be confused with either JavaScript's `Object`
> prototype nor with TypeScript's `object` type, both of which are much broader
> concepts. JSON Objects are strictly those objects which have been declared
> with curly braces, and contain values that are themselves JSON-serializable.

### Additional properties

If the second argument to `object` is omitted, then the object will not allow
any additional properties, meaning only those properties listed in `properties`
are allowed.

To allow additional properties, pass a Breadboard Type Expression as the second
argument to `object`. This can be `"unknown"` to allow any JSON value, or
something more specific to constrain it further.

### Optional properties

Properties passed to `object` are required by default, but can be made optional
by wrapping the type with `optional`.

### Example

```ts
import { object, optional, input } from "@breadboard-ai/build";

const sensorReadingType = object({
  sensorId: "string",
  sensorDescription: optional("string"),
  // e.g. {"2024-07-29": 37, "2024-07-30": 42}
  sensorTimeSeries: object({}, "number"),
});

const sensorReading = input({
  type: sensorReadingType,
  description: "Time series data from a sensor",
});
```

## Arrays

Use the `array` function to match a JSON Array.

### Arguments

1. `itemType` (required): The type of the elements in the array. Any Breadboard
   Type Expression.

### Example

```ts
import { array, object } from "@breadboard-ai/build";

array("string");

array("unknown");

array(
  object({
    timestamp: "string",
    value: "number",
  })
);
```

## Composition

Use the `anyOf` function to match at least one of the given types.

Generates a JSON Schema
[`anyOf`](https://json-schema.org/understanding-json-schema/reference/combining#anyOf).
and a TypeScript
[union](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types)
(`|`).

### Arguments

Specify 2 or more arguments, each any kind of Breadboard Type Expression.

### Example

```ts
import { anyOf } from "@breadboard-ai/build";

anyOf("string", "number");

anyOf(
  "string",
  array("string"),
  object({ value: "string" }),
  array(object({ value: "string" }))
);
```

## Enumerations

Use the `enumeration` function to match a fixed set of values.

Generates a JSON Schema
[`enum`](https://json-schema.org/understanding-json-schema/reference/enum) and a
TypeScript
[union](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types)
(`|`).

### Arguments

Specify 1 or more fixed values. Each value can be a string, number, boolean, or
null.

### Example

```ts
import { enumeration, input } from "@breadboard-ai/build";

const fileType = input({
  type: enumeration("video", "audio", "image", "text"),
});

// Mixed types are OK.
enumeration("foo", 123, true, null);
```

## Forcing Schemas

Use the `unsafeType` function to manually create a custom Breadboard Type
Expression with an exact given JSON Schema and TypeScript type.

This can be useful in cases where the JSON Schema and the TypeScript types are
generated by an external process. It can also be useful if there is a feature of
JSON Schema or TypeScript that would improve the type or schema, but which is
not provided by the included utilities.

> [!NOTE]
>
> This function is named "unsafe" because there is no guarantee that the JSON
> Schema and TypeScript types you specify are semantically equivalent. Prefer
> using one of the provided types if possible, and consider filing a feature
> request if you think a type should be natively supported.

### Example

```ts
import { unsafeType } from "@breadboard-ai/build";
import type { ThingType } from "./my-type.js";

export const thing = unsafeType<ThingType>(
  await import("./thing-schema.json", { with: { type: "json" } })
);
```

## Breadboard Behaviors

Breadboard extends JSON Schema with a special field called `behavior`. Use the
`annotate` function to add a `behavior` field to the underlying JSON Schema.

### Example

```ts
import { annotate, input } from "@breadboard-ai/build";

const oldConfig = input({
  type: annotate("string", {
    behavior: ["config", "deprecated"],
  }),
});
```
