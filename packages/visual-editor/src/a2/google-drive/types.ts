export enum SlideDeckMode {
  New = "new",
  Same = "same",
}

export enum SlideWriteMode {
  Prepend = "prepend",
  Append = "append",
  Overwrite = "overwrite",
}

export enum SlideOutputName {
  DeckMode = "b-d-slide-deck-mode",
  WriteMode = "b-d-slide-write-mode",
}

export enum DocEditMode {
  New = "new",
  Same = "same",
}
export enum DocWriteMode {
  Prepend = "prepend",
  Append = "append",
  Overwrite = "overwrite",
}

export enum DocOutputName {
  WriteMode = "b-doc-a-write-mode",
  EditMode = "b-doc-a-edit-mode",
}

export enum SheetEditMode {
  NewSheet = "new-sheet",
  NewTab = "new-tab",
  SameTab = "same-tab",
}
export enum SheetWriteMode {
  Prepend = "prepend",
  Append = "append",
  Overwrite = "overwrite",
}

export enum SheetOutputName {
  WriteMode = "b-d-sheets-write-mode",
  EditMode = "b-d-sheets-edit-mode",
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
  sheetEditMode?: SheetEditMode;
  sheetWriteMode?: SheetWriteMode;
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
