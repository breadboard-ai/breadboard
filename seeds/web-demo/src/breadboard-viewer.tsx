import { signal, useSignalEffect } from '@preact/signals';
import { useRef } from 'preact/hooks';
import simpleGraph from './graphs/simplest.graph';

import { Board } from "@google-labs/breadboard";
import { OutputValues, InputValues } from "@google-labs/graph-runner";


import mermaid from "mermaid";

const ask = async (inputs: InputValues): Promise<OutputValues> => {
  const defaultValue = "<Exit>";
  const message = ((inputs && inputs.message) as string) || "Enter some text";
  const input = prompt(message, defaultValue);
  if (input === defaultValue) return { exit: true };
  return { text: input };
};

export function BreadboardViewerApp() {
  const mermaidRef = useRef();
  const resultsRef = useRef();
  const runButtonRef = useRef();

  const graphUrl = signal(simpleGraph);
  const error = signal("");
  const board = signal<Board | undefined>(undefined);

  const loadGraph = async (e) => {
    const { files } = e.target;
    graphUrl.value = URL.createObjectURL(files[0]);
  };

  const runGraph = async () => {
    const url = graphUrl.value;
    const outputs = [];
    resultsRef.current.innerText = "";

    try {
      const currentBoard = await Board.load(url);
      board.value = currentBoard;

      for await (const result of currentBoard.run()) {
        if (result.seeksInputs) {
          result.inputs = await ask(result.inputArguments);
        }
        else {
          outputs.push(result.outputs);
        }
      }

      for (const output of outputs) {
        resultsRef.current.innerText += `${output.text}\n`

      }
    } catch (e) {
      resultsRef.current.innerText = e.message;
    }
  };

  useSignalEffect(async () => {
    const url = graphUrl.value;
    try {
      const board = await Board.load(url);
      const { svg } = await mermaid.render('mermaid', board.mermaid());
      mermaidRef.current.innerHTML = svg;
      runButtonRef.current.disabled = false;
    } catch (e) {
      runButtonRef.current.disabled = true;
      resultsRef.value = e.message;
    }
  });

  mermaid.initialize({ startOnLoad: false });

  return (
    <>
      <h1>Breadboard viewer</h1>
      <p>This tool let's you view a breadboard graph file. Currently if your graph file contains a Kit that can't be resolved via a HTTP request, it will fail.</p>

      <div class="card output">
        <label>Mermaid</label>
        <div class="mermaid" ref={mermaidRef}>
        </div>
      </div>

      <input type="file" onChange={(e) => { loadGraph(e) }} value="Go" />

      <button class="primary" onClick={(e) => runGraph()} ref={runButtonRef} disabled>Run</button>

      <div class="card output results">
        <label>Results</label>
        <pre ref={resultsRef}>
        </pre>
      </div>
    </>
  )
}
