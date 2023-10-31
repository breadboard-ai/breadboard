# react-with-jsonata
  - Original: [`react-with-jsonata.ts`](../../src/boards/react-with-jsonata.ts)
  - Graph: [`react-with-jsonata.json`](../../graphs/react-with-jsonata.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
reflect4["reflect <br> id='reflect-4'"] -- "graph->json" --> jsonata2["jsonata <br> id='jsonata-2'"]
reflect4["reflect <br> id='reflect-4'"] -- "graph->json" --> jsonata3["jsonata <br> id='jsonata-3'"]
jsonata3["jsonata <br> id='jsonata-3'"] -- "result->descriptions" --o promptTemplate5["promptTemplate <br> id='promptTemplate-5'"]
jsonata2["jsonata <br> id='jsonata-2'"] -- "result->tools" --o promptTemplate5["promptTemplate <br> id='promptTemplate-5'"]
rememberObservation["append <br> id='rememberObservation'"] -- "accumulator->memory" --> promptTemplate5["promptTemplate <br> id='promptTemplate-5'"]
rememberThought["append <br> id='rememberThought'"] -- "accumulator->accumulator" --> rememberObservation["append <br> id='rememberObservation'"]
rememberObservation["append <br> id='rememberObservation'"] -- "accumulator->accumulator" --> rememberThought["append <br> id='rememberThought'"]
rememberQuestion["append <br> id='rememberQuestion'"] -- "accumulator->accumulator" --> rememberThought["append <br> id='rememberThought'"]
rememberQuestion["append <br> id='rememberQuestion'"] -- "accumulator->memory" --> promptTemplate5["promptTemplate <br> id='promptTemplate-5'"]
input6[/"input <br> id='input-6'"/]:::input -- "text->Question" --> rememberQuestion["append <br> id='rememberQuestion'"]
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o reactcompletion["generateText <br> id='react-completion'"]
math[["include <br> id='math'"]]:::include -- "text->Observation" --> rememberObservation["append <br> id='rememberObservation'"]
search[["include <br> id='search'"]]:::include -- "text->Observation" --> rememberObservation["append <br> id='rememberObservation'"]
jsonata7["jsonata <br> id='jsonata-7'"] -- "search->text" --> search[["include <br> id='search'"]]:::include
jsonata7["jsonata <br> id='jsonata-7'"] -- "math->text" --> math[["include <br> id='math'"]]:::include
jsonata7["jsonata <br> id='jsonata-7'"] -- "answer->text" --> output8{{"output <br> id='output-8'"}}:::output
reactcompletion["generateText <br> id='react-completion'"] -- "completion->json" --> jsonata7["jsonata <br> id='jsonata-7'"]
reactcompletion["generateText <br> id='react-completion'"] -- "completion->Thought" --> rememberThought["append <br> id='rememberThought'"]
promptTemplate5["promptTemplate <br> id='promptTemplate-5'"] -- "prompt->text" --> reactcompletion["generateText <br> id='react-completion'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```