# Incident Workspace

## The Problem Nobody Talks About

Your SIEM fires at 2am. Your on-call analyst pings two colleagues. They open Slack, share screens over a Zoom call nobody else can see, and start investigating in parallel — each in their own terminal, their own browser, their own head.

Three hours later, you've contained the incident. A week later, your compliance team asks: *"Walk us through how you determined it was a false positive."* Your lead analyst is on PTO. The Slack thread is 400 messages of noise. The Zoom recording expired.

You have no answer.

**The real problem isn't the incident. It's that your investigation produced no durable record of how your team thinks.**

Every conclusion your team reaches, every hypothesis they rule out, every query they run — it lives in people's heads and disappears when the shift ends. Your organisation keeps paying for the same investigation work, over and over, because there's nowhere for it to accumulate.

---

## Who This Is For

Incident Workspace is built for **security teams of 3–15 analysts** who coordinate critical investigations across multiple tools with no shared context — regardless of what else is in their stack.

SOAR automates the response to incidents you've seen before. Incident Workspace handles what SOAR can't: the unstructured, collaborative thinking your team does when they're looking at something new and figuring out what it even is. Most teams that use both find they're solving completely different problems.

You're the right fit if you recognise these:

- Your senior analysts carry investigation knowledge that your junior analysts can't access
- Shift handoffs are a 15-minute verbal summary that nobody writes down
- Post-incident reports take 1–2 hours to write and are outdated by the time they're read
- When a similar incident happens six months later, you start from scratch

If investigations at your organisation produce no durable record of *how* your team reached their conclusions, this is built for you.

---

## What It Is

Incident Workspace is a **real-time collaborative investigation board** — a shared space where your team investigates together, and the investigation itself becomes the documentation.

It is not a SIEM. It is not a ticketing system. It is not a SOAR replacement. It sits between *"alert fired"* and *"case closed"* — the human thinking layer where your analysts form hypotheses, test them against evidence, coordinate tasks, and reach conclusions together.

---

## A Concrete Example

**10:45pm** — A Splunk alert fires: unusual outbound traffic from three internal hosts.

**10:46pm** — One URL auto-creates an investigation board pre-loaded with the alert context. On-call analyst opens it. Two colleagues join within two minutes. All three see the same canvas. Live cursors show who's looking at what.

**10:48pm** — Analyst A creates a "Hypothesis" entity: *C2 beacon, staging exfil*. Analyst B creates an "Evidence" entity from a saved Splunk query showing the traffic pattern. They connect them on the canvas: *this evidence supports that hypothesis*.

**11:05pm** — Analyst C finds a conflicting data point — the traffic correlates with a scheduled backup job. Creates a "Blocker" entity, assigns a task to verify the backup schedule. Gets a notification when it's done.

**11:22pm** — False positive confirmed. The hypothesis is disproved. The reasoning is visible on the canvas.

**11:23pm** — One click promotes the investigation to a case record: the hypothesis, the evidence, the ruling, the timeline. Complete. No report to write.

**Next morning** — Your compliance team, your CISO, your junior analyst joining the team next week — they can all open that board and understand exactly how your team reached that conclusion, step by step.

---

## The Core Capability

### Investigation Canvas
A shared real-time board where your team lays out the investigation visually. Create typed entities — Hypothesis, Evidence, Blocker, Scope, Handoff — and draw connections between them. Everyone sees the same layout simultaneously. No screen sharing required.

Typed entities matter. A "Hypothesis" is something to test. "Evidence" supports or refutes it. A "Blocker" needs an owner. This structure keeps investigations from becoming unreadable whiteboards.

### Live Collaboration
- Real-time cursor presence — see where your colleagues are looking
- Built-in voice and screen sharing (no Zoom required)
- Up to 9 simultaneous screen shares with gallery and focus modes
- Task assignment with notifications so work doesn't get duplicated

### Automatic Timeline
Every entity created, every connection drawn, every task completed — automatically captured in a timestamped timeline. The investigation builds its own documentation as it happens. When it ends, the timeline is already written.

### One-Click Case Promotion
When your team reaches a conclusion, promote findings directly to durable case records. Evidence sets, linked entities, action items, decisions — all attached and indexed. No copy-paste. No summary to write from memory.

