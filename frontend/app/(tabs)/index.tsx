import React, { useEffect } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuthStore } from '../../src/store/authStore';
import { usePRStore } from '../../src/store/prStore';
import { useWorkoutStore } from '../../src/store/workoutStore';
import { ActivityHeatmap } from '../../src/components/dashboard/ActivityHeatmap';
import { StreakCard } from '../../src/components/dashboard/StreakCard';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';

export default function HomeScreen() {
  const { profile, fetchProfile } = useAuthStore();
  const { records } = usePRStore();
  const {
    activityLog,
    workoutHistory,
    weeklyPlan,
    loadPlanningData,
    fetchWorkouts,
    fetchWorkoutHistory,
    fetchActivityLog,
    getSessionsForDate,
    getUpcomingSessions,
    getStrictStreak,
  } = useWorkoutStore();

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchProfile(),
        loadPlanningData(),
        fetchWorkouts(),
        fetchWorkoutHistory(),
        fetchActivityLog(),
      ]);
    };

    loadData();
  }, [fetchActivityLog, fetchProfile, fetchWorkoutHistory, fetchWorkouts, loadPlanningData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchProfile(),
      loadPlanningData(),
      fetchWorkouts(),
      fetchWorkoutHistory(),
      fetchActivityLog(),
    ]);
    setRefreshing(false);
  };

  const strictStreak = getStrictStreak();
  const activeDays = weeklyPlan.filter((day) => day.enabled).length;
  const todayDate = format(new Date(), 'yyyy-MM-dd');
  const todaySessions = getSessionsForDate(todayDate).filter((session) => session.status !== 'completed');
  const todaySession = todaySessions[0];
  const todayCompleted = workoutHistory.filter((entry) => entry.date === todayDate);
  const todaySets = todayCompleted.reduce((sum, entry) => sum + entry.totalSets, 0);
  const upcomingSessions = getUpcomingSessions(7).slice(0, 3);
  const recentWorkouts = workoutHistory.slice(0, 3);
  const recentPrs = records.slice(0, 2);
  const todayLabel = format(new Date(), 'EEEE d MMMM', { locale: fr });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10B981"
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bon retour</Text>
            <Text style={styles.username}>
              {profile?.username || profile?.email?.split('@')[0] || 'Athlete'}
            </Text>
          </View>
          <View style={styles.dateChip}>
            <Ionicons name="sparkles" size={14} color="#0F172A" />
            <Text style={styles.dateChipText}>{todayLabel}</Text>
          </View>
        </View>

        <LinearGradient
          colors={['#10B981', '#0F766E', '#111827']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Aujourd&apos;hui</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/planning')}>
              <Ionicons name="calendar-outline" size={22} color="#F8FAFC" />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroTitle}>
            {todaySession ? todaySession.name : 'Aucune séance imposée'}
          </Text>
          <Text style={styles.heroText}>
            {todaySession
              ? `${todaySession.exercises.length} exercices déjà prêts. Tu peux lancer la bonne séance sans repasser par le planning.`
              : 'Tu es libre aujourd’hui. Tu peux récupérer ou lancer une séance libre en deux taps.'}
          </Text>
          <View style={styles.heroActions}>
            <Button
              title={todaySession ? 'Démarrer maintenant' : 'Séance libre'}
              onPress={() => router.push('/(tabs)/train')}
              style={styles.heroPrimary}
              textStyle={styles.heroPrimaryText}
            />
            <Button
              title="Voir mon split"
              variant="outline"
              onPress={() => router.push('/(tabs)/planning')}
              style={styles.heroSecondary}
            />
          </View>
        </LinearGradient>

        <View style={styles.metricRow}>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Streak</Text>
            <Text style={styles.metricValue}>{strictStreak}</Text>
            <Text style={styles.metricHint}>jours valides</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Rythme</Text>
            <Text style={styles.metricValue}>{activeDays}</Text>
            <Text style={styles.metricHint}>jours actifs</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Aujourd&apos;hui</Text>
            <Text style={styles.metricValue}>{todaySets}</Text>
            <Text style={styles.metricHint}>séries loguées</Text>
          </Card>
        </View>

        <StreakCard
          currentStreak={strictStreak}
          longestStreak={profile?.longest_streak || 0}
          totalWorkouts={profile?.total_workouts || 0}
        />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cette semaine</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/planning')}>
              <Text style={styles.seeAll}>Ouvrir le planning</Text>
            </TouchableOpacity>
          </View>
          {upcomingSessions.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>Aucune séance à venir pour le moment.</Text>
            </Card>
          ) : (
            upcomingSessions.map((session, index) => (
              <Card key={session.key} style={styles.agendaCard}>
                <View style={styles.agendaIndex}>
                  <Text style={styles.agendaIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.agendaInfo}>
                  <Text style={styles.agendaTitle}>{session.name}</Text>
                  <Text style={styles.agendaMeta}>
                    {format(new Date(session.date), 'EEEE d MMM', { locale: fr })} · {session.exercises.length} exos
                  </Text>
                </View>
                <View style={[styles.agendaBadge, session.strict ? styles.strictBadge : styles.extraBadge]}>
                  <Text style={styles.agendaBadgeText}>{session.strict ? 'Strict' : 'Extra'}</Text>
                </View>
              </Card>
            ))
          )}
        </View>

        <View style={styles.section}>
          <ActivityHeatmap data={activityLog} weeks={12} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recents</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/train')}>
              <Text style={styles.seeAll}>Voir plus</Text>
            </TouchableOpacity>
          </View>

          {recentWorkouts.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>Aucune séance terminée pour le moment.</Text>
            </Card>
          ) : (
            recentWorkouts.map((workout) => (
              <Card key={workout.id} style={styles.historyCard}>
                <View style={styles.row}>
                  <View style={styles.historyIcon}>
                    <Ionicons name="barbell" size={18} color="#10B981" />
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyTitle}>{workout.name}</Text>
                    <Text style={styles.historyMeta}>
                      {format(new Date(workout.date), 'd MMM yyyy', { locale: fr })} · {workout.totalSets} séries · {workout.durationMinutes} min
                    </Text>
                    {workout.exercises.length > 0 ? (
                      <Text style={styles.historyDetail}>
                        {workout.exercises.slice(0, 3).map((exercise) => exercise.name).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PR rapides</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/records')}>
              <Text style={styles.seeAll}>Tous les PR</Text>
            </TouchableOpacity>
          </View>
          {recentPrs.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>Aucun PR enregistré pour le moment.</Text>
            </Card>
          ) : (
            recentPrs.map((record) => (
              <Card key={record.id} style={styles.prCard}>
                <View style={styles.row}>
                  <View style={styles.prIcon}>
                    <Ionicons name="trophy" size={18} color="#0F172A" />
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyTitle}>{record.exercise}</Text>
                    <Text style={styles.historyMeta}>
                      {record.value} {record.unit.toUpperCase()} · {format(new Date(record.date), 'd MMM yyyy', { locale: fr })}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 36 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  greeting: { color: '#94A3B8', fontSize: 14, marginBottom: 4 },
  username: { color: '#F8FAFC', fontSize: 28, fontWeight: '700' },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateChipText: { color: '#0F172A', fontWeight: '700', fontSize: 12 },
  hero: {
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  heroBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeText: { color: '#F8FAFC', fontWeight: '700' },
  heroTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '700', lineHeight: 32 },
  heroText: { color: '#DCFCE7', marginTop: 10, lineHeight: 20 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  heroPrimary: { flex: 1, backgroundColor: '#F8FAFC' },
  heroPrimaryText: { color: '#0F172A' },
  heroSecondary: { flex: 1, borderColor: '#E2E8F0', backgroundColor: 'rgba(255,255,255,0.06)' },
  metricRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  metricCard: { flex: 1, padding: 16 },
  metricLabel: { color: '#94A3B8', fontSize: 12, textTransform: 'uppercase' },
  metricValue: { color: '#F8FAFC', fontSize: 24, fontWeight: '700', marginTop: 6 },
  metricHint: { color: '#64748B', marginTop: 4, fontSize: 12 },
  section: { marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  seeAll: { color: '#10B981', fontWeight: '700' },
  emptyText: { color: '#64748B', lineHeight: 18 },
  agendaCard: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  agendaIndex: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaIndexText: { color: '#E2E8F0', fontWeight: '700' },
  agendaInfo: { flex: 1 },
  agendaTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  agendaMeta: { color: '#94A3B8', marginTop: 4 },
  agendaBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  strictBadge: { backgroundColor: 'rgba(16, 185, 129, 0.16)' },
  extraBadge: { backgroundColor: 'rgba(245, 158, 11, 0.16)' },
  agendaBadgeText: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center' },
  historyCard: { marginBottom: 10 },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyInfo: { flex: 1, marginLeft: 12 },
  historyTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  historyMeta: { color: '#94A3B8', marginTop: 4 },
  historyDetail: { color: '#CBD5E1', marginTop: 6, lineHeight: 18 },
  prCard: { marginBottom: 10 },
});
