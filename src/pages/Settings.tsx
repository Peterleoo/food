import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../db';
import { User, Globe, Trash2, CheckCircle2, Sparkles, Heart, HeartOff, AlertTriangle, Plus, X, Menu, ArrowUp, ArrowDown, RotateCcw, ChevronRight, Download, Upload } from 'lucide-react';
import { clsx } from 'clsx';
import { DEFAULT_NAV_ORDER, NAV_ORDER_CHANGE_EVENT, NAV_ORDER_STORAGE_KEY, loadNavOrder, type NavItemKey } from '../navigation';
import { HEALTH_CONDITION_OPTIONS, getHealthConditionLabels, normalizeUserProfile, type HealthConditionKey } from '../profile';
import { CUISINE_PREFERENCE_OPTIONS, TASTE_PREFERENCES_STORAGE_KEY, getCuisinePreferenceLabels, normalizeTastePreferences, type CuisinePreferenceKey } from '../tastePreferences';

const QWEN_MODEL_OPTIONS = [
  'deepseek-v4-flash',
  'qwen3.7-plus',
  'qwen3.6-flash-2026-04-16',
  'qwen3.5-ocr',
  'qwen3.6-35b-a3b',
  'qwen3.7-max-2026-05-17',
  'qwen3.7-max-2026-06-08',
  'glm-5.1',
  'qwen3.7-max-preview',
  'qwen3.5-plus-2026-04-20'
];

const EXPORT_LOCAL_STORAGE_KEYS = [
  'babyProfile',
  'aiSettings',
  TASTE_PREFERENCES_STORAGE_KEY,
  NAV_ORDER_STORAGE_KEY,
  'app_language'
];

function normalizeSettingsModel(provider: 'google' | 'qwen', value: string) {
  if (provider === 'qwen') {
    return QWEN_MODEL_OPTIONS.includes(value) ? value : 'deepseek-v4-flash';
  }
  return value || 'gemini-3-flash-preview';
}

