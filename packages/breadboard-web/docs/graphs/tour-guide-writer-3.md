## tour-guide-writer-3.ts

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
travelItineraryGenerator["invoke <br> id='travelItineraryGenerator'"] -- "text->itinerary" --> guide{{"output <br> id='guide'"}}:::output
travelItineraryGenerator["invoke <br> id='travelItineraryGenerator'"] -- "text->itinerary" --> fn3["invoke <br> id='fn-3'"]
fn6["invoke <br> id='fn-6'"] -- "guide->guide" --> guide{{"output <br> id='guide'"}}:::output
parameters[/"input <br> id='parameters'"/]:::input -- "location->location" --> travelItinerary["promptTemplate <br> id='travelItinerary'"]
parameters[/"input <br> id='parameters'"/]:::input -- "generator->path" --> travelItineraryGenerator["invoke <br> id='travelItineraryGenerator'"]
parameters[/"input <br> id='parameters'"/]:::input -- "location->location" --> lambda5["lambda <br> id='lambda-5'"]
parameters[/"input <br> id='parameters'"/]:::input -- "generator->generator" --> lambda5["lambda <br> id='lambda-5'"]
parameters[/"input <br> id='parameters'"/]:::input -- "location->location" --> fn6["invoke <br> id='fn-6'"]
travelItinerary["promptTemplate <br> id='travelItinerary'"] -- "prompt->text" --> travelItineraryGenerator["invoke <br> id='travelItineraryGenerator'"]
fn3["invoke <br> id='fn-3'"] -- "list->list" --> createGuides["map <br> id='createGuides'"]
fn3["invoke <br> id='fn-3'"] -- "list->activities" --> fn6["invoke <br> id='fn-6'"]
createGuides["map <br> id='createGuides'"] -- "list->guides" --> fn6["invoke <br> id='fn-6'"]
lambda5["lambda <br> id='lambda-5'"] -- "board->board" --> createGuides["map <br> id='createGuides'"]
subgraph sg_lambda5 [lambda-5]
lambda5_guideGenerator["invoke <br> id='guideGenerator'"] -- "text->guide" --> lambda5_output4{{"output <br> id='output-4'"}}:::output
lambda5_input1[/"input <br> id='input-1'"/]:::input -- "location->location" --> lambda5_guideTemplate["promptTemplate <br> id='guideTemplate'"]
lambda5_input1[/"input <br> id='input-1'"/]:::input -- "generator->path" --> lambda5_guideGenerator["invoke <br> id='guideGenerator'"]
lambda5_guideTemplate["promptTemplate <br> id='guideTemplate'"] -- "prompt->text" --> lambda5_guideGenerator["invoke <br> id='guideGenerator'"]
lambda5_input3[/"input <br> id='input-3'"/]:::input -- "item->activity" --> lambda5_guideTemplate["promptTemplate <br> id='guideTemplate'"]
end
sg_lambda5:::slotted -- "lamdba->lamdba" --o lambda5


subgraph sg_fn6 [fn-6]
fn6_fn6input[/"input <br> id='fn-6-input'"/]:::input -- all --> fn6_fn6run["runJavascript <br> id='fn-6-run'"]
fn6_fn6run["runJavascript <br> id='fn-6-run'"] -- all --> fn6_fn6output{{"output <br> id='fn-6-output'"}}:::output
end


subgraph sg_fn3 [fn-3]
fn3_fn3input[/"input <br> id='fn-3-input'"/]:::input -- all --> fn3_fn3run["runJavascript <br> id='fn-3-run'"]
fn3_fn3run["runJavascript <br> id='fn-3-run'"] -- all --> fn3_fn3output{{"output <br> id='fn-3-output'"}}:::output
end

classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```