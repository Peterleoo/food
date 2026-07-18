import { GoogleGenAI, Type } from "@google/genai";
import { CustomRecipe, db } from "../db";
import { findLocalRecipe, localRecipes, LocalRecipe, MealType } from "../data/localRecipes";
import { getHealthProfilePrompt, normalizeUserProfile, type UserProfile } from "../profile";
import { TASTE_PREFERENCES_STORAGE_KEY, getTastePreferencePrompt, normalizeTastePreferences } from "../tastePreferences";

interface AiSettings {
  enabled: boolean;
  provider: 'google' | 'qwen';
  apiKey: string;
  model: string;
}

const mealTypes: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const AI_TIMEOUT_MS = 45000;
const QWEN_JSON_MAX_TOKENS = 5000;
const QWEN_TEXT_MAX_TOKENS = 900;
const GEMINI_DAILY_MAX_TOKENS = 4500;
const GEMINI_SINGLE_MAX_TOKENS = 900;
const GEMINI_TEXT_MAX_TOKENS = 900;

const adultLocalRecipes: Record<MealType, LocalRecipe[]> = {
  breakfast: [
    {
      mealType: 'breakfast',
      dishName: '鸡蛋牛奶燕麦早餐',
      ingredients: ['燕麦 50g/人', '鸡蛋 1个/人', '牛奶 250ml/人', '蓝莓或香蕉 1份/人'],
      tutorial: `# 鸡蛋牛奶燕麦早餐

## 食材
- 燕麦 50g/人
- 鸡蛋 1个/人
- 牛奶 250ml/人
- 蓝莓或香蕉 1份/人

## 步骤
1. 燕麦加牛奶小火煮至浓稠。
2. 鸡蛋煮熟或煎成少油荷包蛋。
3. 搭配水果一起食用。

## 营养提示
主食、蛋白质和水果搭配，适合作为成人早餐。`
    },
    {
      mealType: 'breakfast',
      dishName: '全麦三明治配豆浆',
      ingredients: ['全麦面包 2片/人', '鸡蛋 1个/人', '生菜 1份', '番茄 1个', '豆浆 250ml/人'],
      tutorial: `# 全麦三明治配豆浆

## 食材
- 全麦面包 2片/人
- 鸡蛋 1个/人
- 生菜 1份
- 番茄 1个
- 豆浆 250ml/人

## 步骤
1. 鸡蛋煎熟，番茄切片，生菜洗净。
2. 将鸡蛋、番茄和生菜夹入全麦面包。
3. 搭配温豆浆食用。

## 营养提示
全麦主食搭配蛋白质和蔬菜，饱腹感更稳定。`
    }
  ],
  lunch: [
    {
      mealType: 'lunch',
      dishName: '番茄炒蛋',
      ingredients: ['番茄 2个', '鸡蛋 3个', '葱花 少量', '食用油 适量'],
      tutorial: `# 番茄炒蛋

## 食材
- 番茄 2个
- 鸡蛋 3个
- 葱花 少量
- 食用油 适量

## 步骤
1. 番茄切块，鸡蛋打散备用。
2. 鸡蛋先炒至凝固后盛出。
3. 番茄炒出汁后放回鸡蛋，少量调味。
4. 撒葱花后出锅。

## 营养提示
番茄和鸡蛋搭配，补充蛋白质和蔬菜。`
    },
    {
      mealType: 'lunch',
      dishName: '清炒时蔬',
      ingredients: ['小白菜 300g', '胡萝卜 半根', '蒜 2瓣', '食用油 适量'],
      tutorial: `# 清炒时蔬

## 食材
- 小白菜 300g
- 胡萝卜 半根
- 蒜 2瓣
- 食用油 适量

## 步骤
1. 小白菜洗净切段，胡萝卜切薄片。
2. 热锅少油，蒜末炒香。
3. 放入胡萝卜和小白菜快炒至断生。
4. 简单调味后出锅。

## 营养提示
绿叶菜搭配少量根茎蔬菜，增加膳食纤维。`
    },
    {
      mealType: 'lunch',
      dishName: '冬瓜肉片汤',
      ingredients: ['冬瓜 400g', '瘦肉 150g', '姜 2片', '葱花 少量'],
      tutorial: `# 冬瓜肉片汤

## 食材
- 冬瓜 400g
- 瘦肉 150g
- 姜 2片
- 葱花 少量

## 步骤
1. 冬瓜去皮切片，瘦肉切薄片。
2. 锅中加水和姜片煮开，放入冬瓜。
3. 冬瓜煮软后下肉片，煮至变色熟透。
4. 撒葱花，少量调味后食用。

## 营养提示
汤菜清淡，适合搭配午餐中的主食和其他菜。`
    },
    {
      mealType: 'lunch',
      dishName: '清蒸鲈鱼',
      ingredients: ['鲈鱼 1条', '姜丝 适量', '葱丝 适量', '蒸鱼豉油 适量'],
      tutorial: `# 清蒸鲈鱼

## 食材
- 鲈鱼 1条
- 姜丝 适量
- 葱丝 适量
- 蒸鱼豉油 适量

## 步骤
1. 鲈鱼处理干净，两面放姜丝。
2. 水开后上锅蒸 8-10 分钟至熟。
3. 倒掉多余汤汁，铺葱丝。
4. 淋少量蒸鱼豉油，热油激香即可。

## 营养提示
鱼肉提供优质蛋白，蒸制方式更清淡。`
    },
    {
      mealType: 'lunch',
      dishName: '豆腐青菜汤',
      ingredients: ['嫩豆腐 1盒', '青菜 200g', '鸡蛋 1个', '葱花 少量'],
      tutorial: `# 豆腐青菜汤

## 食材
- 嫩豆腐 1盒
- 青菜 200g
- 鸡蛋 1个
- 葱花 少量

## 步骤
1. 豆腐切块，青菜洗净切段。
2. 锅中加水煮开，放入豆腐。
3. 加入青菜煮软，再淋入蛋液。
4. 撒葱花，少量调味后出锅。

## 营养提示
豆腐和鸡蛋补充蛋白质，青菜增加膳食纤维。`
    }
  ],
  snack: [
    {
      mealType: 'snack',
      dishName: '酸奶水果加餐',
      ingredients: ['原味酸奶 150g/人', '水果 1份/人', '坚果 少量'],
      tutorial: `# 酸奶水果加餐

## 食材
- 原味酸奶 150g/人
- 水果 1份/人
- 坚果 少量

## 步骤
1. 水果洗净切块。
2. 搭配原味酸奶。
3. 成人可加入少量坚果增加口感。

## 营养提示
加餐以轻量为主，避免影响正餐。`
    }
  ],
  dinner: [
    {
      mealType: 'dinner',
      dishName: '香菇青菜',
      ingredients: ['青菜 300g', '鲜香菇 6朵', '蒜 2瓣', '食用油 适量'],
      tutorial: `# 香菇青菜

## 食材
- 青菜 300g
- 鲜香菇 6朵
- 蒜 2瓣
- 食用油 适量

## 步骤
1. 青菜洗净，香菇切片。
2. 热锅少油，蒜末炒香。
3. 放入香菇炒软，再加入青菜。
4. 快炒至断生，少量调味后出锅。

## 营养提示
晚餐增加绿叶菜，有助于保持清淡和饱腹感。`
    },
    {
      mealType: 'dinner',
      dishName: '虾仁豆腐',
      ingredients: ['虾仁 150g', '嫩豆腐 1盒', '豌豆 少量', '姜丝 少量'],
      tutorial: `# 虾仁豆腐

## 食材
- 虾仁 150g
- 嫩豆腐 1盒
- 豌豆 少量
- 姜丝 少量

## 步骤
1. 虾仁去虾线，豆腐切块。
2. 姜丝炝锅后放入虾仁炒至变色。
3. 加入豆腐和少量水，小火煮 3-5 分钟。
4. 放入豌豆煮熟，少量调味后出锅。

## 营养提示
虾仁和豆腐提供优质蛋白，口感相对清爽。`
    },
    {
      mealType: 'dinner',
      dishName: '紫菜蛋花汤',
      ingredients: ['紫菜 适量', '鸡蛋 1个', '虾皮 少量', '葱花 少量'],
      tutorial: `# 紫菜蛋花汤

## 食材
- 紫菜 适量
- 鸡蛋 1个
- 虾皮 少量
- 葱花 少量

## 步骤
1. 紫菜剪小块，鸡蛋打散。
2. 锅中加水煮开，放入紫菜和虾皮。
3. 转小火淋入蛋液形成蛋花。
4. 撒葱花，少量调味即可。

## 营养提示
汤品轻量，适合晚餐搭配其他菜。`
    },
    {
      mealType: 'dinner',
      dishName: '芹菜牛肉',
      ingredients: ['牛肉 180g', '芹菜 250g', '姜丝 少量', '淀粉 少量'],
      tutorial: `# 芹菜牛肉

## 食材
- 牛肉 180g
- 芹菜 250g
- 姜丝 少量
- 淀粉 少量

## 步骤
1. 牛肉切片，用少量淀粉抓匀。
2. 芹菜切段，姜丝备用。
3. 牛肉先快炒至变色后盛出。
4. 芹菜炒香后放回牛肉，翻炒均匀。

## 营养提示
牛肉补充铁和蛋白质，芹菜增加蔬菜摄入。`
    },
    {
      mealType: 'dinner',
      dishName: '番茄豆腐汤',
      ingredients: ['番茄 2个', '嫩豆腐 1盒', '金针菇 100g', '葱花 少量'],
      tutorial: `# 番茄豆腐汤

## 食材
- 番茄 2个
- 嫩豆腐 1盒
- 金针菇 100g
- 葱花 少量

## 步骤
1. 番茄切块，豆腐切块，金针菇去根洗净。
2. 番茄先炒出汁，加水煮开。
3. 放入豆腐和金针菇煮熟。
4. 撒葱花，少量调味后出锅。

## 营养提示
豆腐汤清淡易入口，适合晚餐补充水分和蛋白质。`
    }
  ]
};

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