### Splunk Integration
Query Splunk directly from the investigation board. Save result sets as evidence, auto-extract IOCs (IPs, hashes, domains), and link query results to entities on the canvas. Your data stays in Splunk; the investigation context lives in the board.

---

## What Makes This Different From Existing Tools

**vs. Slack/Teams:** Slack is a communication layer. It has no concept of hypothesis, evidence, or conclusion. Scrollback is not an investigation record. Incident Workspace is where the thinking happens — Slack stays for notifications and cross-team comms.

**vs. Miro/FigJam:** General whiteboards have no task tracking, no audit trail, no case integration, no SIEM connectivity, and no concept of investigation workflow. You'd spend more time building the structure than doing the investigation.

**vs. SOAR platforms (XSOAR, Splunk SOAR):** SOAR automates playbooks. It does not support the free-form collaborative thinking that happens before you know which playbook applies. Incident Workspace is the layer where your team figures out what they're dealing with — then SOAR takes over. They're complementary, not competing.

**vs. your current setup:** The closest thing most teams have is a Zoom call, a shared Google Doc, and a Slack thread. These produce no structured record and force every analyst to maintain their own context.

---

## What You Get Over Time

The compounding value is institutional knowledge.

After 50 investigations on the platform, your junior analysts can search previous boards and see how your senior analysts investigated similar alerts. Your new hire can understand your team's reasoning patterns from day one. Your compliance team has a complete evidence trail without asking analysts to reconstruct it.

Your team's investigation knowledge stops walking out the door at shift change.

---

## Collaborative AI Analysts — Available Now

The investigation canvas your team builds — typed entities, evidence connections, hypothesis chains — is structured context that most AI tooling can't use. Incident Workspace puts that context to work.

**Deploy AI agents directly into your investigation room.** Configure one as an L1 triage analyst, another as a threat intelligence enricher, another as an incident report writer. When your analyst is looking at a hypothesis or an IOC on the canvas, they click one button — the agent reads the entity context and gets to work.

### What actually happens

The agent's reasoning appears live as a new card on the shared canvas, connected to the entity being investigated. Every team member sees it in real-time as it streams in. When the agent finishes, its findings are a first-class part of the investigation — same as anything a human analyst would add:

- **Log it to the timeline** — add the agent's analysis to the incident feed with one click
- **Create an action item** — turn an agent-identified lead into an assigned follow-up task
- **Promote to a case record** — push the agent's findings directly into your durable case documentation
- **Propose new entities** — agents can suggest new hypotheses, evidence, or blockers; your analyst accepts or dismisses each one

### Tool-calling against your data sources

Agents aren't limited to reasoning over the canvas. Give an agent access to your enrichment data sources and it will make live tool calls mid-investigation — querying VirusTotal for an IP reputation verdict, cross-referencing a hash, or pulling threat intelligence on a domain — then weave the results into its analysis. Tool call summaries appear on the reasoning card so your team can see exactly what the agent checked.

### Fully local. No data leaves your environment.

This runs on **Ollama** — open-weight models you host yourself. Your incident data, your IOCs, your hypotheses never leave your infrastructure. No API calls to external LLM providers. No data residency concerns. The model runs where your investigation runs.

### Multiple agents, multiple roles

You configure the agents. Each one gets a persona, a system prompt, and access to the specific tools it needs. A triage agent that checks every inbound IP. A senior analyst agent that critiques your current hypothesis set. A reporting agent that drafts a post-incident summary from the canvas. Your team invokes them on demand, directly from the entity they're investigating.

Because the agents work on the same structured canvas as your human analysts, their contributions are indistinguishable from any other team member's — except they're available at 2am, don't get paged out, and never lose context.

---

## Current Integrations

- **Splunk** — Full query integration, result set saving, IOC extraction
- **Ollama** — Local LLM runtime for AI agents; bring your own open-weight model (Llama, Mistral, Gemma, and others)
- **VirusTotal** — Agent tool-calling integration for IOC enrichment (IP, domain, file hash verdicts)
- **Webhook intake** — PagerDuty, OpsGenie, and custom alert sources
- **Extensible framework** — Additional data source integrations are in active development; reach out if your SIEM or threat intel source is a priority

