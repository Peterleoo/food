import Dexie, { Table } from 'dexie';

export interface Preference {
  id?: number;
  type: 'like' | 'dislike' | 'allergy';
  item: string;
}

export interface MealHistory {
  id?: number;
  date: string; // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  dishName: string;
  status: 'eaten' | 'rejected' | 'partial' | 'pending';
  ingredients: string[];
  tutorial?: string;
  imageData?: string;
  imageDataList?: string[];
}

export interface CustomRecipe {
  id?: number;
  dishName: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any';
  ingredients: string[];
  tutorial?: string;
  nutritionTips?: string[];
  cautions?: string[];
  tags?: string[];
  audience: string[];
  servings?: number;
  imageData?: string;
  imageDataList?: string[];
}

export class AppDB extends Dexie {
  preferences!: Table<Preference, number>;
  mealHistory!: Table<MealHistory, number>;
  customRecipes!: Table<CustomRecipe, number>;

  constructor() {
    super('ToddlerMealsDB');
    this.version(1).stores({
      preferences: '++id, type, item',
      mealHistory: '++id, date, mealType, status'
    });
    this.version(2).stores({
      preferences: '++id, type, item',
      mealHistory: '++id, date, mealType, status',
      customRecipes: '++id, dishName, mealType'
    });
  }
}

export const db = new AppDB();
