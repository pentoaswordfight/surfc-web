---
title: Gated-Conducted Engineering in Practise
description: Breaking down the Gated-Conducted Engineering Framework
pubDate: 2026-05-22
author: Deji Dipeolu
tags: []
draft: true
updatedDate: 2026-05-22
---
> Everyone has a plan until they get punched in the face
> 
- Mike Tyson

533 Linear tickets. 1551 test cases. 61 PRDs. 281 pull requests. 100+ late nights. 1 patient wife. (All current at time of writing.)

If this is "vibe-coding" then it's bad vibes. What's funny is that I have always considered myself something of a free spirit. Not true, as it turns out, when I'm building something I care about.

The screenshot below is from today's interaction with Claude Code over code it would have happily shipped (having actually caught a bug and "fixed" it) if I hadn't pushed back.

![](assets/Pasted%20image%2020260520174234.png)

A relatively trivial thing, but the sort of death-by-a-thousand-paper-cuts that results in [disaster](https://www.reddit.com/r/vibecoding/comments/1su03dk/vibe_coded_for_6_months_my_codebase_is_a_disaster/). 

I previously covered the "why" and "when" of GCE. In this post, I will explain the (still evolving) framework that allows me to sleep well as a solo founder. My [previous post](https://surfc.app/blog/spine-vs-surface/) laid out the 3 tenets of GCE, and next I will explain how I'm fitting the pieces together.

### The first thing I built was a test

One January afternoon, I prompted Claude to see if it could build a prototype for a project I had been stuck on for over a year. I have to say I was pretty amazed at what it produced. Rudimentary but functional, and helpful in unblocking me enough to create what has become Surfc. If I'm honest, I felt a little guilty at first at how easy it was. And a little uneasy. So I decided to go back to my foundations of Test Driven Development. I wrote a test and asked Claude to build functionality to pass the test.

A test cannot be charmed. It tells me the code does what I said it should, or it goes red. What started as one test became the entire building philosophy, and how I know I'm not building a house of cards.

### So I built an entire production line around testing

GCE is effectively a series of agent harnesses that every non-trivial change has to pass through. Every harness tests the assumptions, decisions and implementation that came before it.

The first harness runs a pressure test. Is this ticket necessary? Is the value it adds worth the effort of scoping and then deploying the agent to build it? Is it worth the tokens? What will it break that I haven't considered up front? What is the cost of building it? What is the cost of doing nothing? Is there a version that gets me eighty percent of the way there for twenty percent of the cost? These are all questions that need an answer before a single line of code is written.

Changes with a bounded blast radius run through the second harness. Depending on the nature of the change, a UX or a naming or a regression review might be warranted. This is the bit that's fast. Being wrong is cheap here, so I let the agents man the gate.

The third harness is how I avoid workarounds becoming habit. A gate-bypass forces any shortcuts or workarounds, any "acceptable" bugs or regressions, to be captured and documented, with a clear resolution plan. After the first time I had to do that, I decided it was better to just fix the bug.

The floor under all of this is that agents hold nothing that can hurt me. No production database, no prod API keys, and nothing that touches payments or encryption. An agent can write a database migration file. I'm still the one who reviews and runs it. Every single one. This won't scale. That's fine. I sleep better.

The final harness is one I can't take credit for. I stumbled into it, but it works so well I kept it. Codex Review in GitHub was a box I ticked when setting up my CI pipeline. A different model, from a different vendor, reviewing without any of the context the rest of the line is steeped in. Like an auditor. It's saved me more times than I can count. Codex in CI reads the diff and flags what it finds. No inherited blind spots. No bias. Just find where it breaks. (About half of the findings turn out to be me neglecting to document an architecture change.)

### Still WIP

The framework isn't fully formed. It is always evolving. I update it as I learn. I tweak it to better fit the repo when something changes. I fold in lessons from other builders and thinkers from time to time. For example, I read a fascinating article by [Kristof Geilenkotten](https://www.linkedin.com/in/geilenkotten) discussing the value of friction in the product development process, and specifically the role of the dissenter, or devil's advocate. I'm still digesting the concept and considering whether it is a necessary gate for Surfc. In this, I'm applying the self-same philosophy to adopting the devil's advocate. Meta.

The harnesses are discrete rigs that I invoke manually today. I intend to wire them into a single end-to-end harness: one workflow that carries a change from its Linear ticket to merge, running each gate in order and pausing for my input where the stakes demand it. The process is deliberately slow but, ironically, the more gates and controls I have in place, the more comfortable I am picking up the pace.

This is what makes Surfc. It is gruelling and it is satisfying, because I know that if I end up building something terrible, I will have at least done it on purpose.