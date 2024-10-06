/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ChapterStoryProgress,
  StartStoryProgress,
  StoryMakingProgress,
  StoryType,
} from "@/app/types";

const STORY: StoryType = {
  topic: "grace",
  id: "f17cb261-6d5a-4b0d-97fa-46b32ce4a150",
  title: "Amazing Grace",
  chapters: [
    {
      img: "/f17cb261-6d5a-4b0d-97fa-46b32ce4a150.png",
      text: "Grace the giraffe had a very long neck. It was so long, in fact, that it sometimes felt like a problem. The leaves on the tallest trees, the tastiest ones, were just out of reach. Grace tried jumping. She tried stretching. She even asked her friends, the zebras, to give her a boost. But nothing worked. The delicious leaves remained tantalizingly out of reach. It made Grace feel sad and a little bit lonely.  She sighed, feeling a little frustrated. \n",
    },
    {
      img: "/1f93e66d-437b-4b33-8a1c-31977ab56109.png",
      text: 'One sunny afternoon, as Grace was gazing longingly at the top of a towering acacia tree, a small zebra named Ziggy approached her. "Why the long face, Grace?" he asked, tilting his head in concern. Grace explained her woes, her voice filled with disappointment.  Ziggy listened patiently, his kind eyes reflecting understanding.  "Maybe," he said thoughtfully, "you could use your long neck to help others reach things they can\'t." Grace\'s ears perked up. "You mean… like the fruit on the acacia tree?" she asked, a spark of hope flickering in her eyes. \n',
    },
    {
      img: "/d57c2779-d150-4325-9440-59f4f7140ebe.png",
      text: "Ziggy nodded excitedly. \"Exactly! You could use your long neck to help me get those delicious mangoes!\"  And so, Grace stretched her neck, reaching high into the tree, and plucked the juicy mangoes for Ziggy.  He munched happily, thanking Grace profusely.  Word spread quickly about Grace's helpful long neck. Soon, other animals were asking for her help.  The little dik-dik needed a sip of water from the pond, but it was too deep. Grace stretched her neck, reaching down to get the water for the grateful dik-dik.  The meerkat wanted a close-up look at the bird's nest in the tree, but couldn't reach. Grace let him climb up her neck to get a better view.  Grace realized that her long neck wasn't a problem, but a gift.  It allowed her to be helpful and kind, making everyone happy.  She started to feel proud of herself, a smile spreading across her face.  \n\n\n",
    },
    {
      img: "/4063c91a-4110-4158-b7ec-2be6fe3fe3cf.png",
      text: "From that day forward, Grace and Ziggy became the best of friends. They shared adventures, laughed together, and always looked out for each other.  Grace realized that with Ziggy's help and her own unique ability, she could overcome any challenge.  She learned that even though her neck was different, it made her special.  She had something unique to offer the world.  And that made her happy.  She learned that friendship and kindness were the most important things, and that being helpful made her feel truly amazing.\n\n",
    },
    {
      img: "/1bc1021a-1fea-4946-aacd-f7a215c4e0f7.png",
      text: 'The animals of the savanna started calling Grace "Amazing Grace" for her helpful nature and kindness.  They admired her, realizing that her long neck wasn\'t a problem, but a blessing.  She was a symbol of generosity and friendship.  Grace no longer felt sad about her long neck.  She had discovered that by embracing her differences and helping others, she was truly amazing.  She learned that her long neck allowed her to see the world from a different perspective, and that was a beautiful thing.  Every day, Grace woke up feeling happy and grateful for her life, knowing that she could use her gifts to make the world a little brighter. \n',
    },
    {
      img: "/4063c91a-4110-4158-b7ec-2be6fe3fe3cf.png",
      text: "From that day forward, Grace and Ziggy became the best of friends. They shared adventures, laughed together, and always looked out for each other.  Grace realized that with Ziggy's help and her own unique ability, she could overcome any challenge.  She learned that even though her neck was different, it made her special.  She had something unique to offer the world.  And that made her happy.  She learned that friendship and kindness were the most important things, and that being helpful made her feel truly amazing.\n\n",
    },
    {
      img: "/1bc1021a-1fea-4946-aacd-f7a215c4e0f7.png",
      text: 'The animals of the savanna started calling Grace "Amazing Grace" for her helpful nature and kindness.  They admired her, realizing that her long neck wasn\'t a problem, but a blessing.  She was a symbol of generosity and friendship.  Grace no longer felt sad about her long neck.  She had discovered that by embracing her differences and helping others, she was truly amazing.  She learned that her long neck allowed her to see the world from a different perspective, and that was a beautiful thing.  Every day, Grace woke up feeling happy and grateful for her life, knowing that she could use her gifts to make the world a little brighter. \n',
    },
    {
      img: "/4063c91a-4110-4158-b7ec-2be6fe3fe3cf.png",
      text: "From that day forward, Grace and Ziggy became the best of friends. They shared adventures, laughed together, and always looked out for each other.  Grace realized that with Ziggy's help and her own unique ability, she could overcome any challenge.  She learned that even though her neck was different, it made her special.  She had something unique to offer the world.  And that made her happy.  She learned that friendship and kindness were the most important things, and that being helpful made her feel truly amazing.\n\n",
    },
    {
      img: "/1bc1021a-1fea-4946-aacd-f7a215c4e0f7.png",
      text: 'The animals of the savanna started calling Grace "Amazing Grace" for her helpful nature and kindness.  They admired her, realizing that her long neck wasn\'t a problem, but a blessing.  She was a symbol of generosity and friendship.  Grace no longer felt sad about her long neck.  She had discovered that by embracing her differences and helping others, she was truly amazing.  She learned that her long neck allowed her to see the world from a different perspective, and that was a beautiful thing.  Every day, Grace woke up feeling happy and grateful for her life, knowing that she could use her gifts to make the world a little brighter. \n',
    },
  ],
};

export async function POST(req: Request) {
  let topic;
  try {
    const json = await req.json();
    topic = json.topic;
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!topic) {
    return new Response("Missing topic", { status: 400 });
  }
  const chapters = [...STORY.chapters];
  const start: StartStoryProgress = {
    type: "start",
    title: STORY.title,
  };
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(toServerSentEvent(start));
      for (const chapter of chapters) {
        const chapterProgress: ChapterStoryProgress = {
          type: "chapter",
          chapter,
        };
        controller.enqueue(toServerSentEvent(chapterProgress));
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      controller.enqueue(toServerSentEvent({ type: "done", id: STORY.id }));
      controller.close();
    },
  }).pipeThrough(new TextEncoderStream());

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

function toServerSentEvent(event: StoryMakingProgress) {
  return `event: ${event.type}\n\ndata: ${JSON.stringify(event)}\n\n`;
}
