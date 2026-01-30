
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { LeadDetails, Lead, Transmission, Exposition, User } from "../types";

// User state to determine which key to use
let currentUser: User | null = null;

export const setGeminiUser = (user: User | null) => {
    currentUser = user;
};

// Retrieve key from Environment (Master), Local Storage (Guest), or AI Studio
const getApiKey = (): string | undefined => {
  // 1. If Master, prioritize Environment Variable
  // NOTE: In a client-side build, this env var must be injected at build time or via a server proxy.
  if (currentUser?.isMaster && (process.env as any)['API_KEY']) {
      return (process.env as any)['API_KEY'];
  }

  // 2. Check Local Storage (Guest BYOK)
  const localKey = localStorage.getItem('technoir_api_key');
  if (localKey) return localKey;

  // 3. Fallback to Environment if strictly defined (e.g. AI Studio preview)
  const envKey = (process.env as any)['API_KEY'];
  if (envKey) return envKey;

  return undefined;
};

const getAI = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Requested entity was not found: Missing API Key");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to handle streaming and JSON parsing
async function streamJson<T>(
  model: string, 
  contents: any, 
  config: any, 
  onUpdate?: (text: string) => void
): Promise<T> {
  const ai = getAI();
  const response = await ai.models.generateContentStream({
    model,
    contents,
    config
  });

  let fullText = '';
  for await (const chunk of response) {
    const text = chunk.text;
    if (text) {
      fullText += text;
      if (onUpdate) onUpdate(fullText);
    }
  }
  
  const cleanText = fullText.replace(/```json\n?|```/g, '').trim();
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("JSON parse error", e, cleanText);
    throw e;
  }
}

// Step 1a: Generate Title and Setting
export const generateTitleAndSetting = async (theme: string, onUpdate?: (text: string) => void): Promise<Pick<Transmission, 'title' | 'settingSummary'>> => {
  return streamJson<Pick<Transmission, 'title' | 'settingSummary'>>(
    'gemini-3-flash-preview',
    `Theme: ${theme}.
    Generate a Title and a 2-sentence Setting Summary for a Technoir transmission.
    The tone should be gritty, cyberpunk noir.`,
    {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          settingSummary: { type: Type.STRING }
        },
        required: ['title', 'settingSummary']
      }
    },
    onUpdate
  );
};

// Step 1b: Generate Exposition based on Title/Setting
export const generateExposition = async (theme: string, title: string, settingSummary: string, onUpdate?: (text: string) => void): Promise<Exposition> => {
  return streamJson<Exposition>(
    'gemini-3-flash-preview',
    `Theme: ${theme}.
    Transmission Title: "${title}".
    Setting Summary: "${settingSummary}".
    
    Based on the above, create detailed Exposition parameters (1 paragraph each) for:
    1. Technology (Unique tech quirks of this setting)
    2. Society (Class struggle, crime, or culture)
    3. Environment (Physical atmosphere, weather, architecture)`,
    {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          technology: { type: Type.STRING },
          society: { type: Type.STRING },
          environment: { type: Type.STRING }
        },
        required: ['technology', 'society', 'environment']
      }
    },
    onUpdate
  );
};

// Step 1c: Generate Leads based on everything so far
export const generateLeads = async (theme: string, title: string, summary: string, exposition: Exposition, onUpdate?: (text: string) => void): Promise<Lead[]> => {
  const data = await streamJson<{ leads: Lead[] }>(
    'gemini-3-flash-preview',
    `Context: A Technoir setting titled "${title}".
    Summary: ${summary}
    Technology: ${exposition.technology}
    Society: ${exposition.society}
    Environment: ${exposition.environment}
    
    Generate 36 leads: Exactly 6 leads for each of these 6 categories: Connections, Events, Locations, Objects, Threats, Factions.
    Each lead name should be 2-3 words. Description should be exactly 1 evocative sentence that ties into the exposition provided.`,
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
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.STRING, description: "Must be one of: Connections, Events, Locations, Objects, Threats, Factions" }
              },
              required: ['id', 'name', 'description', 'category']
            }
          }
        },
        required: ['leads']
      }
    },
    onUpdate
  );
  return data.leads || [];
};

