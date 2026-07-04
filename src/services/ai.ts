import { GoogleGenAI, Type } from "@google/genai";
import { CustomRecipe, db } from "../db";
import { findLocalRecipe, localRecipes, MealType } from "../data/localRecipes";

interface AiSettings {
  enabled: boolean;
  provider: 'google' | 'qwen';
  apiKey: string;
  model: string;
}

const mealTypes: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

function getDefaultModel(provider: AiSettings['provider']) {
  return provider === 'qwen' ? 'deepseek-v4-flash' : 'gemini-3-flash-preview';
}

function normalizeApiKey(value: string) {
  return String(value || '').trim().replace(/^Bearer\s+/i, '');
}

function normalizeModel(provider: AiSettings['provider'], model: string) {
  const cleanModel = String(model || '').trim();
  if (provider === 'qwen') {
    if (['qwen-plus', 'qwen-turbo', 'qwen-max'].includes(cleanModel)) return getDefaultModel(provider);
    return cleanModel || getDefaultModel(provider);
  }
  return cleanModel.startsWith('qwen-') ? getDefaultModel(provider) : (cleanModel || getDefaultModel(provider));
}

type GeneratedMealInput = {
  mealType?: string;
  dishName?: string;
  ingredients?: unknown;
  steps?: unknown;
  nutritionTips?: unknown;
  cautions?: unknown;
  audience?: unknown;
  tutorial?: string;
  imageData?: string;
  imageDataList?: string[];
};

function getAiSettings(): AiSettings {
  try {
    const saved = localStorage.getItem('aiSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      const provider = parsed.provider || 'google';
      return {
        enabled: Boolean(parsed.enabled),
        provider,
        apiKey: normalizeApiKey(parsed.apiKey || import.meta.env.VITE_GEMINI_API_KEY || ''),
        model: normalizeModel(provider, parsed.model)
      };
    }
  } catch (e) {}

  return {
    enabled: false,
    provider: 'google',
    apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
    model: 'gemini-3-flash-preview'
  };
}

function getAI() {
  return new GoogleGenAI({ apiKey: getAiSettings().apiKey });
}

function shouldUseAI() {
  const settings = getAiSettings();
  return settings.enabled && Boolean(settings.apiKey);
}

