# schemish-validator
  - Original: [`schemish-validator.ts`](../../src/boards/schemish-validator.ts)
  - Graph: [`schemish-validator.json`](../../graphs/schemish-validator.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o generateText2["generateText <br> id='generateText-2'"]
generateText2["generateText <br> id='generateText-2'"] -- "completion->text" --> analysis{{"output <br> id='analysis'"}}:::output
promptTemplate3["promptTemplate <br> id='promptTemplate-3'"] -- "prompt->text" --> generateText2["generateText <br> id='generateText-2'"]
scene[/"input <br> id='scene'"/]:::input -- "text->scene" --> promptTemplate3["promptTemplate <br> id='promptTemplate-3'"]
keyssecrets1[keys]:::config -- "keys->keys" --o secrets1
schemascene[schema]:::config -- "schema->schema" --o scene
templatepromptTemplate3[template]:::config -- "template->template" --o promptTemplate3
schemishpromptTemplate3[schemish]:::config -- "schemish->schemish" --o promptTemplate3
textanalysis[text]:::config -- "text->text" --o analysis
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```