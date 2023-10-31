# react-with-lambdas
  - Original: [`react-with-lambdas.ts`](../../src/boards/react-with-lambdas.ts)
  - Graph: [`react-with-lambdas.json`](../../graphs/react-with-lambdas.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
input1[/"input <br> id='input-1'"/]:::input -- "tools->json" --> jsonata3["jsonata <br> id='jsonata-3'"]
input1[/"input <br> id='input-1'"/]:::input -- "tools->json" --> jsonata4["jsonata <br> id='jsonata-4'"]
jsonata4["jsonata <br> id='jsonata-4'"] -- "result->descriptions" --o promptTemplate5["promptTemplate <br> id='promptTemplate-5'"]
jsonata3["jsonata <br> id='jsonata-3'"] -- "result->tools" --o promptTemplate5["promptTemplate <br> id='promptTemplate-5'"]
rememberObservation["append <br> id='rememberObservation'"] -- "accumulator->memory" --> promptTemplate5["promptTemplate <br> id='promptTemplate-5'"]
rememberThought["append <br> id='rememberThought'"] -- "accumulator->accumulator" --> rememberObservation["append <br> id='rememberObservation'"]
rememberObservation["append <br> id='rememberObservation'"] -- "accumulator->accumulator" --> rememberThought["append <br> id='rememberThought'"]
rememberQuestion["append <br> id='rememberQuestion'"] -- "accumulator->accumulator" --> rememberThought["append <br> id='rememberThought'"]
rememberQuestion["append <br> id='rememberQuestion'"] -- "accumulator->memory" --> promptTemplate5["promptTemplate <br> id='promptTemplate-5'"]
input1[/"input <br> id='input-1'"/]:::input -- "text->Question" --> rememberQuestion["append <br> id='rememberQuestion'"]
secrets2("secrets <br> id='secrets-2'"):::secrets -- "PALM_KEY->PALM_KEY" --o reactcompletion["generateText <br> id='react-completion'"]
reactcompletion["generateText <br> id='react-completion'"] -- "completion->Thought" --> rememberThought["append <br> id='rememberThought'"]
reactcompletion["generateText <br> id='react-completion'"] -- "completion->json" --> jsonata6["jsonata <br> id='jsonata-6'"]
promptTemplate5["promptTemplate <br> id='promptTemplate-5'"] -- "prompt->text" --> reactcompletion["generateText <br> id='react-completion'"]
jsonata6["jsonata <br> id='jsonata-6'"] -- "tool->tool" --> jsonata8["jsonata <br> id='jsonata-8'"]
input1[/"input <br> id='input-1'"/]:::input -- "tools->tools" --o jsonata8["jsonata <br> id='jsonata-8'"]
jsonata8["jsonata <br> id='jsonata-8'"] -- all --> invoke7["invoke <br> id='invoke-7'"]
jsonata6["jsonata <br> id='jsonata-6'"] -- "args->text" --> invoke7["invoke <br> id='invoke-7'"]
invoke7["invoke <br> id='invoke-7'"] -- "text->Observation" --> rememberObservation["append <br> id='rememberObservation'"]
jsonata6["jsonata <br> id='jsonata-6'"] -- "answer->text" --> output9{{"output <br> id='output-9'"}}:::output
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```