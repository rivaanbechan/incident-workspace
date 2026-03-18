# Incident Workspace

## The Problem Nobody Talks About

Your SIEM fires at 2am. Your on-call analyst pings two colleagues. They open Slack, share screens over a Zoom call nobody else can see, and start investigating in parallel — each in their own terminal, their own browser, their own head.

Three hours later, you've contained the incident. A week later, your compliance team asks: *"Walk us through how you determined it was a false positive."* Your lead analyst is on PTO. The Slack thread is 400 messages of noise. The Zoom recording expired.

You have no answer.

**The real problem isn't the incident. It's that your investigation produced no durable record of how your team thinks.**

Every conclusion your team reaches, every hypothesis they rule out, every query they run — it lives in people's heads and disappears when the shift ends. Your organisation keeps paying for the same investigation work, over and over, because there's nowhere for it to accumulate.

---

## Who This Is For

Incident Workspace is built for **SOC and IR teams of 5–30 analysts** who need to coordinate complex, multi-person investigations — particularly teams operating under regulatory scrutiny, running shift-based operations, or handling novel threats where no playbook exists yet.

SOAR automates the response to incidents you've seen before. Incident Workspace handles what SOAR can't: the unstructured, collaborative thinking your team does when they're looking at something new and figuring out what it even is. Most teams that use both find they're solving completely different problems.

You're the right fit if you recognise these:

- Your senior analysts carry investigation knowledge that your junior analysts can't access
- Shift handoffs are a 15-minute verbal summary that nobody writes down
- Post-incident reports take 1–2 hours to write and are outdated by the time they're read
- When a similar incident happens six months later, you start from scratch
- You've been told you cannot send incident data or IOCs to external AI providers

If investigations at your organisation produce no durable record of *how* your team reached their conclusions — and you need that to stay inside your own infrastructure — this is built for you.

---

## Your Data Never Leaves Your Environment

This is worth saying upfront, because for most security teams it's not a preference — it's a requirement.

Incident Workspace runs your AI agents on **Ollama**, an open-weight model runtime you host in your own infrastructure. Your incident data, your IOCs, your internal hostnames, your hypotheses — none of it is sent to OpenAI, Anthropic, or any external API. The model runs where your investigation runs.

This is not a future roadmap item. It works today, on your hardware, air-gapped if needed.

Most AI-augmented security tooling fails a basic procurement question: *"Where does our incident data go during inference?"* We have a clean answer. Your data doesn't go anywhere.

---

## What It Is

Incident Workspace is a **real-time collaborative investigation board** — a shared space where your team investigates together, and the investigation itself becomes the documentation.

It is not a SIEM. It is not a ticketing system. It is not a SOAR replacement. It is not an alerting tool. It sits between *"alert fired"* and *"case closed"* — the human thinking layer where your analysts form hypotheses, test them against evidence, coordinate tasks, and reach conclusions together.

---

## A Concrete Example

**10:45pm** — A Splunk alert fires: unusual outbound traffic from three internal hosts.

**10:46pm** — One URL auto-creates an investigation board pre-loaded with the alert context. On-call analyst opens it. Two colleagues join within two minutes. All three see the same canvas. Live cursors show who's looking at what.

**10:48pm** — Analyst A creates a "Hypothesis" entity: *C2 beacon, staging exfil*. Analyst B creates an "Evidence" entity from a saved Splunk query showing the traffic pattern. They connect them on the canvas: *this evidence supports that hypothesis*.

**10:52pm** — An AI triage agent is invoked on the suspicious IP entity. It makes a live VirusTotal lookup, pulls the verdict, and streams its analysis directly onto the canvas as a new card. The team sees its reasoning in real time. No data left the building.

**11:05pm** — Analyst C joins late. Instead of interrupting the other two, she opens the Feed tab and reads the typed chronological record: one Decision entry explaining the working hypothesis, one Update entry with the Splunk query results, one Mitigation entry marking the host as isolated. She's current in under a minute. Finds a conflicting data point — the traffic correlates with a scheduled backup job. Creates a "Blocker" entity, assigns a task to verify the backup schedule. Gets a notification when it's done.

**11:22pm** — False positive confirmed. Analyst A logs a Decision entry: *"Confirmed false positive. Traffic attributed to backup job running on schedule. No further action."* The hypothesis is marked refuted on the canvas.

**11:23pm** — One click promotes the investigation to a case record: the hypothesis, the evidence, the ruling, the feed. Complete. No report to write.

**Next morning** — Your compliance team, your CISO, your junior analyst joining the team next week — they open the feed and read exactly how your team reached that conclusion, entry by entry, in the order it happened.

---

## The Core Capability

