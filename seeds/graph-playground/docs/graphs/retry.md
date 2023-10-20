# retry
  - Original: [`retry.ts`](../../src/boards/retry.ts)
  - Graph: [`retry.json`](../../graphs/retry.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
input1[/"input <br> id='input-1'"/]:::input -- "lambda->board" --o lambdacompletion["invoke <br> id='lambda-completion'"]
input1[/"input <br> id='input-1'"/]:::input -- "tries->tries" --> countdown["jsonata <br> id='countdown'"]
countdown["jsonata <br> id='countdown'"] -- "tries->tries" --> countdown["jsonata <br> id='countdown'"]
input1[/"input <br> id='input-1'"/]:::input -- "text->text" --> retryprompt["promptTemplate <br> id='retry-prompt'"]
retryprompt["promptTemplate <br> id='retry-prompt'"] -- "prompt->text" --> retryprompt["promptTemplate <br> id='retry-prompt'"]
input1[/"input <br> id='input-1'"/]:::input -- "text->text" --> lambdacompletion["invoke <br> id='lambda-completion'"]
lambdacompletion["invoke <br> id='lambda-completion'"] -- all --> outputsuccess{{"output <br> id='output-success'"}}:::output
lambdacompletion["invoke <br> id='lambda-completion'"] -- "$error->data" --> countdown["jsonata <br> id='countdown'"]
countdown["jsonata <br> id='countdown'"] -- "done->$error" --> outputerror{{"output <br> id='output-error'"}}:::output
countdown["jsonata <br> id='countdown'"] -- "data->json" --> errorparser["jsonata <br> id='error-parser'"]
errorparser["jsonata <br> id='error-parser'"] -- "error->error" --> retryprompt["promptTemplate <br> id='retry-prompt'"]
errorparser["jsonata <br> id='error-parser'"] -- "completion->completion" --> retryprompt["promptTemplate <br> id='retry-prompt'"]
retryprompt["promptTemplate <br> id='retry-prompt'"] -- "prompt->text" --> lambdacompletion["invoke <br> id='lambda-completion'"]
schemainput1[schema]:::config -- "schema->schema" --o input1
schemaoutputsuccess[schema]:::config -- "schema->schema" --o outputsuccess
schemaoutputerror[schema]:::config -- "schema->schema" --o outputerror
expressioncountdown[expression]:::config -- "expression->expression" --o countdown
triescountdown[tries]:::config -- "tries->tries" --o countdown
rawcountdown[raw]:::config -- "raw->raw" --o countdown
expressionerrorparser[expression]:::config -- "expression->expression" --o errorparser
rawerrorparser[raw]:::config -- "raw->raw" --o errorparser
templateretryprompt[template]:::config -- "template->template" --o retryprompt
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```