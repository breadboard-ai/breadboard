# retry
  - Original: [`retry.ts`](../../src/boards/retry.ts)
  - Graph: [`retry.json`](../../graphs/retry.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
input1[/"input <br> id='input-1'"/]:::input -- "tries->tries" --> jsonata4["jsonata <br> id='jsonata-4'"]
jsonata4["jsonata <br> id='jsonata-4'"] -- "tries->tries" --> jsonata4["jsonata <br> id='jsonata-4'"]
input1[/"input <br> id='input-1'"/]:::input -- "text->text" --> promptTemplate6["promptTemplate <br> id='promptTemplate-6'"]
promptTemplate6["promptTemplate <br> id='promptTemplate-6'"] -- "prompt->text" --> promptTemplate6["promptTemplate <br> id='promptTemplate-6'"]
input1[/"input <br> id='input-1'"/]:::input -- "text->text" --> lambda completion["invoke <br> id='lambda completion'"]
input1[/"input <br> id='input-1'"/]:::input -- "lambda->board" --o lambda completion["invoke <br> id='lambda completion'"]
lambda completion["invoke <br> id='lambda completion'"] -- "completion->completion" --> output2{{"output <br> id='output-2'"}}:::output
lambda completion["invoke <br> id='lambda completion'"] -- "$error->data" --> jsonata4["jsonata <br> id='jsonata-4'"]
jsonata4["jsonata <br> id='jsonata-4'"] -- "done->$error" --> output3{{"output <br> id='output-3'"}}:::output
jsonata4["jsonata <br> id='jsonata-4'"] -- "data->json" --> jsonata5["jsonata <br> id='jsonata-5'"]
jsonata5["jsonata <br> id='jsonata-5'"] -- "error->error" --> promptTemplate6["promptTemplate <br> id='promptTemplate-6'"]
jsonata5["jsonata <br> id='jsonata-5'"] -- "completion->completion" --> promptTemplate6["promptTemplate <br> id='promptTemplate-6'"]
promptTemplate6["promptTemplate <br> id='promptTemplate-6'"] -- "prompt->text" --> lambda completion["invoke <br> id='lambda completion'"]
schemainput1[schema]:::config -- "schema->schema" --o input1
schemaoutput2[schema]:::config -- "schema->schema" --o output2
schemaoutput3[schema]:::config -- "schema->schema" --o output3
expressionjsonata4[expression]:::config -- "expression->expression" --o jsonata4
triesjsonata4[tries]:::config -- "tries->tries" --o jsonata4
rawjsonata4[raw]:::config -- "raw->raw" --o jsonata4
expressionjsonata5[expression]:::config -- "expression->expression" --o jsonata5
rawjsonata5[raw]:::config -- "raw->raw" --o jsonata5
templatepromptTemplate6[template]:::config -- "template->template" --o promptTemplate6
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```