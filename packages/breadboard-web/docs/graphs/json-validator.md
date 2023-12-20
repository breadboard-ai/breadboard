## json-validator.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
parameters[/"input <br> id='parameters'"/]:::input -- "text->json" --> validateJson1["validateJson <br> id='validateJson-1'"]
parameters[/"input <br> id='parameters'"/]:::input -- "schema->schema" --> validateJson1["validateJson <br> id='validateJson-1'"]
validateJson1["validateJson <br> id='validateJson-1'"] -- "json->text" --> outputSuccess{{"output <br> id='outputSuccess'"}}:::output
parameters[/"input <br> id='parameters'"/]:::input -- "schema->schema" --> formatValidationError["jsonata <br> id='formatValidationError'"]
validateJson1["validateJson <br> id='validateJson-1'"] -- "$error->$error" --> formatValidationError["jsonata <br> id='formatValidationError'"]
validateJson1["validateJson <br> id='validateJson-1'"] -- "$error->$error" --> formatParsingError["jsonata <br> id='formatParsingError'"]
validateJson1["validateJson <br> id='validateJson-1'"] -- "$error->json" --> parseErrorType["jsonata <br> id='parseErrorType'"]
parseErrorType["jsonata <br> id='parseErrorType'"] -- "validation->validation" --> formatValidationError["jsonata <br> id='formatValidationError'"]
parseErrorType["jsonata <br> id='parseErrorType'"] -- "parsing->parsing" --> formatParsingError["jsonata <br> id='formatParsingError'"]
formatValidationError["jsonata <br> id='formatValidationError'"] -- "result->error" --> outputFailure{{"output <br> id='outputFailure'"}}:::output
formatParsingError["jsonata <br> id='formatParsingError'"] -- "result->error" --> outputFailure{{"output <br> id='outputFailure'"}}:::output
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```