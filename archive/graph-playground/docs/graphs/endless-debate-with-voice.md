# endless-debate-with-voice
  - Original: [`endless-debate-with-voice.ts`](../../src/boards/endless-debate-with-voice.ts)
  - Graph: [`endless-debate-with-voice.json`](../../graphs/endless-debate-with-voice.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
rememberQuestion["append <br> id='rememberQuestion'"] -- "accumulator->accumulator" --> rememberAlbert["append <br> id='rememberAlbert'"]
rememberAlbert["append <br> id='rememberAlbert'"] -- "accumulator->accumulator" --> rememberFriedrich["append <br> id='rememberFriedrich'"]
rememberFriedrich["append <br> id='rememberFriedrich'"] -- "accumulator->accumulator" --> rememberAlbert["append <br> id='rememberAlbert'"]
rememberAlbert["append <br> id='rememberAlbert'"] -- "accumulator->context" --> promptTemplate2["promptTemplate <br> id='promptTemplate-2'"]
palmgenerateText3["palm-generateText <br> id='palm-generateText-3'"] -- "completion->Albert" --> rememberAlbert["append <br> id='rememberAlbert'"]
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o palmgenerateText4["palm-generateText <br> id='palm-generateText-4'"]
palmgenerateText4["palm-generateText <br> id='palm-generateText-4'"] -- "completion->text" --> albertSays{{"output <br> id='albertSays'"}}:::output
albertvoice["promptTemplate <br> id='albert-voice'"] -- "prompt->text" --> palmgenerateText4["palm-generateText <br> id='palm-generateText-4'"]
palmgenerateText3["palm-generateText <br> id='palm-generateText-3'"] -- "completion->context" --> albertvoice["promptTemplate <br> id='albert-voice'"]
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o palmgenerateText3["palm-generateText <br> id='palm-generateText-3'"]
albert["promptTemplate <br> id='albert'"] -- "prompt->text" --> palmgenerateText3["palm-generateText <br> id='palm-generateText-3'"]
rememberFriedrich["append <br> id='rememberFriedrich'"] -- "accumulator->context" --> albert["promptTemplate <br> id='albert'"]
palmgenerateText5["palm-generateText <br> id='palm-generateText-5'"] -- "completion->Friedrich" --> rememberFriedrich["append <br> id='rememberFriedrich'"]
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o palmgenerateText6["palm-generateText <br> id='palm-generateText-6'"]
palmgenerateText6["palm-generateText <br> id='palm-generateText-6'"] -- "completion->text" --> friedrichSays{{"output <br> id='friedrichSays'"}}:::output
friedrichvoice["promptTemplate <br> id='friedrich-voice'"] -- "prompt->text" --> palmgenerateText6["palm-generateText <br> id='palm-generateText-6'"]
palmgenerateText5["palm-generateText <br> id='palm-generateText-5'"] -- "completion->context" --> friedrichvoice["promptTemplate <br> id='friedrich-voice'"]
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o palmgenerateText5["palm-generateText <br> id='palm-generateText-5'"]
promptTemplate2["promptTemplate <br> id='promptTemplate-2'"] -- "prompt->text" --> palmgenerateText5["palm-generateText <br> id='palm-generateText-5'"]
rememberQuestion["append <br> id='rememberQuestion'"] -- "accumulator->context" --> albert["promptTemplate <br> id='albert'"]
input7[/"input <br> id='input-7'"/]:::input -- "text->topic" --> rememberQuestion["append <br> id='rememberQuestion'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```