# Generate a board / recipe from an OpenAPI spec

## Running the Recipe

```bash
breadboard run recipes/tools/openapi/index.js --kit @google-labs/llm-starter --kit @google-labs/core-kit -i "{\"url\":\"https://api.apis.guru/v2/specs/apis.guru/2.2.0/openapi.json\"}"
```

### Inputs

- url - The url to the OpenAPI spec (JSON only for now)

### Outputs

- board - The generated board that has a list of boards.

## Compiling the recipe

`breadboard make recipes/tools/openapi/index.js >  recipes/tools/openapi/index.json`
