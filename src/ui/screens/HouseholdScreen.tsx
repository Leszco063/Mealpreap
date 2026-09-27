import { useState } from 'react';
import type { Person } from '../../domain/types';
import { DIET_LABEL } from '../../domain/labels';
import { useHousehold, usePersons } from '../../db/hooks';
import { deletePerson, savePerson, updateHousehold } from '../../db/repo';
import { useApp } from '../context';
import { Button, Card, Chip, Field, NumberInput, Screen } from '../components';
import { WEEKDAY_SHORT } from '../format';
import { PersonForm } from './PersonForm';

export function HouseholdScreen() {
  const { db } = useApp();
  const household = useHousehold(db);
  const persons = usePersons(db);
  const [editing, setEditing] = useState<Person | 'new' | null>(null);

  if (!household) return null;

  const toggleCookDay = (day: number) =>
    void updateHousehold(db, (h) => ({
      ...h,
      cookDays: h.cookDays.includes(day) ? h.cookDays.filter((d) => d !== day) : [...h.cookDays, day].sort(),
    }));

  return (
    <Screen title="Haushalt">
      <Card>
        <div className="flex flex-col gap-4">
          <Field label="Wochenbudget (€)">
            <NumberInput
              value={household.weeklyBudgetEur}
              min={0}
              step={5}
              onChange={(v) => void updateHousehold(db, (h) => ({ ...h, weeklyBudgetEur: v ?? 0 }))}
            />
          </Field>
          <Field label="Kochtage">
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_SHORT.map((label, idx) => (
                <Chip key={label} active={household.cookDays.includes(idx + 1)} onClick={() => toggleCookDay(idx + 1)}>
                  {label}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Personen</h2>
        <Button onClick={() => setEditing('new')}>+ Person</Button>
      </div>
      {persons.length === 0 && (
        <p className="mt-2 text-sm text-stone-500">Noch niemand angelegt. Füge dich und deine Mitesser hinzu.</p>
      )}
      <ul className="mt-3 flex flex-col gap-3">
        {persons.map((p) => (
          <li key={p.id}>
            <Card>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{p.name}</h3>
                  <p className="text-sm text-stone-500">
                    {p.targets.kcal} kcal · ≥ {p.targets.proteinMin} g Protein · {DIET_LABEL[p.diet]}
                    {p.allergies.length > 0 ? ` · ${p.allergies.length} Allergie(n)` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setEditing(p)}>
                    Bearbeiten
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`${p.name} löschen? Portionen in geplanten Mahlzeiten werden entfernt.`)) {
                        void deletePerson(db, p.id);
                      }
                    }}
                  >
                    Löschen
                  </Button>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-stone-500">
        Nährwerte: Max Rubner-Institut (2025), Bundeslebensmittelschlüssel (BLS) 4.0, CC BY 4.0. Preise: Richtwerte
        (Aldi Süd, Stand 09/2026) bzw. Schätzungen.
      </p>

      {editing && (
        <PersonForm
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(person) => {
            void savePerson(db, person);
            setEditing(null);
          }}
        />
      )}
    </Screen>
  );
}
