/**
 * core/generator.ts
 *
 * Isomorphic generation engine — zero browser API dependencies.
 * Every function accepts an explicit `apiKey: string` rather than reading
 * from localStorage, making this module usable in Node.js (CLI) as well as
 * the browser.
 */
import { GoogleGenAI, Type } from '@google/genai';
import { SYSTEM_INSTRUCTION } from '../constants';
import type { LeadDetails, Lead, Transmission, Exposition, StyleGuide } from '../types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeAI(apiKey: string) {
  if (!apiKey) throw new Error('Requested entity was not found: Missing API Key');
  return new GoogleGenAI({ apiKey });
}

async function streamJson<T>(
  apiKey: string,
  model: string,
  contents: unknown,
  config: unknown,
  onUpdate?: (text: string) => void,
): Promise<T> {
  const ai = makeAI(apiKey);
  const response = await (ai.models as any).generateContentStream({ model, contents, config });

  let fullText = '';
  for await (const chunk of response) {
    const text = (chunk as { text?: string }).text;
    if (text) {
      fullText += text;
      if (onUpdate) onUpdate(fullText);
    }
  }

  const cleanText = fullText.replace(/```json\n?|```/g, '').trim();
  try {
    return JSON.parse(cleanText) as T;
  } catch (e) {
    console.error('JSON parse error', e, cleanText);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Public utilities
// ---------------------------------------------------------------------------

/** Format a StyleGuide into a prompt-injection string. */
export const formatStyleContext = (style: StyleGuide): string =>
  `STYLE CONTEXT:
Visual Tone: ${style.visualTone}
Color Palette: ${style.colorPalette}
Atmospheric Details: ${style.atmosphericDetails}
Narrative Voice: ${style.narrativeVoice}

Apply these stylistic elements throughout your generation to maintain consistency.`;

// ---------------------------------------------------------------------------
// Generation functions — all take apiKey as first parameter
// ---------------------------------------------------------------------------

export const generateStyleGuide = async (
  apiKey: string,
  theme: string,
  presetGuide: StyleGuide,
  onUpdate?: (text: string) => void,
): Promise<StyleGuide> => {
  const styleContext = formatStyleContext(presetGuide);
  return streamJson<StyleGuide>(
    apiKey,
    'gemini-3-flash-preview',
    `Theme: ${theme}\n\n${styleContext}\n\nTask: Generate a refined StyleGuide that adapts the preset style to the specific theme. Ensure the guide maintains consistency with the preset's aesthetic principles while being tailored to the theme's unique characteristics.`,
    {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          visualTone:          { type: Type.STRING },
          colorPalette:        { type: Type.STRING },
          atmosphericDetails:  { type: Type.STRING },
          narrativeVoice:      { type: Type.STRING },
        },
        required: ['visualTone', 'colorPalette', 'atmosphericDetails', 'narrativeVoice'],
      },
    },
    onUpdate,
  );
};

export const generateTitleAndSetting = async (
  apiKey: string,
  theme: string,
  onUpdate?: (text: string) => void,
): Promise<Pick<Transmission, 'title' | 'settingSummary'>> => {
  return streamJson<Pick<Transmission, 'title' | 'settingSummary'>>(
    apiKey,
    'gemini-3-flash-preview',
    `Theme: ${theme}.\n    Generate a Title and a 2-sentence Setting Summary for a Technoir transmission.\n    The tone should be gritty, cyberpunk noir.`,
    {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title:          { type: Type.STRING },
          settingSummary: { type: Type.STRING },
        },
        required: ['title', 'settingSummary'],
      },
    },
    onUpdate,
  );
};

export const generateExposition = async (
  apiKey: string,
  theme: string,
  title: string,
  settingSummary: string,
  style: StyleGuide,
  onUpdate?: (text: string) => void,
): Promise<Exposition> => {
  const styleContext = formatStyleContext(style);
  return streamJson<Exposition>(
    apiKey,
    'gemini-3-flash-preview',
    `${styleContext}\n\nTheme: ${theme}.\n    Transmission Title: "${title}".\n    Setting Summary: "${settingSummary}".\n\n    Based on the above, create detailed Exposition parameters (1 paragraph each) for:\n    1. Technology (Unique tech quirks of this setting)\n    2. Society (Class struggle, crime, or culture)\n    3. Environment (Physical atmosphere, weather, architecture)`,
    {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          technology:  { type: Type.STRING },
          society:     { type: Type.STRING },
          environment: { type: Type.STRING },
        },
        required: ['technology', 'society', 'environment'],
      },
    },
    onUpdate,
  );
};

