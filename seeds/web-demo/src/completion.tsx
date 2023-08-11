import { signal } from '@preact/signals';
import { useRef } from 'preact/hooks';

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";


const promptOutput = signal("");

export function CompletionApp() {
  const run = async (apiKey: string, text: string) => {
    const board = new Board();
    const input = board.input();
    const output = board.output();
    const kit = board.addKit(Starter);
    const completion = kit.generateText();

    localStorage.setItem("PALM_KEY", apiKey);

    kit.secrets(["PALM_KEY"]).wire("PALM_KEY", completion);

    input.wire("ask->text", completion);
    completion.wire("completion->receive", output);

    const result = await board.runOnce({
      ask: text,
    });

    promptOutput.value = result.receive;
  };

  const promptRef = useRef();
  const apikeyRef = useRef();

  return (
    <>
      <h1>Completion demo</h1>
      <p>This tool let's you run a completion on a prompt. Under the hood it uses the <code>Breadboard</code> imperative API.<br></br> <br></br><details><summary>Code</summary><pre><code>{`const board = new Board();
const input = board.input();
const output = board.output();
const kit = board.addKit(Starter);
const completion = kit.generateText();

localStorage.setItem("PALM_KEY", apiKey);

kit.secrets(["PALM_KEY"]).wire("PALM_KEY", completion);

input.wire("ask->text", completion);
completion.wire("completion->receive", output);

const result = await board.runOnce({
  ask: text,
});

promptOutput.value = result.receive;`}</code></pre></details></p>

      <div class="card">
        <label for="apikey" >API key</label>
        <input id="apikey" type="text" ref={apikeyRef} placeholder="API key" />
      </div>

      <div class="card">
        <label for="prompt">Prompt</label>
        <textarea id="prompt" ref={promptRef} placeholder="Enter text here"></textarea>
      </div>

      <div class="card output">
        <label>Prompt Output</label>
        <div id="output">{promptOutput}</div>
      </div>

      <button class="primary" onClick={() => { run(apikeyRef.current.value, promptRef.current.value) }}>Go</button>
    </>
  )
}
