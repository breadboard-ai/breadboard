```typescript
import { base, board, code } from "@google-labs/breadboard";

// Created outside board
const split = code(({ toSplit }) => {
	if (typeof toSplit !== "string") return {};
	return { split: toSplit.split("") };
});

const reverserBoard = board(() => {
	const input = base.input();
	const output = base.output();

	const splitNode = split();
	input.message.as("toSplit").to(splitNode);

	// Created inside board
	const reverse = code(({ toReverse }) => {
		if (!Array.isArray(toReverse)) return {};
		return { reversed: toReverse.reverse() };
	});

	const reverseNode = reverse();
	splitNode.split.as("toReverse").to(reverseNode);

	// Anonymous
	const concat = reverseNode.reversed.as("arr").to(
		code(({ arr }) => {
			if (!Array.isArray(arr)) return {};

			return { concatenated: arr.join("") };
		})()
	);

	concat.concatenated.to(output);

	return output;
});

console.log(await reverserBoard({ message: "Hello World!" })); // { concat: '!dlroW olleH' }
```