import { db } from './db';
import { generateDailyPlan } from './services/ai';

type TaskStatus = 'idle' | 'running' | 'success' | 'error';
type TaskError = 'failedGenerate' | 'errorGenerate' | null;

type TaskSnapshot = {
  date: string | null;
  error: TaskError;
  status: TaskStatus;
  warning: TaskError;
};

let snapshot: TaskSnapshot = {
  date: null,
  error: null,
  status: 'idle',
  warning: null
};
let activeTask: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

function setSnapshot(next: TaskSnapshot) {
  snapshot = next;
  emit();
}

export function getMealPlanTaskSnapshot() {
  return snapshot;
}

export function subscribeMealPlanTask(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearMealPlanTaskNotice() {
  if (!snapshot.error && !snapshot.warning) return;
  setSnapshot({ ...snapshot, error: null, warning: null });
}

export function startDailyMealPlanTask(date: string, language: 'zh' | 'en', refreshSeed = Date.now()) {
  if (activeTask && snapshot.status === 'running' && snapshot.date === date) {
    return activeTask;
  }

  setSnapshot({ date, error: null, status: 'running', warning: null });

  activeTask = (async () => {
    try {
      const newMeals = await generateDailyPlan(date, language, refreshSeed);
      if (!newMeals?.length) {
        setSnapshot({ date, error: 'failedGenerate', status: 'error', warning: null });
        return;
      }

      await db.transaction('rw', db.mealHistory, async () => {
        const existing = await db.mealHistory.where('date').equals(date).toArray();
        const existingIds = existing.map(meal => meal.id!).filter(Boolean);
        if (existingIds.length > 0) {
          await db.mealHistory.bulkDelete(existingIds);
        }

        await db.mealHistory.bulkAdd(
          newMeals.map((meal: any) => ({
            date,
            mealType: meal.mealType,
            dishName: meal.dishName,
            status: 'pending',
            ingredients: meal.ingredients || [],
            tutorial: meal.tutorial,
            imageData: meal.imageData,
            imageDataList: meal.imageDataList
          }))
        );
      });

      setSnapshot({
        date,
        error: null,
        status: 'success',
        warning: (newMeals as any).__aiFallback ? 'errorGenerate' : null
      });
    } catch (error) {
      console.error(error);
      setSnapshot({ date, error: 'errorGenerate', status: 'error', warning: null });
    } finally {
      activeTask = null;
    }
  })();

  return activeTask;
}