export const generateLeads = async (
  apiKey: string,
  theme: string,
  title: string,
  summary: string,
  exposition: Exposition,
  style: StyleGuide,
  onUpdate?: (text: string) => void,
): Promise<Lead[]> => {
  const styleContext = formatStyleContext(style);
  const data = await streamJson<{ leads: Lead[] }>(
    apiKey,
    'gemini-3-flash-preview',
    `${styleContext}\n\nContext: A Technoir setting titled "${title}".\n    Summary: ${summary}\n    Technology: ${exposition.technology}\n    Society: ${exposition.society}\n    Environment: ${exposition.environment}\n\n    Generate 36 leads: Exactly 6 leads for each of these 6 categories: Connections, Events, Locations, Objects, Threats, Factions.\n    Note: When relevant, reflect varied backgrounds and presentations, but keep focus on their role in the story.\n    Each lead name should be 2-3 words. Description should be exactly 1 evocative sentence that ties into the exposition provided.`,
    {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          leads: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id:          { type: Type.STRING },
                name:        { type: Type.STRING },
                description: { type: Type.STRING },
                category:    { type: Type.STRING, description: 'Must be one of: Connections, Events, Locations, Objects, Threats, Factions' },
              },
              required: ['id', 'name', 'description', 'category'],
            },
          },
        },
        required: ['leads'],
      },
    },
    onUpdate,
  );
  return data.leads || [];
};

export const generateTransmissionHeader = async (
  apiKey: string,
  title: string,
  summary: string,
  exposition: Exposition,
  style: StyleGuide,
): Promise<string | undefined> => {
  try {
    const styleContext = `Color Palette: ${style.colorPalette}. Visual Tone: ${style.visualTone}.`;
    const ai = makeAI(apiKey);
    const response = await (ai.models as any).generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `${styleContext}\n\nCinematic wide-shot cyberpunk noir landscape for a setting titled "${title}".\n        Context: ${summary}.\n        Visual details: ${exposition.environment}.\n        Neon rain, heavy atmosphere, hyper-detailed, 8k resolution, cinematic lighting.` }],
      },
      config: { imageConfig: { aspectRatio: '16:9' } },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if ((part as any).inlineData) {
        return `data:image/png;base64,${(part as any).inlineData.data}`;
      }
    }
  } catch (e) {
    console.error('Header image generation failed', e);
  }
  return undefined;
};

export const generateLeadInspectionText = async (
  apiKey: string,
  lead: Lead,
  title: string,
  summary: string,
  exposition: Exposition,
  style: StyleGuide,
): Promise<Pick<LeadDetails, 'sensory' | 'expandedDescription'>> => {
  const styleContext = formatStyleContext(style);
  return streamJson<Pick<LeadDetails, 'sensory' | 'expandedDescription'>>(
    apiKey,
    'gemini-3-flash-preview',
    `${styleContext}\n\nContext: Technoir setting "${title}".\n    Summary: ${summary}\n    Exposition Data:\n    - Tech: ${exposition.technology}\n    - Society: ${exposition.society}\n    - Environment: ${exposition.environment}\n\n    Subject Node:\n    - Name: ${lead.name}\n    - Category: ${lead.category}\n    - Descriptor: ${lead.description}\n\n    Task: Generate a high-fidelity investigative dossier. For human subjects, mention appearance briefly when relevant to characterization.\n    1. Sensory Data: 4 distinct sensory inputs (Sight, Sound, Smell, Vibe) that immediately establish the scene/subject.\n    2. Expanded Description: A hardboiled, atmospheric paragraph expanding on the "Descriptor" and integrating the "Exposition Data". It should feel like a GM describing the node to players.`,
    {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sensory: {
            type: Type.OBJECT,
            properties: {
              sight: { type: Type.STRING },
              sound: { type: Type.STRING },
              smell: { type: Type.STRING },
              vibe:  { type: Type.STRING },
            },
            required: ['sight', 'sound', 'smell', 'vibe'],
          },
          expandedDescription: { type: Type.STRING },
        },
        required: ['sensory', 'expandedDescription'],
      },
    },
  );
};

