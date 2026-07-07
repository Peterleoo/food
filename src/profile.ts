export type TargetGroup = 'infant' | 'adult' | 'elderly';
export type HealthConditionKey =
  | 'diabetes'
  | 'hypertension'
  | 'hyperlipidemia'
  | 'gout'
  | 'kidneyDisease'
  | 'digestiveSensitivity';

export type UserProfile = {
  age: number;
  gender: 'boy' | 'girl';
  targetGroup: TargetGroup;
  peopleCount: number;
  healthConditions: HealthConditionKey[];
  healthConditionNote: string;
};

export const HEALTH_CONDITION_OPTIONS: {
  key: HealthConditionKey;
  zh: string;
  en: string;
  prompt: string;
}[] = [
  {
    key: 'diabetes',
    zh: '糖尿病/控糖',
    en: 'Diabetes / glucose control',
    prompt: 'diabetes or glucose control: prefer low glycemic-load staples, balanced protein and fiber, no added sugar, moderate portions'
  },
  {
    key: 'hypertension',
    zh: '高血压/控盐',
    en: 'Hypertension / low sodium',
    prompt: 'hypertension or sodium control: keep sodium low, avoid processed salty foods, heavy sauces, pickles, and cured foods'
  },
  {
    key: 'hyperlipidemia',
    zh: '高血脂',
    en: 'High blood lipids',
    prompt: 'high blood lipids: prefer lean protein, high-fiber vegetables and grains, avoid deep-fried foods and high saturated fat'
  },
  {
    key: 'gout',
    zh: '痛风/高尿酸',
    en: 'Gout / high uric acid',
    prompt: 'gout or high uric acid: avoid high-purine foods such as organ meats, concentrated meat broth, and excessive seafood'
  },
  {
    key: 'kidneyDisease',
    zh: '肾脏疾病',
    en: 'Kidney condition',
    prompt: 'kidney condition: keep sodium conservative and avoid strong assumptions about potassium or phosphorus; remind users to follow clinician guidance when needed'
  },
  {
    key: 'digestiveSensitivity',
    zh: '肠胃敏感',
    en: 'Digestive sensitivity',
    prompt: 'digestive sensitivity: prefer gentle cooking methods, softer textures, and avoid greasy or highly spicy dishes'
  }
];

const healthConditionKeys = new Set(HEALTH_CONDITION_OPTIONS.map(option => option.key));

export const DEFAULT_USER_PROFILE: UserProfile = {
  age: 24,
  gender: 'boy',
  targetGroup: 'infant',
  peopleCount: 1,
  healthConditions: [],
  healthConditionNote: ''
};

export function normalizeUserProfile(value: unknown): UserProfile {
  const raw = value && typeof value === 'object' ? value as Partial<UserProfile> : {};
  const targetGroup = raw.targetGroup === 'adult' || raw.targetGroup === 'elderly' ? raw.targetGroup : 'infant';
  const gender = raw.gender === 'girl' ? 'girl' : 'boy';
  const age = Number.isFinite(Number(raw.age)) ? Math.max(1, Math.min(120, Number(raw.age))) : DEFAULT_USER_PROFILE.age;
  const peopleCount = Number.isFinite(Number(raw.peopleCount)) ? Math.max(1, Math.min(99, Number(raw.peopleCount))) : 1;
  const healthConditions = Array.isArray(raw.healthConditions)
    ? raw.healthConditions.filter((key): key is HealthConditionKey => healthConditionKeys.has(key as HealthConditionKey))
    : [];

  return {
    age,
    gender,
    targetGroup,
    peopleCount,
    healthConditions,
    healthConditionNote: String(raw.healthConditionNote || '').trim()
  };
}

export function getHealthConditionLabels(keys: HealthConditionKey[], language: 'zh' | 'en') {
  return keys
    .map(key => HEALTH_CONDITION_OPTIONS.find(option => option.key === key))
    .filter(Boolean)
    .map(option => language === 'zh' ? option!.zh : option!.en);
}

export function getHealthProfilePrompt(profile: UserProfile) {
  const conditionPrompts = profile.healthConditions
    .map(key => HEALTH_CONDITION_OPTIONS.find(option => option.key === key)?.prompt)
    .filter(Boolean);
  const note = profile.healthConditionNote ? `Additional user note or clinician guidance: ${profile.healthConditionNote}.` : '';

  if (!conditionPrompts.length && !note) {
    return 'No special medical dietary constraints specified.';
  }

  return [
    conditionPrompts.length ? conditionPrompts.map(item => `- ${item}`).join('\n') : '',
    note,
    'Use these as dietary constraints only. Do not claim to diagnose, treat, cure, or replace professional medical advice.'
  ].filter(Boolean).join('\n');
}
