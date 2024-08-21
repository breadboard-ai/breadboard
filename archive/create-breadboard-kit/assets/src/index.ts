import { InputValues } from "@google-labs/breadboard";
import { KitBuilder } from "@google-labs/breadboard/kits";

/*
  This is the simplest possible kit. It just echos the input value.
*/
const echo = async (value: InputValues) => {
  return value;
}

export const MyKit = new KitBuilder({
	url: "npm:NAME",
}).build({
	echo
});

export type MyKit = InstanceType<typeof MyKit>;
export default MyKit;