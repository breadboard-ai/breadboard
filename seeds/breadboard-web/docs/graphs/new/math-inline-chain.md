## math-inline-chain.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
palmgenerateText15["palm-generateText <br> id='palm-generateText-15'"] -- "completion->code" --> runJavascript16["runJavascript <br> id='runJavascript-16'"]
secrets14("secrets <br> id='secrets-14'"):::secrets -- "PALM_KEY->PALM_KEY" --> palmgenerateText15["palm-generateText <br> id='palm-generateText-15'"]
promptTemplate13["promptTemplate <br> id='promptTemplate-13'"] -- "prompt->text" --> palmgenerateText15["palm-generateText <br> id='palm-generateText-15'"]
passthrough12(("passthrough <br> id='passthrough-12'")):::passthrough -- all --> promptTemplate13["promptTemplate <br> id='promptTemplate-13'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```