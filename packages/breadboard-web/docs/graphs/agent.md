## agent.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
generate["invoke <br> id='generate'"] -- "text->result" --> output2{{"output <br> id='output-2'"}}:::output
generate["invoke <br> id='generate'"] -- "context->context" --> output2{{"output <br> id='output-2'"}}:::output
prompt["promptTemplate <br> id='prompt'"] -- "prompt->text" --> generate["invoke <br> id='generate'"]
input1[/"input <br> id='input-1'"/]:::input -- "template->template" --> prompt["promptTemplate <br> id='prompt'"]
input1[/"input <br> id='input-1'"/]:::input -- "topic->topic" --> prompt["promptTemplate <br> id='prompt'"]
input1[/"input <br> id='input-1'"/]:::input -- "generator->path" --> generate["invoke <br> id='generate'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```