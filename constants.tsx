
import { Category } from './types';

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

// --- CONFIGURATION ---
// Replace these with your actual values!
export const GCS_BUCKET_NAME = "technoir-transmission-hub"; 
export const GCS_MANIFEST_FILE = "manifest.json";
// PASTE YOUR COPIED CLIENT ID HERE vvv
export const GOOGLE_CLIENT_ID = "YOUR_NEW_CLIENT_ID_FROM_CONSOLE.apps.googleusercontent.com"; 
export const MASTER_EMAIL = "ronie.uliana@gmail.com";
