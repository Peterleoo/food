import { GoogleGenAI, Type } from "@google/genai";
import { db } from "../db";
import { findLocalRecipe, localRecipes, MealType } from "../data/localRecipes";

interface AiSettings {
  enabled: boolean;
  provider: 'google' | 'qwen';
  apiKey: string;
  model: string;
}

const mealTypes: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

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
            ? 'You are a toddler meal planning assistant. Return only valid JSON with no markdown.'
            : 'You are a toddler meal planning assistant.'
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

async function generateLocalDailyPlan(date: string) {
  const { likes, dislikes, allergies, rejected, eaten } = await getMealContext();
  const seedBase = date.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return mealTypes.map((mealType, index) => {
    const recipe = pickLocalMeal(mealType, seedBase + index, likes, dislikes, allergies, rejected, eaten);
    return {
      mealType: recipe.mealType,
      dishName: recipe.dishName,
      ingredients: recipe.ingredients
    };
  });
}

async function generateLocalSingleMeal(mealType: string, date: string) {
  const normalizedType = mealType.toLowerCase() as MealType;
  if (!mealTypes.includes(normalizedType)) return null;

  const { likes, dislikes, allergies, rejected, eaten } = await getMealContext();
  const seed = date.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) + Date.now();
  const recipe = pickLocalMeal(normalizedType, seed, likes, dislikes, allergies, rejected, eaten);

  return {
    mealType: recipe.mealType,
    dishName: recipe.dishName,
    ingredients: recipe.ingredients
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

优先保留宝宝接受度高的软饭、粥、面和蒸煮类食物。对被拒绝的菜品，可以更换相近食材或改变形态，比如从块状改成泥状、从单一蔬菜改成粥饭搭配。

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
  return { age: 24, gender: 'boy' };
}

function getAgeString(months: number) {
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const m = months % 12;
    return m > 0 ? `${years} year and ${m} month old` : `${years} year old`;
  }
  return `${months} month old`;
}

export async function generateDailyPlan(date: string, language: 'zh' | 'en') {
  if (!shouldUseAI()) {
    return generateLocalDailyPlan(date);
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
  const ageStr = getAgeString(profile.age);

  const prompt = `
Generate a healthy daily meal plan for a ${ageStr} toddler (${profile.gender}) for the date ${date}.
The toddler has the following preferences:
- Likes: ${likes.join(', ') || 'None specified'}
- Dislikes: ${dislikes.join(', ') || 'None specified'}
- Allergies: ${allergies.join(', ') || 'None specified'}

Recently rejected meals (avoid these or similar): ${rejected.join(', ') || 'None'}
Recently eaten meals (they like these, but don't repeat exactly): ${eaten.join(', ') || 'None'}

Requirements:
- Meals must be healthy, low in sodium and sugar, soft enough for a ${ageStr} toddler, and nutritionally balanced.
- Provide 4 meals: breakfast, lunch, snack, dinner.
- For each meal, provide a dish name and a list of main ingredients.
- The response MUST be a valid JSON object matching the requested schema.
- ${langInstruction}
  `;

  try {
    if (getAiSettings().provider === 'qwen') {
      const content = await qwenChat(prompt, true);
      const data = JSON.parse(content || '{}');
      return data.meals || generateLocalDailyPlan(date);
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
                  ingredients: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["mealType", "dishName", "ingredients"]
              }
            }
          },
          required: ["meals"]
        }
      }
    });

    const data = JSON.parse(response.text || '{}');
    return data.meals || generateLocalDailyPlan(date);
  } catch (e) {
    console.error("Failed to generate AI meal plan", e);
    return generateLocalDailyPlan(date);
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
  const ageStr = getAgeString(profile.age);

  const prompt = `
Generate a healthy ${mealType} for a ${ageStr} toddler (${profile.gender}) for the date ${date}.
The toddler has the following preferences:
- Likes: ${likes.join(', ') || 'None specified'}
- Dislikes: ${dislikes.join(', ') || 'None specified'}
- Allergies: ${allergies.join(', ') || 'None specified'}

Recently rejected meals (avoid these or similar): ${rejected.join(', ') || 'None'}
Recently eaten meals (they like these, but don't repeat exactly): ${eaten.join(', ') || 'None'}

Requirements:
- Meals must be healthy, low in sodium and sugar, soft enough for a ${ageStr} toddler, and nutritionally balanced.
- Provide a dish name and a list of main ingredients.
- The response MUST be a valid JSON object matching the requested schema.
- ${langInstruction}
  `;

  try {
    if (getAiSettings().provider === 'qwen') {
      const content = await qwenChat(prompt, true);
      return JSON.parse(content || '{}');
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
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["mealType", "dishName", "ingredients"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
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
      ? `# ${dishName}\n\n## 食材\n${ingredients.map(item => `- ${item}`).join('\n')}\n\n## 建议\n使用蒸、煮、炖等清淡方式制作，确保食材足够软烂，放温后再给宝宝食用。`
      : `# ${dishName}\n\n## Ingredients\n${ingredients.map(item => `- ${item}`).join('\n')}\n\n## Suggestion\nUse gentle cooking methods such as steaming, boiling, or stewing. Make sure everything is soft enough and cooled before serving.`;
  }

  const langInstruction = language === 'zh' ? 'The tutorial MUST be written in Chinese (Simplified).' : 'The tutorial MUST be written in English.';
  const profile = getBabyProfile();
  const ageStr = getAgeString(profile.age);

  const prompt = `
Provide a detailed, step-by-step cooking tutorial for a ${ageStr} toddler's meal: "${dishName}".
Main ingredients: ${ingredients.join(', ')}.

Requirements:
- The cooking method must be healthy (e.g., steaming, boiling, light sautéing).
- Ensure the texture is appropriate for a ${ageStr} toddler (soft, easy to chew).
- Mention any specific prep steps for toddlers (e.g., cutting grapes in half, removing bones).
- Do not use added salt or sugar.
- Format as Markdown.
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
Analyze the following meal history for a 2-year-old toddler over the past ${timeframe} and provide a summary report.
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
