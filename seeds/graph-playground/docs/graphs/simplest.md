# simplest
  - Original: [`simplest.ts`](../../src/boards/simplest.ts)
  - Graph: [`simplest.json`](../../graphs/simplest.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
secrets2("secrets <br> id='secrets-2'"):::secrets -- "PALM_KEY->PALM_KEY" --> generateText1["generateText <br> id='generateText-1'"]
generateText1["generateText <br> id='generateText-1'"] -- "completion->text" --> completion{{"output <br> id='completion'"}}:::output
prompt[/"input <br> id='prompt'"/]:::input -- "text->text" --> generateText1["generateText <br> id='generateText-1'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```