# Coffee Bot

```mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
tools(("passthrough <br> id='tools'")):::passthrough -- "tools->tools" --o botprompt["promptTemplate <br> id='bot-prompt'"]
orderformat(("passthrough <br> id='order-format'")):::passthrough -- "order-format->order-format" --o botprompt["promptTemplate <br> id='bot-prompt'"]
passthrough1(("passthrough <br> id='passthrough-1'")):::passthrough -- "accumulator->accumulator" --> customerMemory["append <br> id='customerMemory'"]
customerMemory["append <br> id='customerMemory'"] -- "accumulator->accumulator" --> agentMemory["append <br> id='agentMemory'"]
agentMemory["append <br> id='agentMemory'"] -- "accumulator->accumulator" --> toolMemory["append <br> id='toolMemory'"]
agentMemory["append <br> id='agentMemory'"] -- "accumulator->accumulator" --> customerMemory["append <br> id='customerMemory'"]
toolMemory["append <br> id='toolMemory'"] -- "accumulator->accumulator" --> agentMemory["append <br> id='agentMemory'"]
customerMemory["append <br> id='customerMemory'"] -- "accumulator->memory" --> botprompt["promptTemplate <br> id='bot-prompt'"]
toolMemory["append <br> id='toolMemory'"] -- "accumulator->memory" --> botprompt["promptTemplate <br> id='bot-prompt'"]
slot4(("slot <br> id='slot-4'")):::slot -- "bot->Tool" --> toolMemory["append <br> id='toolMemory'"]
slot4(("slot <br> id='slot-4'")):::slot -- "bot->bot" --> output5{{"output <br> id='output-5'"}}:::output
jsonata3["jsonata <br> id='jsonata-3'"] -- "result->customer" --> slot4(("slot <br> id='slot-4'")):::slot
passthrough2(("passthrough <br> id='passthrough-2'")):::passthrough -- "checkMenu->json" --> jsonata3["jsonata <br> id='jsonata-3'"]
toolRouter["runJavascript <br> id='toolRouter'"] -- "customer->bot" --> output6{{"output <br> id='output-6'"}}:::output
input8[/"input <br> id='input-8'"/]:::input -- "customer->Customer" --> customerMemory["append <br> id='customerMemory'"]
jsonata7["jsonata <br> id='jsonata-7'"] -- "result->message" --> input8[/"input <br> id='input-8'"/]:::input
toolRouter["runJavascript <br> id='toolRouter'"] -- "customer->json" --> jsonata7["jsonata <br> id='jsonata-7'"]
toolRouter["runJavascript <br> id='toolRouter'"] -- "checkMenu->checkMenu" --> passthrough2(("passthrough <br> id='passthrough-2'")):::passthrough
input9[/"input <br> id='input-9'"/]:::input -- "customer->Customer" --> customerMemory["append <br> id='customerMemory'"]
generateText10["generateText <br> id='generateText-10'"] -- "completion->completion" --> toolRouter["runJavascript <br> id='toolRouter'"]
generateText10["generateText <br> id='generateText-10'"] -- "completion->Agent" --> agentMemory["append <br> id='agentMemory'"]
generateText10["generateText <br> id='generateText-10'"] -- "filters->filters" --> blocked{{"output <br> id='blocked'"}}:::output
secrets11("secrets <br> id='secrets-11'"):::secrets -- "PALM_KEY->PALM_KEY" --o generateText10["generateText <br> id='generateText-10'"]
botprompt["promptTemplate <br> id='bot-prompt'"] -- "prompt->text" --> generateText10["generateText <br> id='generateText-10'"]
templatebotprompt[template]:::config -- "template->template" --o botprompt
toolstools[tools]:::config -- "tools->tools" --o tools
orderformatorderformat[order-format]:::config -- "order-format->order-format" --o orderformat
accumulatorpassthrough1[accumulator]:::config -- "accumulator->accumulator" --o passthrough1
expressionjsonata3[expression]:::config -- "expression->expression" --o jsonata3
slotslot4[slot]:::config -- "slot->slot" --o slot4
nametoolRouter[name]:::config -- "name->name" --o toolRouter
codetoolRouter[code]:::config -- "code->code" --o toolRouter
rawtoolRouter[raw]:::config -- "raw->raw" --o toolRouter
expressionjsonata7[expression]:::config -- "expression->expression" --o jsonata7
stopSequencesgenerateText10[stopSequences]:::config -- "stopSequences->stopSequences" --o generateText10
safetySettingsgenerateText10[safetySettings]:::config -- "safetySettings->safetySettings" --o generateText10
keyssecrets11[keys]:::config -- "keys->keys" --o secrets11
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79
```