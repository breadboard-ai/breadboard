export type * from "./marked-types";

export type ConnectorConfiguration = {
  file?: {
    preview: string;
    id: string;
    mimeType: string;
  };
};

export type SimpleSlide = {
  title: string;
  subtitle?: string;
  body?: string;
};

export type SimplePresentation = {
  slides: SimpleSlide[];
};
