import { useRoute, go } from './router';
import { Screen } from './components';
import { RecipesScreen } from './screens/RecipesScreen';
import { RecipeDetailScreen } from './screens/RecipeDetailScreen';
import { HouseholdScreen } from './screens/HouseholdScreen';
import { WeekScreen } from './screens/WeekScreen';

const TABS = [
  { path: 'woche', label: 'Woche', icon: '📅' },
  { path: 'rezepte', label: 'Rezepte', icon: '📖' },
  { path: 'einkauf', label: 'Einkauf', icon: '🛒' },
  { path: 'haushalt', label: 'Haushalt', icon: '🏠' },
] as const;

export function Shell() {
  const route = useRoute();
  const [section = 'woche'] = route;
  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <main>
        {section === 'rezepte' && route[1] ? (
          <RecipeDetailScreen key={route[1]} id={route[1]} />
        ) : section === 'rezepte' ? (
          <RecipesScreen />
        ) : section === 'haushalt' ? (
          <HouseholdScreen />
        ) : section === 'woche' ? (
          <WeekScreen />
        ) : (
          <Screen title={TABS.find((t) => t.path === section)?.label ?? 'Mealprep'}>
            <p className="text-stone-500">Dieser Bereich folgt gleich.</p>
          </Screen>
        )}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-stone-800 dark:bg-stone-900/95">
        <ul className="mx-auto flex max-w-2xl">
          {TABS.map((t) => (
            <li key={t.path} className="flex-1">
              <button
                type="button"
                onClick={() => go(t.path)}
                aria-current={section === t.path ? 'page' : undefined}
                className={`flex w-full flex-col items-center py-2 text-xs ${
                  section === t.path ? 'text-green-700 dark:text-green-400' : 'text-stone-500'
                }`}
              >
                <span className="text-lg" aria-hidden>
                  {t.icon}
                </span>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
