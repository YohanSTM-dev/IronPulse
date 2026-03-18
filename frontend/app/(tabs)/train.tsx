import React, { useEffect, useState } from 'react';
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
import { router } from 'expo-router';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { ExerciseCard } from '../../src/components/workout/ExerciseCard';
import { useWorkoutStore } from '../../src/store/workoutStore';

const META_PREFIX = '__IRONPULSE_META__';

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

const parseSource = (notes: string | null): 'template' | 'extra' | 'free' | null => {
  if (!notes || !notes.startsWith(META_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(notes.slice(META_PREFIX.length)) as {
      source?: 'template' | 'extra' | 'free';
    };
    return parsed.source || null;
  } catch {
    return null;
  }
};

const formatElapsed = (startedAt: string | null) => {
  if (!startedAt) {
    return '00:00';
  }

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  );
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

export default function TrainScreen() {
  const {
    currentWorkout,
    currentWorkoutStartedAt,
    currentExercises,
    workoutHistory,
    loadPlanningData,
    fetchWorkouts,
    fetchWorkoutHistory,
    getSessionsForDate,
    startWorkoutFromPlan,
    startFreeWorkout,
    updateWorkout,
    deleteWorkout,
    addExercise,
    removeExercise,
    addSet,
    removeSet,
    updateSet,
    toggleSetComplete,
    saveWorkoutLogs,
    clearCurrentWorkout,
    loading,
  } = useWorkoutStore();

  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [customExercise, setCustomExercise] = useState('');
  const [freeWorkoutName, setFreeWorkoutName] = useState('');
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([loadPlanningData(), fetchWorkouts(), fetchWorkoutHistory()]);
    };

    loadData();
  }, [fetchWorkoutHistory, fetchWorkouts, loadPlanningData]);

  useEffect(() => {
    setElapsed(formatElapsed(currentWorkoutStartedAt));

    if (!currentWorkoutStartedAt) {
      return;
    }

    const timer = setInterval(() => {
      setElapsed(formatElapsed(currentWorkoutStartedAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [currentWorkoutStartedAt]);

  const todayDate = format(new Date(), 'yyyy-MM-dd');
  const todaySessions = getSessionsForDate(todayDate).filter((session) => session.status !== 'completed');
  const firstSession = todaySessions[0];
  const lastWorkout = workoutHistory[0];
  const totalSets = currentExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const completedSets = currentExercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((setItem) => setItem.completed).length,
    0
  );
  const source = currentWorkout ? parseSource(currentWorkout.notes) : null;

  const handleStartFreeWorkout = async () => {
    if (!freeWorkoutName.trim()) {
      Alert.alert('Entrainement', 'Ajoute un nom de séance.');
      return;
    }

    const workout = await startFreeWorkout(freeWorkoutName.trim());
    if (workout) {
      setShowStartModal(false);
      setFreeWorkoutName('');
    }
  };

  const handleAddExercise = (name: string) => {
    const nextName = name.trim();
    if (!nextName) {
      return;
    }

    addExercise(nextName);
    setCustomExercise('');
    setShowExerciseModal(false);
  };

  const handleCancelWorkout = () => {
    if (!currentWorkout) {
      return;
    }

    Alert.alert(
      'Annuler la séance',
      'Tu veux vraiment quitter cette séance ?',
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Annuler',
          style: 'destructive',
          onPress: async () => {
            if (source === 'extra') {
              await updateWorkout(currentWorkout.id, { status: 'planned' });
            } else {
              await deleteWorkout(currentWorkout.id);
            }

            clearCurrentWorkout();
            await fetchWorkouts();
          },
        },
      ]
    );
  };

  const handleFinishWorkout = () => {
    if (currentExercises.length === 0) {
      Alert.alert('Entrainement', 'Ajoute au moins un exercice avant de terminer.');
      return;
    }

    Alert.alert(
      'Terminer la séance',
      'Confirmer la fin de la séance ?',
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Terminer',
          onPress: async () => {
            await saveWorkoutLogs();
          },
        },
      ]
    );
  };

  if (!currentWorkout) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Entrainement</Text>
          <Text style={styles.subtitle}>
            Lance ta séance du jour ou démarre une séance libre sans te perdre.
          </Text>

          <LinearGradient
            colors={['#10B981', '#0F766E', '#111827']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.heroLabel}>Séance du jour</Text>
            <Text style={styles.heroTitle}>
              {firstSession ? firstSession.name : 'Aucune séance prévue'}
            </Text>
            <Text style={styles.heroText}>
              {firstSession
                ? `${firstSession.exercises.length} exercices préparés. Tu récupères directement le bon split.`
                : 'Aucune routine imposée aujourd’hui. Tu peux improviser une séance libre.'}
            </Text>
            <View style={styles.heroActions}>
              {firstSession ? (
                <Button
                  title={firstSession.status === 'in_progress' ? 'Reprendre' : 'Démarrer'}
                  onPress={() => startWorkoutFromPlan(firstSession)}
                  style={styles.heroPrimary}
                  textStyle={styles.heroPrimaryText}
                />
              ) : (
                <Button
                  title="Séance libre"
                  onPress={() => setShowStartModal(true)}
                  style={styles.heroPrimary}
                  textStyle={styles.heroPrimaryText}
                />
              )}
              <Button
                title="Voir mon planning"
                variant="outline"
                onPress={() => router.push('/(tabs)/planning')}
                style={styles.heroSecondary}
              />
            </View>
          </LinearGradient>

          {todaySessions.length > 1 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Autres options aujourd&apos;hui</Text>
              {todaySessions.slice(1).map((session) => (
                <Card key={session.key} style={styles.optionCard}>
                  <View style={styles.optionRow}>
                    <View style={styles.optionIcon}>
                      <Ionicons name="flash-outline" size={18} color="#38BDF8" />
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionTitle}>{session.name}</Text>
                      <Text style={styles.optionMeta}>{session.exercises.length} exercices prêts</Text>
                    </View>
                  </View>
                  <Button title="Choisir cette séance" onPress={() => startWorkoutFromPlan(session)} variant="outline" />
                </Card>
              ))}
            </View>
          ) : null}

          <Card style={styles.freeCard}>
            <Text style={styles.sectionTitle}>Séance libre</Text>
            <Text style={styles.sectionHint}>
              Parfaite si tu improvises, changes d&apos;objectif ou veux ajouter du volume.
            </Text>
            <Button title="Créer une séance libre" onPress={() => setShowStartModal(true)} variant="outline" />
          </Card>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dernière séance</Text>
            {lastWorkout ? (
              <Card>
                <Text style={styles.historyTitle}>{lastWorkout.name}</Text>
                <Text style={styles.historyMeta}>
                  {format(new Date(lastWorkout.date), 'd MMM yyyy', { locale: fr })} · {lastWorkout.totalSets} séries · {lastWorkout.durationMinutes} min
                </Text>
                {lastWorkout.exercises.length > 0 ? (
                  <Text style={styles.historyDetail}>
                    {lastWorkout.exercises.slice(0, 3).map((exercise) => exercise.name).join(' · ')}
                  </Text>
                ) : null}
              </Card>
            ) : (
              <Card>
                <Text style={styles.emptyText}>Tes dernières stats apparaîtront ici.</Text>
              </Card>
            )}
          </View>
        </ScrollView>

        <Modal visible={showStartModal} animationType="slide" transparent onRequestClose={() => setShowStartModal(false)}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouvelle séance libre</Text>
                <TouchableOpacity onPress={() => setShowStartModal(false)}>
                  <Ionicons name="close" size={24} color="#F8FAFC" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Ex. Full body, cardio, haut du corps"
                placeholderTextColor="#64748B"
                value={freeWorkoutName}
                onChangeText={setFreeWorkoutName}
              />

              <Button title="Commencer" onPress={handleStartFreeWorkout} loading={loading} />
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#111827', '#0F766E', '#10B981']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.activeHero}
      >
        <View style={styles.activeTop}>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>
              {source === 'template' ? 'Routine du jour' : source === 'extra' ? 'Séance extra' : 'Libre'}
            </Text>
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelWorkout}>
            <Ionicons name="close" size={20} color="#F8FAFC" />
          </TouchableOpacity>
        </View>
        <Text style={styles.activeTitle}>{currentWorkout.name}</Text>
        <Text style={styles.activeSubtitle}>Chrono {elapsed}</Text>

        <View style={styles.activeStats}>
          <View style={styles.activeStatBox}>
            <Text style={styles.activeStatValue}>{completedSets}/{totalSets}</Text>
            <Text style={styles.activeStatLabel}>Séries cochées</Text>
          </View>
          <View style={styles.activeStatBox}>
            <Text style={styles.activeStatValue}>{currentExercises.length}</Text>
            <Text style={styles.activeStatLabel}>Exercices</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.activeContent}
        showsVerticalScrollIndicator={false}
      >
        {currentExercises.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Ta séance est prête à être construite</Text>
            <Text style={styles.emptyText}>
              Ajoute tes exercices pour garder un vrai historique de reps, charge et durée.
            </Text>
          </Card>
        ) : null}

        {currentExercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            name={exercise.name}
            sets={exercise.sets}
            onAddSet={() => addSet(exercise.id)}
            onRemoveSet={(setId) => removeSet(exercise.id, setId)}
            onUpdateSet={(setId, field, value) => updateSet(exercise.id, setId, field, value)}
            onToggleComplete={(setId) => toggleSetComplete(exercise.id, setId)}
            onRemoveExercise={() => removeExercise(exercise.id)}
          />
        ))}

        <TouchableOpacity style={styles.addExerciseButton} onPress={() => setShowExerciseModal(true)}>
          <Ionicons name="add-circle-outline" size={20} color="#10B981" />
          <Text style={styles.addExerciseText}>Ajouter un exercice</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Terminer la séance" onPress={handleFinishWorkout} loading={loading} size="lg" />
      </View>

      <Modal visible={showExerciseModal} animationType="slide" transparent onRequestClose={() => setShowExerciseModal(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalContent, styles.exerciseModalContent]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter un exercice</Text>
              <TouchableOpacity onPress={() => setShowExerciseModal(false)}>
                <Ionicons name="close" size={24} color="#F8FAFC" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Nom de l’exercice"
              placeholderTextColor="#64748B"
              value={customExercise}
              onChangeText={setCustomExercise}
            />
            <Button title="Ajouter cet exercice" onPress={() => handleAddExercise(customExercise)} />

            <Text style={styles.quickTitle}>Ajouts rapides</Text>
            <ScrollView style={styles.quickList}>
              {POPULAR_EXERCISES.map((exercise) => (
                <TouchableOpacity key={exercise} style={styles.quickItem} onPress={() => handleAddExercise(exercise)}>
                  <Ionicons name="barbell-outline" size={18} color="#10B981" />
                  <Text style={styles.quickItemText}>{exercise}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 36 },
  title: { color: '#F8FAFC', fontSize: 28, fontWeight: '700' },
  subtitle: { color: '#94A3B8', marginTop: 6, marginBottom: 16, lineHeight: 20 },
  hero: { borderRadius: 28, padding: 20, marginBottom: 16 },
  heroLabel: { color: '#D1FAE5', fontWeight: '700', marginBottom: 8 },
  heroTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '700', lineHeight: 32 },
  heroText: { color: '#DCFCE7', marginTop: 10, lineHeight: 20 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  heroPrimary: { flex: 1, backgroundColor: '#F8FAFC' },
  heroPrimaryText: { color: '#0F172A' },
  heroSecondary: { flex: 1, borderColor: '#E2E8F0', backgroundColor: 'rgba(255,255,255,0.06)' },
  section: { marginBottom: 16 },
  sectionTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  sectionHint: { color: '#94A3B8', lineHeight: 18, marginBottom: 12 },
  optionCard: { marginBottom: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionInfo: { flex: 1, marginLeft: 12 },
  optionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  optionMeta: { color: '#94A3B8', marginTop: 4 },
  freeCard: { marginBottom: 16 },
  historyTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  historyMeta: { color: '#94A3B8', marginTop: 4 },
  historyDetail: { color: '#CBD5E1', marginTop: 6, lineHeight: 18 },
  emptyText: { color: '#64748B', lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#131C2E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },
  exerciseModalContent: { maxHeight: '82%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700' },
  input: {
    backgroundColor: '#0B1220',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#233046',
    marginBottom: 12,
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
  activeHero: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  activeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  activeBadge: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  activeBadgeText: { color: '#F8FAFC', fontWeight: '700' },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTitle: { color: '#F8FAFC', fontSize: 28, fontWeight: '700' },
  activeSubtitle: { color: '#D1FAE5', fontSize: 16, marginTop: 6 },
  activeStats: { flexDirection: 'row', gap: 10, marginTop: 18 },
  activeStatBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    padding: 14,
  },
  activeStatValue: { color: '#F8FAFC', fontSize: 24, fontWeight: '700' },
  activeStatLabel: { color: '#D1FAE5', marginTop: 4, fontSize: 12 },
  activeContent: { padding: 16, paddingBottom: 36 },
  emptyCard: { marginBottom: 16, alignItems: 'center' },
  emptyTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  addExerciseText: { color: '#10B981', fontWeight: '700' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#1E293B', backgroundColor: '#0B1220' },
});
