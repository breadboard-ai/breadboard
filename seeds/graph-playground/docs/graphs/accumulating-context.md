# accumulating-context
  - Original: [`accumulating-context.ts`](../../src/boards/accumulating-context.ts)
  - Graph: [`accumulating-context.json`](../../graphs/accumulating-context.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
append3["append id='append-3'"] -- "accumulator->accumulator" --> append3["append id='append-3'"]
secrets5("secrets id='secrets-5'"):::secrets -- "PALM_KEY->PALM_KEY" --o textCompletion4["textCompletion id='textCompletion-4'"]
append3["append id='append-3'"] -- "accumulator->context" --> promptTemplate2["promptTemplate id='promptTemplate-2'"]
textCompletion4["textCompletion id='textCompletion-4'"] -- "completion->assistant" --> append3["append id='append-3'"]
output6{{"output id='output-6'"}}:::output --> input1[/"input id='input-1'"/]:::input
textCompletion4["textCompletion id='textCompletion-4'"] -- "completion->text" --> output6{{"output id='output-6'"}}:::output
promptTemplate2["promptTemplate id='promptTemplate-2'"] -- "prompt->text" --> textCompletion4["textCompletion id='textCompletion-4'"]
input1[/"input id='input-1'"/]:::input -- "text->question" --> promptTemplate2["promptTemplate id='promptTemplate-2'"]
input1[/"input id='input-1'"/]:::input -- "text->user" --> append3["append id='append-3'"]
start(("passthrough id='start'")):::passthrough --> input1[/"input id='input-1'"/]:::input
templatepromptTemplate2[template]:::config -- "template->template" --o promptTemplate2
contextpromptTemplate2[context]:::config -- "context->context" --o promptTemplate2
accumulatorappend3[accumulator]:::config -- "accumulator->accumulator" --o append3
keyssecrets5[keys]:::config -- "keys->keys" --o secrets5
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```