export default function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const preferences = useLiveQuery(() => db.preferences.toArray());
  const [age, setAge] = useState(24);
  const [gender, setGender] = useState<'boy' | 'girl'>('boy');
  const [targetGroup, setTargetGroup] = useState<'infant' | 'adult' | 'elderly'>('infant');
  const [peopleCount, setPeopleCount] = useState(1);
  const [healthConditions, setHealthConditions] = useState<HealthConditionKey[]>([]);
  const [healthConditionNote, setHealthConditionNote] = useState('');
  const [enableAiGeneration, setEnableAiGeneration] = useState(false);
  const [provider, setProvider] = useState<'google' | 'qwen'>('google');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-3-flash-preview');
  const [navOrder, setNavOrder] = useState<NavItemKey[]>(() => loadNavOrder());
  const [activeModal, setActiveModal] = useState<null | 'profile' | 'app' | 'ai' | 'preferences' | 'navigation' | 'data'>(null);
  const [newItem, setNewItem] = useState('');
  const [activePrefTab, setActivePrefTab] = useState<'like' | 'dislike' | 'allergy'>('like');
  const [cuisinePreferences, setCuisinePreferences] = useState<CuisinePreferenceKey[]>([]);
  const [tasteNote, setTasteNote] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isCleared, setIsCleared] = useState(false);
  const [dataMessage, setDataMessage] = useState('');
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const data = localStorage.getItem('babyProfile');
      if (data) {
        const profile = normalizeUserProfile(JSON.parse(data));
        setAge(profile.age);
        setGender(profile.gender);
        setTargetGroup(profile.targetGroup);
        setPeopleCount(profile.peopleCount);
        setHealthConditions(profile.healthConditions);
        setHealthConditionNote(profile.healthConditionNote);
      }
      const aiData = localStorage.getItem('aiSettings');
      if (aiData) {
        const settings = JSON.parse(aiData);
        const nextProvider = settings.provider === 'qwen' ? 'qwen' : 'google';
        setEnableAiGeneration(Boolean(settings.enabled));
        setProvider(nextProvider);
        if (settings.apiKey) setApiKey(settings.apiKey);
        setModel(normalizeSettingsModel(nextProvider, settings.model || ''));
      }
      const tasteData = localStorage.getItem(TASTE_PREFERENCES_STORAGE_KEY);
      if (tasteData) {
        const tastePreferences = normalizeTastePreferences(JSON.parse(tasteData));
        setCuisinePreferences(tastePreferences.cuisines);
        setTasteNote(tastePreferences.note);
      }
      setNavOrder(loadNavOrder());
    } catch (e) {}
  }, []);

  const handleSave = () => {
    localStorage.setItem('babyProfile', JSON.stringify({
      age,
      gender,
      targetGroup,
      peopleCount,
      healthConditions,
      healthConditionNote: healthConditionNote.trim()
    }));
    localStorage.setItem(NAV_ORDER_STORAGE_KEY, JSON.stringify(navOrder));
    localStorage.setItem('aiSettings', JSON.stringify({
      enabled: enableAiGeneration,
      provider,
      apiKey: apiKey.trim(),
      model
    }));
    localStorage.setItem(TASTE_PREFERENCES_STORAGE_KEY, JSON.stringify({
      cuisines: cuisinePreferences,
      note: tasteNote.trim()
    }));
    window.dispatchEvent(new Event(NAV_ORDER_CHANGE_EVENT));
    setIsSaved(true);
    setActiveModal(null);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleAddPreference = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newItem.trim()) return;
    await db.preferences.add({
      type: activePrefTab,
      item: newItem.trim().toLowerCase()
    });
    setNewItem('');
  };

  const handleClearHistory = async () => {
    if (window.confirm(t('clearHistoryConfirm'))) {
      await db.mealHistory.clear();
      setIsCleared(true);
      setTimeout(() => setIsCleared(false), 2000);
    }
  };

  const collectLocalStorageData = () => {
    const data: Record<string, string> = {};
    EXPORT_LOCAL_STORAGE_KEYS.forEach(key => {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    });
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('shoppingBought:')) {
        const value = localStorage.getItem(key);
        if (value !== null) data[key] = value;
      }
    }
    return data;
  };

  const handleExportData = async () => {
    const payload = {
      app: '今日餐食',
      version: 1,
      exportedAt: new Date().toISOString(),
      localStorage: collectLocalStorageData(),
      tables: {
        preferences: await db.preferences.toArray(),
        mealHistory: await db.mealHistory.toArray(),
        customRecipes: await db.customRecipes.toArray()
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily-meals-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDataMessage(t('dataExported'));
    setTimeout(() => setDataMessage(''), 2000);
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!window.confirm(t('importDataConfirm'))) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const tables = payload?.tables || {};
      await db.transaction('rw', db.preferences, db.mealHistory, db.customRecipes, async () => {
        await db.preferences.clear();
        await db.mealHistory.clear();
        await db.customRecipes.clear();
        if (Array.isArray(tables.preferences) && tables.preferences.length) await db.preferences.bulkAdd(tables.preferences);
        if (Array.isArray(tables.mealHistory) && tables.mealHistory.length) await db.mealHistory.bulkAdd(tables.mealHistory);
        if (Array.isArray(tables.customRecipes) && tables.customRecipes.length) await db.customRecipes.bulkAdd(tables.customRecipes);
      });
      if (payload?.localStorage && typeof payload.localStorage === 'object') {
        Object.entries(payload.localStorage).forEach(([key, value]) => {
          if (typeof value === 'string') localStorage.setItem(key, value);
        });
      }
      setDataMessage(t('dataImported'));
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      console.error(error);
      setDataMessage(t('importDataFailed'));
      setTimeout(() => setDataMessage(''), 3000);
    }
  };

  const profileSummary = targetGroup === 'infant'
    ? `${t('infant')} · ${age >= 12 ? `${Math.floor(age / 12)}${t('years')}` : `${age}${t('months')}`} · ${t('servings')} ${peopleCount}`
    : `${t(targetGroup)} · ${t('servings')} ${peopleCount}`;
  const healthSummary = healthConditions.length
    ? getHealthConditionLabels(healthConditions, language).join('、')
    : (language === 'zh' ? '无特殊限制' : 'No special constraints');
  const fullProfileSummary = `${profileSummary} · ${healthSummary}`;
  const prefCounts = {
    like: preferences?.filter(item => item.type === 'like').length || 0,
    dislike: preferences?.filter(item => item.type === 'dislike').length || 0,
    allergy: preferences?.filter(item => item.type === 'allergy').length || 0
  };
  const cuisineSummary = cuisinePreferences.length
    ? getCuisinePreferenceLabels(cuisinePreferences, language).join('、')
    : (language === 'zh' ? '未选菜系' : 'No cuisine selected');
  const filteredPrefs = preferences?.filter(p => p.type === activePrefTab) || [];
  const navLabels: Record<NavItemKey, string> = {
    today: t('navToday'),
    preferences: t('navPreferences'),
    reports: t('navReports'),
    settings: t('navSettings')
  };
  const moveNavItem = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= navOrder.length) return;
    const next = [...navOrder];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setNavOrder(next);
  };
  const handlePeopleCountChange = (value: string) => {
    const nextValue = value.replace(/\D/g, '');
    setPeopleCount(nextValue ? Math.max(1, Number(nextValue)) : 1);
  };
  const toggleHealthCondition = (key: HealthConditionKey) => {
    setHealthConditions(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]);
  };
  const toggleCuisinePreference = (key: CuisinePreferenceKey) => {
    setCuisinePreferences(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]);
  };
  const getModalTitle = () => {
    if (activeModal === 'profile') return t('babyProfile');
    if (activeModal === 'preferences') return t('prefTitle');
    if (activeModal === 'app') return t('appSettings');
    if (activeModal === 'navigation') return t('bottomNavSettings');
    if (activeModal === 'data') return t('dataManagement');
    return t('aiSettings');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-2">
      <div className="px-2">
        <h2 className="text-3xl font-bold tracking-tight text-black">{t('settingsTitle')}</h2>
        <p className="text-gray-500 font-medium mt-1">{t('settingsDesc')}</p>
      </div>

      <div className="space-y-4 px-2">
        {[
          { key: 'profile', title: t('babyProfile'), desc: fullProfileSummary, icon: User, color: '#FF9500' },
          { key: 'preferences', title: t('prefTitle'), desc: `${t('likes')} ${prefCounts.like} · ${t('dislikes')} ${prefCounts.dislike} · ${t('allergies')} ${prefCounts.allergy} · ${cuisineSummary}`, icon: Heart, color: '#34C759' },
          { key: 'app', title: t('appSettings'), desc: language === 'zh' ? '中文' : 'English', icon: Globe, color: '#34C759' },
          { key: 'navigation', title: t('bottomNavSettings'), desc: navOrder.map(key => navLabels[key]).join(' · '), icon: Menu, color: '#5856D6' },
          { key: 'ai', title: t('aiSettings'), desc: `${enableAiGeneration ? t('enabled') || 'Enabled' : t('pending')} · ${provider === 'google' ? t('google') : t('qwen')} · ${model}`, icon: Sparkles, color: '#007AFF' },
          { key: 'data', title: t('dataManagement'), desc: t('clearHistory'), icon: Trash2, color: '#FF3B30' }
        ].map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => setActiveModal(item.key as any)}
              className="w-full bg-white rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 flex items-center justify-between gap-4 text-left active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}1A` }}>
                  <Icon style={{ color: item.color }} size={21} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-black tracking-tight">{item.title}</h3>
                  <p className="text-sm text-gray-500 truncate">{item.desc}</p>
                </div>
              </div>
              <ChevronRight className="shrink-0 text-gray-300" size={19} strokeWidth={1.8} />
            </button>
          );
        })}
      </div>

      {activeModal && (
        <div className="pwa-modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-sm">
          <div className="ios-modal-panel bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/5">
              <h2 className="text-xl font-bold tracking-tight text-black">
                {getModalTitle()}
              </h2>
              <button onClick={() => setActiveModal(null)} className="p-2 bg-[#F2F2F7] text-gray-500 hover:text-black hover:bg-gray-200 rounded-full transition-colors active:scale-95">
                <X size={20} />
              </button>
            </div>

            <div className="ios-modal-scroll flex-1 overflow-y-auto p-6 space-y-6">
              {activeModal === 'profile' && (
                <>
                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">{t('targetGroup')}</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['infant', 'adult', 'elderly'] as const).map(value => (
                        <button key={value} onClick={() => setTargetGroup(value)} className={clsx("py-3 px-3 rounded-[20px] font-semibold transition-all active:scale-95", targetGroup === value ? "bg-[#007AFF]/10 text-[#007AFF] ring-2 ring-[#007AFF]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200")}>{t(value)}</button>
                      ))}
                    </div>
                  </div>
                  {targetGroup === 'infant' && (
                    <>
                      <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">{t('age')} ({t('months')})</label>
                        <div className="flex items-center space-x-4">
                          <input type="range" min="1" max="60" value={age} onChange={(e) => setAge(parseInt(e.target.value))} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#007AFF]" />
                          <span className="text-lg font-bold text-black w-20 text-right">{age}{t('months')}</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">{t('gender')}</label>
                        <div className="flex space-x-4">
                          <button onClick={() => setGender('boy')} className={clsx("flex-1 py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95", gender === 'boy' ? "bg-[#007AFF]/10 text-[#007AFF] ring-2 ring-[#007AFF]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200")}>{t('boy')}</button>
                          <button onClick={() => setGender('girl')} className={clsx("flex-1 py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95", gender === 'girl' ? "bg-[#FF2D55]/10 text-[#FF2D55] ring-2 ring-[#FF2D55]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200")}>{t('girl')}</button>
                        </div>
                      </div>
                    </>
                  )}
                  <label className="block space-y-3">
                    <span className="block text-sm font-bold text-gray-700 uppercase tracking-wider">{t('servings')}</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPeopleCount(prev => Math.max(1, prev - 1))}
                        className="h-12 w-12 rounded-full bg-[#F2F2F7] text-xl font-bold text-gray-600 transition active:scale-95"
                      >
                        -
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={peopleCount}
                        onChange={(event) => handlePeopleCountChange(event.target.value)}
                        className="min-w-0 flex-1 bg-[#F2F2F7] border-0 rounded-[20px] px-5 py-3.5 text-center text-black focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                      />
                      <button
                        type="button"
                        onClick={() => setPeopleCount(prev => prev + 1)}
                        className="h-12 w-12 rounded-full bg-[#F2F2F7] text-xl font-bold text-gray-600 transition active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">
                        {language === 'zh' ? '特殊饮食' : 'Special diet'}
                      </label>
                      <p className="mt-1 text-xs font-medium text-gray-400">
                        {language === 'zh' ? '用于生成餐单时避开或调整食材，不替代医生建议。' : 'Used to guide meal generation. It does not replace medical advice.'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {HEALTH_CONDITION_OPTIONS.map(option => {
                        const selected = healthConditions.includes(option.key);
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => toggleHealthCondition(option.key)}
                            className={clsx(
                              "min-h-11 rounded-[18px] px-3 py-2 text-sm font-semibold transition-all active:scale-95",
                              selected
                                ? "bg-[#FF9500]/10 text-[#C66A00] ring-2 ring-[#FF9500]"
                                : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200"
                            )}
                          >
                            {language === 'zh' ? option.zh : option.en}
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      value={healthConditionNote}
                      onChange={(event) => setHealthConditionNote(event.target.value)}
                      rows={3}
                      placeholder={language === 'zh' ? '其他情况、医生建议或需要避开的饮食要求（选填）' : 'Other conditions, clinician guidance, or dietary limits (optional)'}
                      className="w-full resize-none bg-[#F2F2F7] border-0 rounded-[20px] px-5 py-3.5 text-black focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                    />
                  </div>
                </>
              )}

              {activeModal === 'preferences' && (
                <>
                  <div className="flex border border-black/5 rounded-[22px] overflow-hidden">
                    {[
                      ['like', t('likes'), Heart],
                      ['dislike', t('dislikes'), HeartOff],
                      ['allergy', t('allergies'), AlertTriangle]
                    ].map(([value, label, Icon]: any) => (
                      <button key={value} onClick={() => setActivePrefTab(value)} className={clsx("flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2", activePrefTab === value ? "bg-[#007AFF]/10 text-[#007AFF]" : "text-gray-500")}>
                        <Icon size={16} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  <form onSubmit={handleAddPreference} className="flex gap-3">
                    <input value={newItem} onChange={(event) => setNewItem(event.target.value)} className="flex-1 bg-[#F2F2F7] border-0 rounded-[20px] px-5 py-3.5 text-black focus:outline-none focus:ring-2 focus:ring-[#007AFF]" />
                    <button type="submit" className="bg-[#007AFF] text-white p-3.5 rounded-[20px]"><Plus size={22} /></button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    {filteredPrefs.map(pref => (
                      <span key={pref.id} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-[#F2F2F7] text-gray-700">
                        {pref.item}
                        <button onClick={() => pref.id && db.preferences.delete(pref.id)}><X size={14} /></button>
                      </span>
                    ))}
                  </div>
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">
                        {language === 'zh' ? '菜系口味' : 'Cuisine flavor'}
                      </label>
                      <p className="mt-1 text-xs font-medium text-gray-400">
                        {language === 'zh' ? '影响 AI 生成餐单的口味方向，默认优先常见普通食材。' : 'Guides AI meal flavor. Common everyday ingredients are preferred by default.'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {CUISINE_PREFERENCE_OPTIONS.map(option => {
                        const selected = cuisinePreferences.includes(option.key);
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => toggleCuisinePreference(option.key)}
                            className={clsx(
                              "min-h-11 rounded-[18px] px-3 py-2 text-sm font-semibold transition-all active:scale-95",
                              selected
                                ? "bg-[#34C759]/10 text-[#1F8A3B] ring-2 ring-[#34C759]"
                                : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200"
                            )}
                          >
                            {language === 'zh' ? option.zh : option.en}
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      value={tasteNote}
                      onChange={(event) => setTasteNote(event.target.value)}
                      rows={3}
                      placeholder={language === 'zh' ? '补充口味偏好，比如少辣、偏软烂、不要奶香等（选填）' : 'Add flavor notes, such as less spicy, softer texture, no creamy taste (optional)'}
                      className="w-full resize-none bg-[#F2F2F7] border-0 rounded-[20px] px-5 py-3.5 text-black focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                    />
                  </div>
                </>
              )}

              {activeModal === 'app' && (
                <div className="flex space-x-4">
                  <button onClick={() => setLanguage('zh')} className={clsx("flex-1 py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95", language === 'zh' ? "bg-[#34C759]/10 text-[#34C759] ring-2 ring-[#34C759]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200")}>中文</button>
                  <button onClick={() => setLanguage('en')} className={clsx("flex-1 py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95", language === 'en' ? "bg-[#34C759]/10 text-[#34C759] ring-2 ring-[#34C759]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200")}>English</button>
                </div>
              )}

              {activeModal === 'navigation' && (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-gray-500">{t('bottomNavOrderDesc')}</p>
                  <div className="space-y-3">
                    {navOrder.map((key, index) => (
                      <div key={key} className="flex items-center gap-3 rounded-[22px] bg-[#F2F2F7] p-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-[#007AFF] shadow-sm">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-black">{navLabels[key]}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => moveNavItem(index, -1)}
                            disabled={index === 0}
                            className="rounded-full bg-white p-2 text-gray-600 shadow-sm transition active:scale-95 disabled:opacity-30"
                            aria-label={t('moveUp')}
                          >
                            <ArrowUp size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveNavItem(index, 1)}
                            disabled={index === navOrder.length - 1}
                            className="rounded-full bg-white p-2 text-gray-600 shadow-sm transition active:scale-95 disabled:opacity-30"
                            aria-label={t('moveDown')}
                          >
                            <ArrowDown size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setNavOrder(DEFAULT_NAV_ORDER)}
                    className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-[#F2F2F7] py-3.5 font-semibold text-gray-600 transition active:scale-95"
                  >
                    <RotateCcw size={18} />
                    <span>{t('resetNavOrder')}</span>
                  </button>
                </div>
              )}

              {activeModal === 'ai' && (
                <>
                  <label className="flex items-center justify-between gap-4">
                    <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t('enableAiGeneration')}</span>
                    <button
                      type="button"
                      onClick={() => setEnableAiGeneration(prev => !prev)}
                      aria-pressed={enableAiGeneration}
                      className={clsx(
                        "relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 active:scale-95",
                        enableAiGeneration ? "bg-[#007AFF]" : "bg-gray-300"
                      )}
                    >
                      <span className={clsx(
                        "absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200",
                        enableAiGeneration ? "translate-x-6" : "translate-x-0"
                      )} />
                    </button>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { setProvider('google'); setModel('gemini-3-flash-preview'); }} className={clsx("py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95", provider === 'google' ? "bg-[#007AFF]/10 text-[#007AFF] ring-2 ring-[#007AFF]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200")}>{t('google')}</button>
                    <button onClick={() => { setProvider('qwen'); setModel('deepseek-v4-flash'); }} className={clsx("py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95", provider === 'qwen' ? "bg-[#007AFF]/10 text-[#007AFF] ring-2 ring-[#007AFF]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200")}>{t('qwen')}</button>
                  </div>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={provider === 'google' ? 'Gemini API Key' : 'DashScope API Key'} className="w-full bg-[#F2F2F7] border-0 rounded-[20px] px-5 py-3.5 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]" />
                  <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full bg-[#F2F2F7] border-0 rounded-[20px] px-5 py-3.5 text-black focus:outline-none focus:ring-2 focus:ring-[#007AFF]">
                    {provider === 'google' ? (
                      <>
                        <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                        <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                        <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                      </>
                    ) : (
                      <>
                        {QWEN_MODEL_OPTIONS.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </>
                    )}
                  </select>
                </>
              )}

              {activeModal === 'data' && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="w-full rounded-[22px] bg-[#F2F2F7] p-4 text-left transition active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#007AFF] shadow-sm">
                        <Download size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-black">{t('exportData')}</p>
                        <p className="text-sm font-medium text-gray-500">{t('exportDataDesc')}</p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="w-full rounded-[22px] bg-[#F2F2F7] p-4 text-left transition active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#34C759] shadow-sm">
                        <Upload size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-black">{t('importData')}</p>
                        <p className="text-sm font-medium text-gray-500">{t('importDataDesc')}</p>
                      </div>
                    </div>
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportData}
                    className="hidden"
                  />
                  <button
                    onClick={handleClearHistory}
                    className="w-full bg-[#FF3B30]/10 text-[#FF3B30] py-3.5 rounded-[20px] font-semibold hover:bg-[#FF3B30]/20 transition-colors active:scale-95 flex items-center justify-center space-x-2"
                  >
                    {isCleared ? (
                      <>
                        <CheckCircle2 size={20} />
                        <span>{t('historyCleared')}</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={20} />
                        <span>{t('clearHistory')}</span>
                      </>
                    )}
                  </button>
                  {!!dataMessage && (
                    <p className="text-center text-sm font-semibold text-gray-500">{dataMessage}</p>
                  )}
                </div>
              )}
            </div>

            {activeModal !== 'data' && (
              <div className="p-6 border-t border-black/5">
                <button onClick={handleSave} className="w-full bg-[#007AFF] text-white py-3.5 rounded-[20px] font-semibold shadow-sm hover:bg-[#0056b3] transition-colors active:scale-95 flex items-center justify-center space-x-2">
                  {isSaved ? <><CheckCircle2 size={20} /><span>{t('saved')}</span></> : <span>{t('save')}</span>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
