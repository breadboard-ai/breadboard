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

export type LooseHistoryEvent = {
  type: LooseHistoryEventTypes;
  summary?: string;
  id?: string | null;
  data?: unknown;
};

export type HistoryEvent = LooseHistoryEvent;

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
