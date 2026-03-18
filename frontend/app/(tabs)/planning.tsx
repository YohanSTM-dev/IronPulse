import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import {
  PlannedExercise,
  useWorkoutStore,
  WeekdayKey,
} from '../../src/store/workoutStore';

const POPULAR_EXERCISES = [
  'Bench Press',
  'Squat',
  'Deadlift',
  'Overhead Press',
  'Barbell Row',
  'Pull-up',
  'Dumbbell Curl',
  'Tricep Pushdown',
  'Leg Press',
  'Lat Pulldown',
  'Cable Fly',
  'Leg Extension',
];

export default function PlanningScreen() {
  const {
    weeklyPlan,
    trainingFrequency,
    loadPlanningData,
    fetchWorkouts,
    togglePlanDay,
    updatePlanDayFocus,
    addPlanExercise,
    updatePlanExercise,
    removePlanExercise,
    createExtraWorkout,
    shiftWorkoutDate,
    getUpcomingSessions,
    getStrictStreak,
    loading,
  } = useWorkoutStore();

  const [selectedDayKey, setSelectedDayKey] = useState<WeekdayKey>('monday');
  const [focusDraft, setFocusDraft] = useState('');
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState<PlannedExercise | null>(null);
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseSets, setExerciseSets] = useState('4');
  const [exerciseReps, setExerciseReps] = useState('8-12');
  const [exerciseWeight, setExerciseWeight] = useState('');
  const [extraName, setExtraName] = useState('');
  const [extraDate, setExtraDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([loadPlanningData(), fetchWorkouts()]);
    };

    loadData();
  }, [fetchWorkouts, loadPlanningData]);

  useEffect(() => {
    if (!weeklyPlan.length) {
      return;
    }

    const selectedExists = weeklyPlan.some((day) => day.dayKey === selectedDayKey);
    if (!selectedExists) {
      const firstEnabled = weeklyPlan.find((day) => day.enabled) || weeklyPlan[0];
      setSelectedDayKey(firstEnabled.dayKey);
      return;
    }

    const selectedDay = weeklyPlan.find((day) => day.dayKey === selectedDayKey);
    setFocusDraft(selectedDay?.focus || '');
  }, [selectedDayKey, weeklyPlan]);

  const selectedDay = weeklyPlan.find((day) => day.dayKey === selectedDayKey) || weeklyPlan[0];
  const strictStreak = getStrictStreak();
  const upcomingSessions = getUpcomingSessions(10);
  const nextSession = upcomingSessions[0];
  const selectedTotalSets = selectedDay?.exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0) || 0;
  const nextSevenDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(new Date(), index)),
    []
  );

  const handleSaveFocus = async () => {
    if (!selectedDay) {
      return;
    }

    if (focusDraft.trim() !== selectedDay.focus) {
      await updatePlanDayFocus(selectedDay.dayKey, focusDraft.trim());
    }
  };

  const openExerciseModal = (exercise?: PlannedExercise) => {
    setEditingExercise(exercise || null);
    setExerciseName(exercise?.name || '');
    setExerciseSets(String(exercise?.targetSets || 4));
    setExerciseReps(exercise?.targetReps || '8-12');
    setExerciseWeight(exercise?.suggestedWeight || '');
    setShowExerciseModal(true);
  };

  const handleSaveExercise = async (quickName?: string) => {
    if (!selectedDay) {
      return;
    }

    const nextName = (quickName || exerciseName).trim();
    if (!nextName) {
      Alert.alert('Planning', 'Ajoute un nom d’exercice.');
      return;
    }

    const payload = {
      name: nextName,
      targetSets: Math.max(1, Number(exerciseSets) || 4),
      targetReps: exerciseReps.trim() || '8-12',
      suggestedWeight: exerciseWeight.trim(),
    };

    if (editingExercise) {
      await updatePlanExercise(selectedDay.dayKey, editingExercise.id, payload);
    } else {
      await addPlanExercise(selectedDay.dayKey, payload);
    }

    setShowExerciseModal(false);
    setEditingExercise(null);
    setExerciseName('');
  };

  const handleCreateExtraWorkout = async () => {
    if (!extraName.trim()) {
      Alert.alert('Planning', 'Ajoute un nom pour la séance extra.');
      return;
    }

    await createExtraWorkout(extraDate, extraName.trim());
    setExtraName('');
    await fetchWorkouts();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Planning</Text>
        <Text style={styles.subtitle}>
          Un seul endroit pour ton rythme hebdo, ton split et les séances extras.
        </Text>

        <LinearGradient
          colors={['#1D4ED8', '#0F766E', '#111827']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.overview}
        >
          <View style={styles.overviewTop}>
            <View style={styles.overviewMetric}>
              <Text style={styles.overviewLabel}>Rythme</Text>
              <Text style={styles.overviewValue}>{trainingFrequency} jours</Text>
            </View>
            <View style={styles.overviewMetric}>
              <Text style={styles.overviewLabel}>Streak stricte</Text>
              <Text style={styles.overviewValue}>{strictStreak} jours</Text>
            </View>
          </View>
          <View style={styles.overviewFocus}>
            <Text style={styles.overviewCaption}>Prochaine séance</Text>
            <Text style={styles.overviewTitle}>
              {nextSession ? nextSession.name : 'Aucune séance prévue'}
            </Text>
            <Text style={styles.overviewText}>
              {nextSession
                ? `${format(new Date(nextSession.date), 'EEEE d MMMM', { locale: fr })} · ${nextSession.exercises.length} exos`
                : 'Active tes jours de salle puis ajoute ton split.'}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Semaine type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRail}>
            {weeklyPlan.map((day) => {
              const selected = day.dayKey === selectedDayKey;
              return (
                <TouchableOpacity
                  key={day.dayKey}
                  style={[styles.dayPill, selected && styles.dayPillSelected]}
                  onPress={() => setSelectedDayKey(day.dayKey)}
                >
                  <Text style={[styles.dayPillName, selected && styles.dayPillNameSelected]}>
                    {day.label.slice(0, 3)}
                  </Text>
                  <Text style={[styles.dayPillMeta, selected && styles.dayPillMetaSelected]}>
                    {day.enabled ? `${day.exercises.length} exos` : 'Off'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {selectedDay ? (
          <Card style={styles.editorCard}>
            <View style={styles.editorHeader}>
              <View>
                <Text style={styles.editorTitle}>{selectedDay.label}</Text>
                <Text style={styles.editorSubtitle}>
                  {selectedDay.enabled ? 'Routine active' : 'Jour de repos'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.stateChip, selectedDay.enabled && styles.stateChipActive]}
                onPress={() => togglePlanDay(selectedDay.dayKey)}
              >
                <Text style={[styles.stateChipText, selectedDay.enabled && styles.stateChipTextActive]}>
                  {selectedDay.enabled ? 'Actif' : 'Off'}
                </Text>
              </TouchableOpacity>
            </View>

            {selectedDay.enabled ? (
              <>
                <TextInput
                  style={styles.focusInput}
                  placeholder="Ex. Pecs / Epaules / Triceps"
                  placeholderTextColor="#64748B"
                  value={focusDraft}
                  onChangeText={setFocusDraft}
                  onBlur={handleSaveFocus}
                />

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{selectedDay.exercises.length}</Text>
                    <Text style={styles.statLabel}>Exercices</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{selectedTotalSets}</Text>
                    <Text style={styles.statLabel}>Séries cibles</Text>
                  </View>
                </View>

                {selectedDay.exercises.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="barbell-outline" size={22} color="#64748B" />
                    <Text style={styles.emptyText}>
                      Ajoute tes exercices une bonne fois et l&apos;app préparera ta séance du jour.
                    </Text>
                  </View>
                ) : (
                  selectedDay.exercises.map((exercise) => (
                    <TouchableOpacity
                      key={exercise.id}
                      style={styles.exerciseRow}
                      activeOpacity={0.9}
                      onPress={() => openExerciseModal(exercise)}
                    >
                      <View style={styles.exerciseIcon}>
                        <Ionicons name="fitness-outline" size={16} color="#10B981" />
                      </View>
                      <View style={styles.exerciseInfo}>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <Text style={styles.exerciseMeta}>
                          {exercise.targetSets} séries · {exercise.targetReps} reps
                          {exercise.suggestedWeight ? ` · ${exercise.suggestedWeight}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removePlanExercise(selectedDay.dayKey, exercise.id)}
                        style={styles.removeButton}
                      >
                        <Ionicons name="trash-outline" size={16} color="#F87171" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )}

                <TouchableOpacity style={styles.addButton} onPress={() => openExerciseModal()}>
                  <Ionicons name="add-circle-outline" size={20} color="#10B981" />
                  <Text style={styles.addButtonText}>Ajouter un exercice</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.offState}>
                <Text style={styles.offTitle}>Jour libre</Text>
                <Text style={styles.offText}>
                  Active ce jour si tu veux qu&apos;il compte dans ton rythme et dans ta streak stricte.
                </Text>
                <Button title="Activer ce jour" onPress={() => togglePlanDay(selectedDay.dayKey)} />
              </View>
            )}
          </Card>
        ) : null}

        <Card style={styles.extraCard}>
          <Text style={styles.sectionTitle}>Séance extra</Text>
          <Text style={styles.sectionHint}>
            Une séance ponctuelle dans la semaine, sans toucher au split fixe.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.extraRail}>
            {nextSevenDays.map((day) => {
              const value = format(day, 'yyyy-MM-dd');
              const selected = value === extraDate;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.extraPill, selected && styles.extraPillSelected]}
                  onPress={() => setExtraDate(value)}
                >
                  <Text style={[styles.extraPillName, selected && styles.extraPillNameSelected]}>
                    {format(day, 'EEE', { locale: fr })}
                  </Text>
                  <Text style={[styles.extraPillMeta, selected && styles.extraPillMetaSelected]}>
                    {format(day, 'd MMM', { locale: fr })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TextInput
            style={styles.focusInput}
            placeholder="Ex. Bras, cardio, séance récup"
            placeholderTextColor="#64748B"
            value={extraName}
            onChangeText={setExtraName}
          />
          <Button title="Ajouter au planning" onPress={handleCreateExtraWorkout} loading={loading} />
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prochaines séances</Text>
          {upcomingSessions.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>Aucune séance planifiée pour les prochains jours.</Text>
            </Card>
          ) : (
            upcomingSessions.map((session) => (
              <Card key={session.key} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionLeft}>
                    <Text style={styles.sessionName}>{session.name}</Text>
                    <Text style={styles.sessionMeta}>
                      {format(new Date(session.date), 'EEEE d MMM', { locale: fr })} · {session.exercises.length} exos
                    </Text>
                  </View>
                  <View style={[styles.sessionBadge, session.strict ? styles.sessionBadgeStrict : styles.sessionBadgeExtra]}>
                    <Text style={styles.sessionBadgeText}>{session.strict ? 'Strict' : 'Extra'}</Text>
                  </View>
                </View>
                {session.source === 'extra' && session.workoutId && session.status === 'planned' ? (
                  <View style={styles.sessionActions}>
                    <TouchableOpacity
                      style={styles.shiftButton}
                      onPress={() => shiftWorkoutDate(session.workoutId!, -1)}
                    >
                      <Ionicons name="chevron-back" size={18} color="#CBD5E1" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.shiftButton}
                      onPress={() => shiftWorkoutDate(session.workoutId!, 1)}
                    >
                      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showExerciseModal} animationType="slide" transparent onRequestClose={() => setShowExerciseModal(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingExercise ? 'Modifier l’exercice' : 'Ajouter un exercice'}
              </Text>
              <TouchableOpacity onPress={() => setShowExerciseModal(false)}>
                <Ionicons name="close" size={24} color="#F8FAFC" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.focusInput}
              placeholder="Nom de l’exercice"
              placeholderTextColor="#64748B"
              value={exerciseName}
              onChangeText={setExerciseName}
            />

            <View style={styles.modalInputs}>
              <TextInput
                style={styles.modalInput}
                placeholder="Séries"
                placeholderTextColor="#64748B"
                value={exerciseSets}
                onChangeText={setExerciseSets}
                keyboardType="numeric"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Reps"
                placeholderTextColor="#64748B"
                value={exerciseReps}
                onChangeText={setExerciseReps}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Charge"
                placeholderTextColor="#64748B"
                value={exerciseWeight}
                onChangeText={setExerciseWeight}
              />
            </View>

            <Button title={editingExercise ? 'Sauvegarder' : 'Ajouter'} onPress={() => handleSaveExercise()} />

            {!editingExercise ? (
              <>
                <Text style={styles.quickTitle}>Ajouts rapides</Text>
                <ScrollView style={styles.quickList}>
                  {POPULAR_EXERCISES.map((item) => (
                    <TouchableOpacity key={item} style={styles.quickItem} onPress={() => handleSaveExercise(item)}>
                      <Ionicons name="barbell-outline" size={18} color="#10B981" />
                      <Text style={styles.quickItemText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  title: { color: '#F8FAFC', fontSize: 28, fontWeight: '700' },
  subtitle: { color: '#94A3B8', marginTop: 6, marginBottom: 16, lineHeight: 20 },
  overview: { borderRadius: 28, padding: 20, marginBottom: 18 },
  overviewTop: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  overviewMetric: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    padding: 14,
  },
  overviewLabel: { color: '#BFDBFE', fontSize: 12, textTransform: 'uppercase' },
  overviewValue: { color: '#F8FAFC', fontSize: 22, fontWeight: '700', marginTop: 6 },
  overviewFocus: { gap: 6 },
  overviewCaption: { color: '#BFDBFE', fontWeight: '700' },
  overviewTitle: { color: '#F8FAFC', fontSize: 24, fontWeight: '700' },
  overviewText: { color: '#E0F2FE', lineHeight: 20 },
  section: { marginBottom: 18 },
  sectionTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  dayRail: { gap: 10, paddingRight: 8 },
  dayPill: {
    width: 92,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#223247',
  },
  dayPillSelected: {
    backgroundColor: '#163147',
    borderColor: '#38BDF8',
  },
  dayPillName: { color: '#F8FAFC', fontWeight: '700', fontSize: 16 },
  dayPillNameSelected: { color: '#E0F2FE' },
  dayPillMeta: { color: '#64748B', marginTop: 6, fontSize: 12 },
  dayPillMetaSelected: { color: '#93C5FD' },
  editorCard: { marginBottom: 18 },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  editorTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  editorSubtitle: { color: '#94A3B8', marginTop: 4 },
  stateChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  stateChipActive: {
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderColor: '#10B981',
  },
  stateChipText: { color: '#CBD5E1', fontWeight: '700' },
  stateChipTextActive: { color: '#10B981' },
  focusInput: {
    backgroundColor: '#0B1220',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#233046',
    marginBottom: 12,
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statBox: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    padding: 14,
    borderWidth: 1,
    borderColor: '#223247',
  },
  statValue: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#64748B', marginTop: 4 },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  emptyText: { color: '#64748B', textAlign: 'center', lineHeight: 18 },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#223247',
  },
  exerciseIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseInfo: { flex: 1 },
  exerciseName: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  exerciseMeta: { color: '#94A3B8', marginTop: 4 },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(248,113,113,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
  },
  addButtonText: { color: '#10B981', fontWeight: '700' },
  offState: { gap: 12 },
  offTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  offText: { color: '#94A3B8', lineHeight: 20 },
  extraCard: { marginBottom: 18 },
  sectionHint: { color: '#94A3B8', marginBottom: 12, lineHeight: 18 },
  extraRail: { gap: 8, paddingRight: 8, marginBottom: 12 },
  extraPill: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#233046',
  },
  extraPillSelected: {
    backgroundColor: '#1D4ED8',
    borderColor: '#60A5FA',
  },
  extraPillName: { color: '#CBD5E1', fontWeight: '700', textTransform: 'capitalize' },
  extraPillMeta: { color: '#64748B', marginTop: 4, fontSize: 12 },
  extraPillNameSelected: { color: '#F8FAFC' },
  extraPillMetaSelected: { color: '#DBEAFE' },
  sessionCard: { marginBottom: 10 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  sessionLeft: { flex: 1 },
  sessionName: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  sessionMeta: { color: '#94A3B8', marginTop: 4 },
  sessionBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  sessionBadgeStrict: { backgroundColor: 'rgba(16,185,129,0.14)' },
  sessionBadgeExtra: { backgroundColor: 'rgba(245,158,11,0.14)' },
  sessionBadgeText: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  sessionActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  shiftButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#131C2E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '82%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700' },
  modalInputs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modalInput: {
    flex: 1,
    backgroundColor: '#0B1220',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 14,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#233046',
  },
  quickTitle: { color: '#94A3B8', fontWeight: '700', marginTop: 18, marginBottom: 12 },
  quickList: { maxHeight: 260 },
  quickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#233046',
  },
  quickItemText: { color: '#F8FAFC', fontSize: 15 },
});
