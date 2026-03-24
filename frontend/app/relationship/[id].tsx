import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import api from '../../src/services/api';
import { LineChart } from 'react-native-gifted-charts';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface Relationship {
  id: string;
  person_name: string;
  relationship_type: string | null;
  created_at: string;
  phase2_completed: boolean;
  latest_compatibility: number | null;
  monitoring_active: boolean;
}

interface Phase2Data {
  id: string;
  area_scores: Record<string, number>;
  initial_compatibility: number | null;
  awareness_plan: {
    harmony_areas: Array<{ area: string; score: number }>;
    observe_areas: Array<{ area: string; score: number }>;
  } | null;
}

interface MonitoringEntry {
  id: string;
  compatibility: number;
  created_at: string;
}

const screenWidth = Dimensions.get('window').width;

const RELATIONSHIP_TYPES = [
  'Partner',
  'Familiare',
  'Amico/a',
  'Collega',
  'Altro',
];

export default function RelationshipDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [phase2Data, setPhase2Data] = useState<Phase2Data | null>(null);
  const [monitoringHistory, setMonitoringHistory] = useState<MonitoringEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [relRes, phase2Res, monitoringRes] = await Promise.all([
        api.get('/relationships'),
        api.get(`/phase2/${id}`).catch(() => ({ data: null })),
        api.get(`/monitoring/${id}`).catch(() => ({ data: [] })),
      ]);
      
      const rel = relRes.data.find((r: Relationship) => r.id === id);
      setRelationship(rel || null);
      setPhase2Data(phase2Res.data);
      setMonitoringHistory(monitoringRes.data || []);
      
      if (rel) {
        setEditName(rel.person_name);
        setEditType(rel.relationship_type || '');
      }
    } catch (error) {
      console.error('Error fetching relationship data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [id])
  );

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Errore', 'Il nome è obbligatorio');
      return;
    }

    setIsSaving(true);
    try {
      await api.put(`/relationships/${id}`, {
        person_name: editName.trim(),
        relationship_type: editType || null,
      });
      setEditModalVisible(false);
      fetchData();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile salvare le modifiche');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Elimina relazione',
      `Sei sicuro di voler eliminare la relazione con ${relationship?.person_name}? Tutti i dati associati verranno persi.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/relationships/${id}`);
              router.replace('/(tabs)/relationships');
            } catch (error) {
              Alert.alert('Errore', 'Errore durante l\'eliminazione');
            }
          },
        },
      ]
    );
  };

  const handleRedoPhase2 = () => {
    Alert.alert(
      'Aggiorna analisi',
      'Vuoi rifare l\'analisi della relazione? Le risposte precedenti verranno sostituite e l\'indice di compatibilità sarà aggiornato.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Aggiorna',
          onPress: async () => {
            try {
              await api.delete(`/phase2/${id}/reset`);
              router.push(`/phase2/${id}`);
            } catch (error) {
              Alert.alert('Errore', 'Impossibile resettare l\'analisi');
            }
          },
        },
      ]
    );
  };

  const getChartData = () => {
    const sortedHistory = [...monitoringHistory].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const data = [];
    if (phase2Data?.initial_compatibility) {
      data.push({
        value: phase2Data.initial_compatibility,
        label: 'Inizio',
      });
    }

    sortedHistory.forEach((entry) => {
      data.push({
        value: entry.compatibility,
        label: format(new Date(entry.created_at), 'dd/MM', { locale: it }),
      });
    });

    return data;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!relationship) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Relazione non trovata</Text>
        </View>
      </SafeAreaView>
    );
  }

  const chartData = getChartData();
  const currentCompatibility = relationship.latest_compatibility || phase2Data?.initial_compatibility;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{relationship.person_name}</Text>
        <TouchableOpacity style={styles.editButton} onPress={() => setEditModalVisible(true)}>
          <Ionicons name="pencil-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Relationship Info */}
        <View style={styles.infoCard}>
          <View style={styles.avatarLarge}>
            <Ionicons name="person" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.personName}>{relationship.person_name}</Text>
          {relationship.relationship_type && (
            <Text style={styles.relationType}>{relationship.relationship_type}</Text>
          )}
          <Text style={styles.createdAt}>
            Aggiunto il {format(new Date(relationship.created_at), "d MMMM yyyy", { locale: it })}
          </Text>
          
          {/* Edit button inline */}
          <TouchableOpacity 
            style={styles.editInlineButton}
            onPress={() => setEditModalVisible(true)}
          >
            <Ionicons name="pencil" size={14} color={Colors.primary} />
            <Text style={styles.editInlineText}>Modifica dati</Text>
          </TouchableOpacity>
        </View>

        {/* Compatibility Score */}
        {currentCompatibility !== null && currentCompatibility !== undefined && (
          <View style={styles.compatibilityCard}>
            <Text style={styles.compatibilityLabel}>Indice di Compatibilità</Text>
            <Text style={styles.compatibilityValue}>
              {Math.round(currentCompatibility)}%
            </Text>
            {relationship.monitoring_active && (
              <View style={styles.monitoringBadge}>
                <Ionicons name="pulse" size={14} color={Colors.primary} />
                <Text style={styles.monitoringBadgeText}>Monitoraggio attivo</Text>
              </View>
            )}
          </View>
        )}

        {/* Micro copy for updating */}
        {phase2Data?.initial_compatibility && (
          <View style={styles.updateHintCard}>
            <Ionicons name="refresh-outline" size={20} color={Colors.textLight} />
            <Text style={styles.updateHintText}>
              Puoi aggiornare questo profilo se la tua percezione cambia nel tempo
            </Text>
          </View>
        )}

        {/* Chart */}
        {chartData.length > 1 && (
          <View style={styles.chartContainer}>
            <Text style={styles.sectionTitle}>Evoluzione</Text>
            <View style={styles.chartWrapper}>
              <LineChart
                data={chartData}
                width={screenWidth - 80}
                height={150}
                color={Colors.primary}
                thickness={3}
                dataPointsColor={Colors.primary}
                dataPointsRadius={4}
                startFillColor={Colors.primary + '30'}
                endFillColor={Colors.primary + '05'}
                startOpacity={0.3}
                endOpacity={0.05}
                areaChart
                curved
                hideRules
                yAxisColor="transparent"
                xAxisColor={Colors.border}
                yAxisTextStyle={{ color: Colors.textMuted, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: Colors.textMuted, fontSize: 10 }}
                maxValue={100}
                noOfSections={4}
                spacing={50}
              />
            </View>
          </View>
        )}

        {/* Area Scores */}
        {phase2Data?.awareness_plan && (
          <View style={styles.areasContainer}>
            {phase2Data.awareness_plan.harmony_areas.length > 0 && (
              <View style={styles.areaSection}>
                <View style={styles.areaSectionHeader}>
                  <Ionicons name="sunny-outline" size={20} color={Colors.harmony} />
                  <Text style={styles.areaSectionTitle}>Aree di armonia</Text>
                </View>
                {phase2Data.awareness_plan.harmony_areas.map((area, idx) => (
                  <View key={idx} style={styles.areaItem}>
                    <Text style={styles.areaItemName}>{area.area}</Text>
                    <Text style={[styles.areaItemScore, { color: Colors.harmony }]}>
                      {area.score}%
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {phase2Data.awareness_plan.observe_areas.length > 0 && (
              <View style={styles.areaSection}>
                <View style={styles.areaSectionHeader}>
                  <Ionicons name="eye-outline" size={20} color={Colors.observe} />
                  <Text style={styles.areaSectionTitle}>Aree da osservare</Text>
                </View>
                {phase2Data.awareness_plan.observe_areas.map((area, idx) => (
                  <View key={idx} style={styles.areaItem}>
                    <Text style={styles.areaItemName}>{area.area}</Text>
                    <Text style={[styles.areaItemScore, { color: Colors.observe }]}>
                      {area.score}%
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {!phase2Data?.initial_compatibility ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push(`/phase2/${id}`)}
            >
              <Ionicons name="analytics-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Inizia analisi (Fase 2)</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push(`/monitoring/${id}`)}
              >
                <Ionicons name="pulse" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>
                  {relationship.monitoring_active ? 'Vai al monitoraggio' : 'Attiva monitoraggio'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleRedoPhase2}
              >
                <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
                <Text style={styles.secondaryButtonText}>Aggiorna analisi</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tertiaryButton}
                onPress={() => router.push(`/phase2/${id}`)}
              >
                <Ionicons name="eye-outline" size={20} color={Colors.textLight} />
                <Text style={styles.tertiaryButtonText}>Vedi risultati completi</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
            <Text style={styles.deleteButtonText}>Elimina relazione</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifica relazione</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nome della persona</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Es. Marco"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tipo di relazione</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.typeButtons}>
                  {RELATIONSHIP_TYPES.map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        editType === type && styles.typeButtonActive,
                      ]}
                      onPress={() => setEditType(editType === type ? '' : type)}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          editType === type && styles.typeButtonTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSaveEdit}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Salva modifiche</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.h3,
    flex: 1,
    textAlign: 'center',
  },
  editButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  personName: {
    ...Typography.h2,
    marginBottom: 4,
  },
  relationType: {
    ...Typography.body,
    color: Colors.textLight,
    marginBottom: 8,
  },
  createdAt: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  editInlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.primary + '10',
    borderRadius: 20,
    gap: 6,
  },
  editInlineText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  compatibilityCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  compatibilityLabel: {
    ...Typography.body,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  compatibilityValue: {
    fontSize: 56,
    fontWeight: '700',
    color: '#FFFFFF',
    marginVertical: 4,
  },
  monitoringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginTop: 8,
  },
  monitoringBadgeText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  updateHintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  updateHintText: {
    ...Typography.bodySmall,
    color: Colors.textLight,
    flex: 1,
    fontStyle: 'italic',
  },
  chartContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    ...Typography.h3,
    fontSize: 16,
    marginBottom: 16,
  },
  chartWrapper: {
    alignItems: 'center',
    marginLeft: -10,
  },
  areasContainer: {
    gap: 12,
    marginBottom: 16,
  },
  areaSection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  areaSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  areaSectionTitle: {
    ...Typography.body,
    fontWeight: '600',
  },
  areaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  areaItemName: {
    ...Typography.bodySmall,
  },
  areaItemScore: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  actionsContainer: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  primaryButtonText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '10',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  secondaryButtonText: {
    ...Typography.button,
    color: Colors.primary,
  },
  tertiaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tertiaryButtonText: {
    ...Typography.body,
    color: Colors.textLight,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  deleteButtonText: {
    ...Typography.body,
    color: Colors.error,
  },
  errorText: {
    ...Typography.body,
    color: Colors.error,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    ...Typography.h2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeButtonText: {
    ...Typography.bodySmall,
    color: Colors.text,
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
});
