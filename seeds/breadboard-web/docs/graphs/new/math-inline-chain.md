## math-inline-chain.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
generateText48["generateText <br> id='generateText-48'"] -- "completion->code" --> runJavascript49["runJavascript <br> id='runJavascript-49'"]
secrets47("secrets <br> id='secrets-47'"):::secrets -- "PALM_KEY->PALM_KEY" --> generateText48["generateText <br> id='generateText-48'"]
promptTemplate46["promptTemplate <br> id='promptTemplate-46'"] -- "prompt->text" --> generateText48["generateText <br> id='generateText-48'"]
passthrough45(("passthrough <br> id='passthrough-45'")):::passthrough -- all --> promptTemplate46["promptTemplate <br> id='promptTemplate-46'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```