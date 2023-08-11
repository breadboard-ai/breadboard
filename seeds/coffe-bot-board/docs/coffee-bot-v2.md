# Coffee Bot

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
tools(("passthrough <br> id='tools'")):::passthrough -- "tools->tools" --o botprompt["promptTemplate <br> id='bot-prompt'"]
format(("passthrough <br> id='format'")):::passthrough -- "format->format" --o botprompt["promptTemplate <br> id='bot-prompt'"]
passthrough1(("passthrough <br> id='passthrough-1'")):::passthrough -- "accumulator->accumulator" --> customerMemory["append <br> id='customerMemory'"]
customerMemory["append <br> id='customerMemory'"] -- "accumulator->accumulator" --> agentMemory["append <br> id='agentMemory'"]
agentMemory["append <br> id='agentMemory'"] -- "accumulator->accumulator" --> toolMemory["append <br> id='toolMemory'"]
agentMemory["append <br> id='agentMemory'"] -- "accumulator->accumulator" --> customerMemory["append <br> id='customerMemory'"]
toolMemory["append <br> id='toolMemory'"] -- "accumulator->accumulator" --> agentMemory["append <br> id='agentMemory'"]
toolMemory["append <br> id='toolMemory'"] -- "accumulator->bot" --> output2{{"output <br> id='output-2'"}}:::output
customerMemory["append <br> id='customerMemory'"] -- "accumulator->memory" --> botprompt["promptTemplate <br> id='bot-prompt'"]
toolMemory["append <br> id='toolMemory'"] -- "accumulator->memory" --> botprompt["promptTemplate <br> id='bot-prompt'"]
checkMenu["runJavascript <br> id='checkMenu'"] -- "result->Tool" --> toolMemory["append <br> id='toolMemory'"]
toolRouter["runJavascript <br> id='toolRouter'"] -- "customer->bot" --> output3{{"output <br> id='output-3'"}}:::output
input5[/"input <br> id='input-5'"/]:::input -- "customer->Customer" --> customerMemory["append <br> id='customerMemory'"]
jsonata4["jsonata <br> id='jsonata-4'"] -- "result->message" --> input5[/"input <br> id='input-5'"/]:::input
toolRouter["runJavascript <br> id='toolRouter'"] -- "customer->json" --> jsonata4["jsonata <br> id='jsonata-4'"]
toolRouter["runJavascript <br> id='toolRouter'"] -- "checkMenu->checkMenu" --> checkMenu["runJavascript <br> id='checkMenu'"]
input6[/"input <br> id='input-6'"/]:::input -- "customer->Customer" --> customerMemory["append <br> id='customerMemory'"]
generateText7["generateText <br> id='generateText-7'"] -- "completion->completion" --> toolRouter["runJavascript <br> id='toolRouter'"]
generateText7["generateText <br> id='generateText-7'"] -- "completion->Agent" --> agentMemory["append <br> id='agentMemory'"]
generateText7["generateText <br> id='generateText-7'"] -- "filters->filters" --> blocked{{"output <br> id='blocked'"}}:::output
secrets8("secrets <br> id='secrets-8'"):::secrets -- "PALM_KEY->PALM_KEY" --o generateText7["generateText <br> id='generateText-7'"]
botprompt["promptTemplate <br> id='bot-prompt'"] -- "prompt->text" --> generateText7["generateText <br> id='generateText-7'"]
templatebotprompt[template]:::config -- "template->template" --o botprompt
toolstools[tools]:::config -- "tools->tools" --o tools
formatformat[format]:::config -- "format->format" --o format
accumulatorpassthrough1[accumulator]:::config -- "accumulator->accumulator" --o passthrough1
namecheckMenu[name]:::config -- "name->name" --o checkMenu
codecheckMenu[code]:::config -- "code->code" --o checkMenu
nametoolRouter[name]:::config -- "name->name" --o toolRouter
codetoolRouter[code]:::config -- "code->code" --o toolRouter
rawtoolRouter[raw]:::config -- "raw->raw" --o toolRouter
expressionjsonata4[expression]:::config -- "expression->expression" --o jsonata4
stopSequencesgenerateText7[stopSequences]:::config -- "stopSequences->stopSequences" --o generateText7
safetySettingsgenerateText7[safetySettings]:::config -- "safetySettings->safetySettings" --o generateText7
keyssecrets8[keys]:::config -- "keys->keys" --o secrets8
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```