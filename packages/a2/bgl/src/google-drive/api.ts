/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fetch, { type FetchInputs } from "@fetch";
import secrets from "@secrets";

import { err, ok } from "./a2/utils";

export {
  connect,
  get,
  create,
  del,
  query,
  createMultipart,
  exp,
  getDoc,
  updateDoc,
  createPresentation,
  getPresentation,
  updatePresentation,
  createPermission,
};

// These are various Google Drive-specific types.

export type CreateFileResponse = {
  id: string;
};

export type FileQueryResponse = {
  files: FileInfo[];
};

export type FileInfo = {
  id: string;
};

/**
 * A Google Slides presentation.
 */
export interface SlidesPresentation {
  /**
   * The layouts in the presentation. A layout is a template that determines how content is arranged and styled on the slides that inherit from that layout.
   */
  layouts?: SlidesPage[];
  /**
   * The locale of the presentation, as an IETF BCP 47 language tag.
   */
  locale?: string | null;
  /**
   * The slide masters in the presentation. A slide master contains all common page elements and the common properties for a set of layouts. They serve three purposes: - Placeholder shapes on a master contain the default text styles and shape properties of all placeholder shapes on pages that use that master. - The master page properties define the common page properties inherited by its layouts. - Any other shapes on the master slide appear on all slides using that master, regardless of their layout.
   */
  masters?: SlidesPage[];
  /**
   * The notes master in the presentation. It serves three purposes: - Placeholder shapes on a notes master contain the default text styles and shape properties of all placeholder shapes on notes pages. Specifically, a `SLIDE_IMAGE` placeholder shape contains the slide thumbnail, and a `BODY` placeholder shape contains the speaker notes. - The notes master page properties define the common page properties inherited by all notes pages. - Any other shapes on the notes master appear on all notes pages. The notes master is read-only.
   */
  notesMaster?: SlidesPage;
  /**
   * The size of pages in the presentation.
   */
  pageSize?: SlidesSize;
  /**
   * The ID of the presentation.
   */
  presentationId?: string | null;
  /**
   * Output only. The revision ID of the presentation. Can be used in update requests to assert the presentation revision hasn't changed since the last read operation. Only populated if the user has edit access to the presentation. The revision ID is not a sequential number but a nebulous string. The format of the revision ID may change over time, so it should be treated opaquely. A returned revision ID is only guaranteed to be valid for 24 hours after it has been returned and cannot be shared across users. If the revision ID is unchanged between calls, then the presentation has not changed. Conversely, a changed ID (for the same presentation and user) usually means the presentation has been updated. However, a changed ID can also be due to internal factors such as ID format changes.
   */
  revisionId?: string | null;
  /**
   * The slides in the presentation. A slide inherits properties from a slide layout.
   */
  slides?: SlidesPage[];
  /**
   * The title of the presentation.
   */
  title?: string | null;
}

/**
 * A width and height.
 */
