
import { GCS_BUCKET_NAME, GCS_MANIFEST_FILE, GOOGLE_CLIENT_ID, MASTER_EMAIL } from "../constants";
import { CloudManifestItem, Transmission, User } from "../types";

let tokenClient: any;

export const initGoogleClient = (callback: (user: User) => void) => {
  if (!(window as any).google) return;

  tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/devstorage.read_write https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    callback: async (tokenResponse: any) => {
      if (tokenResponse && tokenResponse.access_token) {
        // Fetch User Info
        const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
        }).then(r => r.json());

        const user: User = {
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            accessToken: tokenResponse.access_token,
            isMaster: userInfo.email === MASTER_EMAIL
        };
        callback(user);
      }
    },
  });
};

export const signIn = () => {
  if (tokenClient) {
    tokenClient.requestAccessToken();
  } else {
    alert("Google Auth not initialized. Check Client ID.");
  }
};

// --- GCS OPERATIONS ---

const getPublicUrl = (filename: string) => `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${filename}`;

// Fetch the Public Manifest
export const fetchCloudManifest = async (): Promise<CloudManifestItem[]> => {
    try {
        // Hack: Append timestamp to prevent caching
        const res = await fetch(`${getPublicUrl(GCS_MANIFEST_FILE)}?t=${Date.now()}`);
        if (!res.ok) throw new Error("Manifest not found");
        return await res.json();
    } catch (e) {
        console.warn("Could not load cloud manifest", e);
        return [];
    }
};

// Fetch a specific Transmission from Cloud
export const fetchCloudTransmission = async (filename: string): Promise<Transmission> => {
    const res = await fetch(getPublicUrl(filename));
    if (!res.ok) throw new Error("Failed to load transmission");
    return await res.json();
};

// Upload Transmission to Cloud (Master Only)
export const uploadTransmissionToCloud = async (transmission: Transmission, accessToken: string) => {
    const filename = `transmission_${transmission.id}.json`;
    const jsonStr = JSON.stringify(transmission);
    
    // 1. Upload the File
    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${GCS_BUCKET_NAME}/o?uploadType=media&name=${filename}`;
    const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: jsonStr
    });

    if (!res.ok) throw new Error("Upload failed: " + res.statusText);

    // 2. Update Manifest
    // Note: Concurrency issue exists here (Race condition), but acceptable for single-user Master scenario.
    const currentManifest = await fetchCloudManifest();
    
    // Remove if exists (update)
    const newManifest = currentManifest.filter(i => i.id !== transmission.id);
    newManifest.unshift({
        id: transmission.id,
        title: transmission.title,
        summary: transmission.settingSummary,
        createdAt: transmission.createdAt,
        filename: filename
    });

    const manifestUrl = `https://storage.googleapis.com/upload/storage/v1/b/${GCS_BUCKET_NAME}/o?uploadType=media&name=${GCS_MANIFEST_FILE}`;
    await fetch(manifestUrl, {
        method: 'POST', // overwrite
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newManifest)
    });
};
