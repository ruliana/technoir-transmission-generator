# BYOK-Only Migration Guide

This document describes how to convert the Technoir Transmission Generator from build-time API key injection to a BYOK (Bring Your Own Key) only model, eliminating the security risk of exposing API keys in the browser bundle.

## Overview

**Current State:** The app can inject `GEMINI_API_KEY` at build time via Vite's `define` feature, which embeds the key in the JavaScript bundle (security vulnerability).

**Target State:** Users must provide their own Gemini API key. No API key is ever bundled into the client code.

---

## Required Changes

### 1. Remove Build-Time Key Injection

**File:** `vite.config.ts`

Remove the `define` block that injects environment variables:

```typescript
// BEFORE
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: { port: 3000, host: '0.0.0.0' },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: { alias: { '@': path.resolve(__dirname, '.') } }
    };
});

// AFTER
export default defineConfig(({ mode }) => {
    return {
      server: { port: 3000, host: '0.0.0.0' },
      plugins: [react()],
      resolve: { alias: { '@': path.resolve(__dirname, '.') } }
    };
});
```

Also remove the unused `loadEnv` import if no longer needed.

---

### 2. Simplify API Key Retrieval

**File:** `services/gemini.ts`

Replace the `getApiKey()` function to only use localStorage:

```typescript
// BEFORE
const getApiKey = (): string | undefined => {
  // 1. If Master, prioritize Environment Variable
  if (currentUser?.isMaster && (process.env as any)['API_KEY']) {
      return (process.env as any)['API_KEY'];
  }

  // 2. Check Local Storage (Guest BYOK)
  const localKey = localStorage.getItem('technoir_api_key');
  if (localKey) return localKey;

  // 3. Fallback to Environment if strictly defined
  const envKey = (process.env as any)['API_KEY'];
  if (envKey) return envKey;

  return undefined;
};

// AFTER
const getApiKey = (): string | undefined => {
  return localStorage.getItem('technoir_api_key') || undefined;
};
```

You can also remove the `currentUser` state and `setGeminiUser` function if no longer needed for other purposes.

---

### 3. UI Adjustments

**File:** `App.tsx`

#### 3a. Simplify Auth State

The `user` state from Google OAuth is only used for Cloud Storage operations and Master user detection. For BYOK-only, the key presence check (`hasManualKey`) becomes the primary auth indicator for generation.

Consider renaming for clarity:

```typescript
// Current naming
const [hasManualKey, setHasManualKey] = useState(false);

// Clearer naming
const [hasApiKey, setHasApiKey] = useState(false);
```

#### 3b. Update Auth Status Display

In the setup screen, update the status indicator to reflect BYOK-only:

```tsx
// BEFORE (lines ~229-232)
<span>{user ? `OPERATOR: ${user.name}` : (hasManualKey ? 'GUEST_OPERATOR' : 'NO_AUTH_UPLINK')}</span>

// AFTER
<span>{hasApiKey ? 'API_KEY_CONNECTED' : 'NO_API_KEY'}</span>
{user && <span className="ml-2 text-gray-600">({user.name})</span>}
```

#### 3c. Simplify Login Section

Make the API key input more prominent since it's now required:

```tsx
// BEFORE (lines ~234-246) - Google login is primary
{!user ? (
   <div className="flex gap-2">
       <button onClick={signIn} className="text-cyan-600 hover:text-cyan-400 border border-cyan-900/50 px-2 py-1">
           Google_Login
       </button>
       <button onClick={() => setShowKeyModal(true)} className="text-gray-500 hover:text-gray-300 px-2 py-1">
           Input_Key
       </button>
   </div>
) : (
    <div className="text-gray-600">Secure Connection</div>
)}

// AFTER - API key is primary, Google login optional (for cloud sync)
<div className="flex gap-2">
    {!hasApiKey ? (
        <button onClick={() => setShowKeyModal(true)} className="text-cyan-600 hover:text-cyan-400 border border-cyan-900/50 px-2 py-1">
            Connect_API_Key
        </button>
    ) : (
        <button onClick={handleDisconnectKey} className="text-red-800 hover:text-red-500 px-2 py-1">
            Disconnect_Key
        </button>
    )}
    {!user && (
        <button onClick={signIn} className="text-gray-600 hover:text-gray-400 px-2 py-1" title="Optional: For cloud sync">
            Google_Sync
        </button>
    )}
</div>
```

#### 3d. Update Lock Overlay Message

```tsx
// BEFORE (lines ~251-260)
<div className="text-red-600 font-orbitron text-xl">ACCESS DENIED</div>
<p className="text-xs text-gray-500">Authentication required to initiate new transmissions.</p>

// AFTER
<div className="text-red-600 font-orbitron text-xl">API KEY REQUIRED</div>
<p className="text-xs text-gray-500">Connect your Gemini API key to generate transmissions.</p>
<a
    href="https://aistudio.google.com/app/apikey"
    target="_blank"
    rel="noopener noreferrer"
    className="text-cyan-600 hover:text-cyan-400 text-[10px] underline"
>
    Get a free API key from Google AI Studio
</a>
```

#### 3e. Update ApiKeyModal Instructions

```tsx
// BEFORE (lines ~610-611)
<h2 className="text-xl font-orbitron text-red-600 uppercase mb-4">Manual Override</h2>
<p className="text-[10px] text-gray-500 mb-4">Enter Gemini API Key to bypass security protocols.</p>

// AFTER
<h2 className="text-xl font-orbitron text-cyan-500 uppercase mb-4">Connect API Key</h2>
<p className="text-[10px] text-gray-500 mb-4">
    Enter your Gemini API key. Get one free at{' '}
    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan-600 underline">
        Google AI Studio
    </a>
</p>
<p className="text-[9px] text-gray-600 mb-4">
    Your key is stored locally in your browser and never sent to our servers.
</p>
```

---

### 4. Optional Cleanup

#### Remove Unused Code

If you're fully committing to BYOK-only and don't need the "Master" user concept for generation:

- **`services/gemini.ts`**: Remove `currentUser` state, `setGeminiUser` export
- **`App.tsx`**: Remove `setGeminiUser` call in `useEffect`
- **`constants.tsx`**: Consider removing `MASTER_EMAIL` if not needed

#### Keep for Cloud Sync

The Google OAuth flow (`user` state) is still useful for:
- Cloud Storage uploads (Master user)
- Fetching user profile for display

So keep `cloud.ts` and related OAuth code if you want cloud sync features.

---

## Testing Checklist

After making changes:

1. [ ] Build the app: `npm run build`
2. [ ] Inspect `dist/assets/*.js` - search for any API key patterns (should find none)
3. [ ] Run locally: `npm run dev`
4. [ ] Verify generation fails without a key (shows lock overlay)
5. [ ] Input a valid Gemini API key via modal
6. [ ] Verify generation works
7. [ ] Refresh page - verify key persists (localStorage)
8. [ ] Test disconnect key flow
9. [ ] Verify cloud sync still works (if keeping that feature)

---

## Security Notes

- **localStorage is appropriate here** - the user's own API key stays in their own browser
- **Never log or transmit the key** - the app sends it directly to Google's API only
- **Keys are user-scoped** - each user is responsible for their own key's security and billing
