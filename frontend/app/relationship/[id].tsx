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

export default function RelationshipDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [phase2Data, setPhase2Data] = useState<Phase2Data | null>(null);
  const [monitoringHistory, setMonitoringHistory] = useState<MonitoringEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={22} color={Colors.error} />
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
                onPress={() => router.push(`/phase2/${id}`)}
              >
                <Ionicons name="eye-outline" size={20} color={Colors.primary} />
                <Text style={styles.secondaryButtonText}>Vedi risultati analisi</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
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
  },
  deleteButton: {
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
  errorText: {
    ...Typography.body,
    color: Colors.error,
  },
});