function getTastePreferences() {
  try {
    const data = localStorage.getItem(TASTE_PREFERENCES_STORAGE_KEY);
    if (data) return normalizeTastePreferences(JSON.parse(data));
  } catch (e) {}
  return normalizeTastePreferences(null);
}

function withTimeout<T>(task: Promise<T>, timeoutMs = AI_TIMEOUT_MS) {
  return Promise.race([
    task,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error('AI request timed out')), timeoutMs);
    })
  ]);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return window.btoa(binary);
}

function cleanJsonText(value: string) {
  const trimmed = String(value || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function parseJsonObject<T = any>(value: string, label: string): T | null {
  try {
    return JSON.parse(cleanJsonText(value || '{}')) as T;
  } catch (error) {
    console.warn(`${label} returned invalid JSON; using local fallback.`, error);
    return null;
  }
}

async function qwenChat(prompt: string, expectJson = false) {
  const settings = getAiSettings();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(new Error('AI request timed out')), AI_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
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
              ? 'You are a user meal planning assistant. Return only valid JSON with no markdown. Every string value must be single-line JSON text with no raw line breaks.'
              : 'You are a user meal planning assistant.'
          },
          { role: 'user', content: prompt }
        ],
        response_format: expectJson ? { type: 'json_object' } : undefined,
        temperature: expectJson ? 0.6 : 0.7,
        max_tokens: expectJson ? QWEN_JSON_MAX_TOKENS : QWEN_TEXT_MAX_TOKENS
      })
    });
  } catch (error: any) {
    if (error?.name === 'AbortError' || error?.message === 'AI request timed out') {
      throw new Error('AI request timed out');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }

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
  const fallbackMealSlots = getDailyMealSlots(getBabyProfile());
  return meals
    .map((meal, index) => normalizeGeneratedMeal(meal, language, fallbackMealSlots[index] || mealTypes[index % mealTypes.length] || 'breakfast'))
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

function getLocalRecipePool(type: MealType, profile: UserProfile) {
  return profile.targetGroup === 'infant' ? localRecipes[type] : adultLocalRecipes[type];
}

function getDailyMealSlots(profile: UserProfile): MealType[] {
  if (profile.targetGroup === 'infant') return mealTypes;

  const peopleCount = Math.max(1, profile.peopleCount || 1);
  const mainDishCount = peopleCount === 1 ? 2 : peopleCount === 2 ? 3 : 4;
  return [
    'breakfast' as MealType,
    ...Array.from({ length: mainDishCount }, () => 'lunch' as MealType),
    ...Array.from({ length: mainDishCount }, () => 'dinner' as MealType)
  ];
}

function adaptRecipeForProfile(recipe: LocalRecipe & { imageData?: string; imageDataList?: string[] }, profile: UserProfile) {
  if (profile.targetGroup === 'infant') return recipe;

  const peopleCount = Math.max(1, profile.peopleCount || 1);
  const targetNote = profile.targetGroup === 'elderly'
    ? '老年人餐食建议软烂易嚼、少油少盐。'
    : '成人午晚餐按正餐结构搭配，每张卡片只保留一道菜或一份汤。';
  const servingNote = `按 ${peopleCount} 人准备。`;

  return {
    ...recipe,
    ingredients: recipe.ingredients.map(item => item.replace(/\/人/g, peopleCount > 1 ? ` x ${peopleCount}人` : '')),
    tutorial: `${recipe.tutorial}\n\n## 份量说明\n${servingNote}${targetNote}`
  };
}

async function pickMeal(type: MealType, seed: number, likes: string[], dislikes: string[], allergies: string[], rejected: string[], eaten: string[], excluded: string[] = []) {
  const profile = getBabyProfile();
  const customRecipes = await db.customRecipes
    .filter(recipe => !recipe.mealType || recipe.mealType === 'any' || recipe.mealType === type)
    .toArray();
  const localPool = getLocalRecipePool(type, profile);
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
  const picked = pool[seed % pool.length] || pickLocalMeal(type, seed, likes, dislikes, allergies, rejected, eaten);
  return adaptRecipeForProfile(picked, profile);
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
  const profile = getBabyProfile();
  const mealSlots = getDailyMealSlots(profile);

  const usedDishNames: string[] = [];
  const meals = [];

  for (const [index, mealType] of mealSlots.entries()) {
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

async function generateAiFallbackDailyPlan(date: string, refreshSeed = 0) {
  const meals = await generateLocalDailyPlan(date, refreshSeed);
  (meals as any).__aiFallback = true;
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
  const liked = history.filter(item => item.status === 'eaten');
  const disliked = history.filter(item => item.status === 'rejected');
  const partial = history.filter(item => item.status === 'partial');
  const total = history.length || 1;
  const preferenceRate = Math.round((liked.length / total) * 100);
  const profile = getBabyProfile();
  const normalizedProfile = normalizeUserProfile(profile);
  const target = getTargetGroupLabel(normalizedProfile.targetGroup);

  if (language === 'zh') {
    const advice = target === 'elderly'
      ? '优先关注易消化、优质蛋白、钙和膳食纤维的搭配，减少高盐高油食物。对不喜欢的菜品，可以调整软硬度、温度和调味强度，让餐食更容易入口。'
      : target === 'adult'
        ? '优先关注主食、蛋白质、蔬菜和健康脂肪的均衡，结合实际作息控制餐量。对不喜欢的菜品，可以调整烹饪方式、口味层次或替换相近食材。'
        : '优先保留用户喜欢的软饭、粥、面和蒸煮类食物。对不喜欢的菜品，可以更换相近食材或改变形态，比如从块状改成泥状、从单一蔬菜改成粥饭搭配。';
    const nextPlan = target === 'elderly'
      ? '下一次餐单建议保持少油少盐、蛋白质充足、蔬菜柔软易嚼，并减少近期不喜欢的菜名或相近做法。'
      : target === 'adult'
        ? '下一次餐单建议保持主食、蛋白质和蔬菜的组合，结合喜欢的口味增加变化，并减少近期不喜欢的菜名或相近做法。'
        : '继续保持主食、蛋白质和蔬菜的组合，注意食材大小和软硬度，并减少近期不喜欢的菜名或相近做法。';

    return `## 喜好概览

- 记录餐数：${history.length}
- 喜欢：${liked.length}
- 一般：${partial.length}
- 不喜欢：${disliked.length}
- 喜欢占比：${preferenceRate}%

## 调整建议

${advice}

## 下次餐单思路

${nextPlan}`;
  }

  const advice = target === 'elderly'
    ? 'Prioritize easy-to-digest meals with quality protein, calcium, fiber, and lower sodium. For disliked meals, adjust texture, temperature, and seasoning intensity.'
    : target === 'adult'
      ? 'Prioritize balanced meals with carbohydrates, protein, vegetables, and healthy fats. For disliked meals, adjust cooking methods, flavor balance, or use similar ingredients.'
      : 'Keep soft rice, porridge, noodles, steamed dishes, and foods with liked history. For disliked meals, try similar ingredients in a softer texture or a different format.';
  const nextPlan = target === 'elderly'
    ? 'Keep meals lower in oil and sodium, with enough protein and soft vegetables, while reducing recently disliked dishes.'
    : target === 'adult'
      ? 'Keep pairing carbohydrates, protein, and vegetables with more variety, while reducing recently disliked dishes.'
      : 'Keep pairing carbohydrates, protein, and vegetables while paying attention to texture, serving size, and recently disliked dishes.';

  return `## Preference Overview

- Records: ${history.length}
- Liked: ${liked.length}
- Neutral: ${partial.length}
- Disliked: ${disliked.length}
- Liked share: ${preferenceRate}%

## Suggestions

${advice}

## Next Plan

${nextPlan}`;
}

export function getBabyProfile() {
  try {
    const data = localStorage.getItem('babyProfile');
    if (data) return normalizeUserProfile(JSON.parse(data));
  } catch (e) {}
  return normalizeUserProfile(null);
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
  const normalizedProfile = normalizeUserProfile(profile);
  const peopleCount = normalizedProfile.peopleCount || 1;
  const target = getTargetGroupLabel(normalizedProfile.targetGroup);
  if (target === 'infant') {
    return `${getAgeString(normalizedProfile.age || 24)} infant (${normalizedProfile.gender || 'boy'}), serving ${peopleCount} ${peopleCount > 1 ? 'people' : 'person'}`;
  }
  return `${target}, serving ${peopleCount} ${peopleCount > 1 ? 'people' : 'person'}`;
}

function getMealStructurePrompt(profile: any) {
  const normalizedProfile = normalizeUserProfile(profile);
  const peopleCount = normalizedProfile.peopleCount || 1;

  if (normalizedProfile.targetGroup === 'adult') {
    return [
      `Target structure for adults serving ${peopleCount} ${peopleCount > 1 ? 'people' : 'person'}:`,
      '- Breakfast can be one balanced meal with staple food, protein, and fruit or vegetables.',
      '- Lunch and dinner should be made of multiple separate recipe entries. Each entry is exactly one dish or one soup, and will become its own card.',
      '- Do not combine dishes into one entry. Do not use dishName such as "一荤一素", "两菜一汤", "三菜一汤", "家常午餐", or "均衡晚餐".',
      '- For lunch and dinner, provide 1-2 separate entries for 1 person, 3 separate entries for 2 people, or 4 separate entries for 3+ people. Use the same mealType for each dish in that meal.',
      '- For 1 adult, one dish alone is acceptable when it is balanced; one dish plus one soup is also acceptable. Do not force two dishes and one soup.',
      '- Do not include snack by default for adults unless the user explicitly asks for snack.',
      '- Each dish should have its own ingredients and steps. Use realistic adult household portions, such as protein 100-150g/person, vegetables 200-300g per dish, and soup for the table.',
      '- Avoid baby-style names, purees, tiny gram amounts, and texture notes meant for toddlers.'
    ].join('\n');
  }

  if (normalizedProfile.targetGroup === 'elderly') {
    return [
      `Target structure for elderly people serving ${peopleCount} ${peopleCount > 1 ? 'people' : 'person'}:`,
      '- Breakfast can be a soft balanced meal with staple food and protein.',
      '- Lunch and dinner should be made of multiple separate recipe entries. Each entry is exactly one softer dish or one light soup, and will become its own card.',
      '- Do not combine dishes into one entry. Do not use dishName such as "一荤一素", "两菜一汤", "三菜一汤", "家常午餐", or "均衡晚餐".',
      '- For lunch and dinner, provide 1-2 separate entries for 1 person, 3 separate entries for 2 people, or 4 separate entries for 3+ people. Use the same mealType for each dish in that meal.',
      '- For 1 elderly person, one soft balanced dish alone is acceptable; one dish plus one light soup is also acceptable. Do not force two dishes and one soup.',
      '- Do not include snack by default for elderly people unless the user explicitly asks for snack.',
      '- Use adult household portions but keep dinner lighter; prefer soft, easy-to-chew cooking methods.',
      '- Keep sodium and oil conservative, and avoid baby/toddler wording.'
    ].join('\n');
  }

  return [
    `Target structure for infants serving ${peopleCount} ${peopleCount > 1 ? 'people' : 'person'}:`,
    '- Keep portions age-appropriate, soft, fully cooked, and easy to chew or swallow.',
    '- One compact dish per meal is acceptable for infants.',
    '- Avoid adult family-style multi-dish sets unless explicitly requested.'
  ].join('\n');
}

export async function generateDailyPlan(date: string, language: 'zh' | 'en', refreshSeed = 0) {
  if (!shouldUseAI()) {
    return generateLocalDailyPlan(date, refreshSeed);
  }

  const prefs = await db.preferences.toArray();
  const likes = prefs.filter(p => p.type === 'like').map(p => p.item);
  const dislikes = prefs.filter(p => p.type === 'dislike').map(p => p.item);
  const allergies = prefs.filter(p => p.type === 'allergy').map(p => p.item);

  // Get recent history to avoid repetition and learn from preference feedback
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentHistory = await db.mealHistory.where('date').aboveOrEqual(threeDaysAgo).toArray();

  const rejected = recentHistory.filter(h => h.status === 'rejected').map(h => h.dishName);
  const eaten = recentHistory.filter(h => h.status === 'eaten').map(h => h.dishName);

  const langInstruction = language === 'zh' ? 'The response MUST be in Chinese (Simplified).' : 'The response MUST be in English.';
  const profile = getBabyProfile();
  const profileDescription = getProfileDescription(profile);
  const mealStructurePrompt = getMealStructurePrompt(profile);
  const specialDietPrompt = getHealthProfilePrompt(profile);
  const tastePreferencePrompt = getTastePreferencePrompt(getTastePreferences());

  const prompt = `
Generate a healthy daily meal plan for ${profileDescription} for the date ${date}.
Variation token: ${refreshSeed}. Use it to provide a meaningfully different set when regenerating.
The user has the following preferences:
- Likes: ${likes.join(', ') || 'None specified'}
- Dislikes: ${dislikes.join(', ') || 'None specified'}
- Allergies: ${allergies.join(', ') || 'None specified'}

Special dietary constraints:
${specialDietPrompt}

Cuisine and flavor preferences:
${tastePreferencePrompt}

Meal structure and portion guidance:
${mealStructurePrompt}

Recently disliked meals (avoid these or similar): ${rejected.join(', ') || 'None'}
Recently liked meals (use as preference signals, but don't repeat exactly): ${eaten.join(', ') || 'None'}

Requirements:
- Meals must be healthy, low in sodium and sugar, suitable for the target people, and nutritionally balanced.
- Prefer common everyday ingredients that are easy to buy in ordinary markets or supermarkets.
- Avoid rare, expensive, imported, seasonal-only, or hard-to-buy ingredients unless the user explicitly asks for them.
- Follow cuisine and flavor preferences when possible, but keep the meals practical and healthy.
- Respect special dietary constraints when selecting ingredients, seasonings, portions, and cooking methods.
- Keep medical guidance conservative and food-focused. Do not claim treatment, cure, or diagnosis.
- For infants, provide 4 meal entries: breakfast, lunch, snack, dinner.
- For adults or elderly people, provide breakfast and a people-count-aware number of separate lunch/dinner entries. Use 1-2 lunch entries and 1-2 dinner entries for 1 person, 3 entries for 2 people, and 4 entries for 3+ people. Do not include snack by default. Lunch and dinner entries must each be one dish or one soup only, not a combined meal set.
- For 1 person, a single balanced dish is acceptable; one dish plus one soup is also acceptable. Do not force two dishes and one soup.
- Each lunch or dinner dish must be a separate JSON object with its own dishName, ingredients, steps, nutritionTips, and cautions.
- Do not put "一荤一素", "两菜一汤", "三菜一汤", "家常午餐", "均衡晚餐", or multiple dish names in one dishName.
- Each meal must include complete recipe details because the generated menu will be saved locally and viewed later without another AI call.
- For each meal, provide these fixed JSON fields: mealType, dishName, ingredients, steps, nutritionTips, cautions.
- Every JSON string value must be single-line text. Do not put raw line breaks inside any string value.
- ingredients must contain 3-6 concise items.
- steps must contain 3-4 short practical cooking steps, one action per item.
- nutritionTips must contain exactly 1 short nutrition note.
- cautions must contain exactly 1 short safety, allergy, texture, or serving note.
- Use user/target-people wording. Do not say baby or toddler unless the target group is infant.
- The response MUST be a valid JSON object matching the requested schema.
- ${langInstruction}
  `;

  try {
    if (getAiSettings().provider === 'qwen') {
      const content = await qwenChat(prompt, true);
      const data = parseJsonObject<{ meals?: GeneratedMealInput[] }>(content, 'Qwen daily meal plan');
      if (!data) return generateAiFallbackDailyPlan(date, refreshSeed);
      const meals = normalizeGeneratedMeals(data.meals || [], language);
      return meals.length ? meals : generateAiFallbackDailyPlan(date, refreshSeed);
    }

    const response = await withTimeout(getAI().models.generateContent({
      model: getAiSettings().model,
      contents: prompt,
      config: {
        temperature: 0.6,
        maxOutputTokens: GEMINI_DAILY_MAX_TOKENS,
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
    }));

    const data = parseJsonObject<{ meals?: GeneratedMealInput[] }>(response.text || '{}', 'Google daily meal plan');
    if (!data) return generateAiFallbackDailyPlan(date, refreshSeed);
    const meals = normalizeGeneratedMeals(data.meals || [], language);
    return meals.length ? meals : generateAiFallbackDailyPlan(date, refreshSeed);
  } catch (e) {
    if (e instanceof Error && e.message === 'AI request timed out') {
      console.warn("AI meal plan timed out; using local fallback.");
    } else {
      console.error("Failed to generate AI meal plan", e);
    }
    return generateAiFallbackDailyPlan(date, refreshSeed);
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
  const mealStructurePrompt = getMealStructurePrompt(profile);
  const specialDietPrompt = getHealthProfilePrompt(profile);
  const tastePreferencePrompt = getTastePreferencePrompt(getTastePreferences());

  const prompt = `
Generate a healthy ${mealType} for ${profileDescription} for the date ${date}.
The user has the following preferences:
- Likes: ${likes.join(', ') || 'None specified'}
- Dislikes: ${dislikes.join(', ') || 'None specified'}
- Allergies: ${allergies.join(', ') || 'None specified'}

Special dietary constraints:
${specialDietPrompt}

Cuisine and flavor preferences:
${tastePreferencePrompt}

Meal structure and portion guidance:
${mealStructurePrompt}

Recently disliked meals (avoid these or similar): ${rejected.join(', ') || 'None'}
Recently liked meals (use as preference signals, but don't repeat exactly): ${eaten.join(', ') || 'None'}

Requirements:
- Meals must be healthy, low in sodium and sugar, suitable for the target people, and nutritionally balanced.
- Prefer common everyday ingredients that are easy to buy in ordinary markets or supermarkets.
- Avoid rare, expensive, imported, seasonal-only, or hard-to-buy ingredients unless the user explicitly asks for them.
- Follow cuisine and flavor preferences when possible, but keep the meal practical and healthy.
- Respect special dietary constraints when selecting ingredients, seasonings, portions, and cooking methods.
- Keep medical guidance conservative and food-focused. Do not claim treatment, cure, or diagnosis.
- Include complete recipe details because the generated menu will be saved locally and viewed later without another AI call.
- Provide these fixed JSON fields: mealType, dishName, ingredients, steps, nutritionTips, cautions.
- Every JSON string value must be single-line text. Do not put raw line breaks inside any string value.
- ingredients must contain 3-6 concise items.
- steps must contain 3-4 short practical cooking steps, one action per item.
- nutritionTips must contain exactly 1 short nutrition note.
- cautions must contain exactly 1 short safety, allergy, texture, or serving note.
- Use user/target-people wording. Do not say baby or toddler unless the target group is infant.
- The response MUST be a valid JSON object matching the requested schema.
- ${langInstruction}
  `;

  try {
    if (getAiSettings().provider === 'qwen') {
      const content = await qwenChat(prompt, true);
      const meal = parseJsonObject<GeneratedMealInput>(content, 'Qwen single meal');
      if (!meal) return generateLocalSingleMeal(mealType, date);
      return normalizeGeneratedMeal(meal, language, normalizeMealType(meal.mealType, mealType.toLowerCase() as MealType));
    }

    const response = await withTimeout(getAI().models.generateContent({
      model: getAiSettings().model,
      contents: prompt,
      config: {
        temperature: 0.6,
        maxOutputTokens: GEMINI_SINGLE_MAX_TOKENS,
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
    }));

    const meal = parseJsonObject<GeneratedMealInput>(response.text || '{}', 'Google single meal');
    if (!meal) return generateLocalSingleMeal(mealType, date);
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
  const specialDietPrompt = getHealthProfilePrompt(profile);
  const tastePreferencePrompt = getTastePreferencePrompt(getTastePreferences());
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

Special dietary constraints:
${specialDietPrompt}

Cuisine and flavor preferences:
${tastePreferencePrompt}

Requirements:
- Return one recipe only.
- If the meal type preference is breakfast, lunch, snack, or dinner, the JSON mealType MUST exactly equal that value.
- If the user note mentions 早餐/午餐/中餐/中饭/晚餐/加餐 or breakfast/lunch/dinner/snack, honor that meal type.
- The recipe must be practical for home cooking and suitable for the target people.
- Prefer common everyday ingredients that are easy to buy in ordinary markets or supermarkets.
- Avoid rare, expensive, imported, seasonal-only, or hard-to-buy ingredients unless the user explicitly asks for them.
- Follow cuisine and flavor preferences when possible, but keep the recipe practical and healthy.
- Avoid added salt and sugar where possible.
- Respect special dietary constraints when selecting ingredients, seasonings, portions, and cooking methods.
- Keep medical guidance conservative and food-focused. Do not claim treatment, cure, or diagnosis.
- Provide these fixed JSON fields: mealType, dishName, ingredients, steps, nutritionTips, cautions, audience.
- Every JSON string value must be single-line text. Do not put raw line breaks inside any string value.
- ingredients must contain 3-6 concise items.
- steps must contain 3-4 short practical cooking steps, one action per item.
- nutritionTips must contain exactly 1 short note.
- cautions must contain exactly 1 safety, allergy, texture, or serving note.
- audience must contain 1-2 suitable people labels.
- Use user/target-people wording. Do not say baby or toddler unless the target group is infant.
- The response MUST be a valid JSON object matching the requested schema.
- ${langInstruction}
  `;

  if (getAiSettings().provider === 'qwen') {
    const content = await qwenChat(prompt, true);
    const meal = parseJsonObject<GeneratedMealInput>(content, 'Qwen custom recipe draft');
    if (!meal) throw new Error('AI returned invalid JSON');
    return normalizeGeneratedRecipeDraft(meal, requestedMealType);
  }

  const response = await withTimeout(getAI().models.generateContent({
    model: getAiSettings().model,
    contents: prompt,
    config: {
      temperature: 0.6,
      maxOutputTokens: GEMINI_SINGLE_MAX_TOKENS,
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
  }));

  const meal = parseJsonObject<GeneratedMealInput>(response.text || '{}', 'Google custom recipe draft');
  if (!meal) throw new Error('AI returned invalid JSON');
  return normalizeGeneratedRecipeDraft(meal, requestedMealType);
}

export async function generateAudio(text: string, language: 'zh' | 'en') {
  if (!shouldUseAI() || getAiSettings().provider !== 'google') {
    return null;
  }

  try {
    const voiceName = language === 'zh' ? 'Aoede' : 'Kore';
    const response = await withTimeout(getAI().models.generateContent({
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
    }), 25000);

    const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64 ? `data:audio/wav;base64,${base64}` : null;
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
  const specialDietPrompt = getHealthProfilePrompt(profile);
  const tastePreferencePrompt = getTastePreferencePrompt(getTastePreferences());

  const prompt = `
Provide a detailed, step-by-step cooking tutorial for ${profileDescription}: "${dishName}".
Main ingredients: ${ingredients.join(', ')}.

Special dietary constraints:
${specialDietPrompt}

Cuisine and flavor preferences:
${tastePreferencePrompt}

Requirements:
- The cooking method must be healthy (e.g., steaming, boiling, light sautéing).
- Ensure the texture is appropriate for the target people.
- Prefer common everyday ingredients and practical home cooking steps.
- Follow cuisine and flavor preferences when suggesting seasonings or variations.
- Respect special dietary constraints when selecting seasonings, portion notes, and cautions.
- Keep medical guidance conservative and food-focused. Do not claim treatment, cure, or diagnosis.
- Mention any specific prep steps for the user group (e.g., cutting grapes in half, removing bones).
- Do not use added salt or sugar.
- Start with the recipe title as a level 2 Markdown heading.
- Format as Markdown with these exact sections after the title: Ingredients, Cooking steps, Nutrition tips, Cautions. Use the Chinese section names 食材, 做法步骤, 营养提示, 注意事项 when writing in Chinese.
- ${langInstruction}
  `;

  if (getAiSettings().provider === 'qwen') {
    return qwenChat(prompt);
  }

  const response = await withTimeout(getAI().models.generateContent({
    model: getAiSettings().model,
    contents: prompt,
    config: {
      temperature: 0.6,
      maxOutputTokens: GEMINI_TEXT_MAX_TOKENS
    }
  }));

  return response.text || '';
}

export async function generateReport(timeframe: 'daily' | 'weekly', history: any[], language: 'zh' | 'en') {
  if (!shouldUseAI()) {
    return generateLocalReport(history, language);
  }

  const langInstruction = language === 'zh' ? 'The report MUST be written in Chinese (Simplified).' : 'The report MUST be written in English.';
  const profile = getBabyProfile();
  const profileDescription = getProfileDescription(profile);
  const specialDietPrompt = getHealthProfilePrompt(profile);
  const tastePreferencePrompt = getTastePreferencePrompt(getTastePreferences());

  const prompt = `
Analyze the following meal history for ${profileDescription} over the past ${timeframe} and provide a summary report.
Status meaning: status "eaten" means the user liked the dish, status "rejected" means the user disliked the dish, status "partial" means neutral or partly liked. Treat these as preference feedback, not literal eating amount.
Special dietary constraints:
${specialDietPrompt}

Cuisine and flavor preferences:
${tastePreferencePrompt}

History:
${JSON.stringify(history)}

Provide:
1. A summary of their preference patterns (what they liked, disliked, or felt neutral about).
2. Nutritional insights (are they getting enough variety?).
3. Smart adjustments for future meals based on liked and disliked dishes.
4. Target-group-specific advice: infant reports must focus on texture and safety; adult reports should focus on balanced nutrition and routine; elderly reports should focus on digestibility, protein, calcium, fiber, hydration, and lower sodium.
5. If special dietary constraints are present, include conservative food-focused adjustments without making medical claims.
6. If cuisine and flavor preferences are present, suggest practical ways to keep variety while using common everyday ingredients.
Use user/target-people wording. Do not assume the user is an infant unless the profile says infant.
Format as Markdown.
- ${langInstruction}
  `;

  if (getAiSettings().provider === 'qwen') {
    return qwenChat(prompt);
  }

  const response = await withTimeout(getAI().models.generateContent({
    model: getAiSettings().model,
    contents: prompt,
    config: {
      temperature: 0.6,
      maxOutputTokens: GEMINI_TEXT_MAX_TOKENS
    }
  }));

  return response.text || '';
}
