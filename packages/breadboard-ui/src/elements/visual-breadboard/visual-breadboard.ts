import { LitElement, html, nothing} from "lit";
import {customElement, property} from "lit/decorators.js";
import {LoadArgs} from "../../types/types.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { until } from "lit/directives/until.js";
import {breadboardToVisualBlocks} from "./breadboard-to-visualblocks.js";

const VISUALBLOCKS_URL =
  "https://storage.googleapis.com/tfweb/node-graph-editor/node_graph_editor_20240201160419/node_graph_editor_bin.js"

@customElement("visual-breadboard")
export class VisualBreadboard extends LitElement {
  // TODO: Make this 'implement DiagramElement'
  #requestedVB = false;
  #visualBlocks?: HTMLElement;

  #resolveVisualBlocksLoaded = () => {}
  #visualBlocksLoaded = new Promise<void>((resolve) => {
    this.#resolveVisualBlocksLoaded = resolve;
  });

  @property()
  serializedGraph: any;

  reset() {

  }

  #updateGraph = async (diagram: LoadArgs) => {
    if (!diagram.graphDescriptor) {
      return;
    }
    this.serializedGraph = breadboardToVisualBlocks(diagram.graphDescriptor);
    await this.updateComplete;
    await this.#visualBlocksLoaded;
    (this.#visualBlocks as any)?.smartLayout(); // TODO: Types
  }

  async draw(diagram: LoadArgs, highlightedNode: string) {
    valueDebounce(this.#updateGraph, 2000)(diagram);
  }

  render() {
    const loadVisualBlocks = async () => {
      if (
        !this.#requestedVB &&
        customElements.get("graph-editor") == null
      ) {
        this.#requestedVB = true;
        await loadScript(VISUALBLOCKS_URL);
        //this.#scheduleDiagramRender();
      }
      return html`<graph-editor
        ${ref(this.setVisualBlocks)}
        .serializedGraph=${this.serializedGraph}
        ></graph-editor>`;
    };

    return until(loadVisualBlocks(), html`Loading...`);
  }

  private setVisualBlocks(visualBlocks?: Element) {
    this.#visualBlocks = visualBlocks as HTMLElement;
    if (visualBlocks) {
      visualBlocks.addEventListener('loaded', () => {
        this.#resolveVisualBlocksLoaded();
      });
    }
  }
}

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.onload = () => {
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}


let callTimes = new Map<(val: any) => void, [Date, any /* val */]>();
// Don't call the function if the value is the same and the last call was
// within `ms`.
function valueDebounce<T>(cb: (val: T) => void, ms: number) {
  return (val: T) => {
//    if (

    const now = new Date();
    const [lastExecutionTime, lastVal] =
      callTimes.get(cb) ?? [now, null];

    if (val === lastVal && now.getTime() - lastExecutionTime.getTime() < ms) {
      return;
    }

    cb(val);
    callTimes.set(cb, [now, val]);
    console.log(callTimes);
  }
}
