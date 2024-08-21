# call-react-with-slot
  - Original: [`call-react-with-slot.ts`](../../src/boards/call-react-with-slot.ts)
  - Graph: [`call-react-with-slot.json`](../../graphs/call-react-with-slot.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
include1[["include <br> id='include-1'"]]:::include -- "text->text" --> reactResponse{{"output <br> id='reactResponse'"}}:::output
subgraph sg_tools [tools]
include1_reflect2["reflect <br> id='reflect-2'"] -- "graph->graph" --> include1_output3{{"output <br> id='output-3'"}}:::output
include1_input1[/"input <br> id='input-1'"/]:::input -- "graph->graph" --> include1_reflect2["reflect <br> id='reflect-2'"]
include1_math[["include <br> id='math'"]]:::include -- "text->text" --> include1_output4{{"output <br> id='output-4'"}}:::output
include1_input1[/"input <br> id='input-1'"/]:::input -- "math->text" --> include1_math[["include <br> id='math'"]]:::include
include1_search[["include <br> id='search'"]]:::include -- "text->text" --> include1_output5{{"output <br> id='output-5'"}}:::output
include1_input1[/"input <br> id='input-1'"/]:::input -- "search->text" --> include1_search[["include <br> id='search'"]]:::include
end
sg_tools:::slotted -- "slotted->slotted" --o include1

userRequest[/"input <br> id='userRequest'"/]:::input -- "text->text" --> include1[["include <br> id='include-1'"]]:::include
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```