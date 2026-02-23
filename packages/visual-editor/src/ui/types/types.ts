import type {
  Schema,
  InspectableEdgeType,
  InspectableEdge,
  PortStatus,
  NodeValue,
  NodeConfiguration,
  GraphDescriptor,
  NodeIdentifier,
  PortIdentifier,
  InspectableAssetEdgeDirection,
} from "@breadboard-ai/types";
import type {
  AppPalette,
  AssetPath,
  AssetType,
  GraphIdentifier,
  GraphMetadata,
  LLMContent,
  RuntimeFlags,
} from "@breadboard-ai/types";
import type { HTMLTemplateResult, LitElement } from "lit";

import type {
  AppThemeColors,
  SnackbarAction,
  SnackbarUUID,
  SnackType,
} from "../../sca/types.js";

// Re-export migrated types from sca/types.ts for barrel compatibility
// (BreadboardUI.Types.* namespace access). Canonical source: sca/types.ts.
export {
  STATUS,
  SnackType,
  type SnackbarUUID,
  type SnackbarAction,
  type AppTheme,
  type VisualEditorMode,
  type VisualEditorStatusUpdate,
  type UserSignInResponse,
  type ActionTracker,
  type RecentBoard,
  type MakeUrlInit,
  type BaseUrlInit,
  type GraphUrlInit,
  type HomeUrlInit,
  type LandingUrlInit,
  type OpenUrlInit,
  type GlobalConfig,
  type AppThemeColors,
} from "../../sca/types.js";

export type InputCallback = (data: Record<string, unknown>) => void;

export type Board = {
  title: string;
  url: string;
  version: string;
};

export enum BOARD_LOAD_STATUS {
  PENDING = "pending",
  LOADING = "loading",
  LOADED = "loaded",
  ERROR = "error",
}

export enum BOARD_SAVE_STATUS {
  UNSAVED = "unsaved",
  SAVING = "saving",
  SAVED = "saved",
  ERROR = "error",
}

export type UserInputConfiguration = {
  name: string;
  title: string;
  secret: boolean;
  required?: boolean;
  configured?: boolean;
  value: NodeValue;
  originalValue?: NodeValue;
  schema?: Schema | null;
  status?: PortStatus;
  type?: Schema["type"];
  offer?: {
    enhance?: boolean;
  };
};

export type UserOutputValues = NodeConfiguration;

export interface AllowedLLMContentTypes {
  audioFile: boolean;
  audioMicrophone: boolean;
  videoFile: boolean;
  videoWebcam: boolean;
  imageFile: boolean;
  imageWebcam: boolean;
  imageDrawable: boolean;
  textFile: boolean;
  textInline: boolean;
}

export enum TOKEN_TYPE {
  CONNECTIONS = "Connections",
}

export interface TokenEntry {
  key: string;
  value: {
    id?: string;
    name: string;
    description?: string;
    value: string | number | boolean;
  };
}

export interface TokensList {
  [TOKEN_TYPE.CONNECTIONS]: TokenEntry;
}

export type TokenItems = Map<TokenEntry["value"]["name"], TokenEntry["value"]>;

export type Tokens = {
  [K in keyof TokensList]: {
    configuration: {
      extensible: boolean;
      description: string;
      nameEditable: boolean;
      nameVisible: boolean;
      /**
       * Render an instance of the custom element with this name, instead of
       * generic setting entries. The element must match the
       * {@link CustomSettingsElement} interface.
       */
      customElement?: string;
    };
    items: TokenItems;
  };
};

/**
 * A simplified interface over {@link TokenStore} for reading/writing
 * token grants to IndexedDB.
 */
export interface TokensHelper {
  get(section: TOKEN_TYPE, name: string): TokenEntry["value"] | undefined;
  set(
    section: TOKEN_TYPE,
    name: string,
    value: TokenEntry["value"]
  ): Promise<void>;
  delete(section: TOKEN_TYPE, name: string): Promise<void>;
}

