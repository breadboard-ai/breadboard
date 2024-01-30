## math-chain.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
runJavascript6["runJavascript <br> id='runJavascript-6'"] -- all --> output2{{"output <br> id='output-2'"}}:::output
palmgenerateText5["palm-generateText <br> id='palm-generateText-5'"] -- "completion->code" --> runJavascript6["runJavascript <br> id='runJavascript-6'"]
secrets4("secrets <br> id='secrets-4'"):::secrets -- "PALM_KEY->PALM_KEY" --> palmgenerateText5["palm-generateText <br> id='palm-generateText-5'"]
promptTemplate3["promptTemplate <br> id='promptTemplate-3'"] -- "prompt->text" --> palmgenerateText5["palm-generateText <br> id='palm-generateText-5'"]
input1[/"input <br> id='input-1'"/]:::input -- "question->question" --> promptTemplate3["promptTemplate <br> id='promptTemplate-3'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```