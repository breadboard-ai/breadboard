# simple-prompt
  - Original: [`simple-prompt.ts`](../../src/boards/simple-prompt.ts)
  - Graph: [`simple-prompt.json`](../../graphs/simple-prompt.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
secrets2("secrets <br> id='secrets-2'"):::secrets -- "PALM_KEY->PALM_KEY" --> generateText1["generateText <br> id='generateText-1'"]
generateText1["generateText <br> id='generateText-1'"] -- "completion->text" --> analysis{{"output <br> id='analysis'"}}:::output
analyzethis["promptTemplate <br> id='analyze-this'"] -- "prompt->text" --> generateText1["generateText <br> id='generateText-1'"]
question[/"input <br> id='question'"/]:::input -- "text->question" --> analyzethis["promptTemplate <br> id='analyze-this'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```