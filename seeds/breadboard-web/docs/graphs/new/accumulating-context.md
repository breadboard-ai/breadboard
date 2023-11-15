## accumulating-context.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
userRequest[/"input <br> id='userRequest'"/]:::input -- "text->question" --> assistant["promptTemplate <br> id='assistant'"]
userRequest[/"input <br> id='userRequest'"/]:::input -- "text->user" --> append0["append <br> id='append-0'"]
start(("passthrough <br> id='start'")):::passthrough --> userRequest[/"input <br> id='userRequest'"/]:::input
output3{{"output <br> id='output-3'"}}:::output --> userRequest[/"input <br> id='userRequest'"/]:::input
assistant["promptTemplate <br> id='assistant'"] -- "prompt->text" --> generateText2["generateText <br> id='generateText-2'"]
append0["append <br> id='append-0'"] -- "accumulator->accumulator" --> append0["append <br> id='append-0'"]
append0["append <br> id='append-0'"] -- "accumulator->context" --> assistant["promptTemplate <br> id='assistant'"]
generateText2["generateText <br> id='generateText-2'"] -- "completion->accumulator" --> append0["append <br> id='append-0'"]
generateText2["generateText <br> id='generateText-2'"] -- "completion->text" --> output3{{"output <br> id='output-3'"}}:::output
secrets1("secrets <br> id='secrets-1'"):::secrets -- "PALM_KEY->PALM_KEY" --o generateText2["generateText <br> id='generateText-2'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```