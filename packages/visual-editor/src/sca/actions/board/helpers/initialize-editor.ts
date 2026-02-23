import type {
  EditHistoryCreator,
  EditHistoryEntry,
  GraphDescriptor,
  GraphIdentifier,
  GraphStoreArgs,
  OutputValues,
} from "@breadboard-ai/types";
import { Graph as GraphEditor } from "../../../../engine/editor/graph.js";
import { getHandler } from "../../../../engine/runtime/legacy.js";
import type { NodeDescriber } from "../../../../sca/controller/subcontrollers/editor/graph/node-describer.js";
import type * as Editor from "../../../controller/subcontrollers/editor/editor.js";

/**
 * Options for initializing the editor.
 */
export interface InitializeEditorOptions {
  /** The prepared graph to edit */
  graph: GraphDescriptor;
  /** The resolved subgraph ID */
  subGraphId: GraphIdentifier | null;
  /** The URL the graph was loaded from */
  url: string;
  /** Whether the graph is read-only (not owned by current user) */
  readOnly: boolean;
  /** Version information */
  version: number;
  lastLoadedVersion: number;
  /** Creator info for edit history */
  creator?: EditHistoryCreator;
  /** Pre-loaded edit history */
  history?: EditHistoryEntry[];
  /** Callback when history changes */
  onHistoryChanged?: (history: Readonly<EditHistoryEntry[]>) => void;
  /** Pre-loaded final output values */
  finalOutputValues?: OutputValues;
  /** Dependencies for describer caches */
  graphStoreArgs: GraphStoreArgs;
}

/**
 * Result of initializing the editor.
 */
export interface InitializeEditorResult {
  success: true;
  /** The editor ID (for identifying this editing session) */
  id: string;
}

/**
 * Sets up the editor state for a loaded graph.
 *
 * This function:
 * - Builds a NodeDescriber closure (SCA Service→Controller boundary)
 * - Initializes the graph controller as the MutableGraph
 * - Creates an editor instance
 * - Wires up event listeners for graph changes
 * - Updates the graph controller state
 *
 * @param graphController The graph controller to update
 * @param options Editor initialization options
 * @returns The editor ID
 */
export function initializeEditor(
  graphController: Editor.Graph.GraphController,
  options: InitializeEditorOptions
): InitializeEditorResult {
  const {
    graph,
    url,
    readOnly,
    version,
    lastLoadedVersion,
    creator,
    history,
    onHistoryChanged,
    graphStoreArgs,
  } = options;

  // Build the NodeDescriber function (SCA Service→Controller boundary).
  // This closure captures the sandbox and graphStore so the Controller
  // doesn't need to import engine/runtime/ directly.
  const describer: NodeDescriber = async (type, configuration) => {
    const context = {
      sandbox: graphStoreArgs.sandbox,
      graphStore: graphController.store,
    };
    const handler = await getHandler(type, context);
    if (!handler || !("describe" in handler) || !handler.describe) {
      return {
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      };
    }
    return handler.describe(
      { ...configuration },
      { type: "object" },
      { type: "object" },
      {
        sandbox: graphStoreArgs.sandbox,
        graphStore: graphController.store,
        flags: graphStoreArgs.flags,
        asType: false,
      }
    );
  };

  // Initialize GraphController as the MutableGraph (replaces MutableGraphImpl)
  graphController.initialize(graph, graphStoreArgs, describer);
  const editor = new GraphEditor(graphController, {
    creator,
    history,
    onHistoryChanged,
  });

  // Generate a session ID
  const id = globalThis.crypto.randomUUID();

  // Set up controller state
  graphController.sessionId = id;
  graphController.setEditor(editor);
  graphController.url = url;
  graphController.version = version;
  graphController.readOnly = readOnly;
  graphController.mainGraphId = id;
  graphController.lastLoadedVersion = lastLoadedVersion;
  graphController.finalOutputValues = options.finalOutputValues;

  // Bump version to trigger Asset.syncFromGraph and other version-change actions.
  // This must happen AFTER all state is set so triggers see complete state.
  graphController.version++;

  return {
    success: true,
    id,
  };
}

/**
 * Resets the editor state, preparing for a new graph or returning to home.
 *
 * @param graphController The graph controller to reset
 */
export function resetEditor(
  graphController: Editor.Graph.GraphController
): void {
  graphController.resetAll();
}
