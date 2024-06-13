/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * see: https://hn.algolia.com/api
 */

import {
  AbstractNode,
  base,
  code,
  InputValues,
  NodeValue,
} from "@google-labs/breadboard";
import {
  AbstractValue,
  NodeProxy,
} from "../../../breadboard/dist/src/new/grammar/types";
import { OutputValue } from "../../../breadboard/dist/src/new/runner/types";

const johnSmith = {
  forename: "John",
  surname: "Smith",
  age: 30,
  city: "New York",
  dateOfBirth: new Date("1990-01-01"),
};
const input = base.input({
  $metadata: {
    title: "Input",
  },
  schema: {
    type: "object",
    properties: {
      object: {
        type: "object",
        examples: [
          JSON.stringify({
            forename: "John",
            surname: "Smith",
            age: 30,
            city: "New York",
            dateOfBirth: new Date("1990-01-01"),
          }),
        ],
      },
      keys: {
        type: "array",
        items: {
          type: "string",
        },
        examples: [JSON.stringify(["forename", "surname"])],
      },
      mode: {
        type: "string",
        enum: ["pick", "omit"],
        default: "pick",
      },
      strict: {
        type: "boolean",
        default: JSON.stringify(false),
        description: "If true and a key is not found, an error will be thrown",
      },
    },
  },
  examples: [
    {
      object: johnSmith,
      keys: ["forename", "surname"],
      mode: "pick",
      strict: false,
    },
    {
      object: johnSmith,
      keys: ["forename", "surname"],
      mode: "omit",
      strict: false,
    },
    {
      object: {
        name: [johnSmith.forename, johnSmith.surname].join(" "),
        age: johnSmith.age,
        location: johnSmith.city,
        dob: johnSmith.dateOfBirth,
      },
      keys: ["forename", "surname"],
      mode: "pick",
      strict: true,
    },
  ],
});

type ObjectManipulationOptions<T extends Record<string, unknown>> = {
  object: T;
  keys: string[];
  mode?: "pick" | "omit";
  strict?: boolean;
};

function manipulate<T extends Record<string, unknown>>(
  args:
    | AbstractNode<InputValues, ObjectManipulationOptions<T>>
    | AbstractValue<NodeValue>
    | Partial<{
        [K in keyof ObjectManipulationOptions<T>]:
          | AbstractValue<ObjectManipulationOptions<T>[K]>
          | NodeProxy<InputValues, OutputValue<ObjectManipulationOptions<T>[K]>>
          | ObjectManipulationOptions<T>[K];
      }>
    | {
        [p: string]:
          | AbstractValue<NodeValue>
          | NodeProxy<InputValues, Partial<InputValues>>
          | NodeValue;
      }
) {
  return code(
    ({
      object,
      keys,
      mode = "pick",
      strict = false,
    }: ObjectManipulationOptions<T>) => {
      if (mode === "pick") {
        const result: Record<string, unknown> = {};
        keys.forEach((key) => {
          if (strict && !object[key]) {
            throw new Error(`Key "${key}" not found in object`);
          }
          result[key] = object[key];
        });
        return { object: result };
      } else {
        const result = { ...object };
        keys.forEach((key) => {
          if (strict && !object[key]) {
            throw new Error(`Key "${key}" not found in object`);
          }
          delete result[key];
        });
        return { object: result };
      }
    }
  )(args);
}

const manipulation = manipulate({
  object: input.object as unknown as Record<string, unknown>,
  keys: input.keys as unknown as string[],
  mode: input.mode as unknown as "pick" | "omit",
  strict: input.strict as unknown as boolean,
  $metadata: {
    title: "Manipulation",
  },
});

const output = base.output({
  schema: {
    type: "object",
  },
  $metadata: {
    title: "Output",
  },
});

manipulation.object.to(output);

const serialised = await output.serialize({
  title: "Object Manipulator",
  description: "Manipulate an object by picking or omitting keys",
});

export { serialised as graph, input, output };
export default serialised;