export interface SlidesSize {
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
 * A page in a presentation.
 */
export interface SlidesPage {
  /**
   * Layout specific properties. Only set if page_type = LAYOUT.
   */
  layoutProperties?: unknown; // Schema$LayoutProperties;
  /**
   * Master specific properties. Only set if page_type = MASTER.
   */
  masterProperties?: unknown; // Schema$MasterProperties;
  /**
   * Notes specific properties. Only set if page_type = NOTES.
   */
  notesProperties?: unknown; // Schema$NotesProperties;
  /**
   * The object ID for this page. Object IDs used by Page and PageElement share the same namespace.
   */
  objectId?: string | null;
  /**
   * The page elements rendered on the page.
   */
  pageElements?: unknown[]; // Schema$PageElement[];
  /**
   * The properties of the page.
   */
  pageProperties?: unknown; // Schema$PageProperties;
  /**
   * The type of the page.
   */
  pageType?: string | null;
  /**
   * Output only. The revision ID of the presentation. Can be used in update requests to assert the presentation revision hasn't changed since the last read operation. Only populated if the user has edit access to the presentation. The revision ID is not a sequential number but an opaque string. The format of the revision ID might change over time. A returned revision ID is only guaranteed to be valid for 24 hours after it has been returned and cannot be shared across users. If the revision ID is unchanged between calls, then the presentation has not changed. Conversely, a changed ID (for the same presentation and user) usually means the presentation has been updated. However, a changed ID can also be due to internal factors such as ID format changes.
   */
  revisionId?: string | null;
  /**
   * Slide specific properties. Only set if page_type = SLIDE.
   */
  slideProperties?: unknown; // Schema$SlideProperties;
}

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

export type SlidesTextRangeType =
  // A fixed range. Both the startIndex and endIndex must be specified.
  | "FIXED_RANGE"
  // Starts the range at startIndex and continues until the end of the
  // collection. The endIndex must not be specified.
  | "FROM_START_INDEX"
  | "ALL";

export type SlidesTextRange = {
  startIndex?: number;
  endIndex?: number;
  type: SlidesTextRangeType;
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
  textRange?: SlidesTextRange;
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

/**
 * Update the styling of text in a Shape or Table.
 */
export interface SlidesUpdateTextStyleRequest {
  /**
   * The location of the cell in the table containing the text to style. If `object_id` refers to a table, `cell_location` must have a value. Otherwise, it must not.
   */
  cellLocation?: SlidesTableCellLocation;
  /**
   * The fields that should be updated. At least one field must be specified. The root `style` is implied and should not be specified. A single `"*"` can be used as short-hand for listing every field. For example, to update the text style to bold, set `fields` to `"bold"`. To reset a property to its default value, include its field name in the field mask but leave the field itself unset.
   */
  fields?: string | null;
  /**
   * The object ID of the shape or table with the text to be styled.
   */
  objectId?: string | null;
  /**
   * The style(s) to set on the text. If the value for a particular style matches that of the parent, that style will be set to inherit. Certain text style changes may cause other changes meant to mirror the behavior of the Slides editor. See the documentation of TextStyle for more information.
   */
  style?: SlidesTextStyle;
  /**
   * The range of text to style. The range may be extended to include adjacent newlines. If the range fully contains a paragraph belonging to a list, the paragraph's bullet is also updated with the matching text style.
   */
  textRange?: SlidesRange;
}

/**
 * Represents the styling that can be applied to a TextRun. If this text is contained in a shape with a parent placeholder, then these text styles may be inherited from the parent. Which text styles are inherited depend on the nesting level of lists: * A text run in a paragraph that is not in a list will inherit its text style from the the newline character in the paragraph at the 0 nesting level of the list inside the parent placeholder. * A text run in a paragraph that is in a list will inherit its text style from the newline character in the paragraph at its corresponding nesting level of the list inside the parent placeholder. Inherited text styles are represented as unset fields in this message. If text is contained in a shape without a parent placeholder, unsetting these fields will revert the style to a value matching the defaults in the Slides editor.
 */
export interface SlidesTextStyle {
  /**
   * The background color of the text. If set, the color is either opaque or transparent, depending on if the `opaque_color` field in it is set.
   */
  backgroundColor?: SlidesOptionalColor;
  /**
   * The text's vertical offset from its normal position. Text with `SUPERSCRIPT` or `SUBSCRIPT` baseline offsets is automatically rendered in a smaller font size, computed based on the `font_size` field. The `font_size` itself is not affected by changes in this field.
   */
  baselineOffset?: string | null;
  /**
   * Whether or not the text is rendered as bold.
   */
  bold?: boolean | null;
  /**
   * The font family of the text. The font family can be any font from the Font menu in Slides or from [Google Fonts] (https://fonts.google.com/). If the font name is unrecognized, the text is rendered in `Arial`. Some fonts can affect the weight of the text. If an update request specifies values for both `font_family` and `bold`, the explicitly-set `bold` value is used.
   */
  fontFamily?: string | null;
  /**
   * The size of the text's font. When read, the `font_size` will specified in points.
   */
  fontSize?: SlidesDimension;
  /**
   * The color of the text itself. If set, the color is either opaque or transparent, depending on if the `opaque_color` field in it is set.
   */
  foregroundColor?: SlidesOptionalColor;
  /**
   * Whether or not the text is italicized.
   */
  italic?: boolean | null;
  /**
   * The hyperlink destination of the text. If unset, there is no link. Links are not inherited from parent text. Changing the link in an update request causes some other changes to the text style of the range: * When setting a link, the text foreground color will be set to ThemeColorType.HYPERLINK and the text will be underlined. If these fields are modified in the same request, those values will be used instead of the link defaults. * Setting a link on a text range that overlaps with an existing link will also update the existing link to point to the new URL. * Links are not settable on newline characters. As a result, setting a link on a text range that crosses a paragraph boundary, such as `"ABC\n123"`, will separate the newline character(s) into their own text runs. The link will be applied separately to the runs before and after the newline. * Removing a link will update the text style of the range to match the style of the preceding text (or the default text styles if the preceding text is another link) unless different styles are being set in the same request.
   */
  link?: SlidesLink;
  /**
   * Whether or not the text is in small capital letters.
   */
  smallCaps?: boolean | null;
  /**
   * Whether or not the text is struck through.
   */
  strikethrough?: boolean | null;
  /**
   * Whether or not the text is underlined.
   */
  underline?: boolean | null;
  /**
   * The font family and rendered weight of the text. This field is an extension of `font_family` meant to support explicit font weights without breaking backwards compatibility. As such, when reading the style of a range of text, the value of `weighted_font_family#font_family` will always be equal to that of `font_family`. However, when writing, if both fields are included in the field mask (either explicitly or through the wildcard `"*"`), their values are reconciled as follows: * If `font_family` is set and `weighted_font_family` is not, the value of `font_family` is applied with weight `400` ("normal"). * If both fields are set, the value of `font_family` must match that of `weighted_font_family#font_family`. If so, the font family and weight of `weighted_font_family` is applied. Otherwise, a 400 bad request error is returned. * If `weighted_font_family` is set and `font_family` is not, the font family and weight of `weighted_font_family` is applied. * If neither field is set, the font family and weight of the text inherit from the parent. Note that these properties cannot inherit separately from each other. If an update request specifies values for both `weighted_font_family` and `bold`, the `weighted_font_family` is applied first, then `bold`. If `weighted_font_family#weight` is not set, it defaults to `400`. If `weighted_font_family` is set, then `weighted_font_family#font_family` must also be set with a non-empty value. Otherwise, a 400 bad request error is returned.
   */
  weightedFontFamily?: SlidesWeightedFontFamily;
}

/**
 * Represents a font family and weight used to style a TextRun.
 */
export interface SlidesWeightedFontFamily {
  /**
   * The font family of the text. The font family can be any font from the Font menu in Slides or from [Google Fonts] (https://fonts.google.com/). If the font name is unrecognized, the text is rendered in `Arial`.
   */
  fontFamily?: string | null;
  /**
   * The rendered weight of the text. This field can have any value that is a multiple of `100` between `100` and `900`, inclusive. This range corresponds to the numerical values described in the CSS 2.1 Specification, [section 15.6](https://www.w3.org/TR/CSS21/fonts.html#font-boldness), with non-numerical values disallowed. Weights greater than or equal to `700` are considered bold, and weights less than `700`are not bold. The default value is `400` ("normal").
   */
  weight?: number | null;
}

/**
 * A hypertext link.
 */
export interface SlidesLink {
  /**
   * If set, indicates this is a link to the specific page in this presentation with this ID. A page with this ID may not exist.
   */
  pageObjectId?: string | null;
  /**
   * If set, indicates this is a link to a slide in this presentation, addressed by its position.
   */
  relativeLink?: string | null;
  /**
   * If set, indicates this is a link to the slide at this zero-based index in the presentation. There may not be a slide at this index.
   */
  slideIndex?: number | null;
  /**
   * If set, indicates this is a link to the external web page at this URL.
   */
  url?: string | null;
}
/**
 * A color that can either be fully opaque or fully transparent.
 */
export interface SlidesOptionalColor {
  /**
   * If set, this will be used as an opaque color. If unset, this represents a transparent color.
   */
  opaqueColor?: SlidesOpaqueColor;
}
/**
 * The outline of a PageElement. If these fields are unset, they may be inherited from a parent placeholder if it exists. If there is no parent, the fields will default to the value used for new page elements created in the Slides editor, which may depend on the page element kind.
 */
export interface Schema$Outline {
  /**
   * The dash style of the outline.
   */
  dashStyle?: string | null;
  /**
   * The fill of the outline.
   */
  outlineFill?: SlidesOutlineFill;
  /**
   * The outline property state. Updating the outline on a page element will implicitly update this field to `RENDERED`, unless another value is specified in the same request. To have no outline on a page element, set this field to `NOT_RENDERED`. In this case, any other outline fields set in the same request will be ignored.
   */
  propertyState?: string | null;
  /**
   * The thickness of the outline.
   */
  weight?: SlidesDimension;
}

/**
 * The fill of the outline.
 */
export interface SlidesOutlineFill {
  /**
   * Solid color fill.
   */
  solidFill?: SlidesSolidFill;
}

/**
 * A solid color fill. The page or page element is filled entirely with the specified color value. If any field is unset, its value may be inherited from a parent placeholder if it exists.
 */
export interface SlidesSolidFill {
  /**
   * The fraction of this `color` that should be applied to the pixel. That is, the final pixel color is defined by the equation: pixel color = alpha * (color) + (1.0 - alpha) * (background color) This means that a value of 1.0 corresponds to a solid color, whereas a value of 0.0 corresponds to a completely transparent color.
   */
  alpha?: number | null;
  /**
   * The color value of the solid fill.
   */
  color?: SlidesOpaqueColor;
}

/**
 * A themeable solid color value.
 */
export interface SlidesOpaqueColor {
  /**
   * An opaque RGB color.
   */
  rgbColor?: SlidesRgbColor;
  /**
   * An opaque theme color.
   */
  themeColor?: string | null;
}

/**
 * An RGB color.
 */
export interface SlidesRgbColor {
  /**
   * The blue component of the color, from 0.0 to 1.0.
   */
  blue?: number | null;
  /**
   * The green component of the color, from 0.0 to 1.0.
   */
  green?: number | null;
  /**
   * The red component of the color, from 0.0 to 1.0.
   */
  red?: number | null;
}
/**
 * Specifies a contiguous range of an indexed collection, such as characters in text.
 */
export interface SlidesRange {
  /**
   * The optional zero-based index of the end of the collection. Required for `FIXED_RANGE` ranges.
   */
  endIndex?: number | null;
  /**
   * The optional zero-based index of the beginning of the collection. Required for `FIXED_RANGE` and `FROM_START_INDEX` ranges.
   */
  startIndex?: number | null;
  /**
   * The type of range.
   */
  type?: string | null;
}

export type SlidesRequest =
  | { deleteObject: SlidesDeleteObjectRequest }
  | { createSlide: SlidesCreateSlideRequest }
  | { insertText: SlidesInsertTextRequest }
  | { createParagraphBullets: SlidesCreateParagraphBulletsRequest }
  | { createImage: SlidesCreateImageRequest }
  | { updateTextStyle: SlidesUpdateTextStyleRequest };

const connectionId = "connection:$sign-in";

export type Metadata = {
  title?: string;
  description?: string;
};

export type Method = "GET" | "POST" | "PUT" | "DELETE";

async function get(token: string, id: string, metadata: Metadata) {
  if (!token) {
    return err("Authentication token is required.");
  }
  if (!id) {
    return err("Please supply file id.");
  }
  return api(
    metadata,
    token,
    `https://www.googleapis.com/drive/v3/files/${id}`,
    "GET"
  );
}

async function create(
  token: string,
  body: unknown,
  metadata: Metadata
): Promise<Outcome<CreateFileResponse>> {
  if (!token) {
    return err("Authentication token is required.");
  }
  if (!body) {
    return err("Please supply the body of the file to create.");
  }

  return api(
    metadata,
    token,
    "https://www.googleapis.com/drive/v3/files",
    "POST",
    body
  );
}

async function query(
  token: string,
  query: string,
  metadata: Metadata
): Promise<Outcome<FileQueryResponse>> {
  if (!token) {
    return err("Authentication token is required.");
  }
  if (!query) {
    return err("Please supply the query.");
  }

  return api(
    metadata,
    token,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
    "GET"
  );
}

async function del(token: string, id: string, metadata: Metadata) {
  if (!token) {
    return err("Authentication token is required.");
  }
  if (!id) {
    return err("Please supply the id of the file to delete");
  }

  return api(
    metadata,
    token,
    `https://www.googleapis.com/drive/v3/files/${id}`,
    "DELETE"
  );
}

async function exp(
  token: string,
  fileId: string,
  mimeType: string,
  metadata: Metadata
) {
  if (!token) {
    return err("Authentication token is required.");
  }
  if (!fileId) {
    return err("Please supply the file id to export.");
  }
  return api(
    metadata,
    token,
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${mimeType}`,
    "GET"
  );
}

async function getDoc(token: string, id: string, metadata: Metadata) {
  if (!token) {
    return err("Authentication token is required.");
  }
  if (!id) {
    return err("Please supply the doc id to get.");
  }
  return api(
    metadata,
    token,
    `https://docs.googleapis.com/v1/documents/${id}`,
    "GET"
  );
}

async function updateDoc(
  token: string,
  id: string,
  body: unknown,
  metadata: Metadata
) {
  if (!token) {
    return err("Authentication token is required.");
  }
  if (!id) {
    return err("Please supply the id of the doc to update.");
  }
  if (!body) {
    return err("Please supply the body of the doc update request.");
  }
  return api(
    metadata,
    token,
    `https://docs.googleapis.com/v1/documents/${id}:batchUpdate`,
    "POST",
    body
  );
}

async function getPresentation(
  token: string,
  id: string,
  metadata: Metadata
): Promise<Outcome<SlidesPresentation>> {
  if (!token) {
    return err("Authentication token is required.");
  }
  return api(
    metadata,
    token,
    `https://slides.googleapis.com/v1/presentations/${id}`,
    "GET"
  );
}

async function createPresentation(
  token: string,
  title: string,
  metadata: Metadata
): Promise<Outcome<{ presentationId: string }>> {
  if (!token) {
    return err("Authentication token is required.");
  }
  return api(
    metadata,
    token,
    "https://slides.googleapis.com/v1/presentations",
    "POST",
    { title }
  );
}

async function updatePresentation(
  token: string,
  id: string,
  body: { requests: SlidesRequest[] },
  metadata: Metadata
) {
  if (!token) {
    return err("Authentication token is required.");
  }
  if (!id) {
    return err("Please supply the id of the presentation to update.");
  }
  if (!body) {
    return err("Please supply the body of the presentation update request.");
  }
  return api(
    metadata,
    token,
    `https://slides.googleapis.com/v1/presentations/${id}:batchUpdate`,
    "POST",
    body
  );
}

async function connect(metadata: Metadata) {
  const { [connectionId]: token } = await secrets({
    ...meta(metadata),
    keys: [connectionId],
  });
  return token;
}

async function createMultipart(
  token: string,
  metadata: unknown,
  body: unknown,
  mimeType: string,
  $metadata: Metadata
): Promise<Outcome<{ id: string }>> {
  const boundary = "BB-BB-BB-BB-BB-BB";
  const url = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
  const request: FetchInputs = {
    ...meta($metadata),
    url,
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ["Content-Type"]: `multipart/related; boundary=${boundary}`,
    },
    body: `--${boundary}
Content-Type: application/json; charset=UTF-8

${JSON.stringify(metadata, null, 2)}
--${boundary}
Content-Type: ${mimeType}; charset=UTF-8
Content-Transfer-Encoding: base64

${body}
--${boundary}--`,
  };
  const { response, $error } = await fetch(request);
  if ($error) {
    return err(typeof $error === "string" ? $error : JSON.stringify($error));
  }
  return response as { id: string };
}

export type Permission = {
  id?: string;
  displayName?: string;
  type?: string;
  kind?: string;
  permissionDetails?: [
    {
      permissionType?: string;
      inheritedFrom?: string;
      role?: string;
      inherited?: boolean;
    },
  ];
  photoLink?: string;
  emailAddress?: string;
  role?: string;
  allowFileDiscovery?: boolean;
  domain?: string;
  expirationTime?: string;
  teamDrivePermissionDetails?: [
    {
      teamDrivePermissionType: string;
      inheritedFrom: string;
      role: string;
      inherited: boolean;
    },
  ];
  deleted?: boolean;
  view?: string;
  pendingOwner?: boolean;
};

async function createPermission(
  token: string,
  fileId: string,
  permission: Permission,
  metadata: Metadata
): Promise<Outcome<Permission>> {
  return api(
    metadata,
    token,
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    "POST",
    permission
  );
}

async function api<T>(
  metadata: Metadata,
  token: string,
  url: string,
  method: Method,
  body: unknown | null = null
): Promise<Outcome<T>> {
  const request: FetchInputs = {
    ...meta(metadata),
    url,
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
  if (body) {
    request.body = body;
  }
  const { response, $error } = await fetch(request);
  if ($error) {
    return err(typeof $error === "string" ? $error : JSON.stringify($error));
  }
  return response as T;
}

function meta({ title, description }: Metadata = {}) {
  if (!(title || description)) return {};
  const $metadata: Metadata = {};
  if (title) {
    $metadata.title = title;
  }
  if (description) {
    $metadata.description = description;
  }
  return { $metadata };
}
