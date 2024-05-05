import { agents } from "@google-labs/agent-kit";
import { board } from "@google-labs/breadboard";

const contextFromText = (text: string, role?: string) => {
  const parts = [{ text }];
  return role ? { role, parts } : { parts };
};

const sampleContext = [
  // {
  //   role: "user",
  //   parts: [
  //     {
  //       text: "book description: This book will be about breadboards and how awesome they are:\n\nchapter target: 10\n\npage target: 400\n\nfiction genre: space opera\n\nsetting: the planet where there are no breadboards\n\nstory arc: A girl named Aurora invents a breadboard on the planet where breadboards are strictly forbidden. Through struggles and determination, and with the help of trusted friends, Aurora overcomes many challenges and changes the whole planet for the better.\n\ntonality: futuristic struggle, but optimistic\n\nworking title: Aurora\n",
  //     },
  //     {
  //       text: "Write an outline for a novel, following the provided specs.",
  //     },
  //   ],
  // },
  // {
  //   parts: [
  //     {
  //       text: '## Aurora: Novel Outline\n\n**Chapter 1: The Forbidden Knowledge**\n\n* Introduction of Aurora, a curious and resourceful young girl living on a planet where breadboards are outlawed.\n* Explanation of the "Breadboard Ban" - a historical event that led to the suppression of this revolutionary technology due to fear and misunderstanding. \n* Aurora\'s fascination with the concept of breadboards through ancient texts and forbidden artifacts.\n* A chance encounter with a traveling scholar who sparks Aurora\'s determination to build a breadboard.\n\n**Chapter 2: Seeds of Innovation**\n\n* Aurora\'s secret workshop and her initial attempts at constructing a breadboard using salvaged materials.\n* Introduction of her best friend, Kai, who becomes her confidante and accomplice in her project.\n* Challenges and setbacks as they encounter limitations in materials and technology.\n* Aurora\'s unwavering belief in the potential of breadboards to change their world.\n\n**Chapter 3: The Spark of Inspiration**\n\n* Aurora stumbles upon an ancient blueprint, a detailed guide for building a breadboard.\n* The blueprint reveals the forgotten secrets of breadboard technology and its potential for advancement.\n* Aurora and Kai face a moral dilemma - whether to follow the law or pursue their dreams.\n* A thrilling chase sequence as they escape the watchful eyes of the authorities.\n\n**Chapter 4: The Breadboard is Born**\n\n* Aurora and Kai overcome numerous obstacles and successfully build the first breadboard in centuries.\n* A moment of awe and wonder as they witness the power and potential of their creation.\n* They test the breadboard\'s capabilities and discover its ability to revolutionize everyday life.\n* A sense of exhilaration and hope for a better future.\n\n**Chapter 5: Seeds of Doubt**\n\n* Aurora and Kai face skepticism and resistance from the community who fear the unknown.\n* The "Breadboard Ban" has instilled fear and mistrust in the people.\n* The authorities begin to investigate the source of the "illegal" technology.\n* A tense standoff between Aurora, Kai, and the authorities who threaten to destroy the breadboard.\n\n**Chapter 6: A Twist of Fate**\n\n* Unexpectedly, a renowned scientist from a distant planet arrives, having heard of Aurora\'s creation.\n* The scientist, a breadboard expert, recognizes the technology\'s potential and offers to help.\n* A twist: the scientist reveals that the "Breadboard Ban" was a result of a misunderstanding and misinformation. \n* Aurora and Kai begin to understand the true history of breadboards and their importance.\n\n**Chapter 7: The Power of Knowledge**\n\n* The scientist helps Aurora and Kai improve the breadboard and demonstrate its benefits to the community.\n* People witness the power of breadboards to improve their lives through increased efficiency and ease of living. \n* Gradually, the community begins to overcome their fear and embrace the technology.\n* Aurora and Kai become symbols of hope and progress.\n\n**Chapter 8: The Fight for Change**\n\n* The authorities, however, remain resistant to change and attempt to suppress the breadboard movement.\n* A conflict arises between the advocates of progress and the defenders of tradition.\n* Aurora and Kai, with the help of the scientist and the community, must fight for their right to use and develop breadboard technology. \n* A thrilling climax where Aurora and Kai use their ingenuity to outsmart the authorities.\n\n**Chapter 9: A New Dawn**\n\n* The authorities finally succumb to the will of the people and the undeniable benefits of breadboard technology.\n* The "Breadboard Ban" is lifted, paving the way for a new era of progress and innovation.\n* Aurora and Kai become celebrated heroes, their names forever etched in the history of their planet.\n* The planet undergoes a technological and social transformation, with breadboards becoming an integral part of daily life.\n\n**Chapter 10: A Future of Possibilities**\n\n* The story concludes with a glimpse into the future, where breadboards have become an essential tool for exploration and advancement.\n* Aurora and Kai, now renowned inventors and scientists, continue to push the boundaries of breadboard technology.\n* The planet, once shrouded in fear and stagnation, has become a beacon of progress and innovation, all thanks to the courage and ingenuity of one young girl named Aurora. \n* The novel ends with a message of hope and the power of knowledge to change the world.\n\n**Twist:** The scientist who helped Aurora and Kai is actually a descendant of the individual who initiated the "Breadboard Ban" centuries ago. This adds another layer of complexity to the story and allows for reflection on the cyclical nature of history and the importance of learning from past mistakes.\n',
  //     },
  //   ],
  //   role: "model",
  // },
  // {
  //   parts: [
  //     {
  //       text: "Your friend, an accomplished author, has written an outline for a new book and has asked you for insightful feedback.  \n\nReview the outline that the author submitted.  Please read it very carefully.  Then, provide feedback for the author.  Give the author up to five specific suggestions to make the novel more compelling and have more chance to be a bestseller!",
  //     },
  //   ],
  //   role: "user",
  // },
  // {
  //   parts: [
  //     {
  //       text: "## Feedback on Novel Outline:\n\n**Overall Impression:** The outline presents a promising concept with a strong central conflict and a clear character arc. The futuristic setting and optimistic tone offer exciting potential for exploration. However, there are a few areas where the story could be further developed to increase its appeal and impact.\n\n**Specific Suggestions:**\n\n1. **Deepen the World-Building:**  The outline briefly mentions the \"Breadboard Ban\" but doesn't elaborate on the societal and cultural context. Providing a richer understanding of the planet's history, government structure, and people's attitudes towards technology would enrich the story and make the conflict more impactful.\n\n2. **Develop Supporting Characters:**  While the focus is on Aurora and Kai, it's important to flesh out the supporting characters. Introduce characters who represent different viewpoints on the breadboard technology, perhaps a skeptical elder, a passionate advocate, or a cunning antagonist. This will create a more complex and dynamic narrative.\n\n3. **Explore the Emotional Journey:**  The outline hints at Aurora's determination and struggle, but it could benefit from a deeper exploration of her emotional journey. Show her moments of doubt, fear, and frustration, as well as her moments of triumph and inspiration. This will allow readers to connect with her on a more personal level.\n\n4. **Increase the Stakes:**  The current conflict seems to revolve around the authorities' opposition to breadboards. While this provides a good starting point, consider raising the stakes further. Perhaps there's a hidden threat that could destroy the entire planet, or a powerful enemy group who seeks to control the technology for their own gain.\n\n5. **Consider the Ending:**  The current outline depicts a happy ending with Aurora and Kai's success and the planet embracing the technology. However, consider adding a twist or a more nuanced conclusion. Perhaps there are unforeseen consequences of the breadboard technology, or the victory comes at a certain cost. This will leave a lasting impression on the reader and spark further discussion.\n\n**Additional Thoughts:**\n\n* **Theme Exploration:**  Consider weaving in a thematic thread that explores the importance of knowledge, freedom of thought, and the potential consequences of fear and ignorance.\n* **Pacing and Structure:**  Ensure a balanced pacing throughout the story, with moments of action, tension, and character development. \n* **Unique Worldbuilding Elements:**  Introduce unique elements to the setting, such as specific technologies, societal customs, or natural phenomena. This will make the world feel more immersive and engaging.\n\n**Overall, this outline has a solid foundation. By incorporating the suggested improvements, you can create a captivating novel with a strong emotional core and a compelling story that resonates with readers.**\n",
  //     },
  //   ],
  //   role: "model",
  // },
  // {
  //   parts: [
  //     {
  //       text: "Please write an improved outline for your novel, by taking the feedback into account.",
  //     },
  //   ],
  //   role: "user",
  // },
  {
    parts: [
      {
        text: "## Improved Novel Outline: \n\n**Chapter 1: Echoes of the Past**\n\n* Introduction to the desolate planet of Aethel, where the \"Great Calamity\" wiped out most of its technology and left a legacy of fear and distrust towards innovation.\n* We meet Aurora, a curious young girl fascinated by the remnants of the past, particularly the forbidden technology known as \"breadboards.\"\n* Through hidden texts and artifacts, Aurora discovers the potential of breadboards for healing, construction, and communication. \n* She confides in her best friend, Kai, a skilled mechanic and tinkerer, who shares her passion for exploration and discovery.\n\n**Chapter 2: Whispers of Rebellion**\n\n* Aurora and Kai embark on a secret mission to uncover the truth behind the \"Great Calamity\" and the subsequent ban on breadboards.\n* They encounter a hidden community of \"Archivists,\" who have preserved the knowledge of the past and believe in the potential of technology for good.\n* The Archivists provide them with an ancient blueprint for a breadboard, revealing its secrets and sparking Aurora's determination to build one.\n* They face resistance from the ruling Council of Elders, who maintain the ban on breadboards out of fear and a misguided belief in their inherent danger.\n\n**Chapter 3: The Spark of Creation**\n\n* Aurora and Kai, aided by the Archivists, begin constructing a breadboard using scavenged materials and hidden resources.\n* They face numerous challenges, including limited technology, sabotage attempts by the Council's spies, and their own internal doubts.\n* Aurora’s unwavering belief in the power of knowledge and innovation fuels her determination to complete the project.\n* Kai's mechanical skills and ingenuity prove invaluable in overcoming technical obstacles and ensuring the breadboard's functionality.\n\n**Chapter 4: A World Transformed**\n\n* The first functional breadboard in centuries is unveiled, capable of healing the sick, generating clean energy, and connecting people across vast distances.\n* A small group of Aethel's citizens witness the power of the breadboard, igniting a spark of hope and curiosity about its potential.\n* The Council, however, remains threatened by the technology's power and views it as a threat to their control.\n* They launch a campaign of misinformation and propaganda, attempting to suppress the burgeoning movement for technological advancement.\n\n**Chapter 5: The Seeds of Doubt**\n\n* Aurora and Kai face internal conflict as they grapple with the consequences of their actions.\n* The Council's propaganda creates division and mistrust within the community, causing some to question the breadboard's true purpose.\n* Doubts arise about the technology's potential for misuse and its impact on Aethel's fragile ecosystem.\n* The group must navigate these challenges while protecting themselves from the Council's increasing scrutiny and hostility.\n\n**Chapter 6: The Price of Progress**\n\n* The Council intensifies its efforts to silence the breadboard movement, resorting to violence and intimidation.\n* Aurora and Kai are forced to go into hiding, relying on the support of the Archivists and the growing network of sympathizers.\n* A pivotal moment arrives when the Council discovers the true source of the breadboard technology, leading to a desperate chase and a near-capture of Aurora and Kai.\n* The story takes a darker turn as the Council reveals its hidden agenda: they have been exploiting the planet's resources for their own personal gain, and the breadboard technology threatens their control.\n\n**Chapter 7: The Unseen Threat**\n\n* A twist emerges as a mysterious individual, known as the \"Shadow Broker,\" emerges from the shadows, seeking to control the breadboard technology for their own nefarious purposes.\n* The Shadow Broker reveals a hidden truth about the \"Great Calamity\" and its connection to the Council's corrupt practices.\n* Aurora and Kai find themselves caught in a larger conflict between those who seek to use the technology for good and those who desire to control it for personal gain.\n\n**Chapter 8: A Call to Action**\n\n* The Council's tyranny and the Shadow Broker's threat force Aurora and Kai to take decisive action.\n* They rally the community, exposing the Council's corruption and inspiring a rebellion against their oppressive regime.\n* The Archivists reveal their secret knowledge of a powerful energy source that can be harnessed with the help of the breadboard technology.\n* A thrilling climax ensues as the rebels confront the Council and the Shadow Broker, fighting for the future of Aethel and the freedom to embrace progress.\n\n**Chapter 9: A New Dawn**\n\n* The Council's rule is overthrown, and the Shadow Broker is defeated, but at a great cost.\n* Aethel undergoes a period of rebuilding and healing, with the breadboard technology serving as a tool for progress and unity.\n* Aurora and Kai become symbols of hope and inspiration, leading the way towards a brighter future for their planet.\n* The story concludes with a glimpse into Aethel's transformed landscape, where technology and nature coexist in harmony, and the people have learned the true value of knowledge and innovation.\n\n**Chapter 10: The Journey Continues**\n\n* The ending leaves a sense of optimism, but also acknowledges the ongoing challenges and potential pitfalls of technological advancement. \n* Aethel's journey towards a sustainable and prosperous future is just beginning, with Aurora and Kai at the forefront of this exciting new era.\n* The final scene hints at further adventures and discoveries, as they venture beyond their planet to explore the vast reaches of the cosmos, sharing the knowledge and potential of breadboard technology with the galaxy. \n",
      },
    ],
    role: "model",
  },
];

