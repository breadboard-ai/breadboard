# endless-debate
  - Original: [`endless-debate.ts`](../../src/boards/endless-debate.ts)
  - Graph: [`endless-debate.json`](../../graphs/endless-debate.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
rememberQuestion["append <br> id='rememberQuestion'"] -- "accumulator->accumulator" --> rememberAlbert["append <br> id='rememberAlbert'"]
rememberAlbert["append <br> id='rememberAlbert'"] -- "accumulator->accumulator" --> rememberFriedrich["append <br> id='rememberFriedrich'"]
rememberFriedrich["append <br> id='rememberFriedrich'"] -- "accumulator->accumulator" --> rememberAlbert["append <br> id='rememberAlbert'"]
rememberAlbert["append <br> id='rememberAlbert'"] -- "accumulator->context" --> promptTemplate2["promptTemplate <br> id='promptTemplate-2'"]
generateText3["generateText <br> id='generateText-3'"] -- "completion->Albert" --> rememberAlbert["append <br> id='rememberAlbert'"]
generateText3["generateText <br> id='generateText-3'"] -- "completion->text" --> albertSays{{"output <br> id='albertSays'"}}:::output
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o generateText3["generateText <br> id='generateText-3'"]
albert["promptTemplate <br> id='albert'"] -- "prompt->text" --> generateText3["generateText <br> id='generateText-3'"]
rememberFriedrich["append <br> id='rememberFriedrich'"] -- "accumulator->context" --> albert["promptTemplate <br> id='albert'"]
generateText4["generateText <br> id='generateText-4'"] -- "completion->Friedrich" --> rememberFriedrich["append <br> id='rememberFriedrich'"]
generateText4["generateText <br> id='generateText-4'"] -- "completion->text" --> friedrichSays{{"output <br> id='friedrichSays'"}}:::output
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o generateText4["generateText <br> id='generateText-4'"]
promptTemplate2["promptTemplate <br> id='promptTemplate-2'"] -- "prompt->text" --> generateText4["generateText <br> id='generateText-4'"]
rememberQuestion["append <br> id='rememberQuestion'"] -- "accumulator->context" --> albert["promptTemplate <br> id='albert'"]
input5[/"input <br> id='input-5'"/]:::input -- "text->topic" --> rememberQuestion["append <br> id='rememberQuestion'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```