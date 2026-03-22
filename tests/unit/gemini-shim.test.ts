/**
 * Feature: Browser service shim preserves existing behaviour
 *
 * Scenarios:
 *   - services/gemini.ts exports all functions that App.tsx currently imports
 *   - Each shim function calls core/generator with the key from localStorage
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Mock the Gemini SDK (so core/generator doesn't hit the network)
// ---------------------------------------------------------------------------
vi.mock('@google/genai', () =>
  import('../helpers/mockGemini').then((m) => m.geminiModuleStub),
);

// ---------------------------------------------------------------------------
// 2. Provide a localStorage stub (Node.js has no window / localStorage)
// ---------------------------------------------------------------------------
const localStorageData: Record<string, string> = {};
const localStorageStub = {
  getItem: (key: string) => localStorageData[key] ?? null,
  setItem: (key: string, value: string) => { localStorageData[key] = value; },
  removeItem: (key: string) => { delete localStorageData[key]; },
  clear: () => { Object.keys(localStorageData).forEach((k) => delete localStorageData[k]); },
};
vi.stubGlobal('localStorage', localStorageStub);

// ---------------------------------------------------------------------------
// 3. Mock core/generator to spy on calls without actually calling the SDK
// ---------------------------------------------------------------------------
vi.mock('../../core/generator', () => ({
  generateStyleGuide:            vi.fn().mockResolvedValue({}),
  generateTitleAndSetting:       vi.fn().mockResolvedValue({ title: 't', settingSummary: 's' }),
  generateExposition:            vi.fn().mockResolvedValue({}),
  generateLeads:                 vi.fn().mockResolvedValue([]),
  generateTransmissionHeader:    vi.fn().mockResolvedValue(undefined),
  generateLeadInspectionText:    vi.fn().mockResolvedValue({ sensory: {}, expandedDescription: '' }),
  generateLeadImage:             vi.fn().mockResolvedValue(undefined),
  generateFullTransmission:      vi.fn().mockResolvedValue({ id: 1, leads: [] }),
  regenerateSensoryField:        vi.fn().mockResolvedValue(''),
  regenerateExpandedDescription: vi.fn().mockResolvedValue(''),
  formatStyleContext:            vi.fn().mockReturnValue(''),
}));

import * as coreGenerator from '../../core/generator';
import * as shimService    from '../../services/gemini';

// ---------------------------------------------------------------------------
// Scenario: services/gemini.ts exports all functions that App.tsx imports
// ---------------------------------------------------------------------------
describe('gemini shim — exports', () => {
  const expectedExports = [
    'generateStyleGuide',
    'generateTitleAndSetting',
    'generateExposition',
    'generateLeads',
    'generateTransmissionHeader',
    'generateLeadInspectionText',
    'generateLeadImage',
    'generateFullTransmission',
    'regenerateSensoryField',
    'regenerateExpandedDescription',
    'formatStyleContext',
  ] as const;

  for (const name of expectedExports) {
    it(`exports ${name}`, () => {
      expect(shimService).toHaveProperty(name);
      expect(typeof (shimService as Record<string, unknown>)[name]).toBe('function');
    });
  }
});

// ---------------------------------------------------------------------------
// Scenario: each shim function reads the key from localStorage and passes it
// ---------------------------------------------------------------------------
describe('gemini shim — passes apiKey from localStorage', () => {
  const STORED_KEY = 'shim-test-api-key';
  const THEME = 'test theme';

  beforeEach(() => {
    localStorageData['technoir_api_key'] = STORED_KEY;
    vi.clearAllMocks();
  });

  it('generateTitleAndSetting forwards the stored key', async () => {
    await shimService.generateTitleAndSetting(THEME);
    expect(coreGenerator.generateTitleAndSetting).toHaveBeenCalledWith(
      STORED_KEY,
      THEME,
      undefined,
    );
  });

  it('generateStyleGuide forwards the stored key', async () => {
    const guide = { visualTone: '', colorPalette: '', atmosphericDetails: '', narrativeVoice: '' };
    await shimService.generateStyleGuide(THEME, guide);
    expect(coreGenerator.generateStyleGuide).toHaveBeenCalledWith(
      STORED_KEY,
      THEME,
      guide,
      undefined,
    );
  });

  it('formatStyleContext is a direct pass-through (no key needed)', () => {
    const guide = { visualTone: 'v', colorPalette: 'c', atmosphericDetails: 'a', narrativeVoice: 'n' };
    shimService.formatStyleContext(guide);
    expect(coreGenerator.formatStyleContext).toHaveBeenCalledWith(guide);
  });
});
