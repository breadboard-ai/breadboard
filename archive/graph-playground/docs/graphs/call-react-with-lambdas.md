# call-react-with-lambdas
  - Original: [`call-react-with-lambdas.ts`](../../src/boards/call-react-with-lambdas.ts)
  - Graph: [`call-react-with-lambdas.json`](../../graphs/call-react-with-lambdas.json)
  
  ```mermaid
  %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
import2["import <br> id='import-2'"] -- "board->search" --> jsonata1["jsonata <br> id='jsonata-1'"]
import3["import <br> id='import-3'"] -- "board->math" --> jsonata1["jsonata <br> id='jsonata-1'"]
jsonata1["jsonata <br> id='jsonata-1'"] -- "result->tools" --> invoke4["invoke <br> id='invoke-4'"]
invoke4["invoke <br> id='invoke-4'"] -- "text->text" --> reactResponse{{"output <br> id='reactResponse'"}}:::output
userRequest[/"input <br> id='userRequest'"/]:::input -- "text->text" --> invoke4["invoke <br> id='invoke-4'"]
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
  ```