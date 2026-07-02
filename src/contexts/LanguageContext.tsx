import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'zh' | 'en';

interface Translations {
  [key: string]: {
    zh: string;
    en: string;
  };
}

export const translations: Translations = {
  appTitle: { zh: '今日餐食', en: 'Daily Meals' },
  navToday: { zh: '今日', en: 'Today' },
  navPreferences: { zh: '自定义', en: 'Custom' },
  navReports: { zh: '报告', en: 'Reports' },
  navSettings: { zh: '设置', en: 'Settings' },
  
  // Home
  todaysPlan: { zh: '今日餐单', en: "Today's Plan" },
  generatePlan: { zh: '生成餐单', en: 'Generate Plan' },
  regenerate: { zh: '重新生成', en: 'Regenerate' },
  noMealsTitle: { zh: '暂无餐单', en: 'No meals planned yet' },
  noMealsDesc: { zh: '生成一份专为用户定制的健康餐单。', en: "Generate a healthy meal plan tailored to the user's preferences." },
  createPlanBtn: { zh: '创建今日餐单', en: "Create Today's Plan" },
  recipe: { zh: '食谱', en: 'Recipe' },
  eaten: { zh: '已吃', en: 'Eaten' },
  rejected: { zh: '拒绝', en: 'Rejected' },
  pending: { zh: '待定', en: 'Pending' },
  enabled: { zh: '已启用', en: 'Enabled' },
  failedGenerate: { zh: '生成餐单失败，请重试。', en: 'Failed to generate a meal plan. Please try again.' },
  errorGenerate: { zh: '生成餐单时发生错误。', en: 'An error occurred while generating the plan.' },
  
  // Preferences
  prefTitle: { zh: '饮食偏好', en: 'Preferences' },
  prefDesc: { zh: '帮助我们定制最完美的餐食。', en: 'Help us tailor the perfect meals.' },
  likes: { zh: '喜欢', en: 'Likes' },
  dislikes: { zh: '不喜欢', en: 'Dislikes' },
  allergies: { zh: '过敏', en: 'Allergies' },
  addPlaceholder: { zh: '添加', en: 'Add a' },
  noItemsAdded: { zh: '暂未添加', en: 'No items added yet.' },
  customTitle: { zh: '自定义食谱', en: 'Custom Recipes' },
  customDesc: { zh: '添加自己的餐食，也会参与今日餐单推荐。', en: 'Add your own meals and let them join daily planning.' },
  dishName: { zh: '食谱名', en: 'Recipe name' },
  mealType: { zh: '餐次', en: 'Meal type' },
  ingredients: { zh: '食材', en: 'Ingredients' },
  tutorial: { zh: '做法', en: 'Tutorial' },
  tags: { zh: '营养提示', en: 'Nutrition tips' },
  nutritionTips: { zh: '营养提示', en: 'Nutrition tips' },
  cautions: { zh: '注意事项', en: 'Cautions' },
  cookingSteps: { zh: '做法步骤', en: 'Cooking steps' },
  suitablePeople: { zh: '适合人群', en: 'Suitable people' },
  servings: { zh: '人数', en: 'Servings' },
  optionalComma: { zh: '可用逗号分隔', en: 'Separate with commas' },
  addRecipe: { zh: '添加食谱', en: 'Add recipe' },
  editRecipe: { zh: '编辑食谱', en: 'Edit recipe' },
  anyMeal: { zh: '不限餐次', en: 'Any meal' },
  noRecipeContent: { zh: '暂未填写做法。', en: 'No tutorial added yet.' },
  recipeImage: { zh: '食谱图片', en: 'Recipe image' },
  uploadImage: { zh: '上传图片', en: 'Upload image' },
  uploadMoreImages: { zh: '继续上传图片', en: 'Upload more images' },
  removeImage: { zh: '移除图片', en: 'Remove image' },
  onePerLine: { zh: '每行填写一条', en: 'One item per line' },
  stepsPlaceholder: { zh: '每行填写一个步骤', en: 'One step per line' },
  
  // Reports
  repTitle: { zh: '洞察与报告', en: 'Insights & Reports' },
  repDesc: { zh: '追踪长期的饮食习惯。', en: 'Track eating habits over time.' },
  daily: { zh: '每日', en: 'Daily' },
  weekly: { zh: '每周', en: 'Weekly' },
  mealsEaten: { zh: '已吃餐数', en: 'Meals Eaten' },
  mealsRejected: { zh: '拒绝餐数', en: 'Meals Rejected' },
  acceptanceRate: { zh: '接受率', en: 'Acceptance Rate' },
  aiAnalysis: { zh: 'AI 分析', en: 'AI Analysis' },
  generate: { zh: '生成', en: 'Generate' },
  analyzing: { zh: '正在分析饮食习惯...', en: 'Analyzing eating habits...' },
  clickGenerate: { zh: '点击生成以获取基于近期餐食的个性化洞察。', en: 'Click generate to get personalized insights based on recent meals.' },
  notEnoughHistory: { zh: '没有足够的就餐历史来生成报告。', en: 'Not enough meal history to generate a report.' },
  failedReport: { zh: '生成报告失败，请重试。', en: 'Failed to generate report. Please try again.' },
  
  // Tutorial Modal
  generatingRecipe: { zh: '正在生成健康食谱...', en: 'Generating healthy recipe...' },
  failedTutorial: { zh: '加载教程失败，请重试。', en: 'Failed to load tutorial. Please try again.' },
  playAudio: { zh: '朗读食谱', en: 'Listen' },
  stopAudio: { zh: '停止朗读', en: 'Stop' },
  loadingAudio: { zh: '加载语音...', en: 'Loading audio...' },
  
  // Settings
  settingsTitle: { zh: '设置', en: 'Settings' },
  settingsDesc: { zh: '管理用户资料和应用偏好。', en: 'Manage user profile and app preferences.' },
  babyProfile: { zh: '用户资料', en: 'User Profile' },
  age: { zh: '年龄', en: 'Age' },
  months: { zh: '个月', en: 'months' },
  years: { zh: '岁', en: 'years' },
  gender: { zh: '性别', en: 'Gender' },
  targetGroup: { zh: '定位', en: 'Target' },
  infant: { zh: '婴儿', en: 'Infant' },
  adult: { zh: '成人', en: 'Adult' },
  elderly: { zh: '老年人', en: 'Elderly' },
  boy: { zh: '男孩', en: 'Boy' },
  girl: { zh: '女孩', en: 'Girl' },
  appSettings: { zh: '应用设置', en: 'App Settings' },
  language: { zh: '语言', en: 'Language' },
  dataManagement: { zh: '数据管理', en: 'Data Management' },
  clearHistory: { zh: '清除饮食记录', en: 'Clear Meal History' },
  clearHistoryConfirm: { zh: '确定要清除所有饮食记录吗？此操作不可恢复。', en: 'Are you sure you want to clear all meal history? This cannot be undone.' },
  historyCleared: { zh: '饮食记录已清除', en: 'Meal history cleared' },
  save: { zh: '保存设置', en: 'Save Settings' },
  saved: { zh: '已保存', en: 'Saved' },
  aiSettings: { zh: 'AI 设置', en: 'AI Settings' },
  enableAiGeneration: { zh: '启用 AI 餐单生成', en: 'Enable AI Meal Generation' },
  provider: { zh: '供应商', en: 'Provider' },
  apiKey: { zh: 'API Key', en: 'API Key' },
  modelSelection: { zh: '模型选择', en: 'Model Selection' },
  google: { zh: 'Google', en: 'Google' },
  qwen: { zh: '通义千问', en: 'Qwen' },
  
  // Meal Types
  breakfast: { zh: '早餐', en: 'Breakfast' },
  lunch: { zh: '午餐', en: 'Lunch' },
  snack: { zh: '加餐', en: 'Snack' },
  dinner: { zh: '晚餐', en: 'Dinner' }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved as Language) || 'zh';
  });

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  const t = (key: keyof typeof translations): string => {
    return translations[key]?.[language] || String(key);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
