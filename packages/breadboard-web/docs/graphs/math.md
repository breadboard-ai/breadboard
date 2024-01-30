## math.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
compute["runJavascript <br> id='compute'"] -- all --> answer{{"output <br> id='answer'"}}:::output
generator["invoke <br> id='generator'"] -- "text->code" --> compute["runJavascript <br> id='compute'"]
mathquestion[/"input <br> id='math-question'"/]:::input -- "question->question" --> mathfunction["promptTemplate <br> id='math-function'"]
mathquestion[/"input <br> id='math-question'"/]:::input -- "generator->path" --> generator["invoke <br> id='generator'"]
mathfunction["promptTemplate <br> id='math-function'"] -- "prompt->text" --> generator["invoke <br> id='generator'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```