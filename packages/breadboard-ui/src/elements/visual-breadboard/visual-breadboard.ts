import { LitElement, html, nothing} from "lit";
import {customElement, property} from "lit/decorators.js";
import {LoadArgs} from "../../types/types.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { until } from "lit/directives/until.js";
import {breadboardToVisualBlocks} from "./breadboard-to-visualblocks.js";

const VISUALBLOCKS_URL =
  "https://storage.googleapis.com/tfweb/node-graph-editor/node_graph_editor_20240130001456/node_graph_editor_bin.js"

@customElement("visual-breadboard")
export class VisualBreadboard extends LitElement {
  // TODO: Make this 'implement DiagramElement'
  #requestedVB = false;
  #visualBlocks: Ref<HTMLElement> = createRef();

  @property()
  serializedGraph: any;

  reset() {

  }

  async draw(diagram: LoadArgs, highlightedNode: string) {
    if (!diagram.graphDescriptor) {
      return;
    }
    this.serializedGraph = breadboardToVisualBlocks(diagram.graphDescriptor);
    await this.updateComplete;

    // TODO: Don't do this setTimeout hackery.
    // It's necessary now because the angular visualblocks component hasn't
    // yet registered all its `@Input` handlers, so the `smartLayout` property
    // isn't available yet.
    //
    // We probably need to pass the component a callback that it can call
    // after it's set up. This seems like it will work, since it's able to render
    // the `serializedGraph`.
    setTimeout(() => {
      (this.#visualBlocks.value as any)?.smartLayout(); // TODO: Types
    }, 100);
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
        ${ref(this.#visualBlocks)}
        .serializedGraph=${this.serializedGraph}
        ></graph-editor>`;
    };

    return until(loadVisualBlocks(), html`Loading...`);
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
