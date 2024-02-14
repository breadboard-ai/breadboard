# Generate a board from an OpenAPI spec

## Running the Board

```bash
breadboard run boards/tools/openapi/openapi.js --kit @google-labs/core-kit -i "{\"url\":\"https://api.apis.guru/v2/specs/apis.guru/2.2.0/openapi.json\"}"
```

### Inputs

- url - The url to the OpenAPI spec (JSON only for now)

### Outputs

- board - The generated board that has a list of boards.

## Compiling the board

`breadboard make boards/tools/openapi/--kit @google-labs/core-kit.js > boards/tools/openapi/index.json`
