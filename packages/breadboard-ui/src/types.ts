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
}

export type HistoryEvent = {
  type: HistoryEventType;
  summary?: string;
  id?: string | null;
  data?: unknown;
};

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
