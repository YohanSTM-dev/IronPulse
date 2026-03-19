import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { addDays, differenceInSeconds, format, startOfToday, subDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { ActivityLog, Workout, WorkoutLog } from '../types/database';

export type WeekdayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface PlannedExercise {
  id: string;
  name: string;
  targetSets: number;
  targetReps: string;
  suggestedWeight: string;
}

export interface WeeklyPlanDay {
  dayKey: WeekdayKey;
  label: string;
  enabled: boolean;
  focus: string;
  exercises: PlannedExercise[];
}

export interface PlannedSessionEntry {
  key: string;
  date: string;
  name: string;
  focus: string;
  exercises: PlannedExercise[];
  strict: boolean;
  status: 'planned' | 'in_progress' | 'completed';
  source: 'template' | 'extra' | 'free';
  workoutId?: string;
  dayKey?: WeekdayKey;
}

export interface WorkoutHistoryExercise {
  name: string;
  sets: number;
  totalReps: number;
  bestWeight: number | null;
}

export interface WorkoutHistoryEntry {
  id: string;
  name: string;
  date: string;
  durationMinutes: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  exercises: WorkoutHistoryExercise[];
}

interface ExerciseSet {
  id: string;
  setNumber: number;
  reps: string;
  weight: string;
  completed: boolean;
}

interface Exercise {
  id: string;
  name: string;
  sets: ExerciseSet[];
}

interface WorkoutMetadata {
  source?: 'template' | 'extra' | 'free';
  dayKey?: WeekdayKey;
  exercises?: PlannedExercise[];
}

interface CreateWorkoutOptions {
  date?: string;
  status?: Workout['status'];
  metadata?: WorkoutMetadata;
}

interface AddPlanExerciseInput {
  name: string;
  targetSets?: number;
  targetReps?: string;
  suggestedWeight?: string;
}

interface WorkoutState {
  workouts: Workout[];
  currentWorkout: Workout | null;
  currentWorkoutStartedAt: string | null;
  currentExercises: Exercise[];
  activityLog: ActivityLog[];
  workoutHistory: WorkoutHistoryEntry[];
  weeklyPlan: WeeklyPlanDay[];
  loading: boolean;
  planLoaded: boolean;
  error: string | null;
  trainingFrequency: number;
  fetchWorkouts: () => Promise<void>;
  fetchWorkoutHistory: (limit?: number) => Promise<void>;
  createWorkout: (name: string, options?: CreateWorkoutOptions) => Promise<Workout | null>;
  startFreeWorkout: (name: string) => Promise<Workout | null>;
  startWorkoutFromPlan: (session: PlannedSessionEntry) => Promise<Workout | null>;
  updateWorkout: (id: string, updates: Partial<Workout>) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  completeWorkout: (id: string, durationMinutes?: number) => Promise<void>;
  shiftWorkoutDate: (id: string, deltaDays: number) => Promise<void>;
  createExtraWorkout: (date: string, name: string) => Promise<void>;
  setTrainingFrequency: (frequency: number) => Promise<void>;
  loadPlanningData: () => Promise<void>;
  togglePlanDay: (dayKey: WeekdayKey) => Promise<void>;
  updatePlanDayFocus: (dayKey: WeekdayKey, focus: string) => Promise<void>;
  addPlanExercise: (dayKey: WeekdayKey, exercise: AddPlanExerciseInput) => Promise<void>;
  updatePlanExercise: (
    dayKey: WeekdayKey,
    exerciseId: string,
    updates: Partial<Omit<PlannedExercise, 'id' | 'name'>> & { name?: string }
  ) => Promise<void>;
  removePlanExercise: (dayKey: WeekdayKey, exerciseId: string) => Promise<void>;
  setCurrentWorkout: (
    workout: Workout | null,
    templateExercises?: PlannedExercise[],
    startedAt?: string | null
  ) => void;
  addExercise: (name: string) => void;
  removeExercise: (exerciseId: string) => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSet: (exerciseId: string, setId: string, field: 'reps' | 'weight', value: string) => void;
  toggleSetComplete: (exerciseId: string, setId: string) => void;
  saveWorkoutLogs: () => Promise<void>;
  clearCurrentWorkout: () => void;
  fetchActivityLog: (days?: number) => Promise<void>;
  getUpcomingSessions: (daysAhead?: number) => PlannedSessionEntry[];
  getSessionsForDate: (date: string) => PlannedSessionEntry[];
  getStrictStreak: () => number;
}

const PLAN_STORAGE_PREFIX = 'ironpulse:weekly-plan';
const META_PREFIX = '__IRONPULSE_META__';
const DAY_ORDER: WeekdayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];
const DAY_LABELS: Record<WeekdayKey, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
};

