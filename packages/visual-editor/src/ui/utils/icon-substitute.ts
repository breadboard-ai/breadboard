/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Ideally we update the icons so this isn't necessary
 *
 * @deprecated
 */
export function iconSubstitute(
  src: string | undefined | null
): string | undefined | null {
  if (
    src &&
    typeof src === "string" &&
    src.startsWith("application/vnd.google-apps.")
  ) {
    switch (src) {
      case "application/vnd.google-apps.spreadsheet":
        return "sheets";
      case "application/vnd.google-apps.document":
        return "docs";
      case "application/vnd.google-apps.presentation":
        return "drive_presentation";
      case "application/vnd.google-apps.drawing":
        return "draw";
      case "application/vnd.google-apps.folder":
        return "folder";
      default:
        return "drive";
    }
  }

  switch (src) {
    case "content":
      return "text_fields";
    case "generative-text":
    case "generative":
      return "spark";
    case "ask-user":
      return "chat_mirror";
    case "map-search":
      return "map_search";
    case "web-search":
      return "search";
    case "file":
      return "upload";
    case "gdrive":
      return "drive";
    case "drawable":
      return "draw";
    case "notebooklm":
      return "notebooklm";
    case "webcam-video":
      return "videocam";
    case "youtube":
      return "video_youtube";
    case "display":
    case "output":
      return "responsive_layout";
    default:
      return src;
  }
}
