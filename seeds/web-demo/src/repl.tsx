import { signal, useSignalEffect } from '@preact/signals';
import { useRef } from 'preact/hooks';
import emptyGraph from './graphs/empty.graph';

import { Board } from "@google-labs/breadboard";
import { OutputValues, InputValues } from "@google-labs/graph-runner";

import mermaid from "mermaid";
import { LogToElementProbe } from './lib/probe.js';

const ask = async (inputs: InputValues): Promise<OutputValues> => {
  const defaultValue = "<Exit>";
  const message = ((inputs && inputs.message) as string) || "Enter some text";
  const input = prompt(message, defaultValue);
  if (input === defaultValue) return { exit: true };
  return { text: input };
};

export function REPLApp() {
  const mermaidRef = useRef();
  const graphRef = useRef();
  const resultsRef = useRef();
  const runButtonRef = useRef();
  const dialogRef = useRef();
  const debugRef = useRef();


  const graphUrl = signal(emptyGraph);
  const graphJson = signal();
  const board = signal<Board | undefined>(undefined);

  const loadGraph = async (e) => {
    const { files } = e.target;
    graphUrl.value = URL.createObjectURL(files[0]);
  };

  const loadGraphJSON = async (e) => {
    const textArea = e.target;
    const jsonText = textArea.value;

    graphJson.value = jsonText;

    if (graphUrl.value) {
      URL.revokeObjectURL(graphUrl.value);
    }

    const blob = new Blob([jsonText], { type: "application/json" })

    // Kick off the rendering
    graphUrl.value = URL.createObjectURL(blob);
  };

  const runGraph = async () => {
    const url = graphUrl.value;
    
    resultsRef.current.innerText = "";
    debugRef.current.innerText = "";

    const probe = new LogToElementProbe(debugRef.current);

    try {
      const currentBoard = await Board.load(url);
      board.value = currentBoard;

      dialogRef.current.showModal();

      for await (const result of currentBoard.run(probe)) {
        if (result.seeksInputs) {
          result.inputs = await ask(result.inputArguments);
        }
        else {
          resultsRef.current.innerText += `${JSON.stringify(result.outputs, null, 2)}\n`
        }
      }
    } catch (e: any) {
      resultsRef.current.innerText = e.message;
    }
  };

  useSignalEffect(async () => {
    const url = graphUrl.value;
    try {
      const board = await Board.load(url);
      const { svg } = await mermaid.render('mermaid', board.mermaid());
     
      graphJson.value = JSON.stringify(board, null, 2);
      mermaidRef.current.innerHTML = svg;
      runButtonRef.current.disabled = false;
    } catch (e) {
      runButtonRef.current.disabled = true;
      alert(`Unable to load graph: ${e.message}`);
    }
  });

  mermaid.initialize({ startOnLoad: false });

  return (
    <>
      <h1>Breadboard REPL</h1>
      <p>This tool let's you create, edit and run breadboards all in one place</p>

      <section class="repl">
        <div class="card graph">
          <fieldset>
            <legend>Graph</legend>
            <div class="fields">
              <textarea ref={graphRef} onInput={(e) => loadGraphJSON(e)}>{graphJson}</textarea>
              <input type="file" onChange={(e) => loadGraph(e)} value="Go" />
              <button class="primary" onClick={(e) => runGraph()} ref={runButtonRef} disabled>Run</button>
            </div>
          </fieldset>
        </div>
        <div class="card mermaid">

          <fieldset>
            <legend>Mermaid</legend>
            <div class="output" ref={mermaidRef}>
            </div>
          </fieldset>
        </div>
        <dialog ref={dialogRef}>
            <h3>Graph Output</h3>
            <pre class="output" ref={resultsRef}>
            </pre>
            <h3>Probe Output</h3>
            <pre class="debug" ref={debugRef}></pre>
        </dialog>
      </section>
    </>
  )
}