const generateId = () => Math.random().toString(36).substring(2, 15);

const createPlanExercise = (
  name: string,
  targetSets = 4,
  targetReps = '8-12',
  suggestedWeight = ''
): PlannedExercise => ({
  id: generateId(),
  name,
  targetSets,
  targetReps,
  suggestedWeight,
});

const createDefaultPlan = (): WeeklyPlanDay[] => [
  {
    dayKey: 'monday',
    label: DAY_LABELS.monday,
    enabled: true,
    focus: 'Pecs / Epaules / Triceps',
    exercises: [
      createPlanExercise('Bench Press', 4, '6-8'),
      createPlanExercise('Incline Dumbbell Press', 3, '8-10'),
      createPlanExercise('Shoulder Press', 4, '8-10'),
      createPlanExercise('Tricep Pushdown', 3, '12-15'),
    ],
  },
  {
    dayKey: 'tuesday',
    label: DAY_LABELS.tuesday,
    enabled: true,
    focus: 'Dos / Biceps',
    exercises: [
      createPlanExercise('Barbell Row', 4, '6-8'),
      createPlanExercise('Lat Pulldown', 3, '10-12'),
      createPlanExercise('Pull-up', 3, 'max'),
      createPlanExercise('Dumbbell Curl', 3, '10-12'),
    ],
  },
  {
    dayKey: 'wednesday',
    label: DAY_LABELS.wednesday,
    enabled: false,
    focus: '',
    exercises: [],
  },
  {
    dayKey: 'thursday',
    label: DAY_LABELS.thursday,
    enabled: true,
    focus: 'Jambes / Core',
    exercises: [
      createPlanExercise('Squat', 4, '5-8'),
      createPlanExercise('Leg Press', 3, '10-12'),
      createPlanExercise('Leg Extension', 3, '12-15'),
      createPlanExercise('Plank', 3, '45s'),
    ],
  },
  {
    dayKey: 'friday',
    label: DAY_LABELS.friday,
    enabled: false,
    focus: '',
    exercises: [],
  },
  {
    dayKey: 'saturday',
    label: DAY_LABELS.saturday,
    enabled: false,
    focus: '',
    exercises: [],
  },
  {
    dayKey: 'sunday',
    label: DAY_LABELS.sunday,
    enabled: false,
    focus: '',
    exercises: [],
  },
];

const getStorageKey = (userId?: string | null) => `${PLAN_STORAGE_PREFIX}:${userId || 'guest'}`;

const getWeekdayKey = (date: Date): WeekdayKey => {
  const index = date.getDay();
  return index === 0 ? 'sunday' : DAY_ORDER[index - 1];
};

const todayIso = () => format(new Date(), 'yyyy-MM-dd');

const parseWorkoutMetadata = (notes: string | null): WorkoutMetadata => {
  if (!notes || !notes.startsWith(META_PREFIX)) {
    return {};
  }

  try {
    return JSON.parse(notes.slice(META_PREFIX.length)) as WorkoutMetadata;
  } catch {
    return {};
  }
};

const serializeWorkoutMetadata = (metadata?: WorkoutMetadata): string | null => {
  if (!metadata) {
    return null;
  }

  return `${META_PREFIX}${JSON.stringify(metadata)}`;
};

const clonePlanDay = (day: WeeklyPlanDay): WeeklyPlanDay => ({
  ...day,
  exercises: day.exercises.map((exercise) => ({ ...exercise })),
});