### Investigation Canvas
A shared real-time board where your team lays out the investigation visually. Create typed entities — Hypothesis, Evidence, Blocker, Scope, Handoff — and draw connections between them. Everyone sees the same layout simultaneously. No screen sharing required.

Typed entities matter. A "Hypothesis" is something to test. "Evidence" supports or refutes it. A "Blocker" needs an owner. Zones let leads group and label related clusters of entities. This structure keeps investigations readable as they scale — a board with 30 entities is navigable in a way that a 400-message Slack thread is not.

### Live Collaboration Without Extra Tools
- Real-time cursor presence — see where your colleagues are looking
- Built-in voice and screen sharing (no Zoom required)
- Up to 9 simultaneous screen shares with gallery and focus modes
- Task assignment with notifications so work doesn't get duplicated
- One less tool to context-switch to during a live incident

### Structured Incident Feed
The feed is not a generic activity log. Every entry is typed — **Decision**, **Mitigation**, **Update**, **Comms**, or **Owner Change** — each with its own guided template so analysts capture the right information under pressure, not just free text.

Every entry is timestamped, attributed, and cross-linked to the canvas entities and action items it relates to. Entries are grouped by day, filterable by type, and the header always shows a live count of decisions made, mitigations applied, and comms sent.

This matters for two reasons. First, an analyst joining a live incident two hours in can switch to the feed, scan the typed chronological record, and get up to speed without interrupting anyone — regardless of how sprawling the canvas is at that point. Second, when the incident ends, the feed is already the post-incident report. No reconstruction from memory. No Slack archaeology.

### One-Click Case Promotion
When your team reaches a conclusion, promote findings directly to durable case records. Evidence sets, linked entities, action items, decisions — all attached and indexed. No copy-paste. No summary to write from memory.

### SIEM Integration
Query your data source directly from the investigation board. Save result sets as evidence, auto-extract IOCs (IPs, hashes, domains, users, processes), and link query results to entities on the canvas. Your data stays in your SIEM; the investigation context lives in the board.

*Currently supported: Splunk (full query integration). Elastic, Microsoft Sentinel, and Microsoft Advanced Hunting are on the active roadmap — reach out if your SIEM is a priority.*

---

## Collaborative AI Analysts — Available Now, Fully Local

The investigation canvas your team builds — typed entities, evidence connections, hypothesis chains — is structured context that most AI tooling can't use. Incident Workspace puts that context to work, without touching an external API.

**Deploy AI agents directly into your investigation room.** Configure one as an L1 triage analyst, another as a threat intelligence enricher, another as an incident report writer. When your analyst is looking at a hypothesis or an IOC on the canvas, they click one button — the agent reads the entity context and gets to work.

### What actually happens

The agent's reasoning appears live as a new card on the shared canvas, connected to the entity being investigated. Every team member sees it in real-time as it streams in. When the agent finishes, its findings are a first-class part of the investigation — same as anything a human analyst would add:

- **Log it to the timeline** — add the agent's analysis to the incident feed with one click
- **Create an action item** — turn an agent-identified lead into an assigned follow-up task
- **Promote to a case record** — push the agent's findings directly into your durable case documentation
- **Propose new entities** — agents can suggest new hypotheses, evidence, or blockers; your analyst accepts or dismisses each one

### Tool-calling against your data sources

Agents aren't limited to reasoning over the canvas. Give an agent access to your enrichment data sources and it will make live tool calls mid-investigation — querying VirusTotal for an IP reputation verdict, cross-referencing a hash, or pulling threat intelligence on a domain — then weave the results into its analysis. Tool call summaries appear on the reasoning card so your team can see exactly what the agent checked.

### Multiple agents, multiple roles

You configure the agents. Each one gets a persona, a system prompt, and access to the specific tools it needs. A triage agent that checks every inbound IP. A senior analyst agent that critiques your current hypothesis set. A reporting agent that drafts a post-incident summary from the canvas. Your team invokes them on demand, directly from the entity they're investigating.

Because the agents work on the same structured canvas as your human analysts, their contributions are indistinguishable from any other team member's — except they're available at 2am, don't get paged out, and never lose context.

---

## What Makes This Different From Existing Tools

**vs. TheHive:** TheHive is the most commonly deployed open-source IR case management platform, and it's free. If your team's primary need is case tracking and observable management — and you have someone to run the infrastructure — it's a legitimate choice. Where Incident Workspace differs: TheHive is a list-and-form UI optimised for after-the-fact case documentation. It has no real-time canvas, no built-in voice/video, no AI agents, and no concept of hypothesis-to-evidence reasoning chains. If your team investigates reactively and writes up findings after the fact, TheHive may be sufficient. If your team investigates *collaboratively in real time* and needs that process to produce its own documentation, that's what we're built for.

