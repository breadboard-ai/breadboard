export const enum HistoryEventType {
  DONE = "done",
  ERROR = "error",
  INPUT = "input",
  INPUT_MULTIPART = "input-multi-part",
  LOAD = "load",
  OUTPUT = "output",
  BEFOREHANDLER = "beforehandler",
  AFTERHANDLER = "afterhandler",
  RESULT = "result",
  SECRETS = "secrets",
  GRAPHSTART = "graphstart",
  GRAPHEND = "graphend",
}

// TODO: Remove all the `Loose` types by tightening up the types for
// each event.
export type LooseHistoryEventTypes = Exclude<
  HistoryEventType,
  | HistoryEventType.GRAPHEND
  | HistoryEventType.GRAPHSTART
  | HistoryEventType.BEFOREHANDLER
  | HistoryEventType.AFTERHANDLER
>;

export type PrimordialHistoryEvent = {
  type: HistoryEventType;
  summary?: string;
  id?: string | null;
  data?: unknown;
};

export type LooseHistoryEvent = PrimordialHistoryEvent & {
  type: LooseHistoryEventTypes;
};

export type DataWithPath = {
  path: number[];
};

export type GraphStartHistoryEvent = PrimordialHistoryEvent & {
  type: HistoryEventType.GRAPHSTART;
  data: DataWithPath;
};

export type GraphEndHistoryEvent = PrimordialHistoryEvent & {
  type: HistoryEventType.GRAPHEND;
  data: DataWithPath;
};

export type BeforehandlerHistoryEvent = PrimordialHistoryEvent & {
  type: HistoryEventType.BEFOREHANDLER;
  data: DataWithPath;
};

export type AfterhandlerHistoryEvent = PrimordialHistoryEvent & {
  type: HistoryEventType.AFTERHANDLER;
  data: DataWithPath & { outputs: Record<string, unknown> };
};

export type HistoryEvent =
  | LooseHistoryEvent
  | GraphStartHistoryEvent
  | GraphEndHistoryEvent
  | BeforehandlerHistoryEvent
  | AfterhandlerHistoryEvent;

export interface ImageHandler {
  start(): Promise<void>;
  stop(): void;
}

export interface CanvasData {
  inline_data: {
    data: string;
    mime_type: string;
  };
}
