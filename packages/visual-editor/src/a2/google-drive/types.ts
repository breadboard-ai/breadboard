export type SlideDeckMode = "new" | "same";
export type SlideWriteMode = "prepend" | "append" | "overwrite";

export type ConnectorConfiguration = {
  file?: {
    preview: string;
    id: string;
    mimeType: string;
  };
  slideDeckMode?: SlideDeckMode;
  slideWriteMode?: SlideWriteMode;
};

export type SimpleSlide = {
  title: string;
  subtitle?: string;
  body?: string;
};

export type SimplePresentation = {
  slides: SimpleSlide[];
};

export type SheetValues = {
  spreadsheet_values: unknown[][];
};
