# simplest
  ---
  - Original: [`simplest.ts`](../../src/boards/simplest.ts)
  - Graph: [`simplest.json`](../../graphs/simplest.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
secrets6("secrets
id='secrets-6'"):::secrets -- API_KEY:API_KEY --> textcompletion5["text-completion
id='text-completion-5'"]
textcompletion5["text-completion
id='text-completion-5'"] -- completion:text --> output8{{"output
id='output-8'"}}:::output
input7[/"input
id='input-7'"/]:::input -- text:text --> textcompletion5["text-completion
id='text-completion-5'"]
keyssecrets6[keys]:::config -- keys:keys --o secrets6
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```