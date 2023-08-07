# call-react-with-slot
  - Original: [`call-react-with-slot.ts`](../../src/boards/call-react-with-slot.ts)
  - Graph: [`call-react-with-slot.json`](../../graphs/call-react-with-slot.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
include2[["include <br> id='include-2'"]]:::include -- "text->text" --> output3{{"output <br> id='output-3'"}}:::output
subgraph tools
reflect2["reflect <br> id='reflect-2'"] -- "graph->graph" --> output3{{"output <br> id='output-3'"}}:::output
input1[/"input <br> id='input-1'"/]:::input -- "graph->graph" --> reflect2["reflect <br> id='reflect-2'"]
math[["include <br> id='math'"]]:::include -- "text->text" --> output4{{"output <br> id='output-4'"}}:::output
input1[/"input <br> id='input-1'"/]:::input -- "math->text" --> math[["include <br> id='math'"]]:::include
search[["include <br> id='search'"]]:::include -- "text->text" --> output5{{"output <br> id='output-5'"}}:::output
input1[/"input <br> id='input-1'"/]:::input -- "search->text" --> search[["include <br> id='search'"]]:::include
end
tools:::slotted -- "slotted->slotted" --o include2

input1[/"input <br> id='input-1'"/]:::input -- "text->text" --> include2[["include <br> id='include-2'"]]:::include
messageinput1[message]:::config -- "message->message" --o input1
$refinclude2[$ref]:::config -- "$ref->$ref" --o include2

classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```