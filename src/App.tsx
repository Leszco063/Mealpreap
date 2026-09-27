import { useEffect, useState } from 'react';
import { makeLookup } from './domain/recipe';
import type { Catalog } from './domain/types';
import { getDb } from './db/database';
import { ensureHousehold } from './db/repo';
import { AppContext, type AppData } from './ui/context';
import { buildRecipeInfos } from './ui/recipeInfo';
import { Shell } from './ui/Shell';

async function loadCatalog(): Promise<Catalog> {
  const res = await fetch(`${import.meta.env.BASE_URL}catalog.json`);
  if (!res.ok) throw new Error(`Rezeptkatalog konnte nicht geladen werden (HTTP ${res.status}).`);
  return (await res.json()) as Catalog;
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-stone-50 p-6 text-center text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="max-w-sm text-stone-600 dark:text-stone-400">{text}</p>
    </main>
  );
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catalog, db] = await Promise.all([loadCatalog(), getDb()]);
        await ensureHousehold(db);
        if (cancelled) return;
        setData({
          db,
          catalog,
          lookupRecipe: makeLookup(catalog.recipes),
          lookupIngredient: makeLookup(catalog.ingredients),
          recipeInfos: buildRecipeInfos(catalog),
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Message
        title="Start fehlgeschlagen"
        text={`${error} Beim allerersten Öffnen wird eine Internetverbindung gebraucht; danach funktioniert die App offline.`}
      />
    );
  }
  if (!data) return <Message title="Mealprep-Planer" text="Lädt …" />;
  return (
    <AppContext.Provider value={data}>
      <Shell />
    </AppContext.Provider>
  );
}
