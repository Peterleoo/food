import type { MealHistory } from './db';
import { normalizeUserProfile, type UserProfile } from './profile';

export type ShoppingListItem = {
  name: string;
  amount: string;
  category: ShoppingCategory;
  dishes: string[];
};

type Unit = '份' | '把' | '个' | '根' | '包' | '盒' | '袋' | '适量';
export type ShoppingCategory = 'vegetables' | 'meat' | 'fruit' | 'staple' | 'eggDairy' | 'soy' | 'other';

type IngredientRule = {
  pattern: RegExp;
  name?: string;
  unit: Unit;
  base: number;
  category: ShoppingCategory;
};

const ingredientRules: IngredientRule[] = [
  { pattern: /(鸡蛋|鸭蛋|蛋)/, name: '鸡蛋', unit: '个', base: 1, category: 'eggDairy' },
  { pattern: /(大米|米饭|米\b|糙米|小米)/, name: '大米', unit: '袋', base: 0.25, category: 'staple' },
  { pattern: /(面条|细面|宝宝面|意面|挂面|乌冬|米粉|河粉|米线)/, unit: '包', base: 0.5, category: 'staple' },
  { pattern: /(面粉|燕麦|麦片)/, unit: '袋', base: 0.25, category: 'staple' },
  { pattern: /(牛奶|酸奶)/, unit: '盒', base: 0.5, category: 'eggDairy' },
  { pattern: /(豆浆)/, unit: '盒', base: 0.5, category: 'soy' },
  { pattern: /(鸡胸肉|鸡肉|牛肉|猪肉|鱼肉|鱼|鲈鱼|鲫鱼|鲤鱼|草鱼|龙利鱼|巴沙鱼|虾|虾仁|三文鱼|鳕鱼)/, unit: '份', base: 0.5, category: 'meat' },
  { pattern: /(豆腐|豆干)/, unit: '盒', base: 0.5, category: 'soy' },
  { pattern: /(西兰花|菜花|菠菜|青菜|生菜|油麦菜|娃娃菜|白菜|芹菜|芦笋)/, unit: '把', base: 0.5, category: 'vegetables' },
  { pattern: /(土豆|红薯|紫薯|南瓜|山药)/, unit: '份', base: 0.5, category: 'vegetables' },
  { pattern: /(胡萝卜|黄瓜|玉米)/, unit: '根', base: 0.5, category: 'vegetables' },
  { pattern: /(番茄|西红柿|洋葱)/, unit: '个', base: 1, category: 'vegetables' },
  { pattern: /(苹果|梨|香蕉|橙子|猕猴桃|蓝莓|草莓|葡萄|提子|樱桃|车厘子|火龙果|芒果|桃|桃子)/, unit: '个', base: 1, category: 'fruit' },
  { pattern: /(蘑菇|香菇|金针菇|口蘑)/, unit: '盒', base: 0.5, category: 'vegetables' },
  { pattern: /(坚果|核桃|杏仁|腰果)/, unit: '包', base: 0.25, category: 'other' }
];

const pantryPattern = /(生抽|老抽|酱油|蚝油|料酒|醋|米醋|陈醋|香醋|盐|糖|白糖|冰糖|油|橄榄油|香油|芝麻油|淀粉|胡椒|胡椒粉|五香粉|十三香|花椒|八角|桂皮|香叶|孜然|辣椒粉|辣椒面|豆瓣酱|番茄酱|沙拉酱|蜂蜜|味精|鸡精|清水|水)/;
const descriptorOnlyPattern = /^(无添加|低钠|低盐|低糖|无糖|少糖|新鲜|有机|天然|即食|原味|熟|生|去皮|去骨|切片|切块|洗净|焯水|冷冻|常温)$/;

function getServingFactor(profile: UserProfile) {
  const targetFactor = profile.targetGroup === 'infant' ? 0.45 : profile.targetGroup === 'elderly' ? 0.85 : 1;
  return Math.max(0.5, profile.peopleCount * targetFactor);
}

function sanitizeIngredient(value: string) {
  return value
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\d+(\.\d+)?\s*(g|克|kg|千克|ml|毫升|个|颗|根|片|勺|汤匙|茶匙|小勺|大勺|杯|碗|少许|适量)/gi, '')
    .replace(/[,，、;；。]/g, ' ')
    .trim();
}

function isPantryIngredient(name: string) {
  return pantryPattern.test(name);
}

function isDescriptorOnly(name: string) {
  return descriptorOnlyPattern.test(name);
}

function getRule(name: string): IngredientRule {
  return ingredientRules.find(rule => rule.pattern.test(name)) || { pattern: /.*/, unit: '适量', base: 0, category: 'other' };
}

function roundAmount(value: number, unit: Unit) {
  if (unit === '适量') return 0;
  if (unit === '份' || unit === '把' || unit === '盒' || unit === '袋' || unit === '包') {
    return Math.max(1, Math.ceil(value));
  }
  return Math.max(1, Math.ceil(value));
}

function formatAmount(value: number, unit: Unit) {
  if (unit === '适量') return '适量';
  const amount = roundAmount(value, unit);
  if (unit === '份' || unit === '把' || unit === '盒' || unit === '袋' || unit === '包') {
    return `约${amount}${unit}`;
  }
  return `${amount}${unit}`;
}

export function createShoppingList(meals: MealHistory[], profileValue: unknown): ShoppingListItem[] {
  const profile = normalizeUserProfile(profileValue);
  const servingFactor = getServingFactor(profile);
  const itemMap = new Map<string, { unit: Unit; amount: number; category: ShoppingCategory; dishes: Set<string> }>();

  meals.forEach(meal => {
    meal.ingredients.forEach(rawIngredient => {
      const cleanName = sanitizeIngredient(rawIngredient);
      if (!cleanName) return;
      if (isPantryIngredient(cleanName)) return;
      if (isDescriptorOnly(cleanName)) return;

      const rule = getRule(cleanName);
      const name = rule.name || cleanName;
      const existing = itemMap.get(name);
      const amount = rule.base * servingFactor;

      if (existing) {
        existing.amount += amount;
        existing.dishes.add(meal.dishName);
      } else {
        itemMap.set(name, {
          unit: rule.unit,
          amount,
          category: rule.category,
          dishes: new Set([meal.dishName])
        });
      }
    });
  });

  return Array.from(itemMap.entries())
    .map(([name, item]) => ({
      name,
      amount: formatAmount(item.amount, item.unit),
      category: item.category,
      dishes: Array.from(item.dishes)
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

export function formatShoppingListText(items: ShoppingListItem[], title: string, description: string) {
  return [
    title,
    description,
    '',
    ...items.map(item => `${item.name} ${item.amount}${item.dishes.length ? `（${item.dishes.join('、')}）` : ''}`)
  ].join('\n');
}
