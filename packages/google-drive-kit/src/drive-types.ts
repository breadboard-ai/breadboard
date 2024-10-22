/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// These are various Google Drive-specific types that are being used by
// this kit

export type TextToSlideRequestsResult = {
  requests: SlidesRequest[];
  prevSlideId: number;
};

export type SlidesDeleteObjectRequest = {
  objectId: string;
};

/**
 * The placeholder information that uniquely identifies a placeholder shape.
 */
export type SlidesPlaceholder = {
  /**
   * The index of the placeholder. If the same placeholder types are present in the same page, they would have different index values.
   */
  index?: number | null;
  /**
   * The object ID of this shape's parent placeholder. If unset, the parent placeholder shape does not exist, so the shape does not inherit properties from any other shape.
   */
  parentObjectId?: string | null;
  /**
   * The type of the placeholder.
   */
  type?: string | null;
};

export type SlidesLayoutPlaceholderIdMapping = {
  /**
   * The placeholder on a layout that will be applied to a slide. Only type and index are needed. For example, a predefined `TITLE_AND_BODY` layout may usually have a TITLE placeholder with index 0 and a BODY placeholder with index 0.
   */
  layoutPlaceholder?: SlidesPlaceholder;
  /**
   * The object ID of the placeholder on a layout that will be applied to a slide.
   */
  layoutPlaceholderObjectId?: string | null;
  /**
   * A user-supplied object ID for the placeholder identified above that to be created onto a slide. If you specify an ID, it must be unique among all pages and page elements in the presentation. The ID must start with an alphanumeric character or an underscore (matches regex `[a-zA-Z0-9_]`); remaining characters may include those as well as a hyphen or colon (matches regex `[a-zA-Z0-9_-:]`). The length of the ID must not be less than 5 or greater than 50. If you don't specify an ID, a unique one is generated.
   */
  objectId?: string | null;
};

/**
 * A location of a single table cell within a table.
 */
export interface SlidesTableCellLocation {
  /**
   * The 0-based column index.
   */
  columnIndex?: number | null;
  /**
   * The 0-based row index.
   */
  rowIndex?: number | null;
}

/**
 * Inserts text into a shape or a table cell.
 */
export type SlidesInsertTextRequest = {
  /**
   * The optional table cell location if the text is to be inserted into a table cell. If present, the object_id must refer to a table.
   */
  cellLocation?: SlidesTableCellLocation;
  /**
   * The index where the text will be inserted, in Unicode code units, based on TextElement indexes. The index is zero-based and is computed from the start of the string. The index may be adjusted to prevent insertions inside Unicode grapheme clusters. In these cases, the text will be inserted immediately after the grapheme cluster.
   */
  insertionIndex?: number | null;
  /**
   * The object ID of the shape or table where the text will be inserted.
   */
  objectId?: string | null;
  /**
   * The text to be inserted. Inserting a newline character will implicitly create a new ParagraphMarker at that index. The paragraph style of the new paragraph will be copied from the paragraph at the current insertion index, including lists and bullets. Text styles for inserted text will be determined automatically, generally preserving the styling of neighboring text. In most cases, the text will be added to the TextRun that exists at the insertion index. Some control characters (U+0000-U+0008, U+000C-U+001F) and characters from the Unicode Basic Multilingual Plane Private Use Area (U+E000-U+F8FF) will be stripped out of the inserted text.
   */
  text?: string | null;
};

export type SlidesCreateParagraphBulletsRequest = {
  objectId: string | null;
};

/**
 * Creates an image.
 */
export interface SlidesCreateImageRequest {
  /**
   * The element properties for the image. When the aspect ratio of the provided size does not match the image aspect ratio, the image is scaled and centered with respect to the size in order to maintain the aspect ratio. The provided transform is applied after this operation. The PageElementProperties.size property is optional. If you don't specify the size, the default size of the image is used. The PageElementProperties.transform property is optional. If you don't specify a transform, the image will be placed at the top-left corner of the page.
   */
  elementProperties?: SlidesPageElementProperties;
  /**
   * A user-supplied object ID. If you specify an ID, it must be unique among all pages and page elements in the presentation. The ID must start with an alphanumeric character or an underscore (matches regex `[a-zA-Z0-9_]`); remaining characters may include those as well as a hyphen or colon (matches regex `[a-zA-Z0-9_-:]`). The length of the ID must not be less than 5 or greater than 50. If you don't specify an ID, a unique one is generated.
   */
  objectId?: string | null;
  /**
   * The image URL. The image is fetched once at insertion time and a copy is stored for display inside the presentation. Images must be less than 50 MB in size, can't exceed 25 megapixels, and must be in one of PNG, JPEG, or GIF formats. The provided URL must be publicly accessible and up to 2 KB in length. The URL is saved with the image, and exposed through the Image.source_url field.
   */
  url?: string | null;
}

