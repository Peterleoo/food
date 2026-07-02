import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Plus, X, Heart, HeartOff, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useLanguage } from '../contexts/LanguageContext';

export default function Preferences() {
  const { t } = useLanguage();
  const preferences = useLiveQuery(() => db.preferences.toArray());
  const [newItem, setNewItem] = useState('');
  const [activeTab, setActiveTab] = useState<'like' | 'dislike' | 'allergy'>('like');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    
    await db.preferences.add({
      type: activeTab,
      item: newItem.trim().toLowerCase()
    });
    setNewItem('');
  };

  const handleRemove = async (id: number) => {
    await db.preferences.delete(id);
  };

  const filteredPrefs = preferences?.filter(p => p.type === activeTab) || [];

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-2">
      <div className="px-2">
        <h2 className="text-3xl font-bold tracking-tight text-black">{t('prefTitle')}</h2>
        <p className="text-gray-500 font-medium mt-1">{t('prefDesc')}</p>
      </div>

      <div className="bg-white rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mx-2">
        <div className="flex border-b border-black/5">
          <button
            onClick={() => setActiveTab('like')}
            className={clsx(
              "flex-1 py-4 text-sm font-semibold flex items-center justify-center space-x-2 transition-colors",
              activeTab === 'like' ? "text-[#34C759] border-b-2 border-[#34C759] bg-[#34C759]/5" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <Heart size={18} />
            <span>{t('likes')}</span>
          </button>
          <button
            onClick={() => setActiveTab('dislike')}
            className={clsx(
              "flex-1 py-4 text-sm font-semibold flex items-center justify-center space-x-2 transition-colors",
              activeTab === 'dislike' ? "text-[#FF3B30] border-b-2 border-[#FF3B30] bg-[#FF3B30]/5" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <HeartOff size={18} />
            <span>{t('dislikes')}</span>
          </button>
          <button
            onClick={() => setActiveTab('allergy')}
            className={clsx(
              "flex-1 py-4 text-sm font-semibold flex items-center justify-center space-x-2 transition-colors",
              activeTab === 'allergy' ? "text-[#FF9500] border-b-2 border-[#FF9500] bg-[#FF9500]/5" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <AlertTriangle size={18} />
            <span>{t('allergies')}</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <form onSubmit={handleAdd} className="flex space-x-3">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder={`${t('addPlaceholder')} ${t(activeTab === 'like' ? 'likes' : activeTab === 'dislike' ? 'dislikes' : 'allergies').toLowerCase()}...`}
              className="flex-1 bg-[#F2F2F7] border-0 rounded-[20px] px-5 py-3.5 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF] transition-all"
            />
            <button
              type="submit"
              disabled={!newItem.trim()}
              className="bg-[#007AFF] text-white p-3.5 rounded-[20px] hover:bg-[#0056b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center active:scale-95"
            >
              <Plus size={24} />
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {filteredPrefs.length === 0 ? (
              <p className="text-gray-400 italic text-sm py-4 text-center w-full">
                {t('noItemsAdded')}
              </p>
            ) : (
              filteredPrefs.map(pref => (
                <div
                  key={pref.id}
                  className={clsx(
                    "flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium",
                    activeTab === 'like' ? "bg-[#34C759]/10 text-[#34C759]" :
                    activeTab === 'dislike' ? "bg-[#FF3B30]/10 text-[#FF3B30]" :
                    "bg-[#FF9500]/10 text-[#FF9500]"
                  )}
                >
                  <span>{pref.item}</span>
                  <button
                    onClick={() => handleRemove(pref.id!)}
                    className="p-1 rounded-full hover:bg-black/10 transition-colors ml-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
