import { createContext, useContext } from 'react';
import type { Catalog, Recipe } from '../domain/types';
import type { IngredientLookup } from '../domain/recipe';
import type { MealprepDb } from '../db/database';
import type { RecipeInfo } from './recipeInfo';

export interface AppData {
  db: MealprepDb;
  catalog: Catalog;
  lookupRecipe: (id: string) => Recipe | undefined;
  lookupIngredient: IngredientLookup;
  recipeInfos: Map<string, RecipeInfo>;
}

export const AppContext = createContext<AppData | null>(null);

export function useApp(): AppData {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppContext fehlt');
  return value;
}
