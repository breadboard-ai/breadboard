import {
  AbstractNode,
  InputsMaybeAsValues,
  NewInputValuesWithNodeFactory,
  V,
  base,
  code,
} from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { NodeProxy } from "../../../breadboard/dist/src/new/grammar/types";
import {
  inputSchema,
  graph as replyGenerator,
} from "./business-review-replier";

const defaultReview = [
  `Rating: ★★★★★`,
  ``,
  `I recently visited a coffee shop and was thoroughly impressed with my experience. From the moment I walked in, I was greeted with a warm, welcoming atmosphere that instantly made me feel at home. The cosy decor, complete with comfortable seating and tasteful artwork, added to the overall charm of the place.`,
  `The staff were exceptionally friendly and attentive, making sure that every customer felt valued. I was particularly impressed by their knowledge of the menu and their willingness to offer recommendations. Their passion for coffee was evident, and it was clear that they took great pride in their work.`,
  `Now, onto the coffee – it was nothing short of spectacular. I ordered a flat white, and it was perfectly balanced with a rich, creamy texture and a smooth, velvety finish. The barista’s skill in crafting the drink was apparent, and it was one of the best coffees I’ve had in a long time. They also offer a variety of specialty drinks, teas, and pastries, all of which looked delicious.`,
  `One aspect that really stood out was their commitment to sustainability. This coffee shop uses ethically sourced beans and environmentally friendly packaging, which is a big plus for me. It’s great to see a local business taking steps to reduce its environmental impact.`,
  `Overall, the coffee shop exceeded my expectations in every way. The delightful ambience, excellent coffee, and outstanding service make it a standout in the local coffee scene. I highly recommend paying them a visit – you won’t be disappointed!`,
].join("\n");

const positiveReviews = [
  `I had an amazing time at the café. The coffee was absolutely perfect and the staff were so friendly and attentive. I’ll definitely be coming back!"`,
  `This boutique has such a fantastic collection! I found exactly what I was looking for and the customer service was excellent. Highly recommend!"`,
  `What a wonderful experience at the spa! The massage was incredibly relaxing and the ambience was just right. Can't wait for my next visit."`,
] as const;

const negativeReviews = [
  `The service at the restaurant was really slow. We had to wait almost an hour for our food, and when it arrived, it was cold and undercooked."`,
  `I was very disappointed with my stay at the hotel. The room was not clean, and the staff seemed uninterested in addressing our concerns."`,
  `The product I bought from the electronics store stopped working after just a week. When I tried to contact customer service, I got no response."`,
] as const;

const neutralReviews = [
  `The new exhibit at the museum was interesting, but it felt a bit disorganised. Some of the information was hard to follow, but overall, it was a decent visit."`,
  `I had a mixed experience at the salon. The haircut was fine, but the stylist seemed rushed and didn't really listen to what I wanted."`,
  `Shopping at the supermarket is convenient, but the aisles are often cluttered and it’s hard to find certain items. Prices are reasonable though."`,
] as const;

const examples: string[] = [
  defaultReview,
  ...positiveReviews,
  ...negativeReviews,
  ...neutralReviews,
] as const;

const input = base.input({
  $metadata: {
    title: "Input",
  },
  schema: {
    ...inputSchema,
    required: ["tone", "voice", "review"],
    properties: {
      ...inputSchema.properties,
      review: {
        ...inputSchema.properties.review,
        default: "",
      },
    },
  },
});

function randomFromArray<T>(
  args:
    | V<unknown>
    | AbstractNode<NewInputValuesWithNodeFactory, { array: T[] }>
    | InputsMaybeAsValues<{ array: T[] }, NewInputValuesWithNodeFactory>
    | undefined
): NodeProxy<{ array: T[] }, Required<{ item: T }>> {
  return code<
    {
      array: T[];
    },
    {
      item: T;
    }
  >((inputs: { array: T[] }) => {
    console.log({ inputs });
    const randomIndex = Math.floor(Math.random() * inputs.array.length);
    return { item: inputs.array[randomIndex] };
  })(args);
}

type AlternateType<T> = {
  a?: T;
  b?: T;
};

function coalesce<T>(
  args:
    | V<unknown>
    | AbstractNode<NewInputValuesWithNodeFactory, AlternateType<T>>
    | InputsMaybeAsValues<AlternateType<T>, NewInputValuesWithNodeFactory>
    | undefined
): NodeProxy<AlternateType<T>, Required<{ item: T }>> {
  return code<AlternateType<T>, { item: T }>((inputs: AlternateType<T>) => {
    if ("a" in inputs) {
      return { item: inputs["a"] as T };
    }
    if ("b" in inputs) {
      return { item: inputs["b"] as T };
    }
    throw new Error("No value");
  })(args);
}

const pickRandomExample = randomFromArray({
  $metadata: {
    title: "Pick random example",
  },
  array: examples,
});

const relabelReviewParam = core.passthrough({
  $metadata: {
    title: "Relabel Review",
  },
});

const coalesceReview = coalesce({
  $metadata: {
    title: "Coalesce",
  },
});

pickRandomExample.item.as("b").to(coalesceReview);
input.as({}).to(relabelReviewParam);
input.review.as("a").as({}).to(relabelReviewParam);

relabelReviewParam.to(coalesceReview);

const output = base.output({
  $metadata: {
    title: "Output",
  },
});

const invokeGenerator = core.invoke({
  $board: replyGenerator,
  $metadata: {
    title: "Invoke reply generator",
  },
  task: input.task,
  tone: input.tone,
  voice: input.voice,
  review: coalesceReview.item,
});

// const review = coalesceReview.item.as("review");

// review.to(invokeGenerator);
coalesceReview.item.as("review").to(output);

invokeGenerator.reply.to(output);

const serialised = await output.serialize({
  title: "Business Review Replier Demo",
  description: "A board to demonstrate the business review replier.",
});

export { serialised as graph, input, output };
export default serialised;
