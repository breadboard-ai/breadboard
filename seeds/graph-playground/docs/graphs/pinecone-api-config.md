# pinecone-api-config
  - Original: [`pinecone-api-config.ts`](../../src/boards/pinecone-api-config.ts)
  - Graph: [`pinecone-api-config.json`](../../graphs/pinecone-api-config.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PINECONE_INDEX->PINECONE_INDEX" --> start["jsonata <br> id='start'"]
secrets2("secrets <br> id='secrets-2'"):::secrets -- "PINECONE_PROJECT_ID->PINECONE_PROJECT_ID" --> start["jsonata <br> id='start'"]
secrets3("secrets <br> id='secrets-3'"):::secrets -- "PINECONE_ENVIRONMENT->PINECONE_ENVIRONMENT" --> start["jsonata <br> id='start'"]
secrets4("secrets <br> id='secrets-4'"):::secrets -- "PINECONE_API_KEY->PINECONE_API_KEY" --> start["jsonata <br> id='start'"]
start["jsonata <br> id='start'"] -- "result->config" --> result{{"output <br> id='result'"}}:::output
expressionstart[expression]:::config -- "expression->expression" --o start
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
keyssecrets2[keys]:::config -- "keys->keys" --o secrets2
keyssecrets3[keys]:::config -- "keys->keys" --o secrets3
keyssecrets4[keys]:::config -- "keys->keys" --o secrets4
schemaresult[schema]:::config -- "schema->schema" --o result
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```