/**
 * A POJO version of {@link InspectableEdge} with only what we need for
 * rendering. An {@link InspectableEdge} should be assignable to this, but not
 * vice-versa.
 *
 * This type was created to distinguish when we have an actual
 * {@link InspectableEdge} with methods and full inspectable nodes, vs a plain
 * object that just has the basic string data.
 *
 * Note that it's not safe to `structuredClone` an {@link InspectableEdge}, so
 * {@link cloneEdgeData} should be used for cloning.
 */
export interface EdgeData {
  from: { descriptor: { id: string; type?: string } };
  to: { descriptor: { id: string; type?: string } };
  out: string;
  in: string;
  type: InspectableEdgeType;
}

({}) as InspectableEdge satisfies EdgeData;

export function cloneEdgeData<T extends EdgeData | null>(edge: T): T {
  return (
    edge === null
      ? null
      : {
          from: {
            descriptor: {
              id: edge.from.descriptor.id,
              type: edge.from.descriptor.type,
            },
          },
          to: {
            descriptor: {
              id: edge.to.descriptor.id,
              type: edge.from.descriptor.type,
            },
          },
          out: edge.out,
          in: edge.in,
          type: edge.type,
        }
  ) as T;
}

export interface UserMessage {
  srcset: string;
  src: string;
  alt: string;
}

export type RunIdentifier = string;

export interface Command {
  title: string;
  name: string;
  icon: string;
  callback?: (command: string, secondaryAction?: string | null) => void;
  disabled?: boolean;
  secondaryAction?: string;
}

export interface OverflowAction {
  title: string;
  name: string;
  icon: string | HTMLTemplateResult;
  disabled?: boolean;
  value?: string;
  secondaryAction?: string;
}

export type ReferenceIdentifier =
  `${NodeIdentifier}|${PortIdentifier}|${number}`;

export interface GraphSelectionState {
  nodes: Set<NodeIdentifier>;
  assets: Set<AssetPath>;
  assetEdges: Set<string>;
  comments: Set<string>;
  edges: Set<string>;
  references: Set<ReferenceIdentifier>;
}

export interface GraphEntityVisualState {
  type: "node" | "comment";
  x: number;
  y: number;
  expansionState: "collapsed" | "expanded" | "advanced";
  outputHeight: number;
}

export type GraphVisualState = {
  nodes: Map<NodeIdentifier, GraphEntityVisualState>;
  graph: GraphMetadata;
};

export type WorkspaceVisualChangeId = ReturnType<typeof crypto.randomUUID>;
export type WorkspaceVisualState = Map<GraphIdentifier, GraphVisualState>;
export interface WorkspaceVisualStateWithChangeId {
  visualChangeId: WorkspaceVisualChangeId;
  visualState: WorkspaceVisualState;
}

export type SelectionChangeId = ReturnType<typeof crypto.randomUUID>;
export type MultiGraphSelectionState = {
  graphs: Map<GraphIdentifier, GraphSelectionState>;
};
export interface MultiGraphSelectionStateWithChangeId {
  selectionChangeId: SelectionChangeId;
  selectionState: MultiGraphSelectionState;
  moveToSelection: "immediate" | "animated" | false;
}

export interface GraphHighlightState {
  nodes: Set<NodeIdentifier>;
  comments: Set<string>;
  edges: Set<string>;
}
export type HighlightChangeId = ReturnType<typeof crypto.randomUUID>;
export type HighlightState = {
  graphs: Map<GraphIdentifier, GraphHighlightState>;
};
export interface HighlightStateWithChangeId {
  highlightChangeId: HighlightChangeId;
  highlightState: HighlightState;
  highlightType: "user" | "model";
}

export interface DragConnectorReceiver extends HTMLElement {
  isOnDragConnectorTarget(): boolean;
  highlight(): void;
  removeHighlight(): void;
}

export type LanguagePackEntry = Record<
  string,
  { str: string; desc?: string } | string
>;

/**
 * Explicitly list the language packs to ensure new packs contain the correct
 * top-level entries.
 */
