import { Board } from "@google-labs/breadboard";
import test from "ava";

import MyKit from "../src/index.js";

test("addKit", async (t) => {
	const board = new Board({
		title: "Test Board",
		description: "Testing Breadboard Kit",
		version: "0.0.1",
	});

	board.addKit(MyKit);

	const query = board.input({
		$id: "input",
		schema: {
			type: "object",
			properties: {
				text: {
					type: "string",
					title: "Echo",
					description: "What shall I say back to you?",
				},
			},
		},
	});

	query.wire("text->text", board.output());
	t.pass(); // Replies start with a space.
});