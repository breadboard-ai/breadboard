# Creating and using `code` nodes
A special type of node, of type `code`, can be created with the `code` function.

They can be created inside or outside the scope of a board, and even created anonymously.

The below `reverserBoard` board has 3 different `code` nodes:
- The `split` node is created **outside** the board. This node takes an input called `toSplit`, and it either returns an empty object if the given input type is not a string, or it returns the given input split, by each character, into an array of strings.
```typescript
const split = code(({ toSplit }) => {
	if (typeof toSplit !== "string") return {};
	return { split: toSplit.split("") };
});

export default board<{ message: string }>(({ message }, { output }) => {
	const splitNode = split();
	message.as("toSplit").to(splitNode);

	return splitNode.split.to(output());
});
```
- The `reverse` node is created **inside** the board. This node takes an input called `toReverse`, and it either returns an empty object if the given input type is not an array, or it returns the given array of strings reversed.
```typescript
export default board<{ message: string[] }>(({ message }, { output }) => {
	const reverseNode = code(({ toReverse }) => {
		if (!Array.isArray(toReverse)) return {};
		return { reversed: toReverse.reverse() };
	})();

	message.as("toReverse").to(reverseNode);

	return reverseNode.reversed.to(output());
});
```
- The final node is **anonymous**, and it takes an input called `arr`, and either returns an empty object if the given input type is not an array, or it returns the given array of strings concatenated into a single string.
```typescript
export default board<{ message: string[] }>(
	({ message }, { output }) => {
		const concat = message.as("arr").to(
			code(({ arr }) => {
				if (!Array.isArray(arr)) return {};

				return { concatenated: arr.join("") };
			})()
		);
		return concat.concatenated.to(output());
	}
);
```
The `base` input and output are added to the board, as well as an instance of the `split` node called `splitNode`. The input passes an attribute called `message`, as `toSplit` instead, into the `split` node. Then the `reverse` node is created and an instance, called `reverseNode`, is added to the board and passed the `split` attribute, as `toReverse`, from the `splitNode`. The `reverseNode` then passes an attribute called `reversed`, as `arr`, to the anonymous node for concatenation, and the returned node is called `concat` which then passes the `concatenated` attribute to the output node.

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