export const generateLeadImage = async (
  apiKey: string,
  lead: Lead,
  settingContext: { title: string; summary: string },
  expandedDescription: string,
  sensory: LeadDetails['sensory'],
  exposition: { environment: string; technology: string },
  style: StyleGuide,
): Promise<string | undefined> => {
  try {
    let focusDirective = '';
    switch (lead.category) {
      case 'Locations':
        focusDirective = 'Wide or medium shot of the environment/location. Architecture, mood, lighting. NO central character. Environmental focus.';
        break;
      case 'Objects':
        focusDirective = 'Close-up product shot or macro detail of the object. High texture. Object is the sole subject. No people.';
        break;
      case 'Events':
        focusDirective = 'Dynamic scene, active situation, implied motion. Narrative focus.';
        break;
      case 'Threats':
        focusDirective = 'Analyze the description to determine the main subject (person, group, environment, phenomenon, object, etc.) and focus the image accordingly. If it describes people or characters, show them. If it describes an environmental effect, phenomenon, or abstract threat, visualize that without people. Match the visual focus to what is being described.';
        break;
      default:
        focusDirective = 'Character portrait or group shot. Distinct cyberpunk fashion, expressive, moody lighting. Focus on the individual(s).';
    }

    const diversityDirective = `Note: Show varied human subjects naturally without defaulting to a single archetype.`;
    const styleContext = `Color Palette: ${style.colorPalette}. Visual Tone: ${style.visualTone}.`;
    const ai = makeAI(apiKey);

    const response = await (ai.models as any).generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `${styleContext}\n\nCinematic cyberpunk noir visualization.\n          Subject: "${lead.name}"\n          Category: ${lead.category}\n          Description: ${lead.description}\n\n          Setting Context: ${settingContext.title}. ${settingContext.summary}\n\n          Environmental Context:\n          - Technology: ${exposition.technology}\n          - Environment: ${exposition.environment}\n\n          Visual Details:\n          - Sight: ${sensory.sight}\n          - Sound: ${sensory.sound}\n          - Smell: ${sensory.smell}\n          - Vibe: ${sensory.vibe}\n\n          Scene Description: ${expandedDescription}\n\n          Directive: ${focusDirective}\n\n          ${diversityDirective}\n\n          Style: Gritty, shadow-heavy, high contrast, hyper-detailed, 8k resolution, cinematic lighting, volumetric fog.`,
          },
        ],
      },
      config: { imageConfig: { aspectRatio: '1:1' } },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if ((part as any).inlineData) {
        return `data:image/png;base64,${(part as any).inlineData.data}`;
      }
    }
  } catch (e) {
    console.error('Lead image generation failed', e);
  }
  return undefined;
};

export const regenerateSensoryField = async (
  apiKey: string,
  lead: Lead,
  fieldName: 'sight' | 'sound' | 'smell' | 'vibe',
  currentSensory: LeadDetails['sensory'],
  exposition: Exposition,
  style: StyleGuide,
): Promise<string> => {
  const otherFields = Object.entries(currentSensory)
    .filter(([key]) => key !== fieldName)
    .map(([key, val]) => `${key}: ${val}`)
    .join('\n');

  const styleContext = formatStyleContext(style);
  const result = await streamJson<Record<string, string>>(
    apiKey,
    'gemini-3-flash-preview',
    `${styleContext}\n\nContext: Technoir lead "${lead.name}" (${lead.category}).\n    Description: ${lead.description}\n\n    Exposition Context:\n    - Tech: ${exposition.technology}\n    - Society: ${exposition.society}\n    - Environment: ${exposition.environment}\n\n    Existing sensory data:\n    ${otherFields}\n\n    Task: Generate a new ${fieldName} sensory input that complements the existing sensory data and fits the exposition context. Keep it concise and evocative.`,
    {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: { [fieldName]: { type: Type.STRING } },
        required: [fieldName],
      },
    },
  );
  return result[fieldName];
};

