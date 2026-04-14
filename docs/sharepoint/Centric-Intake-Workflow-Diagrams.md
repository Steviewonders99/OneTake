---
title: "Centric Intake Workflow Diagrams"
subtitle: "End-to-end workflow and staged generation flow"
author: "Centric Intake Team"
date: "April 2026"
---

# Centric Intake Workflow Diagrams

## How To Read This Document

This document explains the workflow diagrams in plain language and includes the Mermaid source used to recreate the diagrams in tools that support Mermaid rendering.

The workflow is split into two views:

- End-to-end operating workflow: how a campaign moves from intake to review to handoff.
- Generation pipeline: how each AI generation stage feeds the next stage.

## End-To-End Operating Workflow

### Summary

The operating workflow starts with intake, moves through generation, pauses for marketing-manager review, and then unlocks designer, recruiter, and agency handoffs after approval.

### Reader-Friendly Flow

| Step | Owner | System Action | Result |
| --- | --- | --- | --- |
| 1 | Recruiter or Admin | Creates intake request. | Request enters the system. |
| 2 | Web App | Validates request and extracts structured fields. | Clean campaign data is saved. |
| 3 | Web App | Creates a compute job. | Worker has queued generation work. |
| 4 | Python Worker | Claims the job from the database. | Generation begins. |
| 5 | Python Worker | Runs the staged generation pipeline. | Strategy, personas, copy, images, creatives, and optional video are produced. |
| 6 | Web App | Moves request to review. | Marketing manager review is required. |
| 7 | Marketing Manager | Approves or requests changes. | Campaign either moves forward or returns for revision. |
| 8 | Designer | Reviews context, downloads kits, leaves notes, uploads finals. | Design handoff is completed. |
| 9 | Recruiter | Uses approved assets and creates tracked links. | Campaign activation begins. |
| 10 | Agency | Receives package view and export. | External handoff is packaged. |

### Mermaid Source

```mermaid
flowchart TD
    A["Recruiter/Admin creates intake request"] --> B["Schema validation + job requirements extraction"]
    B --> C["Request saved in intake_requests"]
    C --> D["Status set to generating"]
    D --> E["compute_jobs row created"]
    E --> F["Local Python worker claims job from Neon"]

    F --> G["Generation Pipeline"]
    G --> H["Status set to review"]
    H --> I["Marketing Manager review in admin dashboard"]

    I --> J{"Approve?"}
    J -- "No, request changes" --> K["Approval record: changes_requested"]
    K --> L["Status reset to draft"]
    L --> M["Regenerate full pipeline or specific stage"]
    M --> D

    J -- "Yes" --> N["Approval record: approved"]
    N --> O["Magic link created"]
    O --> P["Status set to approved"]
    P --> Q["Designer notified / designer portal opens"]

    Q --> R["Designer reviews context, downloads kit, leaves notes, uploads replacements"]
    R --> S{"Submit finals?"}
    S -- "Not yet" --> R
    S -- "Yes" --> T["Status set to sent"]

    P --> U["Recruiter post-approval workspace unlocked"]
    T --> U
    U --> V["Recruiter uses approved creatives"]
    V --> W["Recruiter builds tracked links"]
    W --> X["Short-link redirects tracked"]

    P --> Y["Agency link can be generated"]
    T --> Y
    Y --> Z["Agency package view + ZIP export"]
```

## Generation Pipeline

### Summary

The generation pipeline is intentionally staged. Each stage produces structured outputs that become the inputs for the next stage. This makes the system easier to reason about, review, retry, and improve over time.

### Stage Dependency Map

| Stage | Inputs | Outputs | Feeds |
| --- | --- | --- | --- |
| Stage 1: Strategic Intelligence | Intake request, regions, languages, form data. | Research, personas, campaign strategy, creative brief, design direction. | Stage 2, Stage 3, Stage 4. |
| Stage 2: Character-Driven Image Generation | Personas, design direction, regions, languages. | Actor profiles, seed images, image variations, base image assets. | Stage 3 and Stage 4. |
| Stage 3: Copy Generation | Brief, personas, design direction, channel strategy. | Persona, platform, and language-specific copy variants. | Stage 4. |
| Stage 4: Layout Composition | Actors, images, copy, brief, design direction, platform specs. | Composed creatives, overlays, carousel panels, final renders. | Stage 5 and review package. |
| Stage 5: Video Generation | Personas, actors, brief, images, messaging context. | Optional UGC-style video assets. | Final review package. |

### Mermaid Source

```mermaid
flowchart TD
    S0["Job claimed by worker"] --> S1["Stage 1: Strategic Intelligence"]

    S1 --> S1A["Inputs:
    intake request
    target regions
    target languages
    form_data"]

    S1 --> S1B["Outputs:
    cultural research
    personas
    campaign strategies
    brief_data
    design_direction
    derived_requirements"]

    S1B --> S2["Stage 2: Character-Driven Image Generation"]

    S2 --> S2A["Uses:
    personas
    design_direction
    regions
    languages"]

    S2 --> S2B["Outputs:
    actor profiles
    validated seed image per actor
    image variations
    base_image assets"]

    S2B --> S3["Stage 3: Copy Generation"]

    S3 --> S3A["Uses:
    brief
    personas
    design_direction
    regions
    languages
    channel strategy"]

    S3 --> S3B["Outputs:
    persona x channel x language copy variants
    copy assets"]

    S3B --> S4["Stage 4: Layout Composition"]

    S4 --> S4A["Uses:
    actors
    base images
    copy assets
    brief
    design direction
    platform specs"]

    S4 --> S4B["Outputs:
    composed_creative assets
    carousel assets
    overlay/final renders"]

    S4B --> S5["Stage 5: Video Generation"]

    S5 --> S5A["Uses:
    personas
    actors
    brief
    Stage 2 images
    Stage 3/4 messaging context"]

    S5 --> S5B["Outputs:
    short UGC-style video assets"]

    S5B --> DONE["Request status -> review"]
```

## Key Review Talking Points

- Intake creates the source campaign record.
- Compute jobs decouple web interactions from heavy AI work.
- Stage 1 is the strategy layer and should happen before visual generation.
- Stage 2 creates the visual identity layer.
- Stage 3 creates the messaging layer.
- Stage 4 combines strategy, visuals, and copy into usable creative outputs.
- Stage 5 extends the package into optional video.
- Marketing review is the quality gate before designer, recruiter, or agency handoff.

