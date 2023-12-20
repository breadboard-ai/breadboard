import { Board } from "@google-labs/breadboard";
import test from "ava";
import MyKit from "../src/index.js";

// This tests the default echo node in the kit.
test("echo", async (t) => {
	const board = new Board({
		title: "Test Echo",
		description: "Test Breadboard Kit",
		version: "0.0.1",
	});

	const myKit = board.addKit(MyKit);

	const input = board.input({
		$id: "input",
		schema: {
			type: "object",
			properties: {
				text: {
					type: "string",
					title: "echo",
					description: "What would you like me to say back to you?",
				},
			},
		},
	});

	const echo = myKit.echo();

	input.wire("an_input->", echo);
	echo.wire("an_input->an_output", board.output());

	const output = await board.runOnce({
		"an_input": "hello world"
	});

	t.is((<string>output["an_output"]), "hello world");
});