export const regenerateExpandedDescription = async (
  apiKey: string,
  lead: Lead,
  sensory: LeadDetails['sensory'],
  exposition: Exposition,
  style: StyleGuide,
): Promise<string> => {
  const styleContext = formatStyleContext(style);
  const result = await streamJson<{ expandedDescription: string }>(
    apiKey,
    'gemini-3-flash-preview',
    `${styleContext}\n\nContext: Technoir lead "${lead.name}" (${lead.category}).\n    Description: ${lead.description}\n\n    Exposition Context:\n    - Tech: ${exposition.technology}\n    - Society: ${exposition.society}\n    - Environment: ${exposition.environment}\n\n    Sensory Data:\n    - Sight: ${sensory.sight}\n    - Sound: ${sensory.sound}\n    - Smell: ${sensory.smell}\n    - Vibe: ${sensory.vibe}\n\n    Task: Generate a hardboiled, atmospheric paragraph (expanded description) that integrates the sensory data and exposition. For human subjects, mention appearance briefly when relevant to characterization. It should feel like a GM describing this node to players in a Technoir game.`,
    {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: { expandedDescription: { type: Type.STRING } },
        required: ['expandedDescription'],
      },
    },
  );
  return result.expandedDescription;
};

export interface GenerationOptions {
  /** Skip all image generation steps (header + lead images). */
  noImages?: boolean;
}

/**
 * Full pipeline — generates a complete Transmission including all lead details.
 * Progress messages are emitted via `onLog` (printed to stderr in the CLI,
 * forwarded to UI state in the browser).
 */
export const generateFullTransmission = async (
  apiKey: string,
  theme: string,
  style: StyleGuide,
  onLog: (msg: string) => void,
  options: GenerationOptions = {},
): Promise<Transmission> => {
  onLog('>> GENERATING STRUCTURAL FRAMEWORK...');
  const { title, settingSummary } = await generateTitleAndSetting(apiKey, theme);

  onLog(`>> STRUCTURE ACQUIRED: ${title}`);
  onLog('>> DOWNLOADING EXPOSITION...');
  const exposition = await generateExposition(apiKey, theme, title, settingSummary, style);

  onLog('>> COMPILING LEAD NETWORK...');
  const leads = await generateLeads(apiKey, theme, title, settingSummary, exposition, style);

  onLog('>> RENDERING ENVIRONMENTAL VISUALS...');
  const headerImageUrl = options.noImages
    ? undefined
    : await generateTransmissionHeader(apiKey, title, settingSummary, exposition, style);

  let transmission: Transmission = {
    id: Date.now(),
    createdAt: new Date().toLocaleDateString('en-US'),
    title,
    settingSummary,
    exposition: { ...exposition, style },
    leads,
    headerImageUrl,
  };

  onLog(`>> INITIATING DEEP SCAN OF ${leads.length} NODES. THIS WILL TAKE TIME...`);

  const detailedLeads: Lead[] = [];
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    onLog(`>> PROCESSING NODE [${i + 1}/${leads.length}]: ${lead.name}...`);
    try {
      const textDetails = await generateLeadInspectionText(
        apiKey, lead, title, settingSummary, exposition, style,
      );
      const imageUrl = options.noImages
        ? undefined
        : await generateLeadImage(
            apiKey,
            lead,
            { title, summary: settingSummary },
            textDetails.expandedDescription,
            textDetails.sensory,
            { environment: exposition.environment, technology: exposition.technology },
            style,
          );
      detailedLeads.push({ ...lead, details: { ...textDetails, imageUrl } });
    } catch (e) {
      console.error(`Failed to process lead ${lead.name}`, e);
      detailedLeads.push(lead);
    }
  }

  transmission.leads = detailedLeads;
  onLog('>> TRANSMISSION PACKAGE COMPLETE.');
  return transmission;
};