const normalizePlan = (input: unknown): WeeklyPlanDay[] => {
  const defaultPlan = createDefaultPlan();

  if (!Array.isArray(input)) {
    return defaultPlan;
  }

  return DAY_ORDER.map((dayKey) => {
    const fallback = defaultPlan.find((day) => day.dayKey === dayKey)!;
    const rawDay = input.find(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        'dayKey' in value &&
        (value as { dayKey?: string }).dayKey === dayKey
    ) as Partial<WeeklyPlanDay> | undefined;

    if (!rawDay) {
      return fallback;
    }

    const exercises = Array.isArray(rawDay.exercises)
      ? rawDay.exercises.map((exercise) => ({
          id: typeof exercise?.id === 'string' ? exercise.id : generateId(),
          name: typeof exercise?.name === 'string' ? exercise.name : 'Exercice',
          targetSets:
            typeof exercise?.targetSets === 'number' && exercise.targetSets > 0
              ? exercise.targetSets
              : 3,
          targetReps:
            typeof exercise?.targetReps === 'string' && exercise.targetReps.trim()
              ? exercise.targetReps
              : '8-12',
          suggestedWeight:
            typeof exercise?.suggestedWeight === 'string' ? exercise.suggestedWeight : '',
        }))
      : fallback.exercises;

    return {
      dayKey,
      label: DAY_LABELS[dayKey],
      enabled: typeof rawDay.enabled === 'boolean' ? rawDay.enabled : fallback.enabled,
      focus: typeof rawDay.focus === 'string' ? rawDay.focus : fallback.focus,
      exercises,
    };
  });
};

const buildExercisesFromTemplate = (templateExercises: PlannedExercise[] = []): Exercise[] =>
  templateExercises.map((exercise) => ({
    id: generateId(),
    name: exercise.name,
    sets: Array.from({ length: Math.max(1, exercise.targetSets) }, (_, index) => ({
      id: generateId(),
      setNumber: index + 1,
      reps: exercise.targetReps,
      weight: exercise.suggestedWeight,
      completed: false,
    })),
  }));

const derivePlannedSessions = (
  workouts: Workout[],
  weeklyPlan: WeeklyPlanDay[],
  daysAhead = 14
): PlannedSessionEntry[] => {
  const sessionMap = new Map<string, PlannedSessionEntry>();
  const rangeStart = todayIso();
  const rangeEnd = format(addDays(new Date(), Math.max(daysAhead - 1, 0)), 'yyyy-MM-dd');

  for (let index = 0; index < daysAhead; index += 1) {
    const date = addDays(new Date(), index);
    const dayKey = getWeekdayKey(date);
    const dayPlan = weeklyPlan.find((day) => day.dayKey === dayKey);

    if (!dayPlan?.enabled) {
      continue;
    }

    const dateIso = format(date, 'yyyy-MM-dd');
    const focus = dayPlan.focus.trim() || `Seance ${dayPlan.label}`;

    sessionMap.set(`template-${dateIso}-${dayKey}`, {
      key: `template-${dateIso}-${dayKey}`,
      date: dateIso,
      name: focus,
      focus,
      exercises: dayPlan.exercises,
      strict: true,
      status: 'planned',
      source: 'template',
      dayKey,
    });
  }

  const extras: PlannedSessionEntry[] = [];

  workouts.forEach((workout) => {
    const metadata = parseWorkoutMetadata(workout.notes);
    const workoutDate = workout.workout_date;

    if (workoutDate < rangeStart || workoutDate > rangeEnd) {
      return;
    }

    if (metadata.source === 'template' && metadata.dayKey) {
      const key = `template-${workoutDate}-${metadata.dayKey}`;
      const existing = sessionMap.get(key);

      if (existing) {
        sessionMap.set(key, {
          ...existing,
          name: workout.name || existing.name,
          focus: workout.name || existing.focus,
          exercises:
            metadata.exercises && metadata.exercises.length
              ? metadata.exercises
              : existing.exercises,
          status: workout.status,
          workoutId: workout.id,
        });
      }

      return;
    }

    if (metadata.source === 'extra') {
      extras.push({
        key: `extra-${workout.id}`,
        date: workoutDate,
        name: workout.name,
        focus: workout.name,
        exercises: metadata.exercises || [],
        strict: false,
        status: workout.status,
        source: 'extra',
        workoutId: workout.id,
      });
    }
  });

  return [...sessionMap.values(), ...extras].sort((left, right) => {
    if (left.date === right.date) {
      if (left.source === right.source) {
        return left.name.localeCompare(right.name);
      }

      return left.source === 'template' ? -1 : 1;
    }

    return left.date.localeCompare(right.date);
  });
};

