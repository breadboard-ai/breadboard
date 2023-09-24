# kit
  - Original: [`kit.ts`](../../src/boards/kit.ts)
  - Graph: [`kit.json`](../../graphs/kit.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
graphinclude1[graph]:::config -- "graph->graph" --o include1
graphinclude2[graph]:::config -- "graph->graph" --o include2
graphinclude3[graph]:::config -- "graph->graph" --o include3
graphinclude4[graph]:::config -- "graph->graph" --o include4
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```