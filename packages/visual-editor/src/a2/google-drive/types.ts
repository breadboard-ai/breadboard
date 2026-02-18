export type SlideDeckMode = "new" | "same";
export type SlideWriteMode = "prepend" | "append" | "overwrite";

export enum DocEditMode {
  New = "new",
  Same = "same",
}
export enum DocWriteMode {
  Prepend = "prepend",
  Append = "append",
  Overwrite = "overwrite",
}

export type ConnectorConfiguration = {
  file?: {
    preview: string;
    id: string;
    mimeType: string;
  };
  slideDeckMode?: SlideDeckMode;
  slideWriteMode?: SlideWriteMode;
  docEditMode?: DocEditMode;
  docWriteMode?: DocWriteMode;
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
