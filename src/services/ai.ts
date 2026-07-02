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

type GeneratedMealInput = {
  mealType?: string;
  dishName?: string;
  ingredients?: unknown;
  steps?: unknown;
  nutritionTips?: unknown;
  cautions?: unknown;
  tutorial?: string;
  imageData?: string;
  imageDataList?: string[];
};

function getAiSettings(): AiSettings {
  try {
    const saved = localStorage.getItem('aiSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        enabled: Boolean(parsed.enabled),
        provider: parsed.provider || 'google',
        apiKey: parsed.apiKey || import.meta.env.VITE_GEMINI_API_KEY || '',
        model: parsed.model || 'gemini-3-flash-preview'
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
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model || 'qwen-plus',
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
    throw new Error(`Qwen request failed: ${response.status}`);
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
    recipe.ingredients?.length ? `## 食材\n${recipe.ingredients.map(item => `- ${item}`).join('\n')}` : '',
    steps.length ? `## 做法步骤\n${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}` : '',
    nutritionTips.length ? `## 营养提示\n${nutritionTips.map(item => `- ${item}`).join('\n')}` : '',
    cautions.length ? `## 注意事项\n${cautions.map(item => `- ${item}`).join('\n')}` : ''
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
  const normalized = String(value || '').toLowerCase() as MealType;
  return mealTypes.includes(normalized) ? normalized : fallback;
}

function buildGeneratedTutorial(meal: GeneratedMealInput, language: 'zh' | 'en') {
  if (meal.tutorial?.trim()) return meal.tutorial.trim();

  const ingredients = toStringArray(meal.ingredients);
  const steps = toStringArray(meal.steps);
  const nutritionTips = toStringArray(meal.nutritionTips);
  const cautions = toStringArray(meal.cautions);

  if (language === 'zh') {
    return [
      ingredients.length ? `## 食材\n${ingredients.map(item => `- ${item}`).join('\n')}` : '',
      steps.length ? `## 做法步骤\n${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}` : '',
      nutritionTips.length ? `## 营养提示\n${nutritionTips.map(item => `- ${item}`).join('\n')}` : '',
      cautions.length ? `## 注意事项\n${cautions.map(item => `- ${item}`).join('\n')}` : ''
    ].filter(Boolean).join('\n\n');
  }

  return [
    ingredients.length ? `## Ingredients\n${ingredients.map(item => `- ${item}`).join('\n')}` : '',
    steps.length ? `## Cooking steps\n${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}` : '',
    nutritionTips.length ? `## Nutrition tips\n${nutritionTips.map(item => `- ${item}`).join('\n')}` : '',
    cautions.length ? `## Cautions\n${cautions.map(item => `- ${item}`).join('\n')}` : ''
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
  const total = history.length || 1;
  const acceptanceRate = Math.round((eaten.length / total) * 100);

  if (language === 'zh') {
    return `## 饮食概览

- 记录餐数：${history.length}
- 已吃：${eaten.length}
- 拒绝：${rejected.length}
- 接受率：${acceptanceRate}%

## 调整建议

优先保留用户接受度高的软饭、粥、面和蒸煮类食物。对被拒绝的菜品，可以更换相近食材或改变形态，比如从块状改成泥状、从单一蔬菜改成粥饭搭配。

## 下次餐单思路

继续保持主食、蛋白质和蔬菜的组合，避免重复最近被拒绝的菜名。`;
  }

  return `## Meal Overview

- Records: ${history.length}
- Eaten: ${eaten.length}
- Rejected: ${rejected.length}
- Acceptance rate: ${acceptanceRate}%

## Suggestions

Keep soft rice, porridge, noodles, steamed dishes, and foods with a good acceptance history. For rejected meals, try similar ingredients in a softer texture or a different format.

## Next Plan

Keep pairing carbohydrates, protein, and vegetables while avoiding recently rejected dishes.`;
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
      ? `# ${dishName}\n\n## 食材\n${ingredients.map(item => `- ${item}`).join('\n')}\n\n## 做法步骤\n1. 将食材清洗干净并处理成适合用户入口的大小。\n2. 使用蒸、煮、炖等清淡方式烹饪至充分熟透。\n3. 根据用户咀嚼能力调整软硬度和颗粒大小，放温后食用。\n\n## 营养提示\n- 保持主食、蛋白质和蔬菜的搭配。\n\n## 注意事项\n- 避免额外添加盐和糖，注意过敏食材。`
      : `# ${dishName}\n\n## Ingredients\n${ingredients.map(item => `- ${item}`).join('\n')}\n\n## Cooking steps\n1. Wash and prepare ingredients into a serving size suitable for the user.\n2. Cook thoroughly with gentle methods such as steaming, boiling, or stewing.\n3. Adjust texture and portion size for the user's chewing ability, then serve warm.\n\n## Nutrition tips\n- Keep a balanced mix of carbohydrates, protein, and vegetables.\n\n## Cautions\n- Avoid added salt and sugar, and check allergy risks.`;
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
- Format as Markdown with these exact sections: Ingredients, Cooking steps, Nutrition tips, Cautions. Use the Chinese section names 食材, 做法步骤, 营养提示, 注意事项 when writing in Chinese.
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

  const prompt = `
Analyze the following meal history for the user over the past ${timeframe} and provide a summary report.
History:
${JSON.stringify(history)}

Provide:
1. A summary of their eating habits (what they liked, what they rejected).
2. Nutritional insights (are they getting enough variety?).
3. Smart adjustments for future meals based on their rejections and acceptances.
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
