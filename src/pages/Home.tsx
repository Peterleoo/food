import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { Heart, HeartOff, ChefHat, RefreshCw, AlertCircle, Repeat2, CheckCircle2 } from 'lucide-react';
import { db } from '../db';
import { generateTutorial, generateSingleMeal } from '../services/ai';
import TutorialModal from '../components/TutorialModal';
import { clsx } from 'clsx';
import { useLanguage } from '../contexts/LanguageContext';
import { ensureRecipeTitle, extractRecipeSectionItems } from '../recipeDisplay';
import { createShoppingList, type ShoppingCategory } from '../shoppingList';
import { normalizeUserProfile } from '../profile';
import { TODAY_NAV_TOGGLE_EVENT } from '../navigation';
import { clearMealPlanTaskNotice, getMealPlanTaskSnapshot, startDailyMealPlanTask, subscribeMealPlanTask } from '../mealPlanTask';

export default function Home() {
  const { language, t } = useLanguage();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [mealPlanTask, setMealPlanTask] = useState(() => getMealPlanTaskSnapshot());
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDialog, setErrorDialog] = useState<null | { title: string; message: string }>(null);
  const [activeView, setActiveView] = useState<'meals' | 'shopping'>('meals');
  const shoppingBoughtStorageKey = `shoppingBought:${today}`;
  const [boughtShoppingItems, setBoughtShoppingItems] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(shoppingBoughtStorageKey) || '[]'));
    } catch (e) {
      return new Set();
    }
  });
  
  // Tutorial state
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialTitle, setTutorialTitle] = useState('');
  const [tutorialContent, setTutorialContent] = useState('');
  const [tutorialImage, setTutorialImage] = useState<string | undefined>();
  const [tutorialImages, setTutorialImages] = useState<string[]>([]);
  const [isTutorialLoading, setIsTutorialLoading] = useState(false);

  const todaysMeals = useLiveQuery(
    async () => {
      const meals = await db.mealHistory.where('date').equals(today).toArray();
      return meals.filter(meal => !meal.archived);
    },
    [today]
  );
  const isGenerating = mealPlanTask.status === 'running' && mealPlanTask.date === today;

  const handleGeneratePlan = async () => {
    setError(null);
    startDailyMealPlanTask(today, language, Date.now());
  };

  const handleRegenerateSingle = async (id: number, mealType: string) => {
    setRegeneratingId(id);
    try {
      const newMeal = await generateSingleMeal(today, mealType, language);
      if (newMeal) {
        await db.transaction('rw', db.mealHistory, async () => {
          const currentMeal = await db.mealHistory.get(id);
          const nextMeal = {
            date: currentMeal?.date || today,
            mealType: newMeal.mealType || currentMeal?.mealType || mealType,
            dishName: newMeal.dishName,
            ingredients: newMeal.ingredients,
            status: 'pending' as const,
            archived: false,
            tutorial: newMeal.tutorial,
            imageData: newMeal.imageData,
            imageDataList: newMeal.imageDataList
          };

          if (currentMeal && currentMeal.status !== 'pending') {
            await db.mealHistory.update(id, { archived: true });
            await db.mealHistory.add(nextMeal);
            return;
          }

          await db.mealHistory.update(id, nextMeal);
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRegeneratingId(null);
    }
  };

  const updateMealStatus = async (id: number, status: 'eaten' | 'rejected', currentStatus: string) => {
    await db.mealHistory.update(id, { status: currentStatus === status ? 'pending' : status });
  };

  const openTutorial = async (dishName: string, ingredients: string[], existingTutorial?: string, id?: number, imageData?: string, imageDataList?: string[]) => {
    setTutorialTitle(dishName);
    setTutorialImage(imageData);
    setTutorialImages(imageDataList || (imageData ? [imageData] : []));
    setIsTutorialOpen(true);
    
    if (existingTutorial) {
      setTutorialContent(ensureRecipeTitle(dishName, existingTutorial));
      setIsTutorialLoading(false);
      return;
    }

    setIsTutorialLoading(true);
    try {
      const content = await generateTutorial(dishName, ingredients, language);
      const titledContent = ensureRecipeTitle(dishName, content);
      setTutorialContent(titledContent);
      if (id) {
        await db.mealHistory.update(id, { tutorial: titledContent });
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

  const visibleMeals = sortedMeals;
  const dateLabel = language === 'zh'
    ? format(new Date(), 'yyyy/M/d EEE', { locale: zhCN })
    : format(new Date(), 'EEEE, MMMM d', { locale: enUS });
  const profile = useMemo(() => {
    try {
      return normalizeUserProfile(JSON.parse(localStorage.getItem('babyProfile') || 'null'));
    } catch (e) {
      return normalizeUserProfile(null);
    }
  }, []);
  const shoppingList = useMemo(
    () => createShoppingList(todaysMeals || [], profile),
    [todaysMeals, profile]
  );
  const shoppingCategoryLabels: Record<ShoppingCategory, string> = {
    vegetables: language === 'zh' ? '蔬菜' : 'Vegetables',
    meat: language === 'zh' ? '肉食' : 'Meat',
    fruit: language === 'zh' ? '水果' : 'Fruit',
    staple: language === 'zh' ? '米面' : 'Staples',
    eggDairy: language === 'zh' ? '蛋奶' : 'Eggs & Dairy',
    soy: language === 'zh' ? '豆制品' : 'Soy',
    other: language === 'zh' ? '其他' : 'Other'
  };
  const shoppingCategoryOrder: ShoppingCategory[] = ['vegetables', 'meat', 'fruit', 'staple', 'eggDairy', 'soy', 'other'];
  const groupedShoppingList = useMemo(
    () => shoppingCategoryOrder
      .map(category => ({
        category,
        items: shoppingList.filter(item => item.category === category)
      }))
      .filter(group => group.items.length > 0),
    [shoppingList]
  );
  const shoppingListDesc = t('shoppingListDesc');
  const toggleView = () => setActiveView(view => view === 'meals' ? 'shopping' : 'meals');
  const toggleShoppingBought = (name: string) => {
    setBoughtShoppingItems(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  useEffect(() => {
    localStorage.setItem(shoppingBoughtStorageKey, JSON.stringify(Array.from(boughtShoppingItems)));
  }, [boughtShoppingItems, shoppingBoughtStorageKey]);

  useEffect(() => {
    const syncTask = () => setMealPlanTask(getMealPlanTaskSnapshot());
    syncTask();
    return subscribeMealPlanTask(syncTask);
  }, []);

  useEffect(() => {
    if (mealPlanTask.date !== today) return;
    if (mealPlanTask.status === 'error' && mealPlanTask.error) {
      const message = t(mealPlanTask.error);
      setError(message);
      setErrorDialog({ title: t('aiFallbackTitle'), message });
    }
    if (mealPlanTask.status === 'success') {
      setError(null);
      if (mealPlanTask.warning) {
        setErrorDialog({ title: t('aiFallbackTitle'), message: t('aiFallbackDesc') });
      }
    }
  }, [mealPlanTask, t, today]);

  useEffect(() => {
    const handleTodayNavToggle = () => {
      if (!todaysMeals?.length) return;
      toggleView();
    };
    window.addEventListener(TODAY_NAV_TOGGLE_EVENT, handleTodayNavToggle);
    return () => window.removeEventListener(TODAY_NAV_TOGGLE_EVENT, handleTodayNavToggle);
  }, [todaysMeals?.length]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-2">
      <div className="flex items-start justify-between gap-3 px-2">
        <button
          type="button"
          onClick={toggleView}
          disabled={!todaysMeals?.length}
          className="group min-w-0 text-left transition-transform active:scale-[0.99] disabled:active:scale-100"
          aria-label={activeView === 'meals' ? t('shoppingList') : t('todaysPlan')}
        >
          <div className="flex items-center gap-2">
            <h2 className="truncate text-3xl font-bold tracking-tight text-black">
              {activeView === 'meals' ? t('todaysPlan') : t('shoppingList')}
            </h2>
            <span className="mt-1 rounded-full bg-white p-1.5 text-gray-400 shadow-sm transition-colors group-hover:text-[#007AFF]">
              <Repeat2 size={16} />
            </span>
          </div>
          <p className="text-gray-500 font-medium mt-1">
            {activeView === 'meals' ? dateLabel : shoppingListDesc}
          </p>
        </button>
        {activeView === 'meals' && (
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            className="flex items-center space-x-2 bg-[#007AFF]/10 text-[#007AFF] px-4 py-2 rounded-full font-semibold hover:bg-[#007AFF]/20 transition-colors disabled:opacity-50 active:scale-95"
          >
            <RefreshCw size={18} className={clsx(isGenerating && "animate-spin")} />
            <span>{todaysMeals?.length ? t('regenerate') : t('generatePlan')}</span>
          </button>
        </div>
        )}
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

      {!!todaysMeals?.length && (
      <div className={clsx("home-flip-scene px-2 pb-6", activeView === 'shopping' && "is-flipped")}>
        <div className="home-flip-card">
          <div className="home-flip-face home-flip-front space-y-4">
            {visibleMeals?.map((meal) => {
              const mealTypeKey = meal.mealType.toLowerCase() as keyof typeof mealOrder;
              const translatedMealType = t(mealTypeKey) !== mealTypeKey ? t(mealTypeKey) : meal.mealType;
              const nutritionTips = extractRecipeSectionItems(meal.tutorial, 'nutritionTips');
              
              return (
                <div key={meal.id} className="relative bg-white rounded-[28px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col sm:flex-row sm:items-center gap-4 transition-all">
                  <button
                    onClick={() => handleRegenerateSingle(meal.id!, meal.mealType)}
                    disabled={regeneratingId === meal.id}
                    className="absolute top-4 right-4 p-2 bg-[#F2F2F7] text-gray-500 rounded-full hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50"
                    title={t('regenerate')}
                  >
                    <RefreshCw size={16} className={clsx(regeneratingId === meal.id && "animate-spin")} />
                  </button>

                  {(meal.imageDataList?.[0] || meal.imageData) && (
                    <button
                      type="button"
                      onClick={() => openTutorial(meal.dishName, meal.ingredients, meal.tutorial, meal.id, meal.imageData, meal.imageDataList)}
                      className="h-28 w-full overflow-hidden rounded-[22px] bg-[#F2F2F7] sm:h-24 sm:w-24 sm:shrink-0"
                    >
                      <img
                        src={meal.imageDataList?.[0] || meal.imageData}
                        alt={meal.dishName}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  )}

                  <div className="flex-1 pr-10">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#FF9500] bg-[#FF9500]/10 px-2.5 py-1 rounded-md">
                        {translatedMealType}
                      </span>
                      {meal.status !== 'pending' && (
                        <span className={clsx(
                          "text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md",
                          meal.status === 'eaten' ? "text-[#34C759] bg-[#34C759]/10" :
                          "text-[#FF3B30] bg-[#FF3B30]/10"
                        )}>
                          {t(meal.status as any)}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-black leading-tight mb-2 tracking-tight">{meal.dishName}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                      {meal.ingredients.join(', ')}
                    </p>
                    {!!nutritionTips.length && (
                      <p className="mt-2 line-clamp-1 text-xs text-gray-400">{nutritionTips.join(' · ')}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 sm:flex-col sm:space-x-0 sm:space-y-2 shrink-0">
                    <button
                      onClick={() => openTutorial(meal.dishName, meal.ingredients, meal.tutorial, meal.id, meal.imageData, meal.imageDataList)}
                      className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-[#F2F2F7] text-black px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-200 transition-colors active:scale-95"
                    >
                      <ChefHat size={18} />
                      <span>{t('recipe')}</span>
                    </button>
                    
                    <div className="flex space-x-2 flex-1 sm:flex-none">
                      <button
                        onClick={() => updateMealStatus(meal.id!, 'eaten', meal.status)}
                        className={clsx(
                          "flex-1 sm:flex-none flex items-center justify-center p-2.5 rounded-full transition-colors active:scale-95",
                          meal.status === 'eaten' ? "bg-[#34C759]/10 text-[#34C759]" : "bg-[#F2F2F7] text-gray-400 hover:bg-[#34C759]/10 hover:text-[#34C759]"
                        )}
                        title={t('eaten')}
                      >
                        <Heart size={22} />
                      </button>
                      <button
                        onClick={() => updateMealStatus(meal.id!, 'rejected', meal.status)}
                        className={clsx(
                          "flex-1 sm:flex-none flex items-center justify-center p-2.5 rounded-full transition-colors active:scale-95",
                          meal.status === 'rejected' ? "bg-[#FF3B30]/10 text-[#FF3B30]" : "bg-[#F2F2F7] text-gray-400 hover:bg-[#FF3B30]/10 hover:text-[#FF3B30]"
                        )}
                        title={t('rejected')}
                      >
                        <HeartOff size={22} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="home-flip-face home-flip-back">
            {shoppingList.length ? (
              <div className="space-y-5">
                {groupedShoppingList.map(group => (
                  <section key={group.category} className="space-y-3">
                    <div className="px-1">
                      <h3 className="text-sm font-bold text-gray-500">{shoppingCategoryLabels[group.category]}</h3>
                    </div>
                    <div className="space-y-3">
                      {group.items.map(item => {
                        const isBought = boughtShoppingItems.has(item.name);
                        return (
                          <div key={item.name} className={clsx("flex items-center justify-between gap-4 rounded-[28px] bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all", isBought && "opacity-55")}>
                            <div className="flex min-w-0 items-center gap-4">
                              <button
                                type="button"
                                onClick={() => toggleShoppingBought(item.name)}
                                aria-pressed={isBought}
                                className={clsx(
                                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all active:scale-95",
                                  isBought ? "bg-[#34C759]/10 text-[#34C759]" : "bg-[#F2F2F7] text-gray-300"
                                )}
                              >
                                {isBought ? <CheckCircle2 size={22} /> : <span className="h-5 w-5 rounded-full border-2 border-current" />}
                              </button>
                              <div className="min-w-0">
                                <p className={clsx("truncate text-lg font-bold tracking-tight text-black", isBought && "line-through")}>{item.name}</p>
                                {!!item.dishes.length && (
                                  <p className="mt-0.5 truncate text-sm font-medium text-gray-500">
                                    {item.dishes.join('、')}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="shrink-0 text-sm font-bold text-gray-500">
                              {item.amount}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <p className="rounded-[28px] bg-white px-5 py-8 text-center text-sm font-medium text-gray-400 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">{t('noShoppingList')}</p>
            )}
          </div>
        </div>
      </div>
      )}

      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        title={tutorialTitle}
        content={tutorialContent}
        imageData={tutorialImage}
        imageDataList={tutorialImages}
        isLoading={isTutorialLoading}
      />

      {errorDialog && (
        <div className="pwa-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FF3B30]/10 text-[#FF3B30]">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-xl font-bold tracking-tight text-black">{errorDialog.title}</h3>
            <p className="mt-2 text-sm font-medium leading-relaxed text-gray-500">{errorDialog.message}</p>
            <button
              type="button"
              onClick={() => {
                setErrorDialog(null);
                clearMealPlanTaskNotice();
              }}
              className="mt-6 w-full rounded-full bg-[#007AFF] px-5 py-3 text-sm font-bold text-white transition-colors active:scale-95"
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
