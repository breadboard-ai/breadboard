import { code } from "@google-labs/core-kit";
import { CodeOutputConfig } from "../../../core-kit/dist/src/nodes/code";
import { BreadboardType, JsonSerializable } from "@breadboard-ai/build/internal/type-system/type.js";
import { Input } from "@breadboard-ai/build/internal/board/input.js";
import { OutputPort } from "@breadboard-ai/build/internal/common/port.js";

export function createSpreadCode<T extends Record<string, BreadboardType | CodeOutputConfig>>(obj: Input<object & JsonSerializable> | OutputPort<JsonSerializable>, returnType: T) {
    const spread = code(
        {
            $id: "spread",
            $metadata: {
                title: "Spread",
                description: "Spread the properties of an object into a new object",
            },
            obj
        },
        returnType,
        ({ obj }) => {
            if (typeof obj !== "object") {
                throw new Error(`object is of type ${typeof obj} not object`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return { ...obj } as any;

        }
    );
    return spread
}