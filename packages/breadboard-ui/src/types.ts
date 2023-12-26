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

export type LooseHistoryEventTypes = Exclude<
  HistoryEventType,
  HistoryEventType.GRAPHEND | HistoryEventType.GRAPHSTART
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

export type GraphStartHistoryEvent = PrimordialHistoryEvent & {
  type: HistoryEventType.GRAPHSTART;
  data: {
    path: string[];
  };
};

export type GraphEndHistoryEvent = GraphStartHistoryEvent & {
  type: HistoryEventType.GRAPHEND;
};

export type HistoryEvent =
  | LooseHistoryEvent
  | GraphStartHistoryEvent
  | GraphEndHistoryEvent;

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
