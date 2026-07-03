import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChefHat, ImagePlus, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { clsx } from 'clsx';
import { CustomRecipe, db } from '../db';
import { useLanguage } from '../contexts/LanguageContext';
import TutorialModal from '../components/TutorialModal';
import { generateCustomRecipeDraft } from '../services/ai';

type MealTypeValue = CustomRecipe['mealType'];

const emptyForm = {
  dishName: '',
  mealType: 'any' as MealTypeValue,
  ingredients: '',
  tutorial: '',
  nutritionTips: '',
  cautions: '',
  audience: '',
  imageDataList: [] as string[]
};

function splitList(value: string) {
  return value
    .split(/[,，\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

export default function Preferences() {
  const { language, t } = useLanguage();
  const recipes = useLiveQuery(() => db.customRecipes.orderBy('dishName').toArray());
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [useAiAdd, setUseAiAdd] = useState(false);
  const [aiMode, setAiMode] = useState<'direct' | 'ingredients'>('direct');
  const [aiInput, setAiInput] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [isRecipeOpen, setIsRecipeOpen] = useState(false);
  const [recipeTitle, setRecipeTitle] = useState('');
  const [recipeContent, setRecipeContent] = useState('');
  const [recipeImages, setRecipeImages] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyForm);
      setEditingId(null);
      setUseAiAdd(false);
      setAiMode('direct');
      setAiInput('');
      setAiError('');
    }
  }, [isOpen]);

  const openEdit = (recipe: CustomRecipe) => {
    setEditingId(recipe.id || null);
    setForm({
      dishName: recipe.dishName,
      mealType: recipe.mealType || 'any',
      ingredients: recipe.ingredients.join('\n'),
      tutorial: recipe.tutorial || '',
      nutritionTips: (recipe.nutritionTips || recipe.tags || []).join('\n'),
      cautions: (recipe.cautions || []).join('\n'),
      audience: recipe.audience.join('\n'),
      imageDataList: recipe.imageDataList || (recipe.imageData ? [recipe.imageData] : [])
    });
    setIsOpen(true);
  };

  const handleAiGenerate = async () => {
    setIsAiGenerating(true);
    setAiError('');
    try {
      const inputItems = splitList(aiInput);
      const draft = await generateCustomRecipeDraft({
        language,
        mode: aiMode,
        mealType: form.mealType,
        dishName: form.dishName,
        ingredients: aiMode === 'ingredients' ? inputItems : splitList(form.ingredients),
        note: aiInput
      });

      setForm(prev => ({
        ...prev,
        dishName: draft.dishName || prev.dishName,
        mealType: draft.mealType || prev.mealType,
        ingredients: draft.ingredients.join('\n'),
        tutorial: draft.steps.join('\n'),
        nutritionTips: draft.nutritionTips.join('\n'),
        cautions: draft.cautions.join('\n'),
        audience: draft.audience.join('\n')
      }));
    } catch (error) {
      console.error(error);
      setAiError(error instanceof Error ? error.message : t('aiGenerateFailed'));
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    Promise.all(files.map(file => new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.readAsDataURL(file);
    }))).then(images => {
      setForm(prev => ({ ...prev, imageDataList: [...prev.imageDataList, ...images.filter(Boolean)] }));
    });
    event.target.value = '';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.dishName.trim()) return;

    const payload: CustomRecipe = {
      dishName: form.dishName.trim(),
      mealType: form.mealType || 'any',
      ingredients: splitList(form.ingredients),
      tutorial: form.tutorial.trim(),
      nutritionTips: splitList(form.nutritionTips),
      cautions: splitList(form.cautions),
      tags: splitList(form.nutritionTips),
      audience: splitList(form.audience),
      imageData: form.imageDataList[0],
      imageDataList: form.imageDataList
    };

    if (editingId) {
      await db.customRecipes.update(editingId, payload);
    } else {
      await db.customRecipes.add(payload);
    }
    setIsOpen(false);
  };

  const openRecipe = (recipe: CustomRecipe) => {
    const steps = (recipe.tutorial || '')
      .split('\n')
      .map(step => step.trim())
      .filter(Boolean);
    const nutritionTips = recipe.nutritionTips || recipe.tags || [];
    const cautions = recipe.cautions || [];
    const sections = [
      recipe.ingredients.length ? `### ${t('ingredients')}\n${recipe.ingredients.map(item => `- ${item}`).join('\n')}` : '',
      steps.length ? `### ${t('cookingSteps')}\n${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}` : `### ${t('cookingSteps')}\n${t('noRecipeContent')}`,
      nutritionTips.length ? `### ${t('nutritionTips')}\n${nutritionTips.map(item => `- ${item}`).join('\n')}` : '',
      cautions.length ? `### ${t('cautions')}\n${cautions.map(item => `- ${item}`).join('\n')}` : '',
      recipe.audience.length ? `### ${t('suitablePeople')}\n${recipe.audience.map(item => `- ${item}`).join('\n')}` : '',
    ].filter(Boolean);

    setRecipeTitle(recipe.dishName);
    setRecipeContent(sections.join('\n\n'));
    setRecipeImages(recipe.imageDataList || (recipe.imageData ? [recipe.imageData] : []));
    setIsRecipeOpen(true);
  };

  const mealOptions: Array<{ value: MealTypeValue; label: string }> = [
    { value: 'any', label: t('anyMeal') },
    { value: 'breakfast', label: t('breakfast') },
    { value: 'lunch', label: t('lunch') },
    { value: 'snack', label: t('snack') },
    { value: 'dinner', label: t('dinner') }
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-2">
      <div className="px-2 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-black">{t('customTitle')}</h2>
          <p className="text-gray-500 font-medium mt-1">{t('customDesc')}</p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="shrink-0 bg-[#007AFF] text-white p-3 rounded-full shadow-sm hover:bg-[#0056b3] transition-colors active:scale-95"
          title={t('addRecipe')}
        >
          <Plus size={22} />
        </button>
      </div>

      <div className="space-y-4 px-2">
        {!recipes?.length ? (
          <div className="bg-white rounded-[28px] p-8 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="w-16 h-16 bg-[#FF9500]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <ChefHat className="text-[#FF9500]" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-black mb-2 tracking-tight">{t('noItemsAdded')}</h3>
            <p className="text-gray-500">{t('customDesc')}</p>
          </div>
        ) : (
          recipes.map(recipe => (
            <div key={recipe.id} className="bg-white rounded-[28px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#FF9500] bg-[#FF9500]/10 px-2.5 py-1 rounded-md">
                      {recipe.mealType && recipe.mealType !== 'any' ? t(recipe.mealType as any) : t('anyMeal')}
                    </span>
                    {recipe.audience.map(item => (
                      <span key={item} className="text-xs font-bold text-[#007AFF] bg-[#007AFF]/10 px-2.5 py-1 rounded-md">
                        {item}
                      </span>
                    ))}
                  </div>
                  <h3 className="text-xl font-bold text-black leading-tight mb-2 tracking-tight">{recipe.dishName}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {recipe.ingredients.length ? recipe.ingredients.join(', ') : t('ingredients')}
                  </p>
                  {!!(recipe.nutritionTips || recipe.tags || []).length && (
                    <p className="text-xs text-gray-400 mt-2">{(recipe.nutritionTips || recipe.tags || []).join(' · ')}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2 sm:flex-col sm:space-x-0 sm:space-y-2 shrink-0">
                  <button
                    onClick={() => openRecipe(recipe)}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-[#F2F2F7] text-black px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-200 transition-colors active:scale-95"
                  >
                    <ChefHat size={18} />
                    <span>{t('recipe')}</span>
                  </button>

                  <div className="flex space-x-2 flex-1 sm:flex-none">
                    <button
                      onClick={() => openEdit(recipe)}
                      className="flex-1 sm:flex-none flex items-center justify-center p-2.5 bg-[#F2F2F7] text-gray-500 rounded-full hover:bg-gray-200 active:scale-95 transition-all"
                      title={t('editRecipe')}
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => recipe.id && db.customRecipes.delete(recipe.id)}
                      className="flex-1 sm:flex-none flex items-center justify-center p-2.5 bg-[#F2F2F7] text-gray-400 rounded-full hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] active:scale-95 transition-all"
                      title={t('rejected')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isOpen && (
        <div className="pwa-modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="ios-modal-panel bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/5">
              <h2 className="text-xl font-bold tracking-tight text-black">{editingId ? t('editRecipe') : t('addRecipe')}</h2>
              <button type="button" onClick={() => setIsOpen(false)} className="p-2 bg-[#F2F2F7] text-gray-500 hover:text-black hover:bg-gray-200 rounded-full transition-colors active:scale-95">
                <X size={20} />
              </button>
            </div>

            <div className="ios-modal-scroll flex-1 overflow-y-auto p-6 space-y-5">
              {!editingId && (
                <div className="rounded-[24px] bg-[#F2F2F7] p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#007AFF]/10 text-[#007AFF]">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-black">{t('aiAddRecipe')}</p>
                        <p className="text-xs font-medium text-gray-500">{t('aiAddRecipeDesc')}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseAiAdd(prev => !prev)}
                      aria-pressed={useAiAdd}
                      className={clsx(
                        "relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 active:scale-95",
                        useAiAdd ? "bg-[#007AFF]" : "bg-gray-300"
                      )}
                    >
                      <span className={clsx(
                        "absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200",
                        useAiAdd ? "translate-x-6" : "translate-x-0"
                      )} />
                    </button>
                  </div>

                  {useAiAdd && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 rounded-[20px] bg-white p-1">
                        <button
                          type="button"
                          onClick={() => setAiMode('direct')}
                          className={clsx("rounded-[16px] py-2.5 text-sm font-semibold transition-colors", aiMode === 'direct' ? "bg-[#007AFF]/10 text-[#007AFF]" : "text-gray-500")}
                        >
                          {t('directGenerate')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiMode('ingredients')}
                          className={clsx("rounded-[16px] py-2.5 text-sm font-semibold transition-colors", aiMode === 'ingredients' ? "bg-[#007AFF]/10 text-[#007AFF]" : "text-gray-500")}
                        >
                          {t('ingredientsGenerate')}
                        </button>
                      </div>
                      <textarea
                        value={aiInput}
                        onChange={(event) => setAiInput(event.target.value)}
                        rows={3}
                        placeholder={aiMode === 'ingredients' ? t('aiIngredientsPlaceholder') : t('aiDirectPlaceholder')}
                        className="w-full bg-white border-0 rounded-[20px] px-5 py-3.5 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                      />
                      {aiError && <p className="text-sm font-medium text-[#FF3B30]">{aiError}</p>}
                      <button
                        type="button"
                        onClick={handleAiGenerate}
                        disabled={isAiGenerating || (aiMode === 'ingredients' && !aiInput.trim())}
                        className={clsx(
                          "flex w-full items-center justify-center gap-2 rounded-[20px] bg-[#007AFF] py-3 text-sm font-semibold text-white shadow-sm transition-colors active:scale-95",
                          (isAiGenerating || (aiMode === 'ingredients' && !aiInput.trim())) && "cursor-not-allowed opacity-50"
                        )}
                      >
                        <Sparkles size={18} className={clsx(isAiGenerating && "animate-pulse")} />
                        <span>{isAiGenerating ? t('aiGeneratingRecipe') : t('aiFillForm')}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <label className="block space-y-2">
                <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t('dishName')}</span>
                <input
                  value={form.dishName}
                  onChange={(event) => setForm(prev => ({ ...prev, dishName: event.target.value }))}
                  className="w-full bg-[#F2F2F7] border-0 rounded-[20px] px-5 py-3.5 text-black focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                  required
                />
              </label>

              <div className="space-y-2">
                <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t('recipeImage')}</span>
                {form.imageDataList.length ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {form.imageDataList.map((image, index) => (
                        <div key={`${image.slice(0, 24)}-${index}`} className="relative aspect-square overflow-hidden rounded-[18px] bg-[#F2F2F7]">
                          <img src={image} alt={`${form.dishName || t('recipeImage')} ${index + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, imageDataList: prev.imageDataList.filter((_, imageIndex) => imageIndex !== index) }))}
                            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[20px] bg-[#F2F2F7] px-5 py-3 text-sm font-semibold text-gray-600 active:scale-95">
                      <ImagePlus size={18} />
                      <span>{t('uploadMoreImages')}</span>
                      <input type="file" accept="image/*" multiple onChange={handleImageChange} className="sr-only" />
                    </label>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[20px] bg-[#F2F2F7] px-5 py-4 text-sm font-semibold text-gray-600 active:scale-95">
                    <ImagePlus size={18} />
                    <span>{t('uploadImage')}</span>
                    <input type="file" accept="image/*" multiple onChange={handleImageChange} className="sr-only" />
                  </label>
                )}
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t('mealType')}</span>
                <select
                  value={form.mealType}
                  onChange={(event) => setForm(prev => ({ ...prev, mealType: event.target.value as MealTypeValue }))}
                  className="w-full bg-[#F2F2F7] border-0 rounded-[20px] px-5 py-3.5 text-black focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                >
                  {mealOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>

              {[
                ['ingredients', t('ingredients')]
              ].map(([key, label]) => (
                <label key={key} className="block space-y-2">
                  <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">{label}</span>
                  <textarea
                    value={(form as any)[key]}
                    onChange={(event) => setForm(prev => ({ ...prev, [key]: event.target.value }))}
                    placeholder={t('onePerLine')}
                    rows={4}
                    className="w-full bg-[#F2F2F7] border-0 rounded-[20px] px-5 py-3.5 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                  />
                </label>
              ))}

              <label className="block space-y-2">
                <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t('cookingSteps')}</span>
                <textarea
                  value={form.tutorial}
                  onChange={(event) => setForm(prev => ({ ...prev, tutorial: event.target.value }))}
                  rows={5}
                  placeholder={t('stepsPlaceholder')}
                  className="w-full bg-[#F2F2F7] border-0 rounded-[20px] px-5 py-3.5 text-black focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                />
              </label>

              {[
                ['nutritionTips', t('nutritionTips')],
                ['cautions', t('cautions')],
                ['audience', t('suitablePeople')]
              ].map(([key, label]) => (
                <label key={key} className="block space-y-2">
                  <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">{label}</span>
                  <textarea
                    value={(form as any)[key]}
                    onChange={(event) => setForm(prev => ({ ...prev, [key]: event.target.value }))}
                    placeholder={key === 'audience' ? t('optionalComma') : t('onePerLine')}
                    rows={3}
                    className="w-full bg-[#F2F2F7] border-0 rounded-[20px] px-5 py-3.5 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                  />
                </label>
              ))}
            </div>

            <div className="p-6 border-t border-black/5">
              <button
                type="submit"
                disabled={!form.dishName.trim()}
                className={clsx(
                  "w-full bg-[#007AFF] text-white py-3.5 rounded-[20px] font-semibold shadow-sm hover:bg-[#0056b3] transition-colors active:scale-95",
                  !form.dishName.trim() && "opacity-50 cursor-not-allowed"
                )}
              >
                {t('save')}
              </button>
            </div>
          </form>
        </div>
      )}

      <TutorialModal
        isOpen={isRecipeOpen}
        onClose={() => setIsRecipeOpen(false)}
        title={recipeTitle}
        content={recipeContent}
        imageDataList={recipeImages}
        isLoading={false}
      />
    </div>
  );
}