**vs. SOAR platforms (XSOAR, Splunk SOAR, Tines):** SOAR automates playbooks. It does not support the free-form collaborative thinking that happens before you know which playbook applies. Incident Workspace is the layer where your team figures out what they're dealing with — then SOAR takes over. They're complementary, not competing.

**vs. Slack/Teams:** Slack is a communication layer. It has no concept of hypothesis, evidence, or conclusion. Scrollback is not an investigation record. Incident Workspace is where the thinking happens — Slack stays for notifications and cross-team comms.

**vs. Miro/FigJam:** General whiteboards have no task tracking, no audit trail, no case integration, no SIEM connectivity, and no concept of investigation workflow. You'd spend more time building the structure than doing the investigation.

**vs. AI-augmented tools sending data externally:** If a tool sends your incident data or IOCs to an external LLM provider, it may fail your data handling requirements before you finish the procurement form. Incident Workspace uses Ollama — inference runs in your environment.

---

## What You Get Over Time

The compounding value is institutional knowledge.

After 50 investigations on the platform, your junior analysts can search previous boards and see how your senior analysts investigated similar alerts. Your new hire can understand your team's reasoning patterns from day one. Your compliance team has a complete evidence trail without asking analysts to reconstruct it.

Your team's investigation knowledge stops walking out the door at shift change.

---

## Current Integrations

- **Splunk** — Full query integration, result set saving, IOC extraction
- **Ollama** — Local LLM runtime for AI agents; bring your own open-weight model (Llama, Mistral, Gemma, and others)
- **VirusTotal** — Agent tool-calling integration for IOC enrichment (IP, domain, file hash verdicts)
- **Webhook intake** — PagerDuty, OpsGenie, and custom alert sources
- **Elastic / Microsoft Sentinel / Advanced Hunting** — On the active roadmap; reach out if this is a priority for your team

---

## Deployment

**Cloud-hosted:** Provision and start in under 10 minutes. HTTPS, isolated environments per organisation. Note: cloud-hosted deployments use cloud infrastructure for the application layer; Ollama (AI inference) must be self-hosted regardless of deployment model to preserve your data residency guarantees.

**Self-hosted:** Docker-based deployment for teams that need full data residency or operate in air-gapped environments. Everything — application, collaboration layer, AI inference — runs on your hardware. Infrastructure requirements and setup guide provided on request.

SSO/SAML support is on the roadmap and scoped for the next major release. If this is a hard procurement requirement, let us know — it affects our prioritisation.

---

## Pricing

**Team — $499/month**
Up to 15 users. Cloud-hosted (Ollama self-hosted). Splunk integration. AI agents (up to 3 configured agents). Email support. Suitable for most growing SOC teams.

**Growth — $1,200/month**
Unlimited users. Unlimited agents. Priority support. Custom webhook integrations. Onboarding session included. For teams running multiple active investigations simultaneously.

**Self-Hosted / Enterprise**
Custom pricing. Includes fully self-hosted deployment, dedicated onboarding, and direct access to the engineering team for integration work. Contact us.

All plans include a 30-day trial. No credit card required to start.

---

## What We Are Not (Yet)

We believe in being direct about current limitations:

- **SSO/SAML is not yet available.** If this is a hard procurement requirement, reach out — it is scoped and actively being built.
- **Mobile is not supported.** The investigation canvas requires a desktop browser. Mobile participants can view but not fully interact.
- **Deep SIEM integration currently covers Splunk.** Elastic, Sentinel, and Advanced Hunting have webhook connectivity today; native query integration is on the roadmap. If your SIEM is a priority, tell us — it directly affects our build order.

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

**Q: How is this different from TheHive?**
A: TheHive is a solid open-source case management platform and a legitimate alternative if your team's workflow is primarily post-incident documentation. The core difference is the canvas: Incident Workspace is built for the live investigation — real-time collaboration, hypothesis chains, built-in voice/video, AI agents running locally. TheHive is built for recording what happened after it happened. Many teams find they need both layers; others find the canvas approach replaces the need for a separate case tool entirely via case promotion.

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

**Q: How do you stop a canvas from becoming an unreadable mess during a fast-moving incident?**
A: It will get messy, and that's fine — the canvas is where your team thinks, not where they present. The feed is where the record lives. During a fast-moving investigation, analysts work in parallel across different corners of the canvas; the feed captures every decision, mitigation, and update in typed, chronological order regardless of where things are spatially. Anyone joining mid-incident reads the feed to get current — not the canvas. When the incident ends, the canvas reflects how your team thought; the feed reflects what they concluded. Both are useful for different audiences.

---

*Incident Workspace — your team's investigations, preserved.*
