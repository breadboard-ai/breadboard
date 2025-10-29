/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import {
  ServerToClientMessage,
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
  isResolvedIcon,
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

/**
 * Processes and consolidates A2UIProtocolMessage objects into a structured,
 * hierarchical model of UI surfaces.
 */
export class A2UIModelProcessor {
  static readonly DEFAULT_SURFACE_ID = "@default";

  #mapCtor: MapConstructor = Map;
  #arrayCtor: ArrayConstructor = Array;
  #setCtor: SetConstructor = Set;
  #objCtor: ObjectConstructor = Object;
  #surfaces: Map<SurfaceID, Surface>;

  constructor(
    readonly opts: {
      mapCtor: MapConstructor;
      arrayCtor: ArrayConstructor;
      setCtor: SetConstructor;
      objCtor: ObjectConstructor;
    } = { mapCtor: Map, arrayCtor: Array, setCtor: Set, objCtor: Object }
  ) {
    this.#arrayCtor = opts.arrayCtor;
    this.#mapCtor = opts.mapCtor;
    this.#setCtor = opts.setCtor;
    this.#objCtor = opts.objCtor;

    this.#surfaces = new opts.mapCtor();
  }

  getSurfaces(): ReadonlyMap<string, Surface> {
    return this.#surfaces;
  }

  clearSurfaces() {
    this.#surfaces.clear();
  }

  processMessages(messages: ServerToClientMessage[]): void {
    for (const message of messages) {
      if (message.beginRendering) {
        this.#handleBeginRendering(
          message.beginRendering,
          message.beginRendering.surfaceId
        );
      }

      if (message.surfaceUpdate) {
        this.#handleSurfaceUpdate(
          message.surfaceUpdate,
          message.surfaceUpdate.surfaceId
        );
      }

      if (message.dataModelUpdate) {
        this.#handleDataModelUpdate(
          message.dataModelUpdate,
          message.dataModelUpdate.surfaceId
        );
      }

      if (message.deleteSurface) {
        this.#handleDeleteSurface(message.deleteSurface);
      }
    }
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
    const surface = this.#getOrCreateSurface(surfaceId);
    if (!surface) return null;

    let finalPath: string;

    // The special `.` path means the final path is the node's data context
    // path and so we return the dataContextPath as-is.
    if (relativePath === "." || relativePath === "") {
      finalPath = node.dataContextPath ?? "/";
    } else {
      // For all other paths, resolve them against the node's context.
      finalPath = this.resolvePath(relativePath, node.dataContextPath);
    }

    return this.#getDataByPath(surface.dataModel, finalPath);
  }

  setData(
    node: AnyComponentNode | null,
    relativePath: string,
    value: DataValue,
    surfaceId = A2UIModelProcessor.DEFAULT_SURFACE_ID
  ): void {
    if (!node) {
      console.warn("No component node set");
      return;
    }

    const surface = this.#getOrCreateSurface(surfaceId);
    if (!surface) return;

    let finalPath: string;

    // The special `.` path means the final path is the node's data context
    // path and so we return the dataContextPath as-is.
    if (relativePath === "." || relativePath === "") {
      finalPath = node.dataContextPath ?? "/";
    } else {
      // For all other paths, resolve them against the node's context.
      finalPath = this.resolvePath(relativePath, node.dataContextPath);
    }

    this.#setDataByPath(surface.dataModel, finalPath, value);
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

  #parseIfJsonString(value: DataValue): DataValue {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    if (
      (trimmedValue.startsWith("{") && trimmedValue.endsWith("}")) ||
      (trimmedValue.startsWith("[") && trimmedValue.endsWith("]"))
    ) {
      try {
        // It looks like JSON, attempt to parse it.
        return JSON.parse(value);
      } catch (e) {
        // It looked like JSON but wasn't. Keep the original string.
        console.warn(
          `Failed to parse potential JSON string: "${value.substring(
            0,
            50
          )}..."`,
          e
        );
        return value; // Return original string
      }
    }

    // It's a string, but not JSON-like.
    return value;
  }

  /**
   * Converts a specific array format [{key: "...", value_string: "..."}, ...]
   * into a standard Map. It also attempts to parse any string values that
   * appear to be stringified JSON.
   */
  #convertKeyValueArrayToMap(arr: DataArray): DataMap {
    const map = new this.#mapCtor<string, DataValue>();
    for (const item of arr) {
      if (!isObject(item) || !("key" in item)) continue;

      const key = item.key as string;

      // Find the value, which is in a property prefixed with "value".
      const valueKey = this.#findValueKey(item);
      if (!valueKey) continue;

      let value: DataValue = item[valueKey];
      // It's a valueMap. We must recursively convert it.
      if (valueKey === "valueMap" && Array.isArray(value)) {
        value = this.#convertKeyValueArrayToMap(value);
      } else if (typeof value === "string") {
        value = this.#parseIfJsonString(value);
      }

      this.#setDataByPath(map, key, value);
    }
    return map;
  }

  #setDataByPath(root: DataMap, path: string, value: DataValue): void {
    // Check if the incoming value is the special key-value array format.
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      isObject(value[0]) &&
      "key" in value[0]
    ) {
      value = this.#convertKeyValueArrayToMap(value);
    }

    const segments = this.#normalizePath(path)
      .split("/")
      .filter((s) => s);
    if (segments.length === 0) {
      // Root data can either be a Map or an Object. If we receive an Object,
      // however, we will normalize it to a proper Map.
      if (value instanceof Map || isObject(value)) {
        // Normalize an Object to a Map.
        if (!(value instanceof Map) && isObject(value)) {
          value = new this.#mapCtor(Object.entries(value));
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
        target = targetIsArray ? new this.#arrayCtor() : new this.#mapCtor();
        if (current instanceof Map) {
          current.set(segment, target);
        } else if (Array.isArray(current)) {
          current[parseInt(segment, 10)] = target;
        }
      }
      current = target as DataMap | DataArray;
    }

    const finalSegment = segments[segments.length - 1];
    const storedValue = value;
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
      surface = new this.#objCtor({
        rootComponentId: null,
        componentTree: null,
        dataModel: new this.#mapCtor(),
        components: new this.#mapCtor(),
        styles: new this.#objCtor(),
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
    surface.styles = message.styles ?? {};
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
    const visited = new this.#setCtor<string>();
    surface.componentTree = this.#buildNodeRecursive(
      surface.rootComponentId,
      surface,
      visited,
      "/"
    );
  }

  /** Finds a value key in a map. */
  #findValueKey(value: Record<string, unknown>): string | undefined {
    return Object.keys(value).find((k) => k.startsWith("value"));
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
    const componentProps = componentData.component ?? {};
    const componentType = Object.keys(componentProps)[0];
    const unresolvedProperties =
      componentProps[componentType as keyof typeof componentProps];

    // Manually build the resolvedProperties object by resolving each value in
    // the component's properties.
    const resolvedProperties: ResolvedMap = new this.#objCtor() as ResolvedMap;
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
    const baseNode = {
      id: componentId,
      dataContextPath,
      weight: componentData.weight ?? "initial",
    };
    switch (componentType) {
      case "Heading":
        if (!isResolvedHeading(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "Heading",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Text":
        if (!isResolvedText(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "Text",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Image":
        if (!isResolvedImage(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "Image",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Icon":
        if (!isResolvedIcon(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "Icon",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Video":
        if (!isResolvedVideo(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "Video",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "AudioPlayer":
        if (!isResolvedAudioPlayer(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "AudioPlayer",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Row":
        if (!isResolvedRow(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }

        return new this.#objCtor({
          ...baseNode,
          type: "Row",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Column":
        if (!isResolvedColumn(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }

        return new this.#objCtor({
          ...baseNode,
          type: "Column",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "List":
        if (!isResolvedList(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "List",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Card":
        if (!isResolvedCard(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "Card",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Tabs":
        if (!isResolvedTabs(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "Tabs",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Divider":
        if (!isResolvedDivider(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "Divider",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Modal":
        if (!isResolvedModal(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "Modal",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Button":
        if (!isResolvedButton(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "Button",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "CheckBox":
        if (!isResolvedCheckbox(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "Checkbox",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "TextField":
        if (!isResolvedTextField(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "TextField",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "DateTimeInput":
        if (!isResolvedDateTimeInput(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "DateTimeInput",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "MultipleChoice":
        if (!isResolvedMultipleChoice(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: "MultipleChoice",
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case "Slider":
        if (!isResolvedSlider(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
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
            const syntheticId = `${template.componentId}:${newIndices.join(
              ":"
            )}`;
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
        return new this.#arrayCtor();
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
      const newObj: ResolvedMap = new this.#objCtor() as ResolvedMap;
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