async function qwenChat(prompt: string, expectJson = false) {
  const settings = getAiSettings();
  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${normalizeApiKey(settings.apiKey)}`
    },
    body: JSON.stringify({
      model: normalizeModel('qwen', settings.model),
      messages: [
        {
          role: 'system',
          content: expectJson
            ? 'You are a user meal planning assistant. Return only valid JSON with no markdown.'
            : 'You are a user meal planning assistant.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: expectJson ? { type: 'json_object' } : undefined
    })
  });

  if (!response.ok) {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch (e) {}

    if (response.status === 401 || response.status === 403) {
      throw new Error('千问请求被拒绝，请检查 DashScope API Key、模型权限、账户额度，或确认已选择可用模型。');
    }
    throw new Error(`千问请求失败：${response.status}${errorText ? ` ${errorText}` : ''}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function scoreRecipe(recipe: { dishName: string; ingredients: string[] }, likes: string[], dislikes: string[], allergies: string[], rejected: string[], eaten: string[]) {
  const content = `${recipe.dishName} ${recipe.ingredients.join(' ')}`.toLowerCase();
  if (allergies.some(item => content.includes(item.toLowerCase()))) return -1000;
  if (dislikes.some(item => content.includes(item.toLowerCase()))) return -100;

  let score = 0;
  score += likes.filter(item => content.includes(item.toLowerCase())).length * 8;
  if (rejected.includes(recipe.dishName)) score -= 20;
  if (eaten.includes(recipe.dishName)) score -= 8;
  return score;
}

function pickLocalMeal(type: MealType, seed: number, likes: string[], dislikes: string[], allergies: string[], rejected: string[], eaten: string[]) {
  const recipes = [...localRecipes[type]].sort((a, b) => {
    const scoreDiff = scoreRecipe(b, likes, dislikes, allergies, rejected, eaten) - scoreRecipe(a, likes, dislikes, allergies, rejected, eaten);
    if (scoreDiff !== 0) return scoreDiff;
    return a.dishName.localeCompare(b.dishName, 'zh-CN');
  });

  const viableRecipes = recipes.filter(recipe => scoreRecipe(recipe, likes, dislikes, allergies, rejected, eaten) > -1000);
  const pool = viableRecipes.length ? viableRecipes : recipes;
  return pool[seed % pool.length];
}

function buildCustomTutorial(recipe: CustomRecipe) {
  const steps = (recipe.tutorial || '')
    .split('\n')
    .map(step => step.trim())
    .filter(Boolean);
  const nutritionTips = recipe.nutritionTips || recipe.tags || [];
  const cautions = recipe.cautions || [];

  return [
    `## ${recipe.dishName}`,
    recipe.ingredients?.length ? `### 食材\n${recipe.ingredients.map(item => `- ${item}`).join('\n')}` : '',
    steps.length ? `### 做法步骤\n${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}` : '',
    nutritionTips.length ? `### 营养提示\n${nutritionTips.map(item => `- ${item}`).join('\n')}` : '',
    cautions.length ? `### 注意事项\n${cautions.map(item => `- ${item}`).join('\n')}` : ''
  ].filter(Boolean).join('\n\n');
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map(item => String(item || '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,，;；]/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeMealType(value: unknown, fallback: MealType = 'breakfast') {
  const rawValue = String(value || '').trim().toLowerCase();
  const mealTypeAliases: Record<string, MealType> = {
    breakfast: 'breakfast',
    morning: 'breakfast',
    '早餐': 'breakfast',
    '早饭': 'breakfast',
    lunch: 'lunch',
    noon: 'lunch',
    midday: 'lunch',
    '午餐': 'lunch',
    '午饭': 'lunch',
    '中饭': 'lunch',
    '中餐': 'lunch',
    snack: 'snack',
    snacks: 'snack',
    '加餐': 'snack',
    '点心': 'snack',
    '零食': 'snack',
    dinner: 'dinner',
    supper: 'dinner',
    evening: 'dinner',
    '晚餐': 'dinner',
    '晚饭': 'dinner'
  };
  const normalized = (mealTypeAliases[rawValue] || rawValue) as MealType;
  return mealTypes.includes(normalized) ? normalized : fallback;
}

function detectMealTypeIntent(text: string) {
  const value = String(text || '').toLowerCase();
  if (/(早餐|早饭|breakfast|morning)/i.test(value)) return 'breakfast';
  if (/(午餐|午饭|中餐|中饭|lunch|noon|midday)/i.test(value)) return 'lunch';
  if (/(加餐|点心|零食|snack)/i.test(value)) return 'snack';
  if (/(晚餐|晚饭|dinner|supper|evening)/i.test(value)) return 'dinner';
  return null;
}

function getMealTypeInstruction(mealType: MealType | 'any', language: 'zh' | 'en') {
  if (mealType === 'any') {
    return language === 'zh'
      ? '不限餐次。请根据用户备注中的中文餐次词（如早餐、午餐、中餐、晚餐、加餐）判断；只有明确要求早餐时才生成早餐。'
      : 'Any meal. Choose breakfast, lunch, snack, or dinner based on the user note. Do not default to breakfast unless breakfast is requested.';
  }

  const zhLabels: Record<MealType, string> = {
    breakfast: '早餐',
    lunch: '午餐/中餐',
    snack: '加餐/点心',
    dinner: '晚餐'
  };
  const enLabels: Record<MealType, string> = {
    breakfast: 'breakfast',
    lunch: 'lunch',
    snack: 'snack',
    dinner: 'dinner'
  };

  return language === 'zh'
    ? `${zhLabels[mealType]}。请按这个中文餐次生成食谱，JSON mealType 字段必须填写内部值 "${mealType}"。`
    : `${enLabels[mealType]}. Generate the recipe for this meal type, and set JSON mealType exactly to "${mealType}".`;
}

function buildGeneratedTutorial(meal: GeneratedMealInput, language: 'zh' | 'en') {
  if (meal.tutorial?.trim()) {
    const tutorial = meal.tutorial.trim();
    const dishName = String(meal.dishName || '').trim();
    if (!dishName || new RegExp(`^#{1,3}\\s+${dishName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm').test(tutorial)) {
      return tutorial;
    }
    return `## ${dishName}\n\n${tutorial}`;
  }

  const ingredients = toStringArray(meal.ingredients);
  const steps = toStringArray(meal.steps);
  const nutritionTips = toStringArray(meal.nutritionTips);
  const cautions = toStringArray(meal.cautions);

  if (language === 'zh') {
    return [
      meal.dishName ? `## ${meal.dishName}` : '',
      ingredients.length ? `### 食材\n${ingredients.map(item => `- ${item}`).join('\n')}` : '',
      steps.length ? `### 做法步骤\n${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}` : '',
      nutritionTips.length ? `### 营养提示\n${nutritionTips.map(item => `- ${item}`).join('\n')}` : '',
      cautions.length ? `### 注意事项\n${cautions.map(item => `- ${item}`).join('\n')}` : ''
    ].filter(Boolean).join('\n\n');
  }

  return [
    meal.dishName ? `## ${meal.dishName}` : '',
    ingredients.length ? `### Ingredients\n${ingredients.map(item => `- ${item}`).join('\n')}` : '',
    steps.length ? `### Cooking steps\n${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}` : '',
    nutritionTips.length ? `### Nutrition tips\n${nutritionTips.map(item => `- ${item}`).join('\n')}` : '',
    cautions.length ? `### Cautions\n${cautions.map(item => `- ${item}`).join('\n')}` : ''
  ].filter(Boolean).join('\n\n');
}

function normalizeGeneratedMeal(meal: GeneratedMealInput, language: 'zh' | 'en', fallbackMealType: MealType) {
  const ingredients = toStringArray(meal.ingredients);
  return {
    mealType: normalizeMealType(meal.mealType, fallbackMealType),
    dishName: String(meal.dishName || '').trim(),
    ingredients,
    tutorial: buildGeneratedTutorial(meal, language),
    imageData: meal.imageData,
    imageDataList: meal.imageDataList
  };
}

function normalizeGeneratedMeals(meals: GeneratedMealInput[], language: 'zh' | 'en') {
  return meals
    .map((meal, index) => normalizeGeneratedMeal(meal, language, mealTypes[index] || 'breakfast'))
    .filter(meal => meal.dishName);
}

function normalizeGeneratedRecipeDraft(meal: GeneratedMealInput, fallbackMealType: MealType | 'any') {
  const detectedMealType = detectMealTypeIntent(String(meal.mealType || ''));
  const mealType = fallbackMealType === 'any'
    ? detectedMealType || 'any'
    : fallbackMealType;

  return {
    dishName: String(meal.dishName || '').trim(),
    mealType,
    ingredients: toStringArray(meal.ingredients),
    steps: toStringArray(meal.steps),
    nutritionTips: toStringArray(meal.nutritionTips),
    cautions: toStringArray(meal.cautions),
    audience: toStringArray(meal.audience)
  };
}

function customRecipeToLocal(recipe: CustomRecipe, mealType: MealType) {
  return {
    mealType,
    dishName: recipe.dishName,
    ingredients: recipe.ingredients || [],
    tutorial: buildCustomTutorial(recipe),
    imageData: recipe.imageData || recipe.imageDataList?.[0],
    imageDataList: recipe.imageDataList || (recipe.imageData ? [recipe.imageData] : [])
  };
}

async function pickMeal(type: MealType, seed: number, likes: string[], dislikes: string[], allergies: string[], rejected: string[], eaten: string[], excluded: string[] = []) {
  const customRecipes = await db.customRecipes
    .filter(recipe => !recipe.mealType || recipe.mealType === 'any' || recipe.mealType === type)
    .toArray();
  const localPool = localRecipes[type];
  const customPool = customRecipes.map(recipe => customRecipeToLocal(recipe, type));
  const recipes = [...customPool, ...localPool].sort((a, b) => {
    const scoreDiff = scoreRecipe(b, likes, dislikes, allergies, rejected, eaten) - scoreRecipe(a, likes, dislikes, allergies, rejected, eaten);
    if (scoreDiff !== 0) return scoreDiff;
    return a.dishName.localeCompare(b.dishName, 'zh-CN');
  });
  const viableRecipes = recipes.filter(recipe => scoreRecipe(recipe, likes, dislikes, allergies, rejected, eaten) > -1000);
  const basePool = viableRecipes.length ? viableRecipes : recipes;
  const uniquePool = basePool.filter(recipe => !excluded.includes(recipe.dishName));
  const pool = uniquePool.length ? uniquePool : basePool;
  return pool[seed % pool.length] || pickLocalMeal(type, seed, likes, dislikes, allergies, rejected, eaten);
}

async function getMealContext() {
  const prefs = await db.preferences.toArray();
  const likes = prefs.filter(p => p.type === 'like').map(p => p.item);
  const dislikes = prefs.filter(p => p.type === 'dislike').map(p => p.item);
  const allergies = prefs.filter(p => p.type === 'allergy').map(p => p.item);

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentHistory = await db.mealHistory.where('date').aboveOrEqual(threeDaysAgo).toArray();

  const rejected = recentHistory.filter(h => h.status === 'rejected').map(h => h.dishName);
  const eaten = recentHistory.filter(h => h.status === 'eaten').map(h => h.dishName);

  return { likes, dislikes, allergies, rejected, eaten };
}

async function generateLocalDailyPlan(date: string, refreshSeed = 0) {
  const { likes, dislikes, allergies, rejected, eaten } = await getMealContext();
  const seedBase = date.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) + refreshSeed;

  const usedDishNames: string[] = [];
  const meals = [];

  for (const [index, mealType] of mealTypes.entries()) {
    const recipe = await pickMeal(mealType, seedBase + index, likes, dislikes, allergies, rejected, eaten, usedDishNames);
    usedDishNames.push(recipe.dishName);
    meals.push({
      mealType: recipe.mealType,
      dishName: recipe.dishName,
      ingredients: recipe.ingredients,
      tutorial: recipe.tutorial,
      imageData: (recipe as any).imageData,
      imageDataList: (recipe as any).imageDataList
    });
  }

  return meals;
}

async function generateLocalSingleMeal(mealType: string, date: string) {
  const normalizedType = mealType.toLowerCase() as MealType;
  if (!mealTypes.includes(normalizedType)) return null;

  const { likes, dislikes, allergies, rejected, eaten } = await getMealContext();
  const seed = date.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) + Date.now();
  const recipe = await pickMeal(normalizedType, seed, likes, dislikes, allergies, rejected, eaten);

  return {
    mealType: recipe.mealType,
    dishName: recipe.dishName,
    ingredients: recipe.ingredients,
    tutorial: recipe.tutorial,
    imageData: (recipe as any).imageData,
    imageDataList: (recipe as any).imageDataList
  };
}

function generateLocalReport(history: any[], language: 'zh' | 'en') {
  const eaten = history.filter(item => item.status === 'eaten');
  const rejected = history.filter(item => item.status === 'rejected');
  const partial = history.filter(item => item.status === 'partial');
  const total = history.length || 1;
  const acceptanceRate = Math.round((eaten.length / total) * 100);
  const profile = getBabyProfile();
  const target = getTargetGroupLabel(profile.targetGroup);

  if (language === 'zh') {
    const advice = target === 'elderly'
      ? '优先关注易消化、优质蛋白、钙和膳食纤维的搭配，减少高盐高油食物。对被拒绝的菜品，可以调整软硬度、温度和调味强度，让餐食更容易入口。'
      : target === 'adult'
        ? '优先关注主食、蛋白质、蔬菜和健康脂肪的均衡，结合实际作息控制餐量。对被拒绝的菜品，可以调整烹饪方式、口味层次或替换相近食材。'
        : '优先保留用户接受度高的软饭、粥、面和蒸煮类食物。对被拒绝的菜品，可以更换相近食材或改变形态，比如从块状改成泥状、从单一蔬菜改成粥饭搭配。';
    const nextPlan = target === 'elderly'
      ? '下一次餐单建议保持少油少盐、蛋白质充足、蔬菜柔软易嚼，并避免重复近期被拒绝的菜名。'
      : target === 'adult'
        ? '下一次餐单建议保持主食、蛋白质和蔬菜的组合，结合偏好增加变化，并避免重复近期被拒绝的菜名。'
        : '继续保持主食、蛋白质和蔬菜的组合，注意食材大小和软硬度，并避免重复近期被拒绝的菜名。';

    return `## 饮食概览

- 记录餐数：${history.length}
- 已吃：${eaten.length}
- 部分接受：${partial.length}
- 拒绝：${rejected.length}
- 接受率：${acceptanceRate}%

## 调整建议

${advice}

## 下次餐单思路

${nextPlan}`;
  }

  const advice = target === 'elderly'
    ? 'Prioritize easy-to-digest meals with quality protein, calcium, fiber, and lower sodium. For rejected meals, adjust texture, temperature, and seasoning intensity.'
    : target === 'adult'
      ? 'Prioritize balanced meals with carbohydrates, protein, vegetables, and healthy fats. For rejected meals, adjust cooking methods, flavor balance, or use similar ingredients.'
      : 'Keep soft rice, porridge, noodles, steamed dishes, and foods with a good acceptance history. For rejected meals, try similar ingredients in a softer texture or a different format.';
  const nextPlan = target === 'elderly'
    ? 'Keep meals lower in oil and sodium, with enough protein and soft vegetables, while avoiding recently rejected dishes.'
    : target === 'adult'
      ? 'Keep pairing carbohydrates, protein, and vegetables with more variety, while avoiding recently rejected dishes.'
      : 'Keep pairing carbohydrates, protein, and vegetables while paying attention to texture, serving size, and recently rejected dishes.';

  return `## Meal Overview

- Records: ${history.length}
- Eaten: ${eaten.length}
- Partially accepted: ${partial.length}
- Rejected: ${rejected.length}
- Acceptance rate: ${acceptanceRate}%

## Suggestions

${advice}

## Next Plan

${nextPlan}`;
}

export function getBabyProfile() {
  try {
    const data = localStorage.getItem('babyProfile');
    if (data) return JSON.parse(data);
  } catch (e) {}
  return { age: 24, gender: 'boy', targetGroup: 'infant', peopleCount: 1 };
}

function getTargetGroupLabel(targetGroup?: string) {
  if (targetGroup === 'adult') return 'adult';
  if (targetGroup === 'elderly') return 'elderly person';
  return 'infant';
}

function getAgeString(months: number) {
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const m = months % 12;
    return m > 0 ? `${years} year and ${m} month old` : `${years} year old`;
  }
  return `${months} month old`;
}

function getProfileDescription(profile: any) {
  const peopleCount = profile.peopleCount || 1;
  const target = getTargetGroupLabel(profile.targetGroup);
  if (target === 'infant') {
    return `${getAgeString(profile.age || 24)} infant (${profile.gender || 'boy'}), serving ${peopleCount} ${peopleCount > 1 ? 'people' : 'person'}`;
  }
  return `${target}, serving ${peopleCount} ${peopleCount > 1 ? 'people' : 'person'}`;
}

export async function generateDailyPlan(date: string, language: 'zh' | 'en', refreshSeed = 0) {
  if (!shouldUseAI()) {
    return generateLocalDailyPlan(date, refreshSeed);
  }

  const prefs = await db.preferences.toArray();
  const likes = prefs.filter(p => p.type === 'like').map(p => p.item);
  const dislikes = prefs.filter(p => p.type === 'dislike').map(p => p.item);
  const allergies = prefs.filter(p => p.type === 'allergy').map(p => p.item);

  // Get recent history to avoid repetition and learn from rejections
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentHistory = await db.mealHistory.where('date').aboveOrEqual(threeDaysAgo).toArray();

  const rejected = recentHistory.filter(h => h.status === 'rejected').map(h => h.dishName);
  const eaten = recentHistory.filter(h => h.status === 'eaten').map(h => h.dishName);

  const langInstruction = language === 'zh' ? 'The response MUST be in Chinese (Simplified).' : 'The response MUST be in English.';
  const profile = getBabyProfile();
  const profileDescription = getProfileDescription(profile);

  const prompt = `
Generate a healthy daily meal plan for ${profileDescription} for the date ${date}.
Variation token: ${refreshSeed}. Use it to provide a meaningfully different set when regenerating.
The user has the following preferences:
- Likes: ${likes.join(', ') || 'None specified'}
- Dislikes: ${dislikes.join(', ') || 'None specified'}
- Allergies: ${allergies.join(', ') || 'None specified'}

Recently rejected meals (avoid these or similar): ${rejected.join(', ') || 'None'}
Recently eaten meals (they like these, but don't repeat exactly): ${eaten.join(', ') || 'None'}

Requirements:
- Meals must be healthy, low in sodium and sugar, suitable for the target people, and nutritionally balanced.
- Provide 4 meals: breakfast, lunch, snack, dinner.
- Each meal must include complete recipe details because the generated menu will be saved locally and viewed later without another AI call.
- For each meal, provide these fixed JSON fields: mealType, dishName, ingredients, steps, nutritionTips, cautions.
- ingredients must be a concise ingredient list.
- steps must contain 3-6 practical cooking steps, one action per item.
- nutritionTips must contain 1-3 nutrition notes.
- cautions must contain 1-3 safety, allergy, texture, or serving notes.
- Use user/target-people wording. Do not say baby or toddler unless the target group is infant.
- The response MUST be a valid JSON object matching the requested schema.
- ${langInstruction}
  `;

  try {
    if (getAiSettings().provider === 'qwen') {
      const content = await qwenChat(prompt, true);
      const data = JSON.parse(content || '{}');
      const meals = normalizeGeneratedMeals(data.meals || [], language);
      return meals.length ? meals : generateLocalDailyPlan(date, refreshSeed);
    }

    const response = await getAI().models.generateContent({
      model: getAiSettings().model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            meals: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  mealType: { type: Type.STRING, description: "breakfast, lunch, snack, or dinner" },
                  dishName: { type: Type.STRING },
                  ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                  steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  nutritionTips: { type: Type.ARRAY, items: { type: Type.STRING } },
                  cautions: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["mealType", "dishName", "ingredients", "steps", "nutritionTips", "cautions"]
              }
            }
          },
          required: ["meals"]
        }
      }
    });

    const data = JSON.parse(response.text || '{}');
    const meals = normalizeGeneratedMeals(data.meals || [], language);
    return meals.length ? meals : generateLocalDailyPlan(date, refreshSeed);
  } catch (e) {
    console.error("Failed to generate AI meal plan", e);
    return generateLocalDailyPlan(date, refreshSeed);
  }
}

