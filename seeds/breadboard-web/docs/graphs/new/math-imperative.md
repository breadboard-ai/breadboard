## math-imperative.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
runJavascript41["runJavascript <br> id='runJavascript-41'"] -- all --> output37{{"output <br> id='output-37'"}}:::output
generateText40["generateText <br> id='generateText-40'"] -- "completion->code" --> runJavascript41["runJavascript <br> id='runJavascript-41'"]
promptTemplate38["promptTemplate <br> id='promptTemplate-38'"] -- "prompt->text" --> generateText40["generateText <br> id='generateText-40'"]
secrets39("secrets <br> id='secrets-39'"):::secrets -- "PALM_KEY->PALM_KEY" --> generateText40["generateText <br> id='generateText-40'"]
input36[/"input <br> id='input-36'"/]:::input -- "question->question" --> promptTemplate38["promptTemplate <br> id='promptTemplate-38'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```