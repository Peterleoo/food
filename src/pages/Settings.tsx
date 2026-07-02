import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../db';
import { Settings as SettingsIcon, Baby, Globe, Trash2, CheckCircle2, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

export default function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const [age, setAge] = useState(24);
  const [gender, setGender] = useState<'boy' | 'girl'>('boy');
  const [enableAiGeneration, setEnableAiGeneration] = useState(false);
  const [provider, setProvider] = useState<'google' | 'qwen'>('google');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-3-flash-preview');
  const [isSaved, setIsSaved] = useState(false);
  const [isCleared, setIsCleared] = useState(false);

  useEffect(() => {
    try {
      const data = localStorage.getItem('babyProfile');
      if (data) {
        const profile = JSON.parse(data);
        if (profile.age) setAge(profile.age);
        if (profile.gender) setGender(profile.gender);
      }
      const aiData = localStorage.getItem('aiSettings');
      if (aiData) {
        const settings = JSON.parse(aiData);
        setEnableAiGeneration(Boolean(settings.enabled));
        if (settings.provider) setProvider(settings.provider);
        if (settings.apiKey) setApiKey(settings.apiKey);
        if (settings.model) setModel(settings.model);
      }
    } catch (e) {}
  }, []);

  const handleSave = () => {
    localStorage.setItem('babyProfile', JSON.stringify({ age, gender }));
    localStorage.setItem('aiSettings', JSON.stringify({
      enabled: enableAiGeneration,
      provider,
      apiKey: apiKey.trim(),
      model
    }));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleClearHistory = async () => {
    if (window.confirm(t('clearHistoryConfirm'))) {
      await db.mealHistory.clear();
      setIsCleared(true);
      setTimeout(() => setIsCleared(false), 2000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-2">
      <div className="px-2">
        <h2 className="text-3xl font-bold tracking-tight text-black">{t('settingsTitle')}</h2>
        <p className="text-gray-500 font-medium mt-1">{t('settingsDesc')}</p>
      </div>

      <div className="bg-white rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mx-2">
        <div className="p-6 border-b border-black/5 flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#FF9500]/10 rounded-full flex items-center justify-center">
            <Baby className="text-[#FF9500]" size={20} />
          </div>
          <h3 className="text-xl font-bold text-black tracking-tight">{t('babyProfile')}</h3>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">{t('age')} ({t('months')})</label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="6"
                max="60"
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#007AFF]"
              />
              <span className="text-lg font-bold text-black w-20 text-right">
                {age >= 12 ? `${Math.floor(age / 12)}${t('years')} ${age % 12 > 0 ? `${age % 12}${t('months')}` : ''}` : `${age}${t('months')}`}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">{t('gender')}</label>
            <div className="flex space-x-4">
              <button
                onClick={() => setGender('boy')}
                className={clsx(
                  "flex-1 py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95",
                  gender === 'boy' ? "bg-[#007AFF]/10 text-[#007AFF] ring-2 ring-[#007AFF]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200"
                )}
              >
                {t('boy')}
              </button>
              <button
                onClick={() => setGender('girl')}
                className={clsx(
                  "flex-1 py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95",
                  gender === 'girl' ? "bg-[#FF2D55]/10 text-[#FF2D55] ring-2 ring-[#FF2D55]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200"
                )}
              >
                {t('girl')}
              </button>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-[#007AFF] text-white py-3.5 rounded-[20px] font-semibold shadow-sm hover:bg-[#0056b3] transition-colors active:scale-95 flex items-center justify-center space-x-2"
          >
            {isSaved ? (
              <>
                <CheckCircle2 size={20} />
                <span>{t('saved')}</span>
              </>
            ) : (
              <span>{t('save')}</span>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mx-2">
        <div className="p-6 border-b border-black/5 flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#34C759]/10 rounded-full flex items-center justify-center">
            <Globe className="text-[#34C759]" size={20} />
          </div>
          <h3 className="text-xl font-bold text-black tracking-tight">{t('appSettings')}</h3>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">{t('language')}</label>
            <div className="flex space-x-4">
              <button
                onClick={() => setLanguage('zh')}
                className={clsx(
                  "flex-1 py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95",
                  language === 'zh' ? "bg-[#34C759]/10 text-[#34C759] ring-2 ring-[#34C759]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200"
                )}
              >
                中文
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={clsx(
                  "flex-1 py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95",
                  language === 'en' ? "bg-[#34C759]/10 text-[#34C759] ring-2 ring-[#34C759]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200"
                )}
              >
                English
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mx-2">
        <div className="p-6 border-b border-black/5 flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#007AFF]/10 rounded-full flex items-center justify-center">
            <Sparkles className="text-[#007AFF]" size={20} />
          </div>
          <h3 className="text-xl font-bold text-black tracking-tight">{t('aiSettings')}</h3>
        </div>

        <div className="p-6 space-y-6">
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t('enableAiGeneration')}</span>
            <input
              type="checkbox"
              checked={enableAiGeneration}
              onChange={(e) => setEnableAiGeneration(e.target.checked)}
              className="h-5 w-5 accent-[#007AFF]"
            />
          </label>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">{t('provider')}</label>
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setProvider('google');
                  setModel('gemini-3-flash-preview');
                }}
                className={clsx(
                  "flex-1 py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95",
                  provider === 'google' ? "bg-[#007AFF]/10 text-[#007AFF] ring-2 ring-[#007AFF]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200"
                )}
              >
                {t('google')}
              </button>
              <button
                onClick={() => {
                  setProvider('qwen');
                  setModel('qwen-plus');
                }}
                className={clsx(
                  "flex-1 py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95",
                  provider === 'qwen' ? "bg-[#007AFF]/10 text-[#007AFF] ring-2 ring-[#007AFF]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200"
                )}
              >
                {t('qwen')}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">{t('apiKey')}</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === 'google' ? 'Gemini API Key' : 'DashScope API Key'}
              className="w-full bg-[#F2F2F7] border-0 rounded-[20px] px-5 py-3.5 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF] transition-all"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">{t('modelSelection')}</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-[#F2F2F7] border-0 rounded-[20px] px-5 py-3.5 text-black focus:outline-none focus:ring-2 focus:ring-[#007AFF] transition-all"
            >
              {provider === 'google' ? (
                <>
                  <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                </>
              ) : (
                <>
                  <option value="qwen-plus">qwen-plus</option>
                  <option value="qwen-turbo">qwen-turbo</option>
                  <option value="qwen-max">qwen-max</option>
                </>
              )}
            </select>
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-[#007AFF] text-white py-3.5 rounded-[20px] font-semibold shadow-sm hover:bg-[#0056b3] transition-colors active:scale-95 flex items-center justify-center space-x-2"
          >
            {isSaved ? (
              <>
                <CheckCircle2 size={20} />
                <span>{t('saved')}</span>
              </>
            ) : (
              <span>{t('save')}</span>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mx-2">
        <div className="p-6 border-b border-black/5 flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#FF3B30]/10 rounded-full flex items-center justify-center">
            <SettingsIcon className="text-[#FF3B30]" size={20} />
          </div>
          <h3 className="text-xl font-bold text-black tracking-tight">{t('dataManagement')}</h3>
        </div>
        
        <div className="p-6">
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
        </div>
      </div>
    </div>
  );
}
