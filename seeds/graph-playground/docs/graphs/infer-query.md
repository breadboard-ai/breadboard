# infer-query
  - Original: [`infer-query.ts`](../../src/boards/infer-query.ts)
  - Graph: [`infer-query.json`](../../graphs/infer-query.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
questionGenerator["generateText <br> id='questionGenerator'"] -- "completion->text" --> printResults{{"output <br> id='printResults'"}}:::output
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --> questionGenerator["generateText <br> id='questionGenerator'"]
inferringPrompt["promptTemplate <br> id='inferringPrompt'"] -- "prompt->text" --> questionGenerator["generateText <br> id='questionGenerator'"]
promptStuffer["jsonata <br> id='promptStuffer'"] -- "result->result" --> inferringPrompt["promptTemplate <br> id='inferringPrompt'"]
promptToInfer["promptTemplate <br> id='promptToInfer'"] -- "prompt->json" --> promptStuffer["jsonata <br> id='promptStuffer'"]
askForTemplate[/"input <br> id='askForTemplate'"/]:::input -- "text->template" --> promptToInfer["promptTemplate <br> id='promptToInfer'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```