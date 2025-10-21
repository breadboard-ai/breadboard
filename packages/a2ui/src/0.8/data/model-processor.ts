/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalMap } from "signal-utils/map";
import {
  A2UIProtocolMessage,
  AnyComponentNode,
  BeginRenderingMessage,
  DataArray,
  DataMap,
  DataModelUpdate,
  DataValue,
  DeleteSurfaceMessage,
  ResolvedMap,
  ResolvedValue,
  Surface,
  SurfaceID,
  SurfaceUpdateMessage,
} from "../types/types";
import { SignalSet } from "signal-utils/set";
import { SignalObject } from "signal-utils/object";
import { SignalArray } from "signal-utils/array";
import {
  isComponentArrayReference,
  isObject,
  isPath,
  isResolvedAudioPlayer,
  isResolvedButton,
  isResolvedCard,
  isResolvedCheckbox,
  isResolvedColumn,
  isResolvedDateTimeInput,
  isResolvedDivider,
  isResolvedHeading,
  isResolvedImage,
  isResolvedList,
  isResolvedModal,
  isResolvedMultipleChoice,
  isResolvedRow,
  isResolvedSlider,
  isResolvedTabs,
  isResolvedText,
  isResolvedTextField,
  isResolvedVideo,
} from "./guards.js";
import { deep } from "signal-utils/deep";

/**
 * Processes and consolidates A2UIProtocolMessage objects into a
 * structured, hierarchical model of UI surfaces.
 */
export class A2UIModelProcessor {
  static readonly DEFAULT_SURFACE_ID = "@default";

  #currentSurface = A2UIModelProcessor.DEFAULT_SURFACE_ID;
  #surfaces: Map<SurfaceID, Surface> = new SignalMap();
  #styles: Record<string, unknown> = {};

  getSurfaces(): ReadonlyMap<string, Surface> {
    return this.#surfaces;
  }

  getStyles(): Readonly<Record<string, unknown>> {
    return this.#styles;
  }

  clearSurfaces() {
    this.#surfaces.clear();
  }

  processMessages(messages: A2UIProtocolMessage[]): void {
    this.#currentSurface = A2UIModelProcessor.DEFAULT_SURFACE_ID;

    for (const message of messages) {
      if (message.surfaceId) {
        this.#currentSurface = message.surfaceId;
      }

      if (message.beginRendering) {
        this.#handleBeginRendering(
          message.beginRendering,
          this.#currentSurface
        );
      }

      if (message.surfaceUpdate) {
        this.#handleSurfaceUpdate(message.surfaceUpdate, this.#currentSurface);
      }

      if (message.dataModelUpdate) {
        this.#handleDataModelUpdate(
          message.dataModelUpdate,
          this.#currentSurface
        );
      }

