export type CuisinePreferenceKey =
  | 'homeStyle'
  | 'cantonese'
  | 'jiangzhe'
  | 'sichuanHunan'
  | 'northern'
  | 'japanese'
  | 'western'
  | 'mediterranean';

export type TastePreferences = {
  cuisines: CuisinePreferenceKey[];
  note: string;
};

export const TASTE_PREFERENCES_STORAGE_KEY = 'tastePreferences';

export const CUISINE_PREFERENCE_OPTIONS: {
  key: CuisinePreferenceKey;
  zh: string;
  en: string;
  prompt: string;
}[] = [
  {
    key: 'homeStyle',
    zh: '家常清淡',
    en: 'Home-style light',
    prompt: 'home-style light flavor, familiar daily dishes, gentle seasoning'
  },
  {
    key: 'cantonese',
    zh: '粤式',
    en: 'Cantonese',
    prompt: 'Cantonese-inspired flavor, steamed or soup-based dishes, fresh and mild seasoning'
  },
  {
    key: 'jiangzhe',
    zh: '江浙',
    en: 'Jiangzhe',
    prompt: 'Jiangzhe-inspired flavor, light savory dishes with gentle sweetness only when suitable'
  },
  {
    key: 'sichuanHunan',
    zh: '川湘',
    en: 'Sichuan / Hunan',
    prompt: 'Sichuan or Hunan-inspired flavor, aromatic but keep spice mild unless the user asks for spicy'
  },
  {
    key: 'northern',
    zh: '北方',
    en: 'Northern Chinese',
    prompt: 'Northern Chinese flavor, wheat-based staples, stews, noodles, dumpling-style ideas when suitable'
  },
  {
    key: 'japanese',
    zh: '日式',
    en: 'Japanese',
    prompt: 'Japanese-inspired flavor, rice, miso-style light seasoning, simple grilled or simmered dishes'
  },
  {
    key: 'western',
    zh: '西式',
    en: 'Western',
    prompt: 'Western home-style flavor, simple plates with staple, protein, and vegetables'
  },
  {
    key: 'mediterranean',
    zh: '地中海',
    en: 'Mediterranean',
    prompt: 'Mediterranean-inspired flavor, vegetables, legumes, fish or lean protein, olive-oil style light cooking'
  }
];

const cuisineKeys = new Set(CUISINE_PREFERENCE_OPTIONS.map(option => option.key));

export function normalizeTastePreferences(value: unknown): TastePreferences {
  const raw = value && typeof value === 'object' ? value as Partial<TastePreferences> : {};
  const cuisines = Array.isArray(raw.cuisines)
    ? raw.cuisines.filter((key): key is CuisinePreferenceKey => cuisineKeys.has(key as CuisinePreferenceKey))
    : [];

  return {
    cuisines,
    note: String(raw.note || '').trim()
  };
}

export function getCuisinePreferenceLabels(keys: CuisinePreferenceKey[], language: 'zh' | 'en') {
  return keys
    .map(key => CUISINE_PREFERENCE_OPTIONS.find(option => option.key === key))
    .filter(Boolean)
    .map(option => language === 'zh' ? option!.zh : option!.en);
}

export function getTastePreferencePrompt(preferences: TastePreferences) {
  const cuisinePrompts = preferences.cuisines
    .map(key => CUISINE_PREFERENCE_OPTIONS.find(option => option.key === key)?.prompt)
    .filter(Boolean);
  const note = preferences.note ? `Additional flavor note: ${preferences.note}.` : '';

  if (!cuisinePrompts.length && !note) {
    return 'No specific cuisine or flavor preference specified.';
  }

  return [
    cuisinePrompts.length ? cuisinePrompts.map(item => `- ${item}`).join('\n') : '',
    note
  ].filter(Boolean).join('\n');
}