export async function generateSingleMeal(date: string, mealType: string, language: 'zh' | 'en') {
  if (!shouldUseAI()) {
    return generateLocalSingleMeal(mealType, date);
  }

  const prefs = await db.preferences.toArray();
  const likes = prefs.filter(p => p.type === 'like').map(p => p.item);
  const dislikes = prefs.filter(p => p.type === 'dislike').map(p => p.item);
  const allergies = prefs.filter(p => p.type === 'allergy').map(p => p.item);

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentHistory = await db.mealHistory.where('date').aboveOrEqual(threeDaysAgo).toArray();

  const rejected = recentHistory.filter(h => h.status === 'rejected').map(h => h.dishName);
  const eaten = recentHistory.filter(h => h.status === 'eaten').map(h => h.dishName);

  const langInstruction = language === 'zh' ? 'The response MUST be in Chinese (Simplified).' : 'The response MUST be in English.';
  const profile = getBabyProfile();
  const profileDescription = getProfileDescription(profile);

  const prompt = `
Generate a healthy ${mealType} for ${profileDescription} for the date ${date}.
The user has the following preferences:
- Likes: ${likes.join(', ') || 'None specified'}
- Dislikes: ${dislikes.join(', ') || 'None specified'}
- Allergies: ${allergies.join(', ') || 'None specified'}

Recently rejected meals (avoid these or similar): ${rejected.join(', ') || 'None'}
Recently eaten meals (they like these, but don't repeat exactly): ${eaten.join(', ') || 'None'}

Requirements:
- Meals must be healthy, low in sodium and sugar, suitable for the target people, and nutritionally balanced.
- Include complete recipe details because the generated menu will be saved locally and viewed later without another AI call.
- Provide these fixed JSON fields: mealType, dishName, ingredients, steps, nutritionTips, cautions.
- ingredients must be a concise ingredient list.
- steps must contain 3-6 practical cooking steps, one action per item.
- nutritionTips must contain 1-3 nutrition notes.
- cautions must contain 1-3 safety, allergy, texture, or serving notes.
- Use user/target-people wording. Do not say baby or toddler unless the target group is infant.
- The response MUST be a valid JSON object matching the requested schema.
- ${langInstruction}
  `;

  try {
    if (getAiSettings().provider === 'qwen') {
      const content = await qwenChat(prompt, true);
      const meal = JSON.parse(content || '{}');
      return normalizeGeneratedMeal(meal, language, normalizeMealType(meal.mealType, mealType.toLowerCase() as MealType));
    }

    const response = await getAI().models.generateContent({
      model: getAiSettings().model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mealType: { type: Type.STRING },
            dishName: { type: Type.STRING },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
            steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            nutritionTips: { type: Type.ARRAY, items: { type: Type.STRING } },
            cautions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["mealType", "dishName", "ingredients", "steps", "nutritionTips", "cautions"]
        }
      }
    });

    const meal = JSON.parse(response.text || '{}');
    return normalizeGeneratedMeal(meal, language, normalizeMealType(meal.mealType, mealType.toLowerCase() as MealType));
  } catch (e) {
    console.error("Failed to parse single meal JSON", e);
    return generateLocalSingleMeal(mealType, date);
  }
}