/**
 * Common properties for a page element. Note: When you initially create a PageElement, the API may modify the values of both `size` and `transform`, but the visual size will be unchanged.
 */
export interface SlidesPageElementProperties {
  /**
   * The object ID of the page where the element is located.
   */
  pageObjectId?: string | null;
  /**
   * The size of the element.
   */
  size?: SlidesSide;
  /**
   * The transform for the element.
   */
  transform?: SlidesAffineTransform;
}

/**
 * A width and height.
 */
export interface SlidesSide {
  /**
   * The height of the object.
   */
  height?: SlidesDimension;
  /**
   * The width of the object.
   */
  width?: SlidesDimension;
}

/**
 * A magnitude in a single direction in the specified units.
 */
export interface SlidesDimension {
  /**
   * The magnitude.
   */
  magnitude?: number | null;
  /**
   * The units for magnitude.
   */
  unit?: string | null;
}

/**
 * AffineTransform uses a 3x3 matrix with an implied last row of [ 0 0 1 ] to transform source coordinates (x,y) into destination coordinates (x', y') according to: x' x = shear_y scale_y translate_y 1 [ 1 ] After transformation, x' = scale_x * x + shear_x * y + translate_x; y' = scale_y * y + shear_y * x + translate_y; This message is therefore composed of these six matrix elements.
 */
export interface SlidesAffineTransform {
  /**
   * The X coordinate scaling element.
   */
  scaleX?: number | null;
  /**
   * The Y coordinate scaling element.
   */
  scaleY?: number | null;
  /**
   * The X coordinate shearing element.
   */
  shearX?: number | null;
  /**
   * The Y coordinate shearing element.
   */
  shearY?: number | null;
  /**
   * The X coordinate translation element.
   */
  translateX?: number | null;
  /**
   * The Y coordinate translation element.
   */
  translateY?: number | null;
  /**
   * The units for translate elements.
   */
  unit?: string | null;
}

export type SlidesCreateSlideRequest = {
  insertionIndex?: number;
  objectId?: string;
  slideLayoutReference: {
    layoutId?: string;
    predefinedLayout?: SlidesPredefinedLayout;
  };
  placeholderIdMappings: SlidesLayoutPlaceholderIdMapping[];
};

/**
 * The predefined layouts of a slide.
 */
export type SlidesPredefinedLayout =
  /*
   *	Unspecified layout.
   */
  | "PREDEFINED_LAYOUT_UNSPECIFIED"

  /*
   * Blank layout with no placeholders.
   */
  | "BLANK"
  /*
   * Layout with a caption at the bottom.
   */
  | "CAPTION_ONLY"
  /*
   * Layout with a title and a subtitle.
   */
  | "TITLE"
  /*
   * Layout with a title and body.
   */
  | "TITLE_AND_BODY"
  /*
   * Layout with a title and two columns.
   */
  | "TITLE_AND_TWO_COLUMNS"
  /*
   * Layout with only a title
   */
  | "TITLE_ONLY"
  /*
   * Layout with a section title.
   */
  | "SECTION_HEADER"
  /*
   * Layout with a title and subtitle on one side and description on the other.
   */
  | "SECTION_TITLE_AND_DESCRIPTION"
  /*
   * Layout with one title and one body, arranged in a single column.
   */
  | "ONE_COLUMN_TEXT"
  /*
   * Layout with a main point.
   */
  | "MAIN_POINT"
  /*
   * Layout with a big number.
   */
  | "BIG_NUMBER";

export type SlidesRequest =
  | { deleteObject: SlidesDeleteObjectRequest }
  | { createSlide: SlidesCreateSlideRequest }
  | { insertText: SlidesInsertTextRequest }
  | { createParagraphBullets: SlidesCreateParagraphBulletsRequest }
  | { createImage: SlidesCreateImageRequest };
