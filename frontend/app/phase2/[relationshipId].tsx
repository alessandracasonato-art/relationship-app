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

interface Relationship {
  id: string;
  person_name: string;
  relationship_type: string | null;
}

const ANSWER_OPTIONS = [
  { value: 1, label: 'Per niente' },
  { value: 2, label: 'Raramente' },
  { value: 3, label: 'A volte' },
  { value: 4, label: 'Spesso' },
  { value: 5, label: 'Sempre' },
];

const AREA_ICONS: Record<string, string> = {
  comunicazione: 'chatbubbles-outline',
  valori: 'heart-outline',
  bisogni_emotivi: 'hand-left-outline',
  conflitto: 'flash-outline',
  visione: 'telescope-outline',
};

const AREA_DESCRIPTIONS: Record<string, string> = {
  comunicazione: 'Come comunicate e vi ascoltate reciprocamente',
  valori: 'I principi e le priorità che condividete',
  bisogni_emotivi: 'Il supporto emotivo nella relazione',
  conflitto: 'Come affrontate i disaccordi',
  visione: 'Le aspettative sul futuro insieme',
};

// Introduction component for Phase 2
function Phase2Introduction({ 
  relationship, 
  onStart 
}: { 
  relationship: Relationship | null;
  onStart: () => void;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.introContent}>
        <View style={styles.introHeader}>
          <View style={styles.introIconContainer}>
            <Ionicons name="analytics-outline" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.introTitle}>Analisi della Relazione</Text>
          {relationship && (
            <View style={styles.relationshipBadge}>
              <Ionicons name="person" size={16} color={Colors.primary} />
              <Text style={styles.relationshipBadgeText}>{relationship.person_name}</Text>
            </View>
          )}
          <Text style={styles.introSubtitle}>
            Analizzerai la tua relazione attraverso 5 aree tematiche per comprendere meglio le dinamiche e ricevere un indice di compatibilità.
          </Text>
        </View>

        <View style={styles.areasPreview}>
          <Text style={styles.areasTitle}>Le 5 aree di analisi</Text>
          
          <View style={styles.areaPreviewCard}>
            <View style={styles.areaPreviewIcon}>
              <Ionicons name="chatbubbles-outline" size={24} color={Colors.primary} />
            </View>
            <View style={styles.areaPreviewContent}>
              <Text style={styles.areaPreviewTitle}>1. Comunicazione</Text>
              <Text style={styles.areaPreviewDesc}>Come comunicate e vi ascoltate</Text>
            </View>
          </View>

          <View style={styles.areaPreviewCard}>
            <View style={styles.areaPreviewIcon}>
              <Ionicons name="heart-outline" size={24} color={Colors.primary} />
            </View>
            <View style={styles.areaPreviewContent}>
              <Text style={styles.areaPreviewTitle}>2. Valori</Text>
              <Text style={styles.areaPreviewDesc}>I principi che condividete</Text>
            </View>
          </View>

          <View style={styles.areaPreviewCard}>
            <View style={styles.areaPreviewIcon}>
              <Ionicons name="hand-left-outline" size={24} color={Colors.primary} />
            </View>
            <View style={styles.areaPreviewContent}>
              <Text style={styles.areaPreviewTitle}>3. Bisogni Emotivi</Text>
              <Text style={styles.areaPreviewDesc}>Il supporto emotivo reciproco</Text>
            </View>
          </View>

          <View style={styles.areaPreviewCard}>
            <View style={styles.areaPreviewIcon}>
              <Ionicons name="flash-outline" size={24} color={Colors.primary} />
            </View>
            <View style={styles.areaPreviewContent}>
              <Text style={styles.areaPreviewTitle}>4. Gestione del Conflitto</Text>
              <Text style={styles.areaPreviewDesc}>Come affrontate i disaccordi</Text>
            </View>
          </View>

          <View style={styles.areaPreviewCard}>
            <View style={styles.areaPreviewIcon}>
              <Ionicons name="telescope-outline" size={24} color={Colors.primary} />
            </View>
            <View style={styles.areaPreviewContent}>
              <Text style={styles.areaPreviewTitle}>5. Visione della Relazione</Text>
              <Text style={styles.areaPreviewDesc}>Le aspettative sul futuro</Text>
            </View>
          </View>
        </View>

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={22} color={Colors.primary} />
          <Text style={styles.noteText}>
            Le aree si sbloccheranno in sequenza. Completa un'area per passare alla successiva. Al termine riceverai un indice di compatibilità e un piano di consapevolezza.
          </Text>
        </View>

        <View style={styles.timeCard}>
          <Ionicons name="time-outline" size={20} color={Colors.textMuted} />
          <Text style={styles.timeText}>Tempo stimato: ~15 minuti (25 domande totali)</Text>
        </View>
      </ScrollView>

      <View style={styles.introFooter}>
        <TouchableOpacity style={styles.startButton} onPress={onStart}>
          <Text style={styles.startButtonText}>Inizia l'analisi</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function Phase2() {
  const router = useRouter();
  const { relationshipId } = useLocalSearchParams<{ relationshipId: string }>();
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [areas, setAreas] = useState<Record<string, Area>>({});
  const [areaOrder, setAreaOrder] = useState<string[]>([]);
  const [phase2Data, setPhase2Data] = useState<Phase2Data | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [currentAreaId, setCurrentAreaId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const fetchData = async () => {
    try {
      const [areasRes, phase2Res, relRes] = await Promise.all([
        api.get('/phase2/areas'),
        api.get(`/phase2/${relationshipId}`).catch(() => ({ data: null })),
        api.get('/relationships'),
      ]);
      
      setAreas(areasRes.data.areas);
      setAreaOrder(areasRes.data.order);
      setPhase2Data(phase2Res.data);

      // Find the relationship
      const rel = relRes.data.find((r: Relationship) => r.id === relationshipId);
      setRelationship(rel || null);

      // Check if Phase 2 is completed (has compatibility score)
      if (phase2Res.data && phase2Res.data.initial_compatibility !== null && phase2Res.data.initial_compatibility !== undefined) {
        setShowResults(true);
        setShowIntro(false);
      } else if (phase2Res.data && phase2Res.data.completed_areas && phase2Res.data.completed_areas.length > 0) {
        // Phase 2 in progress - continue from where left off
        setShowIntro(false);
        const completedAreas = phase2Res.data.completed_areas || [];
        const nextArea = areasRes.data.order.find((a: string) => !completedAreas.includes(a));
        if (nextArea) {
          setCurrentAreaId(nextArea);
        }
      } else {
        // Phase 2 not started - show intro
        setShowIntro(true);
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

  const handleStartPhase2 = () => {
    setShowIntro(false);
    // Start with first area
    if (areaOrder.length > 0) {
      setCurrentAreaId(areaOrder[0]);
    }
  };

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

      if (result.data.initial_compatibility !== null && result.data.initial_compatibility !== undefined) {
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

  // Show introduction
  if (showIntro) {
    return (
      <Phase2Introduction 
        relationship={relationship} 
        onStart={handleStartPhase2}
      />
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

  // Show questionnaire
  if (!currentAreaId || !areas[currentAreaId]) {
    // Fallback - start with first area
    if (areaOrder.length > 0 && !currentAreaId) {
      setCurrentAreaId(areaOrder[0]);
    }
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
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
          <View style={styles.areaLabelRow}>
            <Ionicons 
              name={(AREA_ICONS[currentAreaId] || 'help-circle-outline') as any} 
              size={18} 
              color={Colors.primary} 
            />
            <Text style={styles.categoryLabel}>{currentArea.name.toUpperCase()}</Text>
          </View>
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
  // Introduction styles
  introContent: {
    padding: 24,
    paddingBottom: 100,
  },
  introHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  introIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  introTitle: {
    ...Typography.h1,
    textAlign: 'center',
    marginBottom: 12,
  },
  relationshipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
  },
  relationshipBadgeText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.primary,
  },
  introSubtitle: {
    ...Typography.body,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 24,
  },
  areasPreview: {
    marginBottom: 20,
  },
  areasTitle: {
    ...Typography.h3,
    marginBottom: 16,
  },
  areaPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  areaPreviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  areaPreviewContent: {
    flex: 1,
  },
  areaPreviewTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  areaPreviewDesc: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  noteCard: {
    flexDirection: 'row',
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  noteText: {
    ...Typography.bodySmall,
    color: Colors.text,
    flex: 1,
    lineHeight: 20,
  },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  timeText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  introFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  startButtonText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
  // Header and progress
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
  areaLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  categoryLabel: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
    letterSpacing: 1,
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
