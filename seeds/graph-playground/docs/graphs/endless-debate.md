# endless-debate
  - Original: [`endless-debate.ts`](../../src/boards/endless-debate.ts)
  - Graph: [`endless-debate.json`](../../graphs/endless-debate.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
localMemory5["localMemory
id='localMemory-5'"] -- "context->context" --> promptTemplate3["promptTemplate
id='promptTemplate-3'"]
textCompletion4["textCompletion
id='textCompletion-4'"] -- "completion->Albert" --> localMemory5["localMemory
id='localMemory-5'"]
textCompletion4["textCompletion
id='textCompletion-4'"] -- "completion->text" --> output6{{"output
id='output-6'"}}:::output
secrets2("secrets
id='secrets-2'"):::secrets -- "PALM_KEY->PALM_KEY" --o textCompletion4["textCompletion
id='textCompletion-4'"]
albert["promptTemplate
id='albert'"] -- "prompt->text" --> textCompletion4["textCompletion
id='textCompletion-4'"]
localMemory8["localMemory
id='localMemory-8'"] -- "context->context" --> albert["promptTemplate
id='albert'"]
textCompletion7["textCompletion
id='textCompletion-7'"] -- "completion->Friedrich" --> localMemory8["localMemory
id='localMemory-8'"]
textCompletion7["textCompletion
id='textCompletion-7'"] -- "completion->text" --> output9{{"output
id='output-9'"}}:::output
secrets2("secrets
id='secrets-2'"):::secrets -- "PALM_KEY->PALM_KEY" --o textCompletion7["textCompletion
id='textCompletion-7'"]
promptTemplate3["promptTemplate
id='promptTemplate-3'"] -- "prompt->text" --> textCompletion7["textCompletion
id='textCompletion-7'"]
localMemory1["localMemory
id='localMemory-1'"] -- "context->context" --> albert["promptTemplate
id='albert'"]
input10[/"input
id='input-10'"/]:::input -- "text->topic" --> localMemory1["localMemory
id='localMemory-1'"]
keyssecrets2[keys]:::config -- "keys->keys" --o secrets2
templatepromptTemplate3[template]:::config -- "template->template" --o promptTemplate3
templatealbert[template]:::config -- "template->template" --o albert
stopsequencestextCompletion4[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o textCompletion4
stopsequencestextCompletion7[stop-sequences]:::config -- "stop-sequences->stop-sequences" --o textCompletion7
messageinput10[message]:::config -- "message->message" --o input10
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```