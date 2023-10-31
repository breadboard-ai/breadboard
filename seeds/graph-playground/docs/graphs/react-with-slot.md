# react-with-slot
  - Original: [`react-with-slot.ts`](../../src/boards/react-with-slot.ts)
  - Graph: [`react-with-slot.json`](../../graphs/react-with-slot.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
getslot(("slot <br> id='get-slot'")):::slot -- "graph->json" --> jsonata2["jsonata <br> id='jsonata-2'"]
getslot(("slot <br> id='get-slot'")):::slot -- "graph->json" --> jsonata3["jsonata <br> id='jsonata-3'"]
jsonata3["jsonata <br> id='jsonata-3'"] -- "result->descriptions" --o promptTemplate4["promptTemplate <br> id='promptTemplate-4'"]
jsonata2["jsonata <br> id='jsonata-2'"] -- "result->tools" --o promptTemplate4["promptTemplate <br> id='promptTemplate-4'"]
rememberObservation["append <br> id='rememberObservation'"] -- "accumulator->memory" --> promptTemplate4["promptTemplate <br> id='promptTemplate-4'"]
rememberThought["append <br> id='rememberThought'"] -- "accumulator->accumulator" --> rememberObservation["append <br> id='rememberObservation'"]
rememberObservation["append <br> id='rememberObservation'"] -- "accumulator->accumulator" --> rememberThought["append <br> id='rememberThought'"]
rememberQuestion["append <br> id='rememberQuestion'"] -- "accumulator->accumulator" --> rememberThought["append <br> id='rememberThought'"]
rememberQuestion["append <br> id='rememberQuestion'"] -- "accumulator->memory" --> promptTemplate4["promptTemplate <br> id='promptTemplate-4'"]
input5[/"input <br> id='input-5'"/]:::input -- "text->Question" --> rememberQuestion["append <br> id='rememberQuestion'"]
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o reactcompletion["generateText <br> id='react-completion'"]
toolsslot(("slot <br> id='tools-slot'")):::slot -- "text->Observation" --> rememberObservation["append <br> id='rememberObservation'"]
jsonata6["jsonata <br> id='jsonata-6'"] -- all --> toolsslot(("slot <br> id='tools-slot'")):::slot
jsonata6["jsonata <br> id='jsonata-6'"] -- "answer->text" --> output7{{"output <br> id='output-7'"}}:::output
reactcompletion["generateText <br> id='react-completion'"] -- "completion->json" --> jsonata6["jsonata <br> id='jsonata-6'"]
reactcompletion["generateText <br> id='react-completion'"] -- "completion->Thought" --> rememberThought["append <br> id='rememberThought'"]
promptTemplate4["promptTemplate <br> id='promptTemplate-4'"] -- "prompt->text" --> reactcompletion["generateText <br> id='react-completion'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```