const buildWorkoutHistory = (workouts: Workout[], logs: WorkoutLog[]): WorkoutHistoryEntry[] =>
  workouts.map((workout) => {
    const workoutLogs = logs.filter((log) => log.workout_id === workout.id);
    const exercisesMap = new Map<string, WorkoutHistoryExercise>();

    workoutLogs.forEach((log) => {
      const current = exercisesMap.get(log.exercise_name) || {
        name: log.exercise_name,
        sets: 0,
        totalReps: 0,
        bestWeight: null,
      };

      exercisesMap.set(log.exercise_name, {
        name: log.exercise_name,
        sets: current.sets + 1,
        totalReps: current.totalReps + (log.reps || 0),
        bestWeight:
          current.bestWeight === null ? log.weight || null : Math.max(current.bestWeight, log.weight || 0),
      });
    });

    const totalReps = workoutLogs.reduce((sum, log) => sum + (log.reps || 0), 0);
    const totalVolume = workoutLogs.reduce((sum, log) => sum + (log.reps || 0) * (log.weight || 0), 0);

    return {
      id: workout.id,
      name: workout.name,
      date: workout.workout_date,
      durationMinutes: workout.duration_minutes || 0,
      totalSets: workoutLogs.length,
      totalReps,
      totalVolume,
      exercises: Array.from(exercisesMap.values()),
    };
  });