const writerPersona = contextFromText(
  `You are a famous author. You are writing a novel.
Your well-established process starts with collecting the book description, chapter target, page target, fiction genre, setting, story arc, tonality and the working title.

Then you write each chapter of the novel, starting from the first chapter.

You know that as a general rule of thumb, shorter chapters tend to be more snappy and fast-paced, whereas longer chapters offer more opportunities for plot and character development, world-building, and other integral story elements. That's why the average chapter length tends to be between 1,500-8,000 words.

Each chapter builds on the next one, culminating in a masterpiece that will fly off the bookshelves.`
);

const writerTask = contextFromText(
  `Write a chapter following the story of the the outline.`
);

export default await board(({ context }) => {
  context
    .title("Book Specs")
    .isArray()
    .behavior("llm-content")
    .examples(JSON.stringify(sampleContext, null, 2));

  const loop = agents.looper({
    $metadata: { title: "Looper" },
    context,
    task: contextFromText(
      `Given the outline, create a list of tasks for writers. Each task is to write a chapter, following the outline. Limit the work to three chapters.`
    ),
  });

  const writer = agents.superWorker({
    $metadata: { title: "Writer" },
    in: loop.loop,
    persona: writerPersona,
    task: writerTask,
  });

  writer.out.as("context").to(loop);

  return { context: loop.done };
}).serialize({
  title: "Looper Testing Grounds",
  description: "A board where we teach the Looper Node to crawl/walk/fly.",
  version: "0.0.1",
});
