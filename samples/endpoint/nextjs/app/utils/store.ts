/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from "path";
import { StoryType } from "../types";
import { readFile } from "fs/promises";

const MODULE_DIR = new URL(import.meta.url).pathname;
const ROOT_DIR = path.resolve(MODULE_DIR, "../../../");

const STORY: StoryType = {
  id: "774cb78f-0e46-4206-be41-0e4b8df65d2c",
  topic: "amazing grace",
  title: "Amazing Grace",
  chapters: [
    {
      img: "f17cb261-6d5a-4b0d-97fa-46b32ce4a150",
      text: "Grace the giraffe had a very long neck. It was so long, in fact, that it sometimes felt like a problem. The leaves on the tallest trees, the tastiest ones, were just out of reach. Grace tried jumping. She tried stretching. She even asked her friends, the zebras, to give her a boost. But nothing worked. The delicious leaves remained tantalizingly out of reach. It made Grace feel sad and a little bit lonely.  She sighed, feeling a little frustrated. \n",
    },
    {
      img: "1f93e66d-437b-4b33-8a1c-31977ab56109",
      text: 'One sunny afternoon, as Grace was gazing longingly at the top of a towering acacia tree, a small zebra named Ziggy approached her. "Why the long face, Grace?" he asked, tilting his head in concern. Grace explained her woes, her voice filled with disappointment.  Ziggy listened patiently, his kind eyes reflecting understanding.  "Maybe," he said thoughtfully, "you could use your long neck to help others reach things they can\'t." Grace\'s ears perked up. "You mean… like the fruit on the acacia tree?" she asked, a spark of hope flickering in her eyes. \n',
    },
    {
      img: "d57c2779-d150-4325-9440-59f4f7140ebe",
      text: "Ziggy nodded excitedly. \"Exactly! You could use your long neck to help me get those delicious mangoes!\"  And so, Grace stretched her neck, reaching high into the tree, and plucked the juicy mangoes for Ziggy.  He munched happily, thanking Grace profusely.  Word spread quickly about Grace's helpful long neck. Soon, other animals were asking for her help.  The little dik-dik needed a sip of water from the pond, but it was too deep. Grace stretched her neck, reaching down to get the water for the grateful dik-dik.  The meerkat wanted a close-up look at the bird's nest in the tree, but couldn't reach. Grace let him climb up her neck to get a better view.  Grace realized that her long neck wasn't a problem, but a gift.  It allowed her to be helpful and kind, making everyone happy.  She started to feel proud of herself, a smile spreading across her face.  \n\n\n",
    },

    {
      img: "4063c91a-4110-4158-b7ec-2be6fe3fe3cf",
      text: "From that day forward, Grace and Ziggy became the best of friends. They shared adventures, laughed together, and always looked out for each other.  Grace realized that with Ziggy's help and her own unique ability, she could overcome any challenge.  She learned that even though her neck was different, it made her special.  She had something unique to offer the world.  And that made her happy.  She learned that friendship and kindness were the most important things, and that being helpful made her feel truly amazing.\n\n",
    },
    {
      img: "1bc1021a-1fea-4946-aacd-f7a215c4e0f7",
      text: 'The animals of the savanna started calling Grace "Amazing Grace" for her helpful nature and kindness.  They admired her, realizing that her long neck wasn\'t a problem, but a blessing.  She was a symbol of generosity and friendship.  Grace no longer felt sad about her long neck.  She had discovered that by embracing her differences and helping others, she was truly amazing.  She learned that her long neck allowed her to see the world from a different perspective, and that was a beautiful thing.  Every day, Grace woke up feeling happy and grateful for her life, knowing that she could use her gifts to make the world a little brighter. \n',
    },
  ],
};

export async function getStory(id: string): Promise<StoryType> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    ...STORY,
    id,
  };
}

export async function getImage(id: string): Promise<Buffer | null> {
  if (!isUUID(id)) {
    return null;
  }

  try {
    console.log("DIR", `${ROOT_DIR}/store/${id}.png`);
    const image = await readFile(`${ROOT_DIR}/store/${id}.png`);
    return image;
  } catch (e) {
    return null;
  }
}

function isUUID(input: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(input);
}
