/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPart, LLMContent } from "@breadboard-ai/types";

const parts: DataPart[] = [
  // Layout description.
  {
    text: `Create a Card for each person. The Heading (level 1) for each Card is
    the name, age, and location for the person along with a fun title underneat
    it as a Heading (level 2). For example, if they are an astronaut called
    Sarah we might come up with something like "Sarah: Night Sky Flier." Within
    each Card is the picture to the left (weight: 1), and to the right are some
    Tabs (weight: 3). There are tab items for their personal statement and
    background info on the person.

    People information: `,
  },

  // People Info.
  {
    text: `# James, 34, Carpenter, London
## Backstory:
Born and raised in Hackney, James's earliest memories are of watching his
grandfather, a cabinet maker, expertly shape wood in his small backyard
workshop. Academic pursuits never quite captivated him, but the tangible
satisfaction of working with his hands was always a clear draw. After leaving
school at 16, he secured an apprenticeship with a firm specializing in period
property renovations across London. For nearly two decades, he's honed his
skills, mastering traditional joinery techniques while also embracing modern
tools and sustainable practices. He's built bespoke kitchens in Georgian
townhouses, restored intricate Victorian bannisters, and crafted custom
furniture for discerning clients. James finds deep satisfaction in transforming
raw materials into lasting, functional beauty, appreciating the history held
within London's architecture and contributing to its enduring character.

## Personal Statement:
"For me, carpentry is more than a trade; it's a dedication to craftsmanship, a
respect for materials, and a commitment to creating lasting beauty. I approach
every project with meticulous attention to detail, whether I'm crafting a
bespoke piece of furniture or undertaking a complex restoration. The challenge
of problem-solving, the precision required, and the ultimate satisfaction of
seeing a vision come to life in timber are what drive me. I value the tradition
of my craft and constantly strive for excellence, believing that quality
workmanship enriches the spaces we live in."

# Alice, 33, Actor, New York

## Backstory:
Alice grew up in a quiet suburban town in upstate New York, often finding solace
and expression in books and imaginary worlds. A school play at age ten ignited a
fervent passion for performance, convincing her that storytelling was her true
calling. She moved to New York City immediately after high school, enrolling in
a rigorous conservatory program. The past decade has been a relentless journey
of dedication: countless auditions, numerous workshops, independent film
projects, and off-Broadway productions, interspersed with survival jobs in cafes
and galleries. She has learned resilience from rejection and found profound joy
in the collaborative process of theatre and film, embracing the vulnerability
required to authentically embody diverse characters and connect with an audience
in the vibrant, competitive heart of the arts world.

## Personal Statement:
"As an actor, I seek to explore the boundless complexities of the human
condition, bringing honesty and depth to every character I portray. My craft is
rooted in a deep sense of empathy, a commitment to rigorous preparation, and a
willingness to confront uncomfortable truths. I thrive in collaborative
environments, believing that the most compelling stories emerge from shared
vision and trust. Whether on stage or screen, my objective is always to move,
provoke, and connect with an audience, creating moments that resonate long after
the final curtain falls or the credits roll."

# Bob, 38, Teacher, Sydney

## Backstory:
Bob initially pursued a degree in marine biology, drawn by his love for Sydney's
coastline and the natural world. However, a part-time tutoring job during
university sparked an unexpected passion for education. He found immense
satisfaction in simplifying complex ideas and witnessing the moment a student
truly grasped a new concept. Redirecting his career path, he completed a
postgraduate teaching qualification, focusing on science and history. For the
past twelve years, he has taught at a diverse high school in Sydney's inner
west, known for his dynamic, interactive lessons and his ability to foster a
genuine love of learning. He frequently integrates local environmental issues
into his science curriculum and uses Sydney's rich history as a living textbook
for his history classes, inspiring his students to be curious, critical
thinkers.

## Personal Statement:
"My philosophy as an educator is to ignite curiosity, foster critical thinking,
and empower students to become lifelong learners. I strive to create an engaging
and supportive classroom environment where every voice is heard, and every
question is encouraged. I believe in connecting curriculum to the real world,
making abstract concepts tangible and relevant to my students' lives and
futures. The greatest reward of teaching is not just imparting knowledge, but
inspiring young minds to explore their potential, develop a passion for
discovery, and grow into thoughtful, engaged citizens."`,
  },

  // Images.
  { text: `Images: ` },
  {
    storedData: { handle: "imagehandle1", mimeType: "image/jpeg" },
  },
  {
    storedData: { handle: "imagehandle2", mimeType: "image/jpeg" },
  },
  {
    storedData: { handle: "imagehandle3", mimeType: "image/jpeg" },
  },
  {
    storedData: { handle: "imagehandle4", mimeType: "image/jpeg" },
  },
];

export const content: LLMContent = { role: "user", parts };
