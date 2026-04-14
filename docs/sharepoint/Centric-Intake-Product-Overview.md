---
title: "Centric Intake Product Overview"
subtitle: "Recruitment campaign intake, generation, review, and handoff platform"
author: "Centric Intake Team"
date: "April 2026"
---

# Centric Intake Product Overview

## Executive Summary

Centric Intake is an AI-assisted recruitment campaign workflow platform. It turns recruiter requests, pasted briefs, and RFP-style inputs into structured campaign workspaces with strategy, personas, creative assets, landing page handoff details, tracked links, designer collaboration, and agency-ready exports.

The platform is designed to reduce handoff friction between recruiters, marketing managers, designers, agencies, and campaign stakeholders. Instead of relying on scattered briefs, chat threads, folders, and manual creative coordination, Centric Intake centralizes the process from intake through final delivery.

## What The Platform Solves

Recruitment campaign delivery usually breaks down across several handoffs:

- Recruiters need a simple way to request campaigns.
- Marketing needs structured, reviewable campaign context.
- Designers need briefs, assets, references, and notes in one place.
- Agencies need packaged deliverables and source context.
- Recruiters need approved creative and trackable campaign links.
- Leadership needs visibility into campaign status and throughput.

Centric Intake addresses these handoffs with a single workflow that captures the request, generates campaign materials, routes work through review, and unlocks the right workspace for each downstream team.

## Platform Capabilities

| Capability | What It Enables |
| --- | --- |
| Structured Intake | Recruiters or admins submit campaign requests through schema-driven forms. |
| Brief Extraction | Pasted briefs or uploaded RFP content can be transformed into usable intake data. |
| AI Generation | The worker generates strategy, personas, copy, images, composed creatives, carousels, and optional video. |
| Marketing Review | Marketing managers review the package before it moves downstream. |
| Designer Collaboration | Designers receive campaign context, download kits, leave notes, and upload refined assets. |
| Recruiter Handoff | Recruiters receive approved creative libraries and tracked campaign links. |
| Agency Handoff | Agencies can access packaged campaign views and downloadable exports. |
| Tracking | Recruiter-generated links support source, platform, and campaign-level attribution. |

## End-To-End Workflow

```text
Recruiter or admin submits intake
  -> request is validated and saved
  -> compute job is queued
  -> AI generation pipeline runs
  -> marketing manager reviews package
  -> package is approved or sent back for changes
  -> designer workspace opens
  -> recruiter creative library unlocks
  -> agency package can be shared
  -> tracked links capture campaign engagement
```

## User Experiences

### Recruiter

Recruiters can submit campaign requests, monitor status, and use approved campaign assets after marketing approval. Once a campaign is approved, recruiters can browse creative assets, download approved files, build tracked campaign links, and monitor click activity.

### Marketing Manager

Marketing managers act as the quality gate. They review campaign strategy, brief outputs, personas, generated assets, landing page handoff data, and overall readiness. They can approve the campaign, request changes, retry generation, manage assets, and prepare downstream handoff.

### Designer

Designers receive a focused workspace with the context they need to finish or refine campaign assets. They can review the brief, download generated assets, leave notes, upload replacements, and submit finals.

### Agency

Agencies receive a package-oriented view of the campaign. The package includes campaign context, strategy data, persona-grouped creative assets, platform-ready files, and ZIP export capability.

## Generation Pipeline

The platform uses a staged generation process where each stage produces structured inputs for the next.

| Stage | Name | Purpose | Feeds Next |
| --- | --- | --- | --- |
| 1 | Strategic Intelligence | Builds cultural research, personas, campaign strategy, creative brief, and design direction. | Personas, regions, languages, design direction, derived requirements. |
| 2 | Character-Driven Image Generation | Creates actor profiles, seed images, image variations, and base visual assets. | Actor identity, validated visuals, image URLs. |
| 3 | Copy Generation | Creates copy variants by persona, platform, language, and messaging angle. | Approved copy sets and platform messaging. |
| 4 | Layout Composition | Combines actors, images, copy, and platform specs into composed creatives and carousels. | Final creative direction and packaged assets. |
| 5 | Video Generation | Creates optional short-form UGC-style video assets. | Video assets for campaign package. |

## Why It Is Impressive

Centric Intake is not just an AI content generator. It is closer to a campaign operations layer that connects request intake, AI-assisted production, human review, asset management, and downstream activation.

The strongest parts of the platform are:

- It maps to a real business workflow rather than a standalone demo.
- It separates heavy AI generation from the web app through a worker architecture.
- It stores generated outputs as campaign assets instead of one-off chat responses.
- It includes human review gates before assets are handed to designers, recruiters, or agencies.
- It supports multiple downstream audiences without forcing everyone into the same interface.
- It creates campaign tracking links so creative handoff can connect to performance.

## Strategic Value

The platform gives marketing a more operational role in recruitment campaign delivery. It shows that marketing can define the workflow, encode quality standards, coordinate creative production, and improve campaign execution across functions.

For engineering and product teams, the platform creates a clear foundation for deeper system ownership:

- Intake schemas can evolve by campaign type.
- Generation stages can be refined independently.
- Review workflows can be hardened.
- Designer and agency handoffs can become repeatable operating procedures.
- Tracking can connect creative production to campaign outcomes.

## Recommended Presentation Narrative

Use this order when presenting:

1. Start with the business problem: recruitment campaign work is high-handoff and easy to fragment.
2. Show the end-to-end workflow: intake, generation, review, designer handoff, recruiter handoff, agency package.
3. Explain the staged generation pipeline: strategy first, visuals second, copy third, composition fourth, optional video fifth.
4. Emphasize human review: the platform does not skip marketing judgement.
5. End with the strategic point: this is a workflow system that gives marketing, product, and engineering a shared operating model.

## Recommended Review Path

| Audience | Recommended Document |
| --- | --- |
| Product and leadership | Product Overview |
| Engineering | Technical Breakdown |
| Cross-functional meeting | Workflow Diagrams |
| Repository handoff | GitHub README |

