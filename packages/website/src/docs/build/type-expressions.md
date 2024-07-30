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

The `"unknown"` Breadboard Type Expression means _any JSON value_. In other
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

Use the `object` function to declare a JSON Object.

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
import { object, optional } from "@breadboard-ai/build";

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
