---
name: Stage 4 v2 Feedback — March 29 Session End
description: User feedback on Stage 4 v2 creative output. Three issues to fix next session: too minimal (bring back blobs), VQA needs hex code/screen artifact rejection, Seedream generates nonsensical backgrounds (pools).
type: feedback
---

## Feedback from reviewing Stage 4 v2 output

### 1. Too minimal — bring back blobs
The MINIMAL design instruction went too far. The v1 creatives had too much noise, but v2 is now too clean. Need a middle ground: more blob shapes, dot patterns, and decorative elements — but not competing with the photo.

**Why:** OneForma's brand identity uses organic blob shapes prominently. Removing them makes creatives look generic.

**How to apply:** Adjust the MINIMAL DESIGN rules in `prompts/creative_overlay.py` — change from "ONE blob maximum" to "2-3 blob shapes encouraged, but keep 25% whitespace."

### 2. VQA needs screen artifact rejection
Seedream generates fake phone UI with hex codes (#E8C08), gibberish text, and fake dollar bills on device screens. The VQA checker in Stage 2 should auto-reject these.

**Why:** Hex codes and fake UI elements are obvious AI tells that destroy credibility.

**How to apply:** Add auto-reject triggers to `prompts/eval_image_realism.py`:
- Visible hex codes (#XXXXXX patterns) on screens/devices
- Gibberish text on device screens
- Fake currency/money renders
- Any text that looks like code/debug output in the scene

### 3. Seedream generates nonsensical backgrounds
A Moroccan parent persona should NOT have a pool in the background. The scene prompts need stronger environmental constraints.

**Why:** Mismatched backgrounds break persona believability. A pool suggests luxury lifestyle, not a parent working from home.

**How to apply:** Update actor generation prompts in `prompts/recruitment_actors.py`:
- Backdrop descriptions must be persona-appropriate (not aspirational/luxury)
- Add negative prompt for Seedream: "no swimming pools, no luxury items, no mansions"
- VQA should flag environment mismatches: "Does this background match a [persona] in [region]?"

### Priority for next session
1. Fix VQA auto-reject triggers (catches bad images BEFORE they reach Stage 4)
2. Tighten Seedream negative prompts (prevents bad images from generating)
3. Adjust overlay MINIMAL rules (bring blobs back to middle ground)
4. LinkedIn carousel implementation (new feature)
