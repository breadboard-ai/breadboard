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

  #updateGraph = valueDebounce(async (diagram: LoadArgs | null) => {
    if (!diagram?.graphDescriptor) {
      this.serializedGraph = null;
      return;
    }
    this.serializedGraph = breadboardToVisualBlocks(diagram.graphDescriptor);
    await this.updateComplete;
    await this.#visualBlocksLoaded;
    (this.#visualBlocks as any)?.smartLayout(); // TODO: Types
  }, 2000);

  reset() {
    this.#updateGraph(null);
  }

  async draw(diagram: LoadArgs, highlightedNode: string) {
    this.#updateGraph(diagram);
  }

  render() {
    const loadVisualBlocks = async () => {
      if (
        !this.#requestedVB &&
        customElements.get("graph-editor") == null
      ) {
        this.#requestedVB = true;
        await loadScript(VISUALBLOCKS_URL);
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

// Don't call the function if the value is the same and the last call was
// within `ms`.
function valueDebounce<T>(cb: (val: T) => void, ms: number) {
  let lastExecutionTime = new Date(0);
  let lastVal: unknown = null;
  return (val: T) => {
    const now = new Date();

    if (val === lastVal && now.getTime() - lastExecutionTime.getTime() < ms) {
      return;
    }

    cb(val);
    lastExecutionTime = now;
    lastVal = val;
  }
}
