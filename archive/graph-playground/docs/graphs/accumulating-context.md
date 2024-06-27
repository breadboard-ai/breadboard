# accumulating-context
  - Original: [`accumulating-context.ts`](../../src/boards/accumulating-context.ts)
  - Graph: [`accumulating-context.json`](../../graphs/accumulating-context.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
conversationMemory["append <br> id='conversationMemory'"] -- "accumulator->accumulator" --> conversationMemory["append <br> id='conversationMemory'"]
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o generator["palm-generateText <br> id='generator'"]
conversationMemory["append <br> id='conversationMemory'"] -- "accumulator->context" --> assistant["promptTemplate <br> id='assistant'"]
generator["palm-generateText <br> id='generator'"] -- "completion->assistant" --> conversationMemory["append <br> id='conversationMemory'"]
assistantResponse{{"output <br> id='assistantResponse'"}}:::output --> userRequest[/"input <br> id='userRequest'"/]:::input
generator["palm-generateText <br> id='generator'"] -- "completion->text" --> assistantResponse{{"output <br> id='assistantResponse'"}}:::output
assistant["promptTemplate <br> id='assistant'"] -- "prompt->text" --> generator["palm-generateText <br> id='generator'"]
userRequest[/"input <br> id='userRequest'"/]:::input -- "text->question" --> assistant["promptTemplate <br> id='assistant'"]
userRequest[/"input <br> id='userRequest'"/]:::input -- "text->user" --> conversationMemory["append <br> id='conversationMemory'"]
start(("passthrough <br> id='start'")):::passthrough --> userRequest[/"input <br> id='userRequest'"/]:::input
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```