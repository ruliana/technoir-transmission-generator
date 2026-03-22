---
name: create-style-preset
description: Create custom visual and narrative style presets for Technoir Transmission generation based on user aesthetic preferences and media references like movies, books, games, or music
argument-hint: [optional: reference media]
allowed-tools: Read, Edit, AskUserQuestion
---

You are helping the user create a custom style preset for the Technoir Transmission Generator. This preset will define the visual tone, color palette, atmospheric details, and narrative voice for generating cyberpunk settings.

## Process

### 1. Gather Initial Inspiration

Greet the user warmly and explain you'll help them create a custom cyberpunk aesthetic. Ask them to share their vision:

"Let's create a custom style preset for your Technoir transmissions! What kind of aesthetic are you envisioning?

You can reference any media:
- Movies/TV (Blade Runner, Akira, Strange Days, etc.)
- Books/graphic novels (Neuromancer, Transmetropolitan, etc.)
- Games (Cyberpunk 2077, Deus Ex, VA-11 Hall-A, etc.)
- Music (synthwave, industrial, vaporwave artists)
- Art movements or visual styles
- Or just describe the vibe

The vaguer, the better to start - we'll refine together!"

If the user invoked with arguments (`$ARGUMENTS`), those are likely media references they want to use as inspiration.

### 2. Narrow Down Preferences

Use AskUserQuestion to gather preferences. Don't ask all at once - split into 2-3 rounds of questions.

**First Round - Visual & Color:**
```
questions:
  - question: What visual aesthetic feels right for your cyberpunk world?
    header: Visual Tone
    options:
      - label: Harsh neon & chrome
        description: Bright lights, reflective surfaces, hyperactive energy
      - label: Moody shadows & decay
        description: Dark corners, weathered rust, contemplative atmosphere
      - label: Clinical & sterile
        description: Clean whites, smooth surfaces, oppressive order
      - label: Digital glitches & chaos
        description: Corrupted visuals, fragmented reality, anarchic energy

  - question: What colors should dominate your setting?
    header: Color Palette
    options:
      - label: Bright synthetics (neon pink, electric blue, acid green)
        description: High contrast, eye-catching, 80s cyberpunk
      - label: Desaturated earth tones (rust, concrete, faded colors)
        description: Low contrast, gritty realism, decay
      - label: Deep darks with spot colors (black with cyan/red accents)
        description: Noir aesthetic, dramatic highlights
      - label: Pastel aberrations (soft pinks, purples, yellows)
        description: Vaporwave, dreamlike, slightly wrong
```

**Second Round - Atmosphere & Voice:**
```
questions:
  - question: What sensory elements define your world's atmosphere?
    header: Atmosphere
    options:
      - label: Rain-soaked streets & neon reflections
        description: Classic cyberpunk, constant drizzle, wet surfaces
      - label: Smog-choked air & industrial haze
        description: Environmental decay, hard to breathe, oppressive
      - label: Desert heat & dust storms
        description: Post-collapse, resource scarcity, harsh elements
      - label: Sterile cleanrooms & recycled air
        description: Corporate control, artificial everything, no nature

  - question: How should the narrative voice feel?
    header: Narrative Voice
    options:
      - label: Cynical noir introspection
        description: First-person fatalism, world-weary observations
      - label: Rapid-fire kinetic action
        description: Fast pacing, sensory overload, no time to think
      - label: Documentary observation
        description: Detached reporting, just the facts, show don't tell
      - label: Dark humor & rebellion
        description: Laugh to keep from screaming, punk attitude
```

### 3. Synthesize References

If the user mentioned specific media, acknowledge those references and identify key stylistic elements:

- **Blade Runner**: Rain-soaked neon, noir introspection, humanity vs machines
- **Akira**: Kinetic energy, red highlights, youth rebellion, bio-horror
- **Neuromancer**: Sparse prose, disembodied consciousness, jacking in
- **Strange Days**: POV intimacy, millennium anxiety, memory as commodity
- **Ghost in the Shell**: Philosophical depth, rain and reflections, identity questions
- **Deus Ex**: Conspiracy theories, augmentation ethics, golden glow
- **Transmetropolitan**: Dark satire, journalist POV, information overload
- **Vaporwave**: Pastel colors, retro-future nostalgia, commercial aesthetics

### 4. Generate the StyleGuide

Read the constants.tsx file to see existing style presets for reference.

Based on user preferences and references, create a cohesive StyleGuide. Write the four aspects directly:

**visualTone**: 2-3 sentences describing the dominant visual aesthetic, lighting, texture, and energy level

**colorPalette**: 2-3 sentences describing primary colors, contrast relationships, and emotional temperature

**atmosphericDetails**: 2-3 sentences describing sensory environment, weather/setting, and technology feel

