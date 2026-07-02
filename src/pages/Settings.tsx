import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../db';
import { User, Globe, Trash2, CheckCircle2, Sparkles, Heart, HeartOff, AlertTriangle, Pencil, Plus, X } from 'lucide-react';
import { clsx } from 'clsx';

export default function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const preferences = useLiveQuery(() => db.preferences.toArray());
  const [age, setAge] = useState(24);
  const [gender, setGender] = useState<'boy' | 'girl'>('boy');
  const [targetGroup, setTargetGroup] = useState<'infant' | 'adult' | 'elderly'>('infant');
  const [peopleCount, setPeopleCount] = useState(1);
  const [enableAiGeneration, setEnableAiGeneration] = useState(false);
  const [provider, setProvider] = useState<'google' | 'qwen'>('google');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-3-flash-preview');
  const [activeModal, setActiveModal] = useState<null | 'profile' | 'app' | 'ai' | 'preferences' | 'data'>(null);
  const [newItem, setNewItem] = useState('');
  const [activePrefTab, setActivePrefTab] = useState<'like' | 'dislike' | 'allergy'>('like');
  const [isSaved, setIsSaved] = useState(false);
  const [isCleared, setIsCleared] = useState(false);

  useEffect(() => {
    try {
      const data = localStorage.getItem('babyProfile');
      if (data) {
        const profile = JSON.parse(data);
        if (profile.age) setAge(profile.age);
        if (profile.gender) setGender(profile.gender);
        if (profile.targetGroup) setTargetGroup(profile.targetGroup);
        if (profile.peopleCount) setPeopleCount(profile.peopleCount);
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
    localStorage.setItem('babyProfile', JSON.stringify({ age, gender, targetGroup, peopleCount }));
    localStorage.setItem('aiSettings', JSON.stringify({
      enabled: enableAiGeneration,
      provider,
      apiKey: apiKey.trim(),
      model
    }));
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

  const profileSummary = targetGroup === 'infant'
    ? `${t('infant')} · ${age >= 12 ? `${Math.floor(age / 12)}${t('years')}` : `${age}${t('months')}`} · ${t('servings')} ${peopleCount}`
    : `${t(targetGroup)} · ${t('servings')} ${peopleCount}`;
  const prefCounts = {
    like: preferences?.filter(item => item.type === 'like').length || 0,
    dislike: preferences?.filter(item => item.type === 'dislike').length || 0,
    allergy: preferences?.filter(item => item.type === 'allergy').length || 0
  };
  const filteredPrefs = preferences?.filter(p => p.type === activePrefTab) || [];

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-2">
      <div className="px-2">
        <h2 className="text-3xl font-bold tracking-tight text-black">{t('settingsTitle')}</h2>
        <p className="text-gray-500 font-medium mt-1">{t('settingsDesc')}</p>
      </div>

      <div className="space-y-4 px-2">
        {[
          { key: 'profile', title: t('babyProfile'), desc: profileSummary, icon: User, color: '#FF9500' },
          { key: 'preferences', title: t('prefTitle'), desc: `${t('likes')} ${prefCounts.like} · ${t('dislikes')} ${prefCounts.dislike} · ${t('allergies')} ${prefCounts.allergy}`, icon: Heart, color: '#34C759' },
          { key: 'app', title: t('appSettings'), desc: language === 'zh' ? '中文' : 'English', icon: Globe, color: '#34C759' },
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
              <Pencil className="text-gray-300 shrink-0" size={18} />
            </button>
          );
        })}
      </div>

      {activeModal && (
        <div className="pwa-modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-sm">
          <div className="ios-modal-panel bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/5">
              <h2 className="text-xl font-bold tracking-tight text-black">
                {activeModal === 'profile' ? t('babyProfile') : activeModal === 'preferences' ? t('prefTitle') : activeModal === 'app' ? t('appSettings') : activeModal === 'data' ? t('dataManagement') : t('aiSettings')}
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
                    <input type="number" min="1" value={peopleCount} onChange={(e) => setPeopleCount(Math.max(1, Number(e.target.value)))} className="w-full bg-[#F2F2F7] border-0 rounded-[20px] px-5 py-3.5 text-black focus:outline-none focus:ring-2 focus:ring-[#007AFF]" />
                  </label>
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
                </>
              )}

              {activeModal === 'app' && (
                <div className="flex space-x-4">
                  <button onClick={() => setLanguage('zh')} className={clsx("flex-1 py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95", language === 'zh' ? "bg-[#34C759]/10 text-[#34C759] ring-2 ring-[#34C759]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200")}>中文</button>
                  <button onClick={() => setLanguage('en')} className={clsx("flex-1 py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95", language === 'en' ? "bg-[#34C759]/10 text-[#34C759] ring-2 ring-[#34C759]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200")}>English</button>
                </div>
              )}

              {activeModal === 'ai' && (
                <>
                  <label className="flex items-center justify-between gap-4">
                    <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t('enableAiGeneration')}</span>
                    <input type="checkbox" checked={enableAiGeneration} onChange={(e) => setEnableAiGeneration(e.target.checked)} className="h-5 w-5 accent-[#007AFF]" />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { setProvider('google'); setModel('gemini-3-flash-preview'); }} className={clsx("py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95", provider === 'google' ? "bg-[#007AFF]/10 text-[#007AFF] ring-2 ring-[#007AFF]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200")}>{t('google')}</button>
                    <button onClick={() => { setProvider('qwen'); setModel('qwen-plus'); }} className={clsx("py-3 px-4 rounded-[20px] font-semibold transition-all active:scale-95", provider === 'qwen' ? "bg-[#007AFF]/10 text-[#007AFF] ring-2 ring-[#007AFF]" : "bg-[#F2F2F7] text-gray-500 hover:bg-gray-200")}>{t('qwen')}</button>
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
                        <option value="qwen-plus">qwen-plus</option>
                        <option value="qwen-turbo">qwen-turbo</option>
                        <option value="qwen-max">qwen-max</option>
                      </>
                    )}
                  </select>
                </>
              )}

              {activeModal === 'data' && (
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