export async function generateCustomRecipeDraft(options: {
  language: 'zh' | 'en';
  mode: 'direct' | 'ingredients';
  mealType?: MealType | 'any';
  dishName?: string;
  ingredients?: string[];
  note?: string;
}) {
  if (!shouldUseAI()) {
    throw new Error('AI is not enabled');
  }

  const langInstruction = options.language === 'zh' ? 'The response MUST be in Chinese (Simplified).' : 'The response MUST be in English.';
  const profile = getBabyProfile();
  const profileDescription = getProfileDescription(profile);
  const ingredientText = options.ingredients?.length ? options.ingredients.join(', ') : 'None specified';
  const requestedMealType = options.mealType && options.mealType !== 'any'
    ? options.mealType
    : detectMealTypeIntent([options.note, options.dishName, ingredientText].filter(Boolean).join(' ')) || 'any';
  const mealTypeText = getMealTypeInstruction(requestedMealType, options.language);
  const modeInstruction = options.mode === 'ingredients'
    ? `Create a recipe mainly using these ingredients: ${ingredientText}. You may add only small common pantry ingredients if necessary.`
    : 'Create a complete recipe idea from scratch.';

  const prompt = `
Generate one healthy custom recipe draft for ${profileDescription}.
Meal type preference / 餐次偏好: ${mealTypeText}
Existing dish name, if any: ${options.dishName || 'None specified'}.
Extra user note: ${options.note || 'None specified'}.
${modeInstruction}

Requirements:
- Return one recipe only.
- If the meal type preference is breakfast, lunch, snack, or dinner, the JSON mealType MUST exactly equal that value.
- If the user note mentions 早餐/午餐/中餐/中饭/晚餐/加餐 or breakfast/lunch/dinner/snack, honor that meal type.
- The recipe must be practical for home cooking and suitable for the target people.
- Avoid added salt and sugar where possible.
- Provide these fixed JSON fields: mealType, dishName, ingredients, steps, nutritionTips, cautions, audience.
- ingredients must be a concise list.
- steps must contain 3-6 practical cooking steps, one action per item.
- nutritionTips must contain 1-3 notes.
- cautions must contain 1-3 safety, allergy, texture, or serving notes.
- audience must contain 1-3 suitable people labels.
- Use user/target-people wording. Do not say baby or toddler unless the target group is infant.
- The response MUST be a valid JSON object matching the requested schema.
- ${langInstruction}
  `;

  if (getAiSettings().provider === 'qwen') {
    const content = await qwenChat(prompt, true);
    const meal = JSON.parse(content || '{}');
    return normalizeGeneratedRecipeDraft(meal, requestedMealType);
  }

  const response = await getAI().models.generateContent({
    model: getAiSettings().model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          mealType: { type: Type.STRING },
          dishName: { type: Type.STRING },
          ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          nutritionTips: { type: Type.ARRAY, items: { type: Type.STRING } },
          cautions: { type: Type.ARRAY, items: { type: Type.STRING } },
          audience: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["mealType", "dishName", "ingredients", "steps", "nutritionTips", "cautions", "audience"]
      }
    }
  });

  const meal = JSON.parse(response.text || '{}');
  return normalizeGeneratedRecipeDraft(meal, requestedMealType);
}

