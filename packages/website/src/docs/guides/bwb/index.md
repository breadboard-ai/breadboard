---
layout: docs.liquid
title: Build with Breadboard
tags:
  - guide
  - wip
---

Welcome! Breadboard is the [open source project](https://github.com/breadboard-ai/breadboard) from Google Labs that aims to enable rapid prototyping of AI systems and unlock easy remixing and sharing of these prototypes.

> [!NOTE]
> This document is best used as part of the "Build with Breadboard" workshop. You may still find it useful outside of that purpose, but some instructions might not make sense.

Let’s get you started.

## Join the Community Board Server

https://www.youtube.com/watch?v=IWMd1RpGKhw&list=PLH7s1qvZKUeLampPQdBggg8LK31heBTxk&index=1

> [!TIP]
> Videos (like the one above) will roughly have the same content as the text for each section, but may contain more information, primarily due to the actual person following the instructions and explaining them step by step.

For this workshop, you will be working on a community board server. To get access to the server:

1️⃣ Go to the spreadsheet provided by the workshop facilitators and find the username that you like and that hasn’t been claimed yet. To claim the username, enter your name and email address next to it.

2️⃣ Once you’ve claimed the username, copy the associated Board Server API key. This key will serve as a password that lets you access the board server.

3️⃣ Once you have the Board Server API key, join the server by going to the Board Server URL, provided by facilitators.

You will see something like this:

![Welcome to Breadboard image](/breadboard/static/images/bwb/image1.png)

Enter your Board Server API key and click “Let’s Go!”. If everything went well, you should see a little welcome toast at the bottom right of the screen:

![Welcome toast](/breadboard/static/images/bwb/image2.png)

If you see this message, you’re in!

> [!NOTE]
> If you get an error message instead, double-check to make sure you’ve entered the right key. If you’re still having trouble, reach out to the facilitator.

## Look around, explore the boards

https://www.youtube.com/watch?v=C2vDW510aGw&list=PLH7s1qvZKUeLampPQdBggg8LK31heBTxk&index=2&pp=iAQB

Now that you’re on the board server, click on this icon in the top left to open up the board menu:

![Board Menu Icon](/breadboard/static/images/bwb/image13.png)

You should see something like this:

![Board Server menu](/breadboard/static/images/bwb/image23.png)

Each item in this list is a board you can load and try out. The boards you create will be listed at the top, with boards shared by others listed below, labeled `@username` to help you see who made them.

We’ve seeded the server with some initial boards that will be labeled with the `@shared` username. You can play with them.

> [!TIP]
> Once everyone starts to create their own boards, the list might get quite crowded. Use the “Search Boards” box to narrow down the list. For instance, to find all the initial boards, type in `shared`. For more details on how to use the left-side menu, see “[Boards and Providers](https://breadboard-ai.github.io/breadboard/docs/visual-editor/boards-and-providers/)” documentation.

Let’s open the "Chat with your dog" board and run it by clicking on the “Debug Board” button:

![Debug button](/breadboard/static/images/bwb/image24.png)

You will see an activity log pane pop up and show you progress: what’s currently happening in the board. When the board needs your input, it will stop and ask for it in the activity pane:

![Activity Pane](/breadboard/static/images/bwb/image25.png)

Enter your input and click the “Continue” button. Some boards, like the chat bot, will continue indefinitely until you stop them by hitting “Stop Board”. Others will run to completion and finish.

> [!NOTE]
> For more information on how to use the Activity pane see the “[Activity Pane](https://breadboard-ai.github.io/breadboard/docs/visual-editor/activity-pane/)” chapter in Breadboard documentation.

> [!TIP]
> 🌵 some of the screenshots in the docs are showing the previous-generation UI, but the basics of the pane are still the same.

## Remix a board

https://www.youtube.com/watch?v=9dyN4TeaZv0&list=PLH7s1qvZKUeLampPQdBggg8LK31heBTxk&index=3&pp=iAQB

Let’s see if you can remix this board and turn "Chat with your dog" into “Chat with your cat”.

1️⃣ Open "Chat with your dog" board.

2️⃣ Click the little 💾 button:

![Board overflow menu](/breadboard/static/images/bwb/image7.png)

3️⃣ Change the title to “Chat with your Cat” in the “Save As…” dialog:

![Board details dialog](/breadboard/static/images/bwb/image27.png)

After a few moments, a new tab will appear in the editor. This is your first board on this server. In addition to just running it, you can make changes to this board.

![Board tabs](/breadboard/static/images/bwb/image28.png)

The first thing we’ll do is change the persona of the bot to be a dog. To do so, click on the “Persona” port of the “Dog” component:

![Edit Specialist Persona](/breadboard/static/images/bwb/image29.png)

As you can see, this gives us a few different options to mess with. Let’s start by editing the “Persona” field and change it to:

```md
You are a friendly cat who loves to chat with humans
but on your own terms. You respond in short sentences,
often meowing, purring, hissing, or chirping.
You love to nap, eat, play with toys, and chase laser
pointers. You are also very curious and love to
explore new things. You might ask the human about
what they are doing, what they are eating, or
what they are wearing. You might also comment
on the weather, the time of day, or any noises
you hear.

You don't like being told what to do, so if the
human tries to command you or give you
instructions, you will ignore them or give them
a sassy reply. You are the boss!
```

> [!TIP]
> Prompts are a very important part of working with LLMs. The “Persona” field is the system instruction part of the prompt, and allows you to specify the “who” of the personality we’re looking for. The “Task” field is more about the “what”: what is it that we want them to do.

To make it clear that this bot is now a cat, scroll up and change the title to “Cat”:

![Edit Specialist](/breadboard/static/images/bwb/image3.png)

Click the “Update” button and then start the board by clicking “Debug Board” as we usually do.

You will now see that bot’s demeanor in the activity log is distinctly cat-like:

![Cat Bot Activity Log](/breadboard/static/images/bwb/image4.png)

Woo hoo! We made our own cat bot.

One thing that’s jarring is the “Talk to your dog” instruction when we’re being asked to talk to what’s clearly a cat.

Let’s change that. Stop the board and then click on “Description” port of the “Owner” component:

![Human Component View](/breadboard/static/images/bwb/image5.png)

Now change it to “Talk to your cat” and click “Update”.

![Edit Human Component](/breadboard/static/images/bwb/image6.png)

When you run the board again, it will have the right instruction. Hooray, we did it. We remixed the board.

> [!TIP]
> This is roughly how board-making happens: we tweak and make changes and add new things until we have something that works like we want it to.

**🏋️ Challenge**: Try to come up with other kinds of personalities your users might enjoy chatting with and remix the chat bot into something else. Don’t forget to use “Save As…” to avoid accidentally overwriting the glorious cat bot with the new idea:

![The "Save As..." item in the overflow menu](/breadboard/static/images/bwb/image7.png)

## Share your work

Now that you have a working board, let’s see if we can share it with others.

First, it is always a good idea to give the board a better description. To do so, choose the “Edit Board Details” option from the overflow menu above (or double-click on the board’s tab title)

![Board details dialog](/breadboard/static/images/bwb/image8.png)

You can share this board in a couple of different ways:

**🎨 Option 1: Share to collaborate**. Choose the option if you want to show your colleagues or friends the actual board that you built. Perhaps it will spark some ideas for them and let them remix it.

https://www.youtube.com/watch?v=uxyIr67cA2k&list=PLH7s1qvZKUeLampPQdBggg8LK31heBTxk&index=4&pp=iAQB

To do so, select the “Copy Tab URL” option from the overflow menu:

![The "Copy Tab URL" menu option](/breadboard/static/images/bwb/image9.png)

This will copy the URL of this tab into your clipboard, and now you can paste it wherever you want it to share. When your friends click on this link, they will be taken to the visual editor with the board tab open.

**🖼️ Option 2: Share as a Preview**. Choose this option if you want to share the board with potential users. A Preview is a mini-app that is automatically created for your board and it’s a great way to show off your work with peeps who don’t necessarily care how you built it.

https://www.youtube.com/watch?v=HDGFBVU05Xc&list=PLH7s1qvZKUeLampPQdBggg8LK31heBTxk&index=5&pp=iAQB

This way takes a bit of preparation. The first step is always the same:

1️⃣ Select “Copy Preview URL” option from the overflow menu. This will copy the URL of the Preview to your clipboard. You can share this link right away, and whoever clicks on it will see something like this:

![The Preview](/breadboard/static/images/bwb/image10.png)

This is the mini-app. It hides away all of the board editing stuff and wraps a nice UI around it.

By default, the mini-app will run in “local mode”, where the user has to enter all the API keys themselves. If you’d like to allow your users to try the mini-app without having to do that, proceed to the next step.

2️⃣ This step is a one-time setup. Open a new browser tab and go to this URL. As in the step before, you will see something like this:

![The Preview](/breadboard/static/images/bwb/image10.png)

Click on “Sign in to Board Server” and enter your Board Server API key:

![Enter board server API key dialog](/breadboard/static/images/bwb/image12.png)

Once you’ve signed, in you should see new options in the left sidebar:

![Owner options in Preview sidebar](/breadboard/static/images/bwb/image14.png)

You do not need to repeat this step for the next previews.

3️⃣ The final step is to create an invite link. Click the “Manage Invites” option (if you don’t have it, go back to step 2).

![Manage Invites dialog](/breadboard/static/images/bwb/image15.png)

Then click the “Create an invite link” button. Doing so will generate a special link that you can share with others. When they use this link, they will be automatically given access to your Preview. Click the little clipboard icon to copy this link into your clipboard.

![Manage Invites with Link dialog](/breadboard/static/images/bwb/image16.png)

The link will typically look like this:

```url
https://breadboard-community.wl.r.appspot.com/boards/@username/chat-with-your-cat.bgl.app?invite=vrsgb9v0
```

You can also deactivate this invite link by clicking the little trash can icon. Once the invite has been deactivated, clicking on the invite link will direct the user to a “local only” preview, where they have to enter all the API keys themselves.

## Beyond the basics

Once learned, Breadboard can be a rather powerful tool. To give you a sense of all the things possible with it, let’s look over all of the initial boards.

<table>
<tbody valign="top">
  <tr>
   <td style="background-color: #ecf5ff">
<img src="/breadboard/static/images/bwb/image17.png" width="">

   </td>
   <td style="padding: 20px; background-color: #ecf5ff"><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/chat-with-your-dog.bgl.json">Chat with your dog</a>
<p>
A very simple chat boot, acting as a loyal and happy dog. This is a board we’ve used as a starting point for making your own chat bots.
   </td>
  </tr>
  <tr>
   <td style="background-color: #ecf5ff">
<img src="/breadboard/static/images/bwb/image18.png" width="" alt="alt_text" title="image_tooltip">

   </td>
   <td style="padding: 20px; background-color: #ecf5ff"><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/the-librarian.bgl.json">The Librarian</a>
<p>
A more complex, purpose-driven chat bot. Interviews you to help you find the book you’re looking for, then calls the Google Books API to search, and finally summarizes the results.
<p>
<a href="https://www.youtube.com/watch?v=ejWpG61BrkE&list=PLH7s1qvZKUeLampPQdBggg8LK31heBTxk&index=6&pp=iAQB">Video tour</a>
<p>
Uses:<ul>

<li><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/google-books-search-api.bgl.json">Google Books API</a></li></ul>

   </td>
  </tr>
  <tr>
   <td style="background-color: #ecf5ff"></b>
<img src="/breadboard/static/images/bwb/image19.png" width="" alt="alt_text" title="image_tooltip">

   </td>
   <td style="padding: 20px; background-color: #ecf5ff"><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/this-moment-s-news.bgl.json">This Moment’s News</a>
<p>
Calls Google Trends API to look at current trends in specified locale, then makes a bunch of queries to the Google News API to find all the news items related to the trends, and finally summarizes the results.
<p>
<p>
<a href="https://www.youtube.com/watch?v=ClBEHcTm63Q&list=PLH7s1qvZKUeLampPQdBggg8LK31heBTxk&index=7&pp=iAQB">Video tour</a>

Uses:<ul>

<li><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/google-trends-api.bgl.json">Google Trends API</a>
<li><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/google-news-api.bgl.json">Google News API</a></li></ul>

   </td>
  </tr>
  <tr>
   <td style="background-color: #ecf5ff">
<img src="/breadboard/static/images/bwb/image20.png" width="" alt="alt_text" title="image_tooltip">

   </td>
   <td style="padding: 20px; background-color: #ecf5ff"><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/web-page-re-designer.bgl.json">Web page redesigner</a>
<p>
Takes an existing page, analyzes it, writes a marketing plan to improve it and then designs a new version of it in HTML.
<p>
<p>
<a href="https://www.youtube.com/watch?v=WLqZj4vJ55Y&list=PLH7s1qvZKUeLampPQdBggg8LK31heBTxk&index=8&pp=iAQB">Video tour</a>

Uses:<ul>

<li><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/get-web-page-content.bgl.json">Get Web Page Content</a>
<li><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/claude-3-5-sonnet.bgl.json">Claude 3.5 Sonnet</a>

<p>
Will require an Anthropic API key. Get it <a href="https://console.anthropic.com/login?selectAccount=true&returnTo=%2Fsettings%2Fkeys%3F">here</a>.</li></ul>

   </td>
  </tr>
  <tr>
   <td style="background-color: #ecf5ff">
<img src="/breadboard/static/images/bwb/image21.png" width="" alt="alt_text" title="image_tooltip">

   </td>
   <td style="padding: 20px; background-color: #ecf5ff"><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/blog-post-writer.bgl.json">Blog Post Writer</a>
<p>
A more complex board: an actual semi-autonomous agent. Give it a topic, and then it will apply a variant of a <a href="https://arxiv.org/abs/2210.03629">ReAct technique</a> to reason and act on its reasoning, calling Google Search API, Wikipedia API, and Web content scraping API to research the topic, then write a blog post based on the research.
<p>

<p>
<a href="https://www.youtube.com/watch?v=F5QVZm9Vm-c&list=PLH7s1qvZKUeLampPQdBggg8LK31heBTxk&index=9&pp=iAQB">Video tour</a>

Uses:<ul>

<li><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/google-custom-search.bgl.json">Google Custom Search API</a>
<li><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/search-wikipedia.bgl.json">Wikipedia Search API</a>
<li><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/get-web-page-content.bgl.json">Get Web Page Content</a>
<li><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/dall-e-image-generator.bgl.json">Dall-E Image Generator</a>

<p>
Will require OpenAI API key. Get it <a href="https://platform.openai.com/api-keys">here</a>.</li></ul>

   </td>
  </tr>
  <tr>
   <td style="background-color: #ecf5ff">
<img src="/breadboard/static/images/bwb/image22.png" width="" alt="alt_text" title="image_tooltip">

   </td>
   <td style="padding: 20px; background-color: #ecf5ff"><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/business-researcher.bgl.json">Business Researcher</a>
<p>
Similar to the Blog Post Writer, but focused on researching details of a business. Another example of a semi-autonomous agent built for a particular purpose.
<p>

<p>
<a href="https://www.youtube.com/watch?v=1zUTWVxNdR0&list=PLH7s1qvZKUeLampPQdBggg8LK31heBTxk&index=10&pp=iAQB">Video tour</a>

Uses:<ul>

<li><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/google-custom-search.bgl.json">Google Custom Search API</a>
<li><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/search-wikipedia.bgl.json">Wikipedia Search API</a>
<li><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/get-web-page-content.bgl.json">Get Web Page Content</a>
<li><a href="https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/google-places-api.bgl.json">Google Places API</a>

<p>
Will require Google Places API key. Get it <a href="https://developers.google.com/maps/documentation/places/web-service/get-api-key">here</a>.</li></ul>

   </td>
  </tr>
</tbody>
</table>

In addition, there are several tools, marked with a ⚒️ symbol. Tools are also boards, designed to be used by other boards. Every “Calls [name] API” in the table above is a tool board being invoked:

- [Google Books API](https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/google-books-search-api.bgl.json) – takes a topic as input, Google Books API, and returns results
- [Google Trends API](https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/google-trends-api.bgl.json) - takes a locale (US, GB, etc.) and returns current trends for the locale
- [Google News API](https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/google-news-api.bgl.json) - takes a topic and returns current news headlines on this topics
- [Google Custom Search API](https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/google-custom-search.bgl.json) – takes a search query and returns Google Search results for this query
- [Wikipedia Search API](https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/search-wikipedia.bgl.json) – takes a search query and returns Wikipedia content related to this query
- [Get Web Page Content](https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/get-web-page-content.bgl.json) - takes a URL of the page and returns its contents. Will not work on pages that are designed to resist web page scraping.
- [Google Places API](https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/google-places-api.bgl.json) - takes a search query and returns places (think Google Maps places) related to this query.
- [Dall-E Image Generator](https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/dall-e-image-generator.bgl.json) – takes a prompt and generates an image based on it.
- [Claude 3.5 Sonnet](https://breadboard-ai.web.app/?tab0=https://breadboard-community.wl.r.appspot.com/boards/@shared/claude-3-5-sonnet.bgl.json) – takes a prompt, and generates text output using the Anthropic Claude 3.5 model.

## Beyond the basics

https://www.youtube.com/watch?v=tJAAgcnr9kg&list=PLH7s1qvZKUeLampPQdBggg8LK31heBTxk&index=11&pp=iAQB

For a more elaborate walkthrough on how to build a board from scratch, check out these guides:

- [Building a Librarian](https://breadboard-ai.github.io/breadboard/docs/guides/librarian/)
- [Building a Novel Generator](https://breadboard-ai.github.io/breadboard/docs/guides/novel-generator/)
- [Building a Social Media Post Creator](https://breadboard-ai.github.io/breadboard/docs/guides/social-post/)

If you’d like to learn more about all the different components that come with Breadboard, check out the kits docs:

- [Agent Kit](https://breadboard-ai.github.io/breadboard/docs/kits/agents/)
- [Core Kit](https://breadboard-ai.github.io/breadboard/docs/kits/core/)
- [Gemini Kit](https://breadboard-ai.github.io/breadboard/docs/kits/gemini/)
- [Google Drive Kit](https://breadboard-ai.github.io/breadboard/docs/kits/google-drive/)
- [JSON Kit](https://breadboard-ai.github.io/breadboard/docs/kits/json/)
- [Template Kit](https://breadboard-ai.github.io/breadboard/docs/kits/template/)
- [Built-in Kit](https://breadboard-ai.github.io/breadboard/docs/reference/kits/built-in/)

> [!NOTE]
> 🌵 some of the screenshots in the guides are showing the previous-generation UI, but the basics of building are still the same.
