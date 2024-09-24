# build-code

[![Published on npm](https://img.shields.io/npm/v/@breadboard-ai/build-code.svg?logo=npm)](https://www.npmjs.com/package/@breadboard-ai/build-code)

Converts TypeScript functions to Breadboard `runJavascript` components. Code is
bundled and schema is automaticaly generated from TypeScript types.

## Usage

1.  Install:

    ```sh
    npm i @breadboard-ai/build-code
    ```

2.  Create a module with the following exports:

    - A type/interface called `Inputs`
    - A type/interface called `Outputs`
    - A function called `run`

    For example, the file `src/js-components/is-foo.js`:

    ```ts
    export interface Inputs {
      str: string;
    }

    export interface Outputs {
      isFoo: boolean;
    }

    export const run = ({ str }: Inputs): Outputs => {
      return { isFoo: strIsFoo(str) };
    };

    // Note that this function is outside the scope of `run`. This would
    // normally be a problem with the the standard Breadboard `code`
    // function, but it's OK here because we bundle! Imports work too.
    function strIsFoo(str: string): boolean {
      return str === "foo";
    }
    ```

3.  Use the `build-code` binary:

    ```json
    {
      "scripts": {
        "generate:js-components": "build-code --tsconfig=./tsconfig.json --out=./src/generated ./src/js-components/*.ts"
      }
    }
    ```

4.  Import the generated module, which in this case will be at
    `src/generated/is-foo.ts`, and use it with the Breadboard Build API. The
    module will contain a strongly-typed function based on the name of the
    source module:

    ```ts
    import { isFoo } from "./generated/is-foo.js";
    import { input, board } from "@breadboard-ai/build";

    const str = input();
    const isFooInst = isFoo({ str });
    export const myBoard = board({
      inputs: { str },
      outputs: { isFoo: isFooInst.outputs.isFoo },
    });
    ```

5.  Upon serialization to BGL, a `runJavascript` component will be created
    with bundled code and automatically generated schemas:

    ```json
    {
      "nodes": {
        {
          "id": "runJavascript-0",
          "type:" "runJavascript",
          "configuration": {
            "raw": true,
            "name": "run",
            "code": "export const run = ({ str }) => {\n  return { isFoo: strIsFoo(str) };\n};\n\nfunction strIsFoo(str) {\n  return str === \"foo\";\n}\n",
            "inputSchema": {
              "type": "object",
              "properties": {
                "str": {
                  "type": "string"
                }
              },
              "required": ["str"],
              "additionalProperties": false
            },
            "outputSchema": {
              "type": "object",
              "properties": {
                "isFoo": {
                  "type": "boolean"
                }
              },
              "required": ["isFoo"],
              "additionalProperties": false
            }
          }
        }
      }
    }
    ```
