import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import api from '../../src/services/api';

interface Area {
  name: string;
  questions: Array<{ id: string; text: string }>;
}

interface Phase2Data {
  id: string;
  completed_areas: string[];
  area_scores: Record<string, number>;
  initial_compatibility: number | null;
  awareness_plan: {
    harmony_areas: Array<{ area: string; score: number }>;
    observe_areas: Array<{ area: string; score: number }>;
    summary: string;
  } | null;
}

const ANSWER_OPTIONS = [
  { value: 1, label: 'Per niente' },
  { value: 2, label: 'Raramente' },
  { value: 3, label: 'A volte' },
  { value: 4, label: 'Spesso' },
  { value: 5, label: 'Sempre' },
];

export default function Phase2() {
  const router = useRouter();
  const { relationshipId } = useLocalSearchParams<{ relationshipId: string }>();
  const [areas, setAreas] = useState<Record<string, Area>>({});
  const [areaOrder, setAreaOrder] = useState<string[]>([]);
  const [phase2Data, setPhase2Data] = useState<Phase2Data | null>(null);
  const [currentAreaId, setCurrentAreaId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const fetchData = async () => {
    try {
      const [areasRes, phase2Res] = await Promise.all([
        api.get('/phase2/areas'),
        api.get(`/phase2/${relationshipId}`),
      ]);
      
      setAreas(areasRes.data.areas);
      setAreaOrder(areasRes.data.order);
      setPhase2Data(phase2Res.data);

      if (phase2Res.data?.initial_compatibility !== null) {
        setShowResults(true);
      } else {
        // Find next area to complete
        const completedAreas = phase2Res.data?.completed_areas || [];
        const nextArea = areasRes.data.order.find((a: string) => !completedAreas.includes(a));
        if (nextArea) {
          setCurrentAreaId(nextArea);
        }
      }
    } catch (error) {
      console.error('Error fetching phase2 data:', error);
      Alert.alert('Errore', 'Impossibile caricare i dati');
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [relationshipId])
  );

  const handleAnswer = (value: number) => {
    if (!currentAreaId || !areas[currentAreaId]) return;
    
    const questionId = areas[currentAreaId].questions[currentQuestionIndex].id;
    setResponses(prev => ({ ...prev, [questionId]: value }));

    const totalQuestions = areas[currentAreaId].questions.length;
    if (currentQuestionIndex < totalQuestions - 1) {
      setTimeout(() => setCurrentQuestionIndex(currentQuestionIndex + 1), 300);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmitArea = async () => {
    if (!currentAreaId) return;

    const questions = areas[currentAreaId].questions;
    const areaResponses: Record<string, number> = {};
    let allAnswered = true;

    for (const q of questions) {
      if (responses[q.id]) {
        areaResponses[q.id] = responses[q.id];
      } else {
        allAnswered = false;
        break;
      }
    }

    if (!allAnswered) {
      Alert.alert('Attenzione', 'Rispondi a tutte le domande prima di continuare.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.post(`/phase2/${relationshipId}/area`, {
        area_id: currentAreaId,
        responses: areaResponses,
      });

      setPhase2Data(result.data);

      if (result.data.initial_compatibility !== null) {
        // All areas completed
        setShowResults(true);
      } else {
        // Move to next area
        const nextArea = areaOrder.find((a) => !result.data.completed_areas.includes(a));
        if (nextArea) {
          setCurrentAreaId(nextArea);
          setCurrentQuestionIndex(0);
          setResponses({});
        }
      }
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile salvare le risposte');
    } finally {
      setIsSubmitting(false);
    }
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

  // Show results page
  if (showResults && phase2Data?.awareness_plan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Risultati Analisi</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.resultsContent}>
          <View style={styles.compatibilityCard}>
            <Text style={styles.compatibilityLabel}>Indice di Compatibilità</Text>
            <Text style={styles.compatibilityValue}>
              {Math.round(phase2Data.initial_compatibility || 0)}%
            </Text>
            <Text style={styles.compatibilityNote}>
              Questo indice rappresenta una fotografia della tua percezione attuale della relazione.
            </Text>
          </View>

          {phase2Data.awareness_plan.harmony_areas.length > 0 && (
            <View style={styles.areaSection}>
              <View style={styles.areaSectionHeader}>
                <Ionicons name="sunny-outline" size={22} color={Colors.harmony} />
                <Text style={styles.areaSectionTitle}>Aree di armonia</Text>
              </View>
              {phase2Data.awareness_plan.harmony_areas.map((area, index) => (
                <View key={index} style={styles.areaItem}>
                  <Text style={styles.areaItemName}>{area.area}</Text>
                  <View style={styles.areaItemScore}>
                    <Text style={styles.areaItemScoreText}>{area.score}%</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {phase2Data.awareness_plan.observe_areas.length > 0 && (
            <View style={styles.areaSection}>
              <View style={styles.areaSectionHeader}>
                <Ionicons name="eye-outline" size={22} color={Colors.observe} />
                <Text style={styles.areaSectionTitle}>Aree da osservare</Text>
              </View>
              {phase2Data.awareness_plan.observe_areas.map((area, index) => (
                <View key={index} style={styles.areaItem}>
                  <Text style={styles.areaItemName}>{area.area}</Text>
                  <View style={[styles.areaItemScore, styles.areaItemScoreObserve]}>
                    <Text style={styles.areaItemScoreTextObserve}>{area.score}%</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>
              {phase2Data.awareness_plan.summary}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.monitoringButton}
            onPress={() => router.push(`/monitoring/${relationshipId}`)}
          >
            <Ionicons name="pulse" size={20} color="#FFFFFF" />
            <Text style={styles.monitoringButtonText}>Attiva il monitoraggio</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backToHomeButton}
            onPress={() => router.replace('/(tabs)/dashboard')}
          >
            <Text style={styles.backToHomeText}>Torna alla dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Show area selection or question
  if (!currentAreaId || !areas[currentAreaId]) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fase 2 - Analisi Relazione</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>Seleziona un'area per iniziare</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentArea = areas[currentAreaId];
  const currentQuestion = currentArea.questions[currentQuestionIndex];
  const totalQuestions = currentArea.questions.length;
  const currentAnswer = responses[currentQuestion?.id];
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  const areaIndex = areaOrder.indexOf(currentAreaId);
  const completedAreasCount = phase2Data?.completed_areas?.length || 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Alert.alert(
              'Esci dall\'analisi',
              'I progressi di questa area non verranno salvati. Vuoi continuare?',
              [
                { text: 'Annulla', style: 'cancel' },
                { text: 'Esci', onPress: () => router.back() },
              ]
            );
          }}
        >
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Area {areaIndex + 1} di {areaOrder.length}</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.areaProgress}>
          {areaOrder.map((areaId, idx) => (
            <View
              key={areaId}
              style={[
                styles.areaProgressDot,
                (phase2Data?.completed_areas?.includes(areaId) || areaId === currentAreaId) && 
                  styles.areaProgressDotActive,
                areaId === currentAreaId && styles.areaProgressDotCurrent,
              ]}
            />
          ))}
        </View>
        <View style={styles.questionProgress}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            Domanda {currentQuestionIndex + 1} di {totalQuestions}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.questionCard}>
          <Text style={styles.categoryLabel}>{currentArea.name.toUpperCase()}</Text>
          <Text style={styles.questionText}>{currentQuestion?.text}</Text>
        </View>

        <View style={styles.optionsContainer}>
          {ANSWER_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionButton,
                currentAnswer === option.value && styles.optionButtonSelected,
              ]}
              onPress={() => handleAnswer(option.value)}
            >
              <View style={[
                styles.optionCircle,
                currentAnswer === option.value && styles.optionCircleSelected,
              ]}>
                {currentAnswer === option.value && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
              <Text style={[
                styles.optionText,
                currentAnswer === option.value && styles.optionTextSelected,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.navButton, currentQuestionIndex === 0 && styles.navButtonDisabled]}
          onPress={handlePrevious}
          disabled={currentQuestionIndex === 0}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={currentQuestionIndex === 0 ? Colors.textMuted : Colors.text}
          />
          <Text style={[
            styles.navButtonText,
            currentQuestionIndex === 0 && styles.navButtonTextDisabled,
          ]}>
            Indietro
          </Text>
        </TouchableOpacity>

        {isLastQuestion && currentAnswer ? (
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmitArea}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>
                  {areaIndex < areaOrder.length - 1 ? 'Prossima area' : 'Completa'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
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
    ...Typography.body,
    fontWeight: '600',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  areaProgress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  areaProgressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  areaProgressDotActive: {
    backgroundColor: Colors.primary,
  },
  areaProgressDotCurrent: {
    width: 24,
    borderRadius: 5,
  },
  questionProgress: {},
  progressBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressText: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 6,
  },
  content: {
    flexGrow: 1,
    padding: 20,
  },
  questionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  categoryLabel: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  questionText: {
    ...Typography.h3,
    lineHeight: 28,
  },
  optionsContainer: {
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  optionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionCircleSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionText: {
    ...Typography.body,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    ...Typography.body,
    fontWeight: '500',
  },
  navButtonTextDisabled: {
    color: Colors.textMuted,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
  placeholder: {
    width: 100,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textMuted,
  },
  // Results styles
  resultsContent: {
    padding: 20,
    paddingBottom: 40,
  },
  compatibilityCard: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  compatibilityLabel: {
    ...Typography.body,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 8,
  },
  compatibilityValue: {
    fontSize: 64,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  compatibilityNote: {
    ...Typography.bodySmall,
    color: '#FFFFFF',
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 16,
  },
  areaSection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  areaSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  areaSectionTitle: {
    ...Typography.h3,
    fontSize: 18,
  },
  areaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  areaItemName: {
    ...Typography.body,
  },
  areaItemScore: {
    backgroundColor: Colors.harmony + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  areaItemScoreObserve: {
    backgroundColor: Colors.observe + '20',
  },
  areaItemScoreText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.harmony,
  },
  areaItemScoreTextObserve: {
    color: Colors.observe,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  summaryText: {
    ...Typography.body,
    color: Colors.textLight,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  monitoringButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    marginBottom: 12,
  },
  monitoringButtonText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
  backToHomeButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  backToHomeText: {
    ...Typography.body,
    color: Colors.textLight,
  },
});
