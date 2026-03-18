import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';

interface Set {
  id: string;
  setNumber: number;
  reps: string;
  weight: string;
  completed: boolean;
}

interface ExerciseCardProps {
  name: string;
  sets: Set[];
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onUpdateSet: (setId: string, field: 'reps' | 'weight', value: string) => void;
  onToggleComplete: (setId: string) => void;
  onRemoveExercise: () => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  name,
  sets,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
  onToggleComplete,
  onRemoveExercise,
}) => {
  const completedSets = sets.filter((setItem) => setItem.completed).length;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.exerciseName}>{name}</Text>
          <Text style={styles.exerciseMeta}>
            {completedSets}/{sets.length} series validees
          </Text>
        </View>
        <TouchableOpacity onPress={onRemoveExercise} style={styles.removeBtn}>
          <Ionicons name="trash-outline" size={18} color="#F87171" />
        </TouchableOpacity>
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendText}>Serie</Text>
        <Text style={styles.legendText}>Kg</Text>
        <Text style={styles.legendText}>Reps</Text>
        <Text style={styles.legendText}>OK</Text>
      </View>

      {sets.map((setItem) => (
        <View key={setItem.id} style={[styles.setRow, setItem.completed && styles.setRowCompleted]}>
          <View style={styles.setBadge}>
            <Text style={styles.setBadgeText}>S{setItem.setNumber}</Text>
          </View>

          <TextInput
            style={styles.input}
            value={setItem.weight}
            onChangeText={(value) => onUpdateSet(setItem.id, 'weight', value)}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#64748B"
          />

          <TextInput
            style={styles.input}
            value={setItem.reps}
            onChangeText={(value) => onUpdateSet(setItem.id, 'reps', value)}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#64748B"
          />

          <TouchableOpacity
            style={[styles.checkBtn, setItem.completed && styles.checkBtnActive]}
            onPress={() => onToggleComplete(setItem.id)}
          >
            <Ionicons
              name="checkmark"
              size={18}
              color={setItem.completed ? '#0F172A' : '#94A3B8'}
            />
          </TouchableOpacity>

          {sets.length > 1 ? (
            <TouchableOpacity style={styles.deleteSetBtn} onPress={() => onRemoveSet(setItem.id)}>
              <Ionicons name="remove" size={16} color="#CBD5E1" />
            </TouchableOpacity>
          ) : null}
        </View>
      ))}

      <TouchableOpacity style={styles.addSetBtn} onPress={onAddSet}>
        <Ionicons name="add-circle-outline" size={18} color="#10B981" />
        <Text style={styles.addSetText}>Ajouter une serie</Text>
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerCopy: {
    flex: 1,
  },
  exerciseName: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  exerciseMeta: {
    color: '#94A3B8',
    marginTop: 4,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  legendText: {
    flex: 1,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  setRowCompleted: {
    opacity: 0.95,
  },
  setBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  setBadgeText: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  input: {
    flex: 1,
    backgroundColor: '#0B1220',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#233046',
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#F8FAFC',
    textAlign: 'center',
  },
  checkBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  deleteSetBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#172234',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#223247',
  },
  addSetText: {
    color: '#10B981',
    fontWeight: '700',
  },
});
