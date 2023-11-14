## math-chain.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
runJavascript36["runJavascript <br> id='runJavascript-36'"] -- all --> output32{{"output <br> id='output-32'"}}:::output
generateText35["generateText <br> id='generateText-35'"] -- "completion->code" --> runJavascript36["runJavascript <br> id='runJavascript-36'"]
secrets34("secrets <br> id='secrets-34'"):::secrets -- "PALM_KEY->PALM_KEY" --> generateText35["generateText <br> id='generateText-35'"]
promptTemplate33["promptTemplate <br> id='promptTemplate-33'"] -- "prompt->text" --> generateText35["generateText <br> id='generateText-35'"]
input31[/"input <br> id='input-31'"/]:::input -- "question->question" --> promptTemplate33["promptTemplate <br> id='promptTemplate-33'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```