---

## Deployment

**Cloud-hosted:** Provision and start in under 10 minutes. HTTPS, isolated environments per organisation.

**Self-hosted:** Docker-based deployment for teams that need data residency or operate in air-gapped environments. Infrastructure requirements and setup guide provided on request.

SSO/SAML support is on the roadmap and scoped for the next major release. If this is a hard requirement for your team, let us know — it affects our prioritisation.

---

## Pricing

**Team — $499/month**
Up to 15 users. Cloud-hosted. Splunk integration. AI agents (up to 3 configured agents). Email support. Suitable for most growing SOC teams.

**Growth — $1,200/month**
Unlimited users. Unlimited agents. Priority support. Custom webhook integrations. Onboarding session included. For teams running multiple active investigations simultaneously.

**Self-Hosted / Enterprise**
Custom pricing. Includes self-hosted deployment, Ollama integration, dedicated onboarding, and direct access to the engineering team for integration work. Contact us.

All plans include a 30-day trial. No credit card required to start.

---

## What We Are Not (Yet)

We believe in being direct about current limitations:

- **SSO/SAML is not yet available.** If this is a hard procurement requirement, reach out — it is scoped and actively being built.
- **Mobile is not supported.** The investigation canvas requires a desktop browser. Mobile participants can view but not fully interact.
- **We currently integrate deeply with Splunk.** If your primary data source is Elastic, Microsoft Sentinel, or another SIEM, basic webhook connectivity works today; native query integration is on the roadmap.

---

## Getting Started

The fastest way to evaluate this is to run one real investigation through it.

1. **Day 1:** We provision your environment and connect your Splunk instance (typically under 2 hours).
2. **Week 1:** Your team uses it on the next real incident or a replay of a recent one.
3. **Week 2:** You have a concrete read on whether the timeline and case promotion alone justify the cost.

We don't do 45-minute demo calls where we walk you through slides. We'd rather give you access and let you run a drill with your actual team on your actual data.

[Request Access] [Book a Technical Setup Call] [View Documentation]

---

## FAQ

**Q: How is this different from a shared Google Doc during an incident?**
A: A Google Doc has no structure, no task tracking, no SIEM connectivity, and no automatic timeline. It also requires someone to maintain it in real-time while also investigating — which nobody actually does under pressure. Incident Workspace captures structure automatically as investigation work happens.

**Q: We already have XSOAR/Splunk SOAR. Why would we add another tool?**
A: SOAR runs playbooks once you know what you're dealing with. Incident Workspace is for the period before that — when your team is forming hypotheses and figuring out what alert type they're actually looking at. Most SOAR users find the two are complementary. If your SOAR is handling the full investigation workflow effectively, you probably don't need this.

**Q: Can non-security teams use this?**
A: The entity types and workflow are optimised for security investigations. Teams handling production outages or compliance investigations have used it effectively, but the integrations and terminology are security-oriented.

**Q: What happens to our data if we cancel?**
A: Full export of all boards, case records, and timelines in JSON and PDF formats at any time, including on cancellation.

**Q: How many users can be on a board simultaneously?**
A: Tested with 12 concurrent users. Performance with larger groups depends on network conditions; let us know your scale requirements.

**Q: Do the AI agents send our data to OpenAI or another cloud LLM provider?**
A: No. Agents run entirely on Ollama — a local model runtime you host in your own environment. Your investigation data, IOCs, and hypotheses never leave your infrastructure. You choose the model; we never touch the inference.

**Q: What models does the AI agent feature support?**
A: Any model available through Ollama — Llama 3, Mistral, Gemma, Phi, and others. Tool-calling (for enrichment integrations like VirusTotal) requires a model with native function-calling support; we recommend Llama 3.1 8B or larger for reliable results.

**Q: Can we configure what the agents do?**
A: Yes. Each agent gets a custom name, a system prompt you write, and a selection of tool integrations from your configured data sources. You decide what each agent focuses on — triage, enrichment, report writing, hypothesis critique — and what data it has access to.

---

*Incident Workspace — your team's investigations, preserved.*
