import { useState } from 'react';
import { ALLERGENS, DIETS, MEAL_TYPES, type Person, type Targets } from '../../domain/types';
import { ALLERGEN_LABEL, DIET_LABEL, MEAL_TYPE_LABEL } from '../../domain/labels';
import { suggestTargets, type Activity, type Goal, type Sex } from '../../domain/targets';
import { newId } from '../../db/repo';
import { Button, Chip, Field, inputClass, Modal, NumberInput } from '../components';

const ACTIVITY_LABEL: Record<Activity, string> = {
  sedentary: 'kaum Bewegung',
  light: 'leicht aktiv (1–2× Sport/Woche)',
  moderate: 'mäßig aktiv (3–4×)',
  active: 'sehr aktiv (5–6×)',
  very_active: 'extrem aktiv / körperliche Arbeit',
};
const GOAL_LABEL: Record<Goal, string> = { lose: 'abnehmen', maintain: 'Gewicht halten', gain: 'Muskelaufbau' };

function emptyPerson(): Person {
  return {
    id: newId(),
    name: '',
    targets: { kcal: 2000, proteinMin: 100 },
    mealSlots: ['breakfast', 'lunch', 'dinner'],
    diet: 'omnivore',
    noPork: false,
    allergies: [],
    dislikedIngredientIds: [],
    maxMinutesWeekday: 30,
    maxMinutesCookDay: 120,
  };
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function PersonForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Person;
  onSave: (p: Person) => void;
  onClose: () => void;
}) {
  const [p, setP] = useState<Person>(initial ?? emptyPerson());
  const [body, setBody] = useState<{ weightKg?: number; heightCm?: number; ageYears?: number; sex: Sex; activity: Activity; goal: Goal }>({
    sex: 'male',
    activity: 'moderate',
    goal: 'maintain',
  });
  const [calcError, setCalcError] = useState<string | null>(null);

  const set = <K extends keyof Person>(key: K, value: Person[K]) => setP((prev) => ({ ...prev, [key]: value }));
  const setTarget = <K extends keyof Targets>(key: K, value: Targets[K]) =>
    setP((prev) => ({ ...prev, targets: { ...prev.targets, [key]: value } }));

  const calculate = () => {
    try {
      const t = suggestTargets({
        weightKg: body.weightKg ?? 0,
        heightCm: body.heightCm ?? 0,
        ageYears: body.ageYears ?? 0,
        sex: body.sex,
        activity: body.activity,
        goal: body.goal,
      });
      setP((prev) => ({ ...prev, targets: t }));
      setCalcError(null);
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : String(e));
    }
  };

  const valid = p.name.trim() !== '' && p.targets.kcal > 0 && p.targets.proteinMin > 0 && p.mealSlots.length > 0;

  return (
    <Modal title={initial ? `${initial.name} bearbeiten` : 'Person hinzufügen'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <input className={inputClass} value={p.name} onChange={(e) => set('name', e.target.value)} />
        </Field>

        <details className="rounded-xl border border-stone-200 p-3 dark:border-stone-800">
          <summary className="cursor-pointer text-sm font-medium">Ziel-Rechner (optional)</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Gewicht (kg)">
              <NumberInput value={body.weightKg} onChange={(v) => setBody({ ...body, weightKg: v })} />
            </Field>
            <Field label="Größe (cm)">
              <NumberInput value={body.heightCm} onChange={(v) => setBody({ ...body, heightCm: v })} />
            </Field>
            <Field label="Alter">
              <NumberInput value={body.ageYears} onChange={(v) => setBody({ ...body, ageYears: v })} />
            </Field>
            <Field label="Formel">
              <select className={inputClass} value={body.sex} onChange={(e) => setBody({ ...body, sex: e.target.value as Sex })}>
                <option value="male">männlich</option>
                <option value="female">weiblich</option>
              </select>
            </Field>
            <Field label="Aktivität">
              <select className={inputClass} value={body.activity} onChange={(e) => setBody({ ...body, activity: e.target.value as Activity })}>
                {Object.entries(ACTIVITY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ziel">
              <select className={inputClass} value={body.goal} onChange={(e) => setBody({ ...body, goal: e.target.value as Goal })}>
                {Object.entries(GOAL_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-3">
            <Button variant="secondary" onClick={calculate}>
              Ziele berechnen
            </Button>
          </div>
          {calcError && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{calcError}</p>}
        </details>

        <div className="grid grid-cols-2 gap-3">
          <Field label="kcal pro Tag">
            <NumberInput value={p.targets.kcal} onChange={(v) => setTarget('kcal', v ?? 0)} />
          </Field>
          <Field label="Protein min. (g)">
            <NumberInput value={p.targets.proteinMin} onChange={(v) => setTarget('proteinMin', v ?? 0)} />
          </Field>
          <Field label="Fett min. (g)">
            <NumberInput value={p.targets.fatMin} onChange={(v) => setTarget('fatMin', v)} />
          </Field>
          <Field label="Fett max. (g)">
            <NumberInput value={p.targets.fatMax} onChange={(v) => setTarget('fatMax', v)} />
          </Field>
          <Field label="Kohlenhydrate min. (g)">
            <NumberInput value={p.targets.carbsMin} onChange={(v) => setTarget('carbsMin', v)} />
          </Field>
          <Field label="Kohlenhydrate max. (g)">
            <NumberInput value={p.targets.carbsMax} onChange={(v) => setTarget('carbsMax', v)} />
          </Field>
        </div>

        <Field label="Mahlzeiten">
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map((m) => (
              <Chip key={m} active={p.mealSlots.includes(m)} onClick={() => set('mealSlots', toggle(p.mealSlots, m))}>
                {MEAL_TYPE_LABEL[m]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Ernährungsform">
          <div className="flex flex-wrap gap-2">
            {DIETS.map((d) => (
              <Chip key={d} active={p.diet === d} onClick={() => set('diet', d)}>
                {DIET_LABEL[d]}
              </Chip>
            ))}
            <Chip active={p.noPork} onClick={() => set('noPork', !p.noPork)}>
              kein Schwein
            </Chip>
          </div>
        </Field>

        <Field label="Allergien und Unverträglichkeiten">
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => (
              <Chip key={a} active={p.allergies.includes(a)} onClick={() => set('allergies', toggle(p.allergies, a))}>
                {ALLERGEN_LABEL[a]}
              </Chip>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Max. Minuten werktags">
            <NumberInput value={p.maxMinutesWeekday} onChange={(v) => set('maxMinutesWeekday', v ?? 0)} />
          </Field>
          <Field label="Max. Minuten am Kochtag">
            <NumberInput value={p.maxMinutesCookDay} onChange={(v) => set('maxMinutesCookDay', v ?? 0)} />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={!valid} onClick={() => onSave({ ...p, name: p.name.trim() })}>
            Speichern
          </Button>
        </div>
      </div>
    </Modal>
  );
}