**narrativeVoice**: 2-3 sentences describing pacing, perspective, and emotional tone

Each aspect should be 20-50 words, evocative and specific.

### 5. Present for Review

Show the user the complete StyleGuide:

```
Here's your custom style preset:

**Visual Tone**: [visualTone text]

**Color Palette**: [colorPalette text]

**Atmospheric Details**: [atmosphericDetails text]

**Narrative Voice**: [narrativeVoice text]

Does this capture what you're envisioning?
```

Ask if they want to:
- **Approve it** - Move to saving
- **Tweak specific aspects** - Regenerate parts
- **Start over** - Try different direction

If tweaks needed, regenerate only the specified aspect with their additional guidance.

### 6. Save to Library

Once approved, ask:
1. **Preset name**: Short, evocative (e.g., "Neon Chrome", "Acid Rain Dreams")
2. **Description**: One-line summary for the preset selector

Then add to constants.tsx:

1. Read the current constants.tsx file
2. Find the `DEFAULT_STYLE_PRESETS` array
3. Generate a safe ID: lowercase the name, replace spaces with hyphens, remove special characters
4. **CRITICAL**: Sanitize the style guide text:
   - Replace ALL em-dashes (—) with regular hyphens (-)
   - Replace ALL smart quotes (' ') with straight quotes (' ')
   - Escape ALL apostrophes in contractions with backslash (e.g., `Humanity\'s`)
   - These special characters WILL cause TypeScript parsing errors
5. Create the new preset object:
```typescript
{
  id: "generated-id",
  name: "User's Name",
  description: "User's description",
  guide: {
    visualTone: "...",
    colorPalette: "...",
    atmosphericDetails: "...",
    narrativeVoice: "..."
  }
}
```
6. Add it to the end of the DEFAULT_STYLE_PRESETS array
7. Use Edit tool to update constants.tsx

After saving, inform the user about the database refresh requirement:
```
✓ Style preset "[Name]" has been added to constants.tsx!

**Next steps to see your preset:**
The preset is saved to the code, but IndexedDB needs to be refreshed.

If the dev server is running:
1. Open the browser console
2. Run: `indexedDB.deleteDatabase('TechnoirDB')`
3. Refresh the page

Or I can do this for you if you have the app open in Claude Browser.

Preset ID: [id]
Location: constants.tsx:line_number
```

## Important Notes

- Be conversational and enthusiastic about the creative process
- If user says "I don't know" to choices, offer to surprise them
- Always show the generated style before saving
- Make sure IDs are unique and safe (lowercase, hyphens, no special chars)
- The user might provide vague vibes - that's perfect, work with it
- Don't use Gemini API - you can generate the style aspects directly
- Keep each aspect concise (20-50 words) but evocative

## Critical: Character Encoding Issues

**ALWAYS sanitize text before saving to constants.tsx:**

❌ **DO NOT USE:**
- Em-dashes: — (causes "Unexpected token" errors)
- Smart quotes: ' ' " " (causes parsing errors)
- Unescaped apostrophes in contractions

✅ **USE INSTEAD:**
- Regular hyphens: -
- Straight quotes: ' "
- Escaped apostrophes: `\'` (e.g., `Humanity\'s`)

**Example of proper sanitization:**
```
Before: "Nature has turned feral—humanity's grip weakens"
After:  "Nature has turned feral - humanity\'s grip weakens"
```

## Troubleshooting

### Preset not appearing in dropdown
**Manual method:**
1. Open browser console
2. Run: `indexedDB.deleteDatabase('TechnoirDB')`
3. Refresh the page
4. The preset should now appear

**With Claude Browser:**
If the user has the app open in Claude Browser, you can refresh it for them:
```javascript
indexedDB.deleteDatabase('TechnoirDB').onsuccess = () => {
  window.location.reload();
};
```

### TypeScript/Babel parsing errors
- Check for em-dashes (—) in the style guide text
- Check for smart quotes (' ' " ")
- Check for unescaped apostrophes
- Replace all with regular ASCII characters
- The error message will show the exact line and column number

### Dev server errors after saving
- Stop and restart the dev server
- The error usually points to the exact character causing issues
- Look for "Unexpected token, expected ','" errors
- Character position in error (e.g., "109:330") indicates where the problematic character is

## Examples

**User input**: "Something like Blade Runner but more colorful"
**Result**: Neon noir with rain-soaked streets but vibrant purples and oranges instead of just blue

**User input**: "Vaporwave meets William Gibson"
**Result**: Pastel aesthetic with retro-future nostalgia but hard-edged cyberpunk tech and sparse prose

**User input**: "I want it to feel hopeful, not dystopian"
**Result**: Bright colors, community networks, tech solving problems, rebellious optimism
