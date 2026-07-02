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
}

export class AppDB extends Dexie {
  preferences!: Table<Preference, number>;
  mealHistory!: Table<MealHistory, number>;

  constructor() {
    super('ToddlerMealsDB');
    this.version(1).stores({
      preferences: '++id, type, item',
      mealHistory: '++id, date, mealType, status'
    });
  }
}

export const db = new AppDB();
