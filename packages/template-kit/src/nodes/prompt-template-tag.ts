/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { JsonSerializable } from "@breadboard-ai/build/internal/type-system/type.js";
import promptTemplate from "./prompt-template.js";
import { Value } from "@breadboard-ai/build";

/**
 * A utility that makes it safer and more convenient to instantiate a
 * {@link promptTemplate} node using JavaScript template string literals.
 *
 * Usage:
 *
 * ```ts
 * import {prompt} from '@google-labs/template-kit';
 * import {input} from '@breadboard-ai/build';
 *
 * const dish = input();
 * const steps = input({default: 10});
 * const instructions = prompt`Write a ${dish} recipe in under ${steps} steps`;
 * ```
 *
 * To customize the node id of the `promptTemplate` node that this function will
 * create, you can use the `configure` method:
 *
 * ```ts
 * const instructions =
 *   prompt`Write a ${dish} recipe in under ${steps} steps`.configure({
 *     id: "recipe-template",
 * });
 * ```
 *
 * To customize the name of a parameter within the template, use the
 * {@link promptPlaceholder} function to wrap the value:
 *
 * ```ts
 * import {prompt, promptPlaceholder} from '@google-labs/template-kit';
 *
 * const instructions = prompt`Write a ${promptPlaceholder(dish, {
 *   name: "dish",
 * })} recipe in under ${promptPlaceholder(steps, {
 *   name: "steps",
 * })} steps`;
 * ```
 */
export function prompt(
  strings: TemplateStringsArray,
  ...values: Array<Value<JsonSerializable> | PromptPlaceholder>
): ReturnType<typeof promptTemplate> & {
  configure(config: { id: string }): ReturnType<typeof promptTemplate>;
} {
  let template = "";
  const placeholders: Record<string, Value<JsonSerializable>> = {};
  const uniqueNames = new Set<string>();
  for (let i = 0; i < strings.length; i++) {
    if (i > 0) {
      template += "}}";
    }
    template += strings[i];
    if (i < strings.length - 1) {
      const value = values[i]!;
      const { name, actualValue } = isPromptPlaceholder(value)
        ? { name: value.name, actualValue: value.value }
        : { name: `p${i}`, actualValue: value };
      if (uniqueNames.has(name)) {
        throw new Error(
          `Prompt placeholder ${JSON.stringify(name)} has already been used ` +
            `in template starting with ` +
            JSON.stringify(strings.join("...").slice(0, 32))
        );
      }
      uniqueNames.add(name);
      template += `{{`;
      template += name;
      placeholders[name] = actualValue;
    }
  }
  return Object.assign(
    promptTemplate({
      template,
      ...placeholders,
    }),
    {
      configure: ({ id }: { id: string }) =>
        promptTemplate({
          $id: id,
          template,
          ...placeholders,
        }),
    }
  );
}

const PromptPlaceholderBrand = Symbol();

export function promptPlaceholder(
  value: Value<JsonSerializable>,
  { name }: { name: string }
): PromptPlaceholder {
  return { [PromptPlaceholderBrand]: true, value, name };
}

interface PromptPlaceholder {
  [PromptPlaceholderBrand]: true;
  value: Value<JsonSerializable>;
  name: string;
}

function isPromptPlaceholder(value: unknown): value is PromptPlaceholder {
  return (
    typeof value === "object" &&
    value !== null &&
    PromptPlaceholderBrand in value
  );
}
