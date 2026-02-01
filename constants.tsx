
import { Category, StylePreset } from './types';

export const CATEGORIES: Category[] = [
  'Connections',
  'Events',
  'Locations',
  'Objects',
  'Threats',
  'Factions'
];

export const SYSTEM_INSTRUCTION = `You are a specialized engine for generating Technoir RPG Transmissions.
Your tone is gritty, hardboiled, and cinematic cyberpunk noir.
Focus on high-contrast descriptions, sensory-rich details, and complex systemic connections.`;

export const STYLE_DISTILLATION_PROMPT = `Extract the core visual and narrative style from the following Transmission's exposition and leads.
Respond ONLY with valid JSON (no markdown, no code blocks) matching this structure:
{
  "visualTone": "concise description of dominant visual aesthetic",
  "colorPalette": "primary colors and color relationships",
  "atmosphericDetails": "key sensory and environmental elements that define the setting",
  "narrativeVoice": "the voice, tone, and perspective through which the world is presented"
}`;

export const DEFAULT_STYLE_PROMPTS = {
  neon: `Generate a StyleGuide for a transmission with a strong neon aesthetic.
Emphasize bright synthetic colors (cyan, magenta, yellow), high contrast, and glowing elements.
The visual tone should feel electric and hyperactive.
The narrative voice should be rapid-fire, punchy, and energetic.
Respond ONLY with valid JSON (no markdown, no code blocks) matching this structure:
{
  "visualTone": "description",
  "colorPalette": "colors",
  "atmosphericDetails": "details",
  "narrativeVoice": "voice"
}`,

  gritty: `Generate a StyleGuide for a transmission with a gritty, worn aesthetic.
Emphasize desaturated colors (grays, browns, dirty yellows), weathered surfaces, and decay.
The visual tone should feel industrial and used.
The narrative voice should be detached, cynical, and observational.
Respond ONLY with valid JSON (no markdown, no code blocks) matching this structure:
{
  "visualTone": "description",
  "colorPalette": "colors",
  "atmosphericDetails": "details",
  "narrativeVoice": "voice"
}`,

  mysterious: `Generate a StyleGuide for a transmission with a mysterious, shadowy aesthetic.
Emphasize deep colors (blacks, deep purples, midnight blues), obscured visibility, and hidden details.
The visual tone should feel secretive and enigmatic.
The narrative voice should be cryptic, introspective, and revelatory.
Respond ONLY with valid JSON (no markdown, no code blocks) matching this structure:
{
  "visualTone": "description",
  "colorPalette": "colors",
  "atmosphericDetails": "details",
  "narrativeVoice": "voice"
}`
};

export const DEFAULT_STYLE_PRESETS: StylePreset[] = [
  {
    id: 'neon-chrome',
    name: 'Neon Chrome',
    description: 'Electric, high-contrast cyberpunk with bright synthetics and glowing elements',
    guide: {
      visualTone: 'Electric and hyperactive, dominated by neon glows and stark contrast',
      colorPalette: 'Cyan, magenta, yellow against deep blacks; synthetic and artificial',
      atmosphericDetails: 'Holographic displays, flickering signs, glowing circuitry, laser-cut shadows',
      narrativeVoice: 'Rapid-fire, punchy, kinetic; breathless and action-oriented'
    }
  },
  {
    id: 'rust-decay',
    name: 'Rust & Decay',
    description: 'Industrial and weathered, emphasizing wear, corrosion, and dystopian decay',
    guide: {
      visualTone: 'Worn and industrial, marked by weathering and oxidation',
      colorPalette: 'Rusted oranges, corroded grays, dirty yellows, oil-slick blacks',
      atmosphericDetails: 'Corroded metal, peeling paint, stained concrete, abandoned machinery, toxic atmospheres',
      narrativeVoice: 'Detached and cynical, matter-of-fact observations of ruin and entropy'
    }
  },
  {
    id: 'shadow-deep',
    name: 'Shadow Deep',
    description: 'Mysterious and obscured, with hidden depths and cryptic revelations',
    guide: {
      visualTone: 'Shadowy and enigmatic, shrouded in mystery and obscurity',
      colorPalette: 'Blacks, deep purples, midnight blues with rare points of dim light',
      atmosphericDetails: 'Darkness concealing detail, obscured faces, hidden chambers, muffled sounds, encrypted information',
      narrativeVoice: 'Cryptic and introspective, revealing secrets gradually through careful exposition'
    }
  }
];

// --- CONFIGURATION ---
// Replace these with your actual values!
export const GCS_BUCKET_NAME = "technoir-transmission-hub"; 
export const GCS_MANIFEST_FILE = "manifest.json";
// PASTE YOUR COPIED CLIENT ID HERE vvv
export const GOOGLE_CLIENT_ID = "YOUR_NEW_CLIENT_ID_FROM_CONSOLE.apps.googleusercontent.com"; 
export const MASTER_EMAIL = "ronie.uliana@gmail.com";