export interface LanguagePack {
  ActivityLog: LanguagePackEntry;
  AppPreview: LanguagePackEntry;
  AssetOrganizer: LanguagePackEntry;
  AudioHandler: LanguagePackEntry;
  CommandPalette: LanguagePackEntry;
  ComponentSelector: LanguagePackEntry;
  Editor: LanguagePackEntry;
  FocusEditor: LanguagePackEntry;
  Global: LanguagePackEntry;
  KitSelector: LanguagePackEntry;
  ProjectListing: LanguagePackEntry;
  UIController: LanguagePackEntry;
  WorkspaceOutline: LanguagePackEntry;
}

export interface AppTemplateAdditionalOption {
  values: Array<{ value: string; title: string }>;
  title: string;
}

export type AppTemplateAdditionalOptionsAvailable = Record<
  string,
  AppTemplateAdditionalOption
>;

export type AppTemplateAdditionalOptionsChosen = Record<string, string>;

export interface AppTemplateOptions {
  title?: string | null;
  description?: string | null;
  mode: "light" | "dark";
  theme?: AppPalette & AppThemeColors;
  isDefaultTheme?: boolean;
  splashImage: string | boolean;
  additionalOptions?: AppTemplateAdditionalOptionsChosen;
}

export interface AppTemplate extends LitElement {
  options: AppTemplateOptions;
  graph: GraphDescriptor | null;
  additionalOptions: AppTemplateAdditionalOptionsAvailable;
  showGDrive: boolean;
  readOnly: boolean;
  showShareButton: boolean;
  disclaimerContent: HTMLTemplateResult | string | null;
  isEmpty: boolean;
  focusWhenIn: ["canvas", "preview" | "console"] | ["app"];
  runtimeFlags: RuntimeFlags | null;
  headerConfig: {
    replay: boolean;
    menu: boolean;
    fullscreen: "available" | "active" | null;
    small: boolean;
  };
}

export interface Utterance {
  isFinal: boolean;
  confidence: number;
  transcript: string;
}

export type EdgeAttachmentPoint = "Top" | "Right" | "Bottom" | "Left" | "Auto";

export interface NewAsset {
  name: string;
  type: AssetType;
  path: AssetPath;
  data: LLMContent;
  subType?: string;
  visual?: Record<string, number>;
  managed?: boolean;
}

export interface AssetEdge {
  direction: InspectableAssetEdgeDirection;
  nodeId: NodeIdentifier;
  assetPath: AssetPath;
}

export type EnumValue = {
  title: string;
  id: string;
  icon?: string | HTMLTemplateResult;
  description?: string;
  tag?: string; // Typically used for keyboard shortcuts.
  hidden?: boolean;
  /**
   * A brief message that can be presented to the user.
   * Currently used to provide proactive quota notification.
   */
  info?: string;
};

export type SnackbarMessage = {
  id: SnackbarUUID;
  type: SnackType;
  persistent: boolean;
  message: string | HTMLTemplateResult;
  actions?: SnackbarAction[];
};

type ColorShade =
  | 0
  | 5
  | 10
  | 15
  | 20
  | 25
  | 30
  | 35
  | 40
  | 50
  | 60
  | 70
  | 80
  | 90
  | 95
  | 98
  | 99
  | 100;

export type PaletteKeyVals = "n" | "nv" | "p" | "s" | "t" | "e";
export const shades: ColorShade[] = [
  0, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100,
];

type CreatePalette<Prefix extends PaletteKeyVals> = {
  [Key in `${Prefix}${ColorShade}`]: string;
};

export type PaletteKey<Prefix extends PaletteKeyVals> = Array<
  keyof CreatePalette<Prefix>
>;

export type PaletteKeys = {
  neutral: PaletteKey<"n">;
  neutralVariant: PaletteKey<"nv">;
  primary: PaletteKey<"p">;
  secondary: PaletteKey<"s">;
  tertiary: PaletteKey<"t">;
  error: PaletteKey<"e">;
};

export type ColorPalettes = {
  neutral: CreatePalette<"n">;
  neutralVariant: CreatePalette<"nv">;
  primary: CreatePalette<"p">;
  secondary: CreatePalette<"s">;
  tertiary: CreatePalette<"t">;
  error: CreatePalette<"e">;
};

export type FloatingInputFocusState =
  | ["canvas", "preview" | "console"]
  | ["app"];
