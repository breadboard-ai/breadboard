# kit
  - Original: [`kit.ts`](../../src/boards/kit.ts)
  - Graph: [`kit.json`](../../graphs/kit.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
graphconfig[graph]:::config -- "graph->graph" --o config
graphquery[graph]:::config -- "graph->graph" --o query
graphupsert[graph]:::config -- "graph->graph" --o upsert
graphvector[graph]:::config -- "graph->graph" --o vector
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```