
export type Category = 'Connections' | 'Events' | 'Locations' | 'Objects' | 'Threats' | 'Factions';

export interface LeadDetails {
  sensory: {
    sight: string;
    sound: string;
    smell: string;
    vibe: string;
  };
  expandedDescription: string;
  imageUrl?: string;
}

export interface Lead {
  id: string;
  name: string;
  description: string;
  category: Category;
  details?: LeadDetails;
}

export interface Exposition {
  technology: string;
  society: string;
  environment: string;
}

export interface Transmission {
  id: number;
  createdAt: string;
  title: string;
  settingSummary: string;
  exposition: Exposition;
  headerImageUrl?: string;
  leads: Lead[];
}

export interface GameState {
  transmission: Transmission | null;
  status: 'setup' | 'loading' | 'viewing';
  error?: string;
}

export interface User {
  email: string;
  name: string;
  picture: string;
  accessToken?: string; // GCS Access Token
  isMaster: boolean; // Is this the Owner?
}

export interface CloudManifestItem {
  id: number;
  title: string;
  summary: string;
  createdAt: string;
  filename: string;
}
