import { Kit, inspect } from "@google-labs/breadboard";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { LoadArgs } from "../../types/types.js";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";

const DATA_TYPE = "text/plain";

@customElement("bb-node-selector")
export class NodeSelector extends LitElement {
  @property()
  loadInfo: LoadArgs | null = null;

  @property()
  kits: Kit[] = [];

  @state()
  filter: string | null = null;

  #listRef: Ref<HTMLUListElement> = createRef();
  #lastSelectedId: string | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: grid;
      background: #ededed;
      border-radius: 12px;
      box-shadow:
        0px 1px 2px rgba(0, 0, 0, 0.3),
        0px 1px 3px 1px rgba(0, 0, 0, 0.15);
      padding: 8px;

      --border-radius: 32px;
      --kit-height: 24px;
      --kit-margin: 1px;
      --kit-count: 2;
      --height: calc(var(--kit-count) * (var(--kit-height)));
    }

    #container {
      display: grid;
    }

    #search {
      margin-bottom: 8px;
      border-radius: 8px;
      border: none;
      height: 24px;
      padding-left: 24px;
      background: #fff var(--bb-icon-search) 4px center no-repeat;
      background-size: 16px 16px;
    }

    #kit-list {
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      list-style: none;
      font-size: var(--bb-text-small);
      color: #222;
      height: var(--height);
      position: relative;
      width: min(80vw, 300px);
    }

    #kit-list > li {
      width: 40%;
    }

    input[type="radio"] {
      display: none;
    }

    li.kit-item,
    label {
      height: var(--kit-height);
      display: block;
      border-radius: var(--border-radius) 0 0 var(--border-radius);
      padding: 0 12px;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
      position: relative;
      cursor: pointer;
      line-height: var(--kit-height);
      color: #1a1a1a;
    }

    #kit-list li:hover label::before {
      content: "";
      background: #000;
      position: absolute;
      left: 1px;
      top: 1px;
      bottom: 1px;
      right: 8px;
      border-radius: var(--border-radius);
      z-index: 0;
      opacity: 0.1;
    }

    #kit-list li:hover label span {
      position: relative;
      z-index: 1;
    }

    label {
      opacity: 0.5;
    }

    input[type="radio"]:checked ~ label {
      background: #fff;
      border-radius: var(--border-radius) 0 0 var(--border-radius);
      position: relative;
      opacity: 1;
    }

    input[type="radio"]:checked ~ label::before {
      display: none;
    }

    input[type="radio"] ~ .kit-contents {
      display: none;
    }

    input[type="radio"]:checked ~ .kit-contents {
      display: block;
      position: absolute;
      left: 40%;
      top: 0;
      height: var(--height);
      overflow-y: scroll;
      scrollbar-gutter: stable;
      background: #fff;
      margin: 0;
      width: 60%;
      border-radius: 8px;
    }

    .kit-contents ul {
      display: block;
    }

    #kit-list
      li:first-of-type:last-of-type
      input[type="radio"]:checked
      ~ .kit-contents,
    #kit-list li:first-of-type input[type="radio"]:checked ~ .kit-contents {
      border-radius: 0 8px 8px 8px;
    }

    #kit-list li:last-of-type input[type="radio"]:checked ~ .kit-contents {
      border-radius: 8px 8px 8px 0;
    }

    .kit-contents ul {
      padding: 0;
      margin: 0;
    }

    li.kit-item {
      margin: 0;
      padding: 0 16px;
      width: 100%;
      border-radius: 12px;
      position: relative;
      background: #fff;
    }

    li.kit-item:hover::before {
      content: "";
      background: #000;
      position: absolute;
      left: 6px;
      top: 1px;
      bottom: 1px;
      right: 8px;
      border-radius: var(--border-radius);
      z-index: 0;
      opacity: 0.05;
    }

    li.kit-item span {
      position: relative;
      z-index: 1;
    }
  `;

  updated() {
    if (!this.#listRef.value) {
      return;
    }

    if (this.#listRef.value.querySelector("input[checked]")) {
      return;
    }

    if (this.#lastSelectedId) {
      const lastInput = this.#listRef.value.querySelector(
        `#${this.#lastSelectedId}`
      ) as HTMLInputElement;
      if (lastInput) {
        lastInput.checked = true;
        return;
      }
    }

    const firstInput = this.#listRef.value.querySelector("input");
    if (!firstInput) {
      return;
    }

    firstInput.checked = true;
  }

  render() {
    if (!this.kits || !this.loadInfo || !this.loadInfo.graphDescriptor) {
      return nothing;
    }

    const graph = inspect(this.loadInfo.graphDescriptor, {
      kits: this.kits,
    });

    const kits = graph.kits() || [];
    const kitList = new Map<string, string[]>();
    kits.sort((kit1, kit2) =>
      (kit1.descriptor.title || "") > (kit2.descriptor.title || "") ? 1 : -1
    );

    for (const kit of kits) {
      if (!kit.descriptor.title) {
        continue;
      }

      let kitNodes = kit.nodeTypes;
      kitNodes = kit.nodeTypes.filter((node) => {
        if (!this.filter) {
          return true;
        }
        const filter = new RegExp(this.filter, "gim");
        return filter.test(node.type());
      });

      if (kitNodes.length === 0) {
        continue;
      }

      kitList.set(
        kit.descriptor.title,
        kitNodes.map((node) => node.type())
      );
    }

    this.style.setProperty("--kit-count", kits.length.toString());

    return html` <div
      id="container"
      @pointerdown=${(evt: Event) => evt.stopPropagation()}
    >
      <input
        type="search"
        id="search"
        placeholder="Search nodes"
        @input=${(evt: InputEvent) => {
          if (!(evt.target instanceof HTMLInputElement)) {
            return;
          }

          this.filter = evt.target.value;
        }}
      />
      <form>
        <ul id="kit-list" ${ref(this.#listRef)}>
          ${map(kitList, ([kitName, kitContents]) => {
            const kitId = kitName.toLocaleLowerCase().replace(/\W/gim, "-");
            return html`<li>
              <input
                type="radio"
                name="selected-kit"
                id="${kitId}"
                @click=${(evt: Event) => {
                  if (!(evt.target instanceof HTMLElement)) {
                    return;
                  }

                  this.#lastSelectedId = evt.target.id;
                }}
              /><label for="${kitId}"><span>${kitName}</span></label>
              <div class="kit-contents">
                <ul>
                  ${map(kitContents, (kitItemName) => {
                    const kitItemId = kitItemName
                      .toLocaleLowerCase()
                      .replace(/\W/, "-");
                    return html`<li
                      class=${classMap({
                        [kitItemId]: true,
                        ["kit-item"]: true,
                      })}
                      draggable="true"
                      @dragstart=${(evt: DragEvent) => {
                        if (!evt.dataTransfer) {
                          return;
                        }
                        evt.dataTransfer.setData(DATA_TYPE, kitItemName);
                      }}
                    >
                      <span>${kitItemName}</span>
                    </li>`;
                  })}
                </ul>
              </div>
            </li>`;
          })}
        </ul>
      </form>
      <div></div>
    </div>`;
  }
}
