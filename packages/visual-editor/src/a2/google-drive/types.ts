export type ConnectorConfiguration = {
  file?: {
    preview: string;
    id: string;
    mimeType: string;
  };
  editEachTime?: string;
  writeMode?: string;
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