      if (message.deleteSurface) {
        this.#handleDeleteSurface(message.deleteSurface);
      }
    }

    this.#currentSurface = A2UIModelProcessor.DEFAULT_SURFACE_ID;
  }

  /**
   * Retrieves the data for a given component node and a relative path string.
   * This correctly handles the special `.` path, which refers to the node's
   * own data context.
   */
  getData(
    node: AnyComponentNode,
    relativePath: string,
    surfaceId = A2UIModelProcessor.DEFAULT_SURFACE_ID
  ): DataValue | null {
    const surface = this.#surfaces.get(surfaceId);
    if (!surface) return null;

    let finalPath: string;

    // The special `.` path means the final path is the node's data context
    // path and so we return the dataContextPath as-is.
    if (relativePath === ".") {
      finalPath = node.dataContextPath ?? "/";
    } else {
      // For all other paths, resolve them against the node's context.
      finalPath = this.resolvePath(relativePath, node.dataContextPath);
    }

    return this.#getDataByPath(surface.dataModel, finalPath);
  }

  getDataByPath(path: string, surfaceId: SurfaceID | null = null) {
    if (!surfaceId) {
      surfaceId = A2UIModelProcessor.DEFAULT_SURFACE_ID;
    }
    const surface = this.#getOrCreateSurface(surfaceId);
    if (!surface) {
      return null;
    }

    return this.#getDataByPath(surface.dataModel, path) ?? null;
  }

  setDataByPath(
    path: string,
    value: DataValue,
    surfaceId = A2UIModelProcessor.DEFAULT_SURFACE_ID
  ) {
    const surface = this.#getOrCreateSurface(surfaceId);
    if (!surface) {
      return null;
    }

    return this.#setDataByPath(surface.dataModel, path, value);
  }

  resolvePath(path: string, dataContextPath?: string): string {
    // If the path is absolute, it overrides any context.
    if (path.startsWith("/")) {
      return path;
    }

    if (dataContextPath && dataContextPath !== "/") {
      // Ensure there's exactly one slash between the context and the path.
      return dataContextPath.endsWith("/")
        ? `${dataContextPath}${path}`
        : `${dataContextPath}/${path}`;
    }

    // Fallback for no context or root context: make it an absolute path.
    return `/${path}`;
  }

  /**
   * Converts a specific array format [{key: "...", value_string: "..."}, ...]
   * into a standard Map. It also attempts to parse any string values that
   * appear to be stringified JSON.
   */
  #convertKeyValueArrayToMap(arr: DataArray): DataMap {
    const map = new SignalMap<string, DataValue>();
    for (const item of arr) {
      if (!isObject(item) || !("key" in item)) continue;

      const key = item.key as string;

      // Find the value, which is in a property prefixed with "value_".
      const valueKey = Object.keys(item).find((k) => k.startsWith("value_"));
      if (!valueKey) continue;

      let value = item[valueKey];

      // Attempt to parse the value if it's a JSON string.
      if (typeof value === "string") {
        const trimmedValue = value.trim();
        if (
          (trimmedValue.startsWith("{") && trimmedValue.endsWith("}")) ||
          (trimmedValue.startsWith("[") && trimmedValue.endsWith("]"))
        ) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // It looked like JSON but wasn't. Keep the original string.
            console.warn(
              `Failed to parse potential JSON string for key "${key}":`,
              e
            );
          }
        }
      }

      this.#setDataByPath(map, key, value);
    }
    return map;
  }

  #setDataByPath(root: DataMap, path: string, value: DataValue): void {
    const segments = this.#normalizePath(path)
      .split("/")
      .filter((s) => s);
    if (segments.length === 0) {
      // Check if the incoming value is the special key-value array format.
      if (
        Array.isArray(value) &&
        value.length > 0 &&
        isObject(value[0]) &&
        "key" in value[0]
      ) {
        value = this.#convertKeyValueArrayToMap(value);
      }

      // Root data can either be a Map or an Object. If we receive an Object,
      // however, we will normalize it to a proper Map.
      if (value instanceof Map || isObject(value)) {
        // Normalize an Object to a Map.
        if (!(value instanceof Map) && isObject(value)) {
          value = new SignalMap(Object.entries(value));
        }

        root.clear();
        for (const [key, v] of value.entries()) {
          root.set(key, v);
        }
      } else {
        console.error("Cannot set root of DataModel to a non-Map value.");
      }
      return;
    }

    let current: DataMap | DataArray = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      let target: DataValue | undefined;

      if (current instanceof Map) {
        target = current.get(segment);
      } else if (Array.isArray(current) && /^\d+$/.test(segment)) {
        target = current[parseInt(segment, 10)];
      }

      if (
        target === undefined ||
        typeof target !== "object" ||
        target === null
      ) {
        const targetIsArray = /^\d+$/.test(segments[i + 1]);
        target = targetIsArray ? new SignalArray() : new SignalMap();
        if (current instanceof Map) {
          current.set(segment, target);
        } else if (Array.isArray(current)) {
          current[parseInt(segment, 10)] = target;
        }
      }
      current = target as DataMap | DataArray;
    }

    const finalSegment = segments[segments.length - 1];
    const storedValue = deep(value);
    if (current instanceof Map) {
      current.set(finalSegment, storedValue);
    } else if (Array.isArray(current) && /^\d+$/.test(finalSegment)) {
      current[parseInt(finalSegment, 10)] = storedValue;
    }
  }

  /**
   * Normalizes a path string into a consistent, slash-delimited format.
   * Converts bracket notation and dot notation in a two-pass.
   * e.g., "bookRecommendations[0].title" -> "/bookRecommendations/0/title"
   * e.g., "book.0.title" -> "/book/0/title"
   */
  #normalizePath(path: string): string {
    // 1. Replace all bracket accessors `[index]` with dot accessors `.index`
    const dotPath = path.replace(/\[(\d+)\]/g, ".$1");

    // 2. Split by dots
    const segments = dotPath.split(".");

    // 3. Join with slashes and ensure it starts with a slash
    return "/" + segments.filter((s) => s.length > 0).join("/");
  }

  #getDataByPath(root: DataMap, path: string): DataValue | null {
    const segments = this.#normalizePath(path)
      .split("/")
      .filter((s) => s);

    let current: DataValue = root;
    for (const segment of segments) {
      if (current === undefined || current === null) return null;

      if (current instanceof Map) {
        current = current.get(segment) as DataMap;
      } else if (Array.isArray(current) && /^\d+$/.test(segment)) {
        current = current[parseInt(segment, 10)];
      } else if (isObject(current)) {
        current = current[segment];
      } else {
        // If we need to traverse deeper but `current` is a primitive, the path is invalid.
        return null;
      }
    }
    return current;
  }

  #getOrCreateSurface(surfaceId: string): Surface {
    let surface: Surface | undefined = this.#surfaces.get(surfaceId);
    if (!surface) {
      surface = new SignalObject({
        rootComponentId: null,
        componentTree: null,
        dataModel: new SignalMap(),
        components: new SignalMap(),
      }) as Surface;

      this.#surfaces.set(surfaceId, surface);
    }

    return surface;
  }

  #handleBeginRendering(
    message: BeginRenderingMessage,
    surfaceId: SurfaceID
  ): void {
    const surface = this.#getOrCreateSurface(surfaceId);
    surface.rootComponentId = message.root;
    this.#styles = message.styles ?? {};
    this.#rebuildComponentTree(surface);
  }

  #handleSurfaceUpdate(
    message: SurfaceUpdateMessage,
    surfaceId: SurfaceID
  ): void {
    const surface = this.#getOrCreateSurface(surfaceId);
    for (const component of message.components) {
      surface.components.set(component.id, component);
    }
    this.#rebuildComponentTree(surface);
  }

  #handleDataModelUpdate(message: DataModelUpdate, surfaceId: SurfaceID): void {
    const surface = this.#getOrCreateSurface(surfaceId);
    const path = message.path ?? "/";
    this.#setDataByPath(surface.dataModel, path, message.contents);
    this.#rebuildComponentTree(surface);
  }

  #handleDeleteSurface(message: DeleteSurfaceMessage): void {
    this.#surfaces.delete(message.surfaceId);
  }

  /**
   * Starts at the root component of the surface and builds out the tree
   * recursively. This process involves resolving all properties of the child
   * components, and expanding on any explicit children lists or templates
   * found in the structure.
   *
   * @param surface The surface to be built.
   */
  #rebuildComponentTree(surface: Surface): void {
    if (!surface.rootComponentId) {
      surface.componentTree = null;
      return;
    }

    // Track visited nodes to avoid circular references.
    const visited = new SignalSet<string>();
    surface.componentTree = this.#buildNodeRecursive(
      surface.rootComponentId,
      surface,
      visited,
      "/"
    );
  }

  /**
   * Builds out the nodes recursively.
   */
  #buildNodeRecursive(
    componentId: string,
    surface: Surface,
    visited: Set<string>,
    dataContextPath: string
  ): AnyComponentNode | null {
    const baseComponentId = componentId.split(":").at(0) ?? "";
    const { components } = surface;

    if (!components.has(baseComponentId)) {
      return null;
    }

    if (visited.has(componentId)) {
      throw new Error(`Circular dependency for component "${componentId}".`);
    }

    visited.add(componentId);

    const componentData = components.get(baseComponentId)!;
    const componentType = Object.keys(componentData.component)[0];
    const unresolvedProperties = componentData.componentProperties
      ? componentData.componentProperties[
          componentType as keyof typeof componentData.componentProperties
        ]
      : componentData.component[
          componentType as keyof typeof componentData.component
        ];

    // Manually build the resolvedProperties object by resolving each value in
    // the component's properties.
    const resolvedProperties: ResolvedMap = new SignalObject();
    if (isObject(unresolvedProperties)) {
      for (const [key, value] of Object.entries(unresolvedProperties)) {
        resolvedProperties[key] = this.#resolvePropertyValue(
          value,
          surface,
          visited,
          dataContextPath
        );
      }
    }

    visited.delete(componentId);

    // Now that we have the resolved properties in place we can go ahead and
    // ensure that they meet expectations in terms of types and so forth,
    // casting them into the specific shape for usage.
    const baseNode = { id: componentId, dataContextPath };
    switch (componentType) {
      case "Heading":
        if (!isResolvedHeading(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "Heading",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Text":
        if (!isResolvedText(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "Text",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Image":
        if (!isResolvedImage(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "Image",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Video":
        if (!isResolvedVideo(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "Video",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "AudioPlayer":
        if (!isResolvedAudioPlayer(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "AudioPlayer",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Row":
        if (!isResolvedRow(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }

        return new SignalObject({
          ...baseNode,
          type: "Row",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Column":
        if (!isResolvedColumn(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }

        return new SignalObject({
          ...baseNode,
          type: "Column",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "List":
        if (!isResolvedList(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "List",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Card":
        if (!isResolvedCard(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "Card",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Tabs":
        if (!isResolvedTabs(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "Tabs",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Divider":
        if (!isResolvedDivider(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "Divider",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Modal":
        if (!isResolvedModal(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "Modal",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Button":
        if (!isResolvedButton(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "Button",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "CheckBox":
        if (!isResolvedCheckbox(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "Checkbox",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "TextField":
        if (!isResolvedTextField(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "TextField",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "DateTimeInput":
        if (!isResolvedDateTimeInput(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "DateTimeInput",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "MultipleChoice":
        if (!isResolvedMultipleChoice(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "MultipleChoice",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Slider":
        if (!isResolvedSlider(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new SignalObject({
          ...baseNode,
          type: "Slider",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      default:
        throw new Error(`Unknown component type: "${componentType}"`);
    }
  }

  /**
   * Recursively resolves an individual property value. If a property indicates
   * a child node (a string that matches a component ID), an explicitList of
   * children, or a template, these will be built out here.
   */
  #resolvePropertyValue(
    value: unknown,
    surface: Surface,
    visited: Set<string>,
    dataContextPath: string
  ): ResolvedValue {
    // 1. If it's a string that matches a component ID, build that node.
    if (typeof value === "string" && surface.components.has(value)) {
      return this.#buildNodeRecursive(value, surface, visited, dataContextPath);
    }

    // 2. If it's a ComponentArrayReference (e.g., a `children` property),
    //    resolve the list and return an array of nodes.
    if (isComponentArrayReference(value)) {
      if (value.explicitList) {
        return value.explicitList.map((id) =>
          this.#buildNodeRecursive(id, surface, visited, dataContextPath)
        );
      }

      if (value.template) {
        const fullDataPath = this.resolvePath(
          value.template.dataBinding,
          dataContextPath
        );
        const data = this.#getDataByPath(surface.dataModel, fullDataPath);

        const template = value.template;
        if (Array.isArray(data)) {
          return data.map((_, index) => {
            const parentIndices = dataContextPath
              .split("/")
              .filter((segment) => /^\d+$/.test(segment));

            const newIndices = [...parentIndices, index];
            const syntheticId = `${template.componentId}:${newIndices.join(":")}`;
            const childDataContextPath = `${fullDataPath}/${index}`;

            return this.#buildNodeRecursive(
              syntheticId,
              surface,
              visited,
              childDataContextPath
            );
          });
        }

        // Return empty array if the data is not ready yet.
        return new SignalArray();
      }
    }

    // 3. If it's a plain array, resolve each of its items.
    if (Array.isArray(value)) {
      return value.map((item) =>
        this.#resolvePropertyValue(item, surface, visited, dataContextPath)
      );
    }

    // 4. If it's a plain object, resolve each of its properties.
    if (isObject(value)) {
      const newObj: ResolvedMap = new SignalObject();
      for (const [key, propValue] of Object.entries(value)) {
        // Special case for paths. Here we might get /item/ or ./ on the front
        // of the path which isn't what we want. In this case we check the
        // dataContextPath and if 1) it's not the default and 2) we also see the
        // path beginning with /item/ or ./we trim it.
        let propertyValue = propValue;
        if (isPath(key, propValue) && dataContextPath !== "/") {
          propertyValue = propValue
            .replace(/^\.?\/item/, "")
            .replace(/^\.?\//, "");
          newObj[key] = propertyValue as ResolvedValue;
          continue;
        }

        newObj[key] = this.#resolvePropertyValue(
          propertyValue,
          surface,
          visited,
          dataContextPath
        );
      }
      return newObj;
    }

    // 5. Otherwise, it's a primitive value.
    return value as ResolvedValue;
  }
}