// Step 2: Generate Image (runs in background)
export const generateTransmissionHeader = async (title: string, summary: string, exposition: Exposition): Promise<string | undefined> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Cinematic wide-shot cyberpunk noir landscape for a setting titled "${title}". 
        Context: ${summary}. 
        Visual details: ${exposition.environment}. 
        Neon rain, heavy atmosphere, hyper-detailed, 8k resolution, cinematic lighting.` }]
      },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.error("Header image generation failed", e);
  }
  return undefined;
};

// Dossier Deep Dive (Part 1: Text)
export const generateLeadInspectionText = async (
  lead: Lead, 
  title: string, 
  summary: string, 
  exposition: Exposition
): Promise<Pick<LeadDetails, 'sensory' | 'expandedDescription'>> => {
  return streamJson<Pick<LeadDetails, 'sensory' | 'expandedDescription'>>(
    'gemini-3-flash-preview',
    `Context: Technoir setting "${title}".
    Summary: ${summary}
    Exposition Data:
    - Tech: ${exposition.technology}
    - Society: ${exposition.society}
    - Environment: ${exposition.environment}

    Subject Node:
    - Name: ${lead.name}
    - Category: ${lead.category}
    - Descriptor: ${lead.description}

    Task: Generate a high-fidelity investigative dossier.
    1. Sensory Data: 4 distinct sensory inputs (Sight, Sound, Smell, Vibe) that immediately establish the scene/subject.
    2. Expanded Description: A hardboiled, atmospheric paragraph expanding on the "Descriptor" and integrating the "Exposition Data". It should feel like a GM describing the node to players.`,
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
              vibe: { type: Type.STRING }
            },
            required: ['sight', 'sound', 'smell', 'vibe']
          },
          expandedDescription: { type: Type.STRING }
        },
        required: ['sensory', 'expandedDescription']
      }
    }
  );
};

// Dossier Deep Dive (Part 2: Image)
export const generateLeadInspectionImage = async (
  lead: Lead, 
  title: string, 
  summary: string, 
  sensorySight: string
): Promise<string | undefined> => {
  try {
    let focusDirective = '';
    
    // Category specific visual directives to ensure correct subject matter
    switch(lead.category) {
        case 'Locations':
            focusDirective = 'Wide or medium shot of the environment/location. Architecture, mood, lighting. NO central character. Environmental focus.';
            break;
        case 'Objects':
            focusDirective = 'Close-up product shot or macro detail of the object. High texture. Object is the sole subject. No people.';
            break;
        case 'Events':
            focusDirective = 'Dynamic scene, active situation, implied motion. Narrative focus.';
            break;
        default: 
            // Connections, Threats, Factions
            focusDirective = 'Character portrait or group shot. Distinct cyberpunk fashion, expressive, moody lighting. Focus on the individual(s).';
            break;
    }
    
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `Cinematic cyberpunk noir visualization.
          Subject: "${lead.name}"
          Descriptor: ${lead.description}
          Category: ${lead.category}
          
          Context: ${title}. ${summary}
          Visual Flavor: ${sensorySight}
          
          Directive: ${focusDirective}
          Style: Gritty, shadow-heavy, high contrast, hyper-detailed, 8k resolution, cinematic lighting, volumetric fog.` }
        ]
      },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.error("Lead image generation failed", e);
  }
  return undefined;
};

// --- NEW: BACKGROUND GENERATION ---
// This runs the full pipeline for ALL leads. Expensive!
export const generateFullTransmission = async (
    theme: string, 
    onLog: (msg: string) => void
): Promise<Transmission> => {
    
    // 1. Structure
    onLog(">> GENERATING STRUCTURAL FRAMEWORK...");
    const { title, settingSummary } = await generateTitleAndSetting(theme);
    
    onLog(`>> STRUCTURE ACQUIRED: ${title}`);
    onLog(">> DOWNLOADING EXPOSITION...");
    const exposition = await generateExposition(theme, title, settingSummary);
    
    onLog(">> COMPILING LEAD NETWORK...");
    const leads = await generateLeads(theme, title, settingSummary, exposition);

    // 2. Header
    onLog(">> RENDERING ENVIRONMENTAL VISUALS...");
    const headerImageUrl = await generateTransmissionHeader(title, settingSummary, exposition);
    
    let transmission: Transmission = {
        id: Date.now(),
        createdAt: new Date().toLocaleDateString('en-US'),
        title,
        settingSummary,
        exposition,
        leads,
        headerImageUrl
    };

    // 3. Batch Process Leads (Sequential to avoid rate limits)
    onLog(`>> INITIATING DEEP SCAN OF ${leads.length} NODES. THIS WILL TAKE TIME...`);
    
    const detailedLeads: Lead[] = [];
    
    for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        onLog(`>> PROCESSING NODE [${i+1}/${leads.length}]: ${lead.name}...`);
        
        try {
            // Text Details
            const textDetails = await generateLeadInspectionText(lead, title, settingSummary, exposition);
            
            // Image Details
            const imageUrl = await generateLeadInspectionImage(lead, title, settingSummary, textDetails.sensory.sight);
            
            detailedLeads.push({
                ...lead,
                details: {
                    ...textDetails,
                    imageUrl
                }
            });
        } catch (e) {
            console.error(`Failed to process lead ${lead.name}`, e);
            detailedLeads.push(lead); // Keep basic version if fail
        }
    }

    transmission.leads = detailedLeads;
    onLog(">> TRANSMISSION PACKAGE COMPLETE.");
    
    return transmission;
};