const persistWeeklyPlan = async (userId: string | null | undefined, weeklyPlan: WeeklyPlanDay[]) => {
  await AsyncStorage.setItem(
    getStorageKey(userId),
    JSON.stringify({
      version: 1,
      days: weeklyPlan,
      updatedAt: new Date().toISOString(),
    })
  );
};

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  workouts: [],
  currentWorkout: null,
  currentWorkoutStartedAt: null,
  currentExercises: [],
  activityLog: [],
  workoutHistory: [],
  weeklyPlan: createDefaultPlan(),
  loading: false,
  planLoaded: false,
  error: null,
  trainingFrequency: 3,

  fetchWorkouts: async () => {
    set({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .order('workout_date', { ascending: false });

      if (error) {
        throw error;
      }

      const workouts = data || [];
      const activeWorkout = workouts.find((workout) => workout.status === 'in_progress');
      const currentWorkout = get().currentWorkout;

      if (!currentWorkout && activeWorkout) {
        const metadata = parseWorkoutMetadata(activeWorkout.notes);
        set({
          workouts,
          currentWorkout: activeWorkout,
          currentWorkoutStartedAt: activeWorkout.created_at,
          currentExercises: buildExercisesFromTemplate(metadata.exercises || []),
          loading: false,
        });
        return;
      }

      set({ workouts });
    } catch (error: any) {
      set({ error: error.message || 'Unable to load workouts' });
    } finally {
      set({ loading: false });
    }
  },

  fetchWorkoutHistory: async (limit = 8) => {
    try {
      const { data: workoutsData, error: workoutsError } = await supabase
        .from('workouts')
        .select('*')
        .eq('status', 'completed')
        .order('workout_date', { ascending: false })
        .limit(limit);

      if (workoutsError) {
        throw workoutsError;
      }

      const completedWorkouts = workoutsData || [];

      if (completedWorkouts.length === 0) {
        set({ workoutHistory: [] });
        return;
      }

      const workoutIds = completedWorkouts.map((workout) => workout.id);
      const { data: logsData, error: logsError } = await supabase
        .from('workout_logs')
        .select('*')
        .in('workout_id', workoutIds);

      if (logsError) {
        throw logsError;
      }

      set({ workoutHistory: buildWorkoutHistory(completedWorkouts, logsData || []) });
    } catch (error: any) {
      set({ error: error.message || 'Unable to load history' });
    }
  },

  createWorkout: async (name, options) => {
    set({ loading: true, error: null });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase
        .from('workouts')
        .insert({
          user_id: user.id,
          name,
          status: options?.status || 'in_progress',
          workout_date: options?.date || todayIso(),
          notes: serializeWorkoutMetadata(options?.metadata),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      set((state) => ({ workouts: [data, ...state.workouts] }));
      return data;
    } catch (error: any) {
      set({ error: error.message || 'Unable to create workout' });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  startFreeWorkout: async (name) => {
    const workout = await get().createWorkout(name.trim(), {
      date: todayIso(),
      status: 'in_progress',
      metadata: { source: 'free', exercises: [] },
    });

    if (workout) {
      get().setCurrentWorkout(workout, [], new Date().toISOString());
    }

    return workout;
  },

  startWorkoutFromPlan: async (session) => {
    set({ loading: true, error: null });

    try {
      let workout = get().workouts.find((item) => item.id === session.workoutId) || null;
      const metadata: WorkoutMetadata = {
        source: session.source === 'template' ? 'template' : 'extra',
        dayKey: session.dayKey,
        exercises: session.exercises,
      };

      if (!workout) {
        workout = await get().createWorkout(session.name, {
          date: session.date,
          status: 'in_progress',
          metadata,
        });
      } else if (workout.status !== 'in_progress') {
        const { error } = await supabase
          .from('workouts')
          .update({
            status: 'in_progress',
            notes: serializeWorkoutMetadata(metadata),
          })
          .eq('id', workout.id);

        if (error) {
          throw error;
        }

        workout = {
          ...workout,
          status: 'in_progress',
          notes: serializeWorkoutMetadata(metadata),
        };

        set((state) => ({
          workouts: state.workouts.map((item) => (item.id === workout!.id ? workout! : item)),
        }));
      }

      if (workout) {
        get().setCurrentWorkout(workout, session.exercises, new Date().toISOString());
      }

      return workout;
    } catch (error: any) {
      set({ error: error.message || 'Unable to start workout' });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  updateWorkout: async (id, updates) => {
    try {
      const { error } = await supabase.from('workouts').update(updates).eq('id', id);

      if (error) {
        throw error;
      }

      set((state) => ({
        workouts: state.workouts.map((workout) => (workout.id === id ? { ...workout, ...updates } : workout)),
      }));
    } catch (error: any) {
      set({ error: error.message || 'Unable to update workout' });
    }
  },

  deleteWorkout: async (id) => {
    try {
      const { error } = await supabase.from('workouts').delete().eq('id', id);

      if (error) {
        throw error;
      }

      set((state) => ({
        workouts: state.workouts.filter((workout) => workout.id !== id),
      }));
    } catch (error: any) {
      set({ error: error.message || 'Unable to delete workout' });
    }
  },

  completeWorkout: async (id, durationMinutes = 0) => {
    try {
      const completedAt = new Date().toISOString();
      const { error } = await supabase
        .from('workouts')
        .update({
          status: 'completed',
          completed_at: completedAt,
          duration_minutes: durationMinutes,
        })
        .eq('id', id);

      if (error) {
        throw error;
      }

      set((state) => ({
        workouts: state.workouts.map((workout) =>
          workout.id === id
            ? { ...workout, status: 'completed', completed_at: completedAt, duration_minutes: durationMinutes }
            : workout
        ),
      }));
    } catch (error: any) {
      set({ error: error.message || 'Unable to complete workout' });
    }
  },

  shiftWorkoutDate: async (id, deltaDays) => {
    try {
      const workout = get().workouts.find((item) => item.id === id);

      if (!workout) {
        throw new Error('Workout not found');
      }

      const nextDate = format(addDays(new Date(workout.workout_date), deltaDays), 'yyyy-MM-dd');

      const { error } = await supabase
        .from('workouts')
        .update({ workout_date: nextDate })
        .eq('id', id);

      if (error) {
        throw error;
      }

      set((state) => ({
        workouts: state.workouts.map((item) => (item.id === id ? { ...item, workout_date: nextDate } : item)),
      }));
    } catch (error: any) {
      set({ error: error.message || 'Unable to move workout' });
    }
  },

  createExtraWorkout: async (date, name) => {
    await get().createWorkout(name.trim(), {
      date,
      status: 'planned',
      metadata: { source: 'extra', exercises: [] },
    });
  },

  setTrainingFrequency: async (frequency) => {
    set({ trainingFrequency: frequency });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ training_frequency: frequency })
        .eq('id', user.id);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Training frequency update error:', error);
    }
  },

  loadPlanningData: async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const stored = await AsyncStorage.getItem(getStorageKey(user?.id));
      const parsed = stored ? JSON.parse(stored) : null;
      const weeklyPlan = normalizePlan(parsed?.days);
      const trainingFrequency = weeklyPlan.filter((day) => day.enabled).length;

      set({
        weeklyPlan,
        trainingFrequency,
        planLoaded: true,
      });
    } catch (error: any) {
      set({
        weeklyPlan: createDefaultPlan(),
        trainingFrequency: 3,
        planLoaded: true,
        error: error.message || 'Unable to load planning',
      });
    }
  },

  togglePlanDay: async (dayKey) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const weeklyPlan = get().weeklyPlan.map((day) =>
        day.dayKey === dayKey ? { ...day, enabled: !day.enabled } : clonePlanDay(day)
      );

      await persistWeeklyPlan(user?.id, weeklyPlan);
      const trainingFrequency = weeklyPlan.filter((day) => day.enabled).length;
      set({ weeklyPlan, trainingFrequency });
      await get().setTrainingFrequency(trainingFrequency);
    } catch (error: any) {
      set({ error: error.message || 'Unable to update planning day' });
    }
  },

  updatePlanDayFocus: async (dayKey, focus) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const weeklyPlan = get().weeklyPlan.map((day) =>
        day.dayKey === dayKey ? { ...day, focus } : clonePlanDay(day)
      );

      await persistWeeklyPlan(user?.id, weeklyPlan);
      set({ weeklyPlan });
    } catch (error: any) {
      set({ error: error.message || 'Unable to update focus' });
    }
  },

  addPlanExercise: async (dayKey, exercise) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const nextExercise = createPlanExercise(
        exercise.name.trim(),
        exercise.targetSets || 4,
        exercise.targetReps || '8-12',
        exercise.suggestedWeight || ''
      );

      const weeklyPlan = get().weeklyPlan.map((day) =>
        day.dayKey === dayKey ? { ...day, exercises: [...day.exercises, nextExercise] } : clonePlanDay(day)
      );

      await persistWeeklyPlan(user?.id, weeklyPlan);
      set({ weeklyPlan });
    } catch (error: any) {
      set({ error: error.message || 'Unable to add exercise to plan' });
    }
  },

  updatePlanExercise: async (dayKey, exerciseId, updates) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const weeklyPlan = get().weeklyPlan.map((day) => {
        if (day.dayKey !== dayKey) {
          return clonePlanDay(day);
        }

        return {
          ...day,
          exercises: day.exercises.map((exercise) =>
            exercise.id === exerciseId ? { ...exercise, ...updates } : { ...exercise }
          ),
        };
      });

      await persistWeeklyPlan(user?.id, weeklyPlan);
      set({ weeklyPlan });
    } catch (error: any) {
      set({ error: error.message || 'Unable to update planned exercise' });
    }
  },

  removePlanExercise: async (dayKey, exerciseId) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const weeklyPlan = get().weeklyPlan.map((day) =>
        day.dayKey === dayKey
          ? { ...day, exercises: day.exercises.filter((exercise) => exercise.id !== exerciseId) }
          : clonePlanDay(day)
      );

      await persistWeeklyPlan(user?.id, weeklyPlan);
      set({ weeklyPlan });
    } catch (error: any) {
      set({ error: error.message || 'Unable to remove planned exercise' });
    }
  },

  setCurrentWorkout: (workout, templateExercises = [], startedAt = null) => {
    if (!workout) {
      set({ currentWorkout: null, currentWorkoutStartedAt: null, currentExercises: [] });
      return;
    }

    const metadata = parseWorkoutMetadata(workout.notes);
    const exercises = templateExercises.length > 0 ? templateExercises : metadata.exercises || [];

    set({
      currentWorkout: workout,
      currentWorkoutStartedAt: startedAt || new Date().toISOString(),
      currentExercises: buildExercisesFromTemplate(exercises),
    });
  },

  addExercise: (name) => {
    const newExercise: Exercise = {
      id: generateId(),
      name,
      sets: [
        {
          id: generateId(),
          setNumber: 1,
          reps: '',
          weight: '',
          completed: false,
        },
      ],
    };

    set((state) => ({ currentExercises: [...state.currentExercises, newExercise] }));
  },

  removeExercise: (exerciseId) => {
    set((state) => ({
      currentExercises: state.currentExercises.filter((exercise) => exercise.id !== exerciseId),
    }));
  },

  addSet: (exerciseId) => {
    set((state) => ({
      currentExercises: state.currentExercises.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              id: generateId(),
              setNumber: exercise.sets.length + 1,
              reps: '',
              weight: '',
              completed: false,
            },
          ],
        };
      }),
    }));
  },

  removeSet: (exerciseId, setId) => {
    set((state) => ({
      currentExercises: state.currentExercises.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        const filteredSets = exercise.sets
          .filter((setItem) => setItem.id !== setId)
          .map((setItem, index) => ({ ...setItem, setNumber: index + 1 }));

        return { ...exercise, sets: filteredSets };
      }),
    }));
  },

  updateSet: (exerciseId, setId, field, value) => {
    set((state) => ({
      currentExercises: state.currentExercises.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.map((setItem) =>
            setItem.id === setId ? { ...setItem, [field]: value } : setItem
          ),
        };
      }),
    }));
  },

  toggleSetComplete: (exerciseId, setId) => {
    set((state) => ({
      currentExercises: state.currentExercises.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.map((setItem) =>
            setItem.id === setId ? { ...setItem, completed: !setItem.completed } : setItem
          ),
        };
      }),
    }));
  },

  saveWorkoutLogs: async () => {
    const { currentWorkout, currentExercises, currentWorkoutStartedAt } = get();

    if (!currentWorkout) {
      return;
    }

    set({ loading: true, error: null });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      const logs = currentExercises.flatMap((exercise) =>
        exercise.sets
          .filter((setItem) => setItem.reps || setItem.weight || setItem.completed)
          .map((setItem) => ({
            workout_id: currentWorkout.id,
            user_id: user.id,
            exercise_name: exercise.name,
            set_number: setItem.setNumber,
            reps: setItem.reps ? parseInt(setItem.reps, 10) : null,
            weight: setItem.weight ? parseFloat(setItem.weight) : null,
            weight_unit: 'kg',
            completed: setItem.completed,
          }))
      );

      if (logs.length > 0) {
        const { error } = await supabase.from('workout_logs').insert(logs);

        if (error) {
          throw error;
        }
      }

      const durationMinutes = currentWorkoutStartedAt
        ? Math.max(1, Math.round(differenceInSeconds(new Date(), new Date(currentWorkoutStartedAt)) / 60))
        : currentWorkout.duration_minutes || 0;

      await get().completeWorkout(currentWorkout.id, durationMinutes);
      get().clearCurrentWorkout();
      await get().fetchWorkouts();
      await get().fetchWorkoutHistory();
      await get().fetchActivityLog();
    } catch (error: any) {
      set({ error: error.message || 'Unable to save workout' });
    } finally {
      set({ loading: false });
    }
  },

  clearCurrentWorkout: () => {
    set({ currentWorkout: null, currentWorkoutStartedAt: null, currentExercises: [] });
  },

  fetchActivityLog: async (days = 90) => {
    set({ loading: true, error: null });

    try {
      const startDate = subDays(new Date(), days);
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .gte('activity_date', format(startDate, 'yyyy-MM-dd'))
        .order('activity_date', { ascending: true });

      if (error) {
        throw error;
      }

      set({ activityLog: data || [] });
    } catch (error: any) {
      set({ error: error.message || 'Unable to load activity log' });
    } finally {
      set({ loading: false });
    }
  },

  getUpcomingSessions: (daysAhead = 14) => derivePlannedSessions(get().workouts, get().weeklyPlan, daysAhead),

  getSessionsForDate: (date) => get().getUpcomingSessions(21).filter((session) => session.date === date),

  getStrictStreak: () => {
    const completedDates = new Set(
      get()
        .workouts.filter((workout) => workout.status === 'completed')
        .map((workout) => workout.workout_date)
    );
    const weeklyPlan = get().weeklyPlan;

    let streak = 0;
    let cursor = startOfToday();

    for (let index = 0; index < 180; index += 1) {
      const dateIso = format(cursor, 'yyyy-MM-dd');
      const dayKey = getWeekdayKey(cursor);
      const dayPlan = weeklyPlan.find((day) => day.dayKey === dayKey);

      if (!dayPlan?.enabled) {
        cursor = subDays(cursor, 1);
        continue;
      }

      if (index === 0 && !completedDates.has(dateIso)) {
        cursor = subDays(cursor, 1);
        continue;
      }

      if (!completedDates.has(dateIso)) {
        break;
      }

      streak += 1;
      cursor = subDays(cursor, 1);
    }

    return streak;
  },
}));
