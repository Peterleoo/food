import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { CheckCircle2, XCircle, ChefHat, RefreshCw, AlertCircle } from 'lucide-react';
import { db } from '../db';
import { generateDailyPlan, generateTutorial, generateSingleMeal } from '../services/ai';
import TutorialModal from '../components/TutorialModal';
import { clsx } from 'clsx';
import { useLanguage } from '../contexts/LanguageContext';

export default function Home() {
  const { language, t } = useLanguage();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  
  // Tutorial state
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialTitle, setTutorialTitle] = useState('');
  const [tutorialContent, setTutorialContent] = useState('');
  const [isTutorialLoading, setIsTutorialLoading] = useState(false);

  const todaysMeals = useLiveQuery(
    () => db.mealHistory.where('date').equals(today).toArray(),
    [today]
  );

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const newMeals = await generateDailyPlan(today, language);
      if (newMeals && newMeals.length > 0) {
        // Clear existing pending meals for today
        const existing = await db.mealHistory.where('date').equals(today).toArray();
        const pendingIds = existing.filter(m => m.status === 'pending').map(m => m.id!);
        if (pendingIds.length > 0) {
          await db.mealHistory.bulkDelete(pendingIds);
        }

        // Add new meals
        await db.mealHistory.bulkAdd(
          newMeals.map((m: any) => ({
            date: today,
            mealType: m.mealType,
            dishName: m.dishName,
            status: 'pending',
            ingredients: m.ingredients
          }))
        );
      } else {
        setError(t('failedGenerate'));
      }
    } catch (err) {
      console.error(err);
      setError(t('errorGenerate'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateSingle = async (id: number, mealType: string) => {
    setRegeneratingId(id);
    try {
      const newMeal = await generateSingleMeal(today, mealType, language);
      if (newMeal) {
        await db.mealHistory.update(id, {
          dishName: newMeal.dishName,
          ingredients: newMeal.ingredients,
          status: 'pending',
          tutorial: undefined
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRegeneratingId(null);
    }
  };

  const updateMealStatus = async (id: number, status: 'eaten' | 'rejected' | 'partial') => {
    if (status === 'rejected') {
      setRejectingId(id);
      setTimeout(async () => {
        await db.mealHistory.update(id, { status });
        setRejectingId(null);
      }, 480);
      return;
    }

    await db.mealHistory.update(id, { status });
  };

  const openTutorial = async (dishName: string, ingredients: string[], existingTutorial?: string, id?: number) => {
    setTutorialTitle(dishName);
    setIsTutorialOpen(true);
    
    if (existingTutorial) {
      setTutorialContent(existingTutorial);
      setIsTutorialLoading(false);
      return;
    }

    setIsTutorialLoading(true);
    try {
      const content = await generateTutorial(dishName, ingredients, language);
      setTutorialContent(content);
      if (id) {
        await db.mealHistory.update(id, { tutorial: content });
      }
    } catch (err) {
      setTutorialContent(t('failedTutorial'));
    } finally {
      setIsTutorialLoading(false);
    }
  };

  const mealOrder = { breakfast: 1, lunch: 2, snack: 3, dinner: 4 };
  const sortedMeals = todaysMeals?.sort((a, b) => {
    const aOrder = mealOrder[a.mealType.toLowerCase() as keyof typeof mealOrder] || 99;
    const bOrder = mealOrder[b.mealType.toLowerCase() as keyof typeof mealOrder] || 99;
    return aOrder - bOrder;
  });

  const visibleMeals = sortedMeals?.filter(meal => meal.status !== 'rejected' || meal.id === rejectingId);
  const dateLabel = language === 'zh'
    ? format(new Date(), 'yyyy/M/d EEE', { locale: zhCN })
    : format(new Date(), 'EEEE, MMMM d', { locale: enUS });

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-2">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-black">{t('todaysPlan')}</h2>
          <p className="text-gray-500 font-medium mt-1">{dateLabel}</p>
        </div>
        <button
          onClick={handleGeneratePlan}
          disabled={isGenerating}
          className="flex items-center space-x-2 bg-[#007AFF]/10 text-[#007AFF] px-4 py-2 rounded-full font-semibold hover:bg-[#007AFF]/20 transition-colors disabled:opacity-50 active:scale-95"
        >
          <RefreshCw size={18} className={clsx(isGenerating && "animate-spin")} />
          <span>{todaysMeals?.length ? t('regenerate') : t('generatePlan')}</span>
        </button>
      </div>

      {error && (
        <div className="bg-[#FF3B30]/10 text-[#FF3B30] p-4 rounded-[20px] flex items-start space-x-3 mx-2">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {!todaysMeals?.length && !isGenerating && (
        <div className="bg-white rounded-[28px] p-8 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] mx-2">
          <div className="w-16 h-16 bg-[#FF9500]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ChefHat className="text-[#FF9500]" size={32} />
          </div>
          <h3 className="text-xl font-semibold text-black mb-2 tracking-tight">{t('noMealsTitle')}</h3>
          <p className="text-gray-500 mb-8">{t('noMealsDesc')}</p>
          <button
            onClick={handleGeneratePlan}
            className="bg-[#007AFF] text-white px-8 py-3.5 rounded-full font-semibold shadow-sm hover:bg-[#0056b3] transition-colors w-full sm:w-auto active:scale-95"
          >
            {t('createPlanBtn')}
          </button>
        </div>
      )}

      {isGenerating && !todaysMeals?.length && (
        <div className="space-y-4 px-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-[28px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-pulse flex space-x-4">
              <div className="w-12 h-12 bg-gray-200 rounded-full shrink-0"></div>
              <div className="flex-1 space-y-3 py-1">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4 px-2 pb-6">
        {visibleMeals?.map((meal) => {
          const mealTypeKey = meal.mealType.toLowerCase() as keyof typeof mealOrder;
          const translatedMealType = t(mealTypeKey) !== mealTypeKey ? t(mealTypeKey) : meal.mealType;
          
          return (
            <div key={meal.id} className={clsx(
              "relative bg-white rounded-[28px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col sm:flex-row sm:items-center gap-4 transition-all",
              rejectingId === meal.id && "animate-fly-away"
            )}>
              <button
                onClick={() => handleRegenerateSingle(meal.id!, meal.mealType)}
                disabled={regeneratingId === meal.id}
                className="absolute top-4 right-4 p-2 bg-[#F2F2F7] text-gray-500 rounded-full hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50"
                title={t('regenerate')}
              >
                <RefreshCw size={16} className={clsx(regeneratingId === meal.id && "animate-spin")} />
              </button>

              <div className="flex-1 pr-10">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#FF9500] bg-[#FF9500]/10 px-2.5 py-1 rounded-md">
                    {translatedMealType}
                  </span>
                  {meal.status !== 'pending' && (
                    <span className={clsx(
                      "text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md",
                      meal.status === 'eaten' ? "text-[#34C759] bg-[#34C759]/10" :
                      "text-[#007AFF] bg-[#007AFF]/10"
                    )}>
                      {t(meal.status as any)}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-black leading-tight mb-2 tracking-tight">{meal.dishName}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                  {meal.ingredients.join(', ')}
                </p>
              </div>
              
              <div className="flex items-center space-x-2 sm:flex-col sm:space-x-0 sm:space-y-2 shrink-0">
                <button
                  onClick={() => openTutorial(meal.dishName, meal.ingredients, meal.tutorial, meal.id)}
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-[#F2F2F7] text-black px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-200 transition-colors active:scale-95"
                >
                  <ChefHat size={18} />
                  <span>{t('recipe')}</span>
                </button>
                
                <div className="flex space-x-2 flex-1 sm:flex-none">
                  <button
                    onClick={() => updateMealStatus(meal.id!, 'eaten')}
                    className={clsx(
                      "flex-1 sm:flex-none flex items-center justify-center p-2.5 rounded-full transition-colors active:scale-95",
                      meal.status === 'eaten' ? "bg-[#34C759]/10 text-[#34C759]" : "bg-[#F2F2F7] text-gray-400 hover:bg-[#34C759]/10 hover:text-[#34C759]"
                    )}
                    title={t('eaten')}
                  >
                    <CheckCircle2 size={22} />
                  </button>
                  <button
                    onClick={() => updateMealStatus(meal.id!, 'rejected')}
                    className={clsx(
                      "flex-1 sm:flex-none flex items-center justify-center p-2.5 rounded-full transition-colors active:scale-95",
                      "bg-[#F2F2F7] text-gray-400 hover:bg-[#FF3B30]/10 hover:text-[#FF3B30]"
                    )}
                    title={t('rejected')}
                  >
                    <XCircle size={22} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        title={tutorialTitle}
        content={tutorialContent}
        isLoading={isTutorialLoading}
      />
    </div>
  );
}