export async function generateAudio(text: string, language: 'zh' | 'en') {
  if (!shouldUseAI()) {
    return null;
  }

  if (getAiSettings().provider !== 'google') {
    return null;
  }

  try {
    const voiceName = language === 'zh' ? 'Aoede' : 'Kore';
    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (e) {
    console.error("Failed to generate audio", e);
    return null;
  }
}

export async function generateTutorial(dishName: string, ingredients: string[], language: 'zh' | 'en') {
  const localRecipe = findLocalRecipe(dishName);
  if (localRecipe) {
    return localRecipe.tutorial;
  }

    if (!shouldUseAI()) {
      return language === 'zh'
      ? `## ${dishName}\n\n### 食材\n${ingredients.map(item => `- ${item}`).join('\n')}\n\n### 做法步骤\n1. 将食材清洗干净并处理成适合用户入口的大小。\n2. 使用蒸、煮、炖等清淡方式烹饪至充分熟透。\n3. 根据用户咀嚼能力调整软硬度和颗粒大小，放温后食用。\n\n### 营养提示\n- 保持主食、蛋白质和蔬菜的搭配。\n\n### 注意事项\n- 避免额外添加盐和糖，注意过敏食材。`
      : `## ${dishName}\n\n### Ingredients\n${ingredients.map(item => `- ${item}`).join('\n')}\n\n### Cooking steps\n1. Wash and prepare ingredients into a serving size suitable for the user.\n2. Cook thoroughly with gentle methods such as steaming, boiling, or stewing.\n3. Adjust texture and portion size for the user's chewing ability, then serve warm.\n\n### Nutrition tips\n- Keep a balanced mix of carbohydrates, protein, and vegetables.\n\n### Cautions\n- Avoid added salt and sugar, and check allergy risks.`;
    }

  const langInstruction = language === 'zh' ? 'The tutorial MUST be written in Chinese (Simplified).' : 'The tutorial MUST be written in English.';
  const profile = getBabyProfile();
  const profileDescription = getProfileDescription(profile);

  const prompt = `
Provide a detailed, step-by-step cooking tutorial for ${profileDescription}: "${dishName}".
Main ingredients: ${ingredients.join(', ')}.

Requirements:
- The cooking method must be healthy (e.g., steaming, boiling, light sautéing).
- Ensure the texture is appropriate for the target people.
- Mention any specific prep steps for the user group (e.g., cutting grapes in half, removing bones).
- Do not use added salt or sugar.
- Start with the recipe title as a level 2 Markdown heading.
- Format as Markdown with these exact sections after the title: Ingredients, Cooking steps, Nutrition tips, Cautions. Use the Chinese section names 食材, 做法步骤, 营养提示, 注意事项 when writing in Chinese.
- ${langInstruction}
  `;

  if (getAiSettings().provider === 'qwen') {
    return qwenChat(prompt);
  }

  const response = await getAI().models.generateContent({
    model: getAiSettings().model,
    contents: prompt
  });

  return response.text || '';
}

export async function generateReport(timeframe: 'daily' | 'weekly', history: any[], language: 'zh' | 'en') {
  if (!shouldUseAI()) {
    return generateLocalReport(history, language);
  }

  const langInstruction = language === 'zh' ? 'The report MUST be written in Chinese (Simplified).' : 'The report MUST be written in English.';
  const profile = getBabyProfile();
  const profileDescription = getProfileDescription(profile);

  const prompt = `
Analyze the following meal history for ${profileDescription} over the past ${timeframe} and provide a summary report.
History:
${JSON.stringify(history)}

Provide:
1. A summary of their eating habits (what they liked, what they rejected).
2. Nutritional insights (are they getting enough variety?).
3. Smart adjustments for future meals based on their rejections and acceptances.
4. Target-group-specific advice: infant reports must focus on texture and safety; adult reports should focus on balanced nutrition and routine; elderly reports should focus on digestibility, protein, calcium, fiber, hydration, and lower sodium.
Use user/target-people wording. Do not assume the user is an infant unless the profile says infant.
Format as Markdown.
- ${langInstruction}
  `;

  if (getAiSettings().provider === 'qwen') {
    return qwenChat(prompt);
  }

  const response = await getAI().models.generateContent({
    model: getAiSettings().model,
    contents: prompt
  });

  return response.text || '';
}
