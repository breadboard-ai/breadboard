## data-board.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
bestOfN["invoke <br> id='bestOfN'"] -- "best->best" --> output2{{"output <br> id='output-2'"}}:::output
bestOfN["invoke <br> id='bestOfN'"] -- "list->list" --> output2{{"output <br> id='output-2'"}}:::output
bestOfN["invoke <br> id='bestOfN'"] -- "rank->rank" --> output2{{"output <br> id='output-2'"}}:::output
input1[/"input <br> id='input-1'"/]:::input -- "n->n" --> bestOfN["invoke <br> id='bestOfN'"]
input1[/"input <br> id='input-1'"/]:::input -- "text->text" --> bestOfN["invoke <br> id='bestOfN'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```