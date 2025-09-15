/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalMap } from "signal-utils/map";
import * as example from "./data/example.json" assert { type: "json" };
import {
  Component,
  ComponentInstanceRef,
  ComponentTemplateRef,
  DataModel,
  DataModelObjectValue,
  ExpandedGULF,
  ExpandedGULFValue,
  GULF,
} from "./types/types";
import * as UI from "./ui/ui.js";
import { getData, setData } from "./utils/utils";
import { deep } from "signal-utils/deep";

interface NewDogInfo {
  name?: string;
  legs?: number;
  abilities?: string[];
}

function generateNewDogInfo({ name, legs, abilities }: NewDogInfo) {
  if (!name) {
    name = "A dog with no name";
  }

  if (!legs) {
    legs = 0;
  }

  const abilityList = abilities ? abilities?.join(",") : "No abilities";
  return `You created a "${name}" with ${legs} leg${legs !== 1 ? "s" : ""} and the following abilities: ${abilityList}`;
}

function inflate(data: GULF): ExpandedGULF | null {
  const gulfData: GULF = {
    components: structuredClone(data.components),
    dataModel: structuredClone(data.dataModel),
    root: structuredClone(data.root),
  };

  function getComponent(id: string) {
    return data.components.find((c) => c.id === id);
  }

  gulfData.dataModel = deep(data.dataModel) as DataModel;

  function innerInflate(
    id = "root",
    component: Component,
    dataModel: DataModelObjectValue,
    target: ExpandedGULF
  ) {
    const trimmedComponent = structuredClone(component);
    delete trimmedComponent.child;
    delete trimmedComponent.children;

    const value: ExpandedGULFValue = {
      data: dataModel,
      component: trimmedComponent,
      children: new SignalMap(),
    };

    if ("child" in component) {
      const child = component.child as ComponentInstanceRef;
      const childComponent = getComponent(child);
      if (childComponent) {
        innerInflate(child, childComponent, dataModel, value.children);
      }
    } else if ("children" in component) {
      if (Array.isArray(component.children)) {
        // Inlined.
        const children = component.children as ComponentInstanceRef[];
        for (const childComponentId of children) {
          const childComponent = getComponent(childComponentId);
          if (childComponent) {
            innerInflate(
              childComponentId,
              childComponent,
              dataModel,
              value.children
            );
          }
        }
      } else {
        // Data bound.
        const ref = component.children as ComponentTemplateRef;
        const binding = ref.dataBinding;
        const data = getData(dataModel, binding);
        const tmpl = getComponent(ref.template);

        if (Array.isArray(data) && tmpl) {
          for (const dataContext of data) {
            const newId = globalThis.crypto.randomUUID();
            innerInflate(newId, tmpl, dataContext, value.children);
          }
        } else {
          console.warn("Received binding for non-array", ref.dataBinding);
        }
      }
    }

    target.set(id, value);
  }

  const root = getComponent(gulfData.root);
  if (!root) {
    return null;
  }

  const gulf: ExpandedGULF = new SignalMap();
  innerInflate(gulfData.root, root, gulfData.dataModel, gulf);
  return gulf;
}

function build(root: ExpandedGULF | null) {
  if (!root) {
    return;
  }

  for (const [id, value] of root) {
    const el = new UI.Root();
    el.id = id;
    el.gulfChildren = value.children;
    document.body.appendChild(el);
  }
}

function main() {
  const gulf = inflate(example as GULF);
  build(gulf);

  document.body.addEventListener("gulfevent", (evt) => {
    switch (evt.detail.action.action) {
      case "generateDog": {
        const obj: NewDogInfo = {
          name: "",
          legs: 4,
          abilities: [],
        };

        if (evt.detail.action.dynamicContext) {
          for (const [key, value] of Object.entries(
            evt.detail.action.dynamicContext
          )) {
            const dogKey: keyof NewDogInfo = key as unknown as keyof NewDogInfo;
            const dogValue = getData(example.dataModel, value);
            if (dogValue === null) {
              continue;
            }

            // @ts-expect-error Types not matched.
            obj[dogKey] = dogValue;
          }
        }

        // Set the data for the dog.
        setData(
          gulf?.get("root-list")?.data,
          "/generatedContent/description",
          generateNewDogInfo(obj)
        );

        console.log(gulf?.get("root-list")?.data);
        break;
      }
    }
  });
}

main();
