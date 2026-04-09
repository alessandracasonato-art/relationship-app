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

interface MonitoringQuestion {
  id: string;
  text: string;
}

interface MonitoringEntry {
  id: string;
  date: string;
  responses: Record<string, number>;
  compatibility: number;
  episode_title: string | null;
  created_at: string;
}

interface Phase2Data {
  initial_compatibility: number;
}

const ANSWER_OPTIONS = [
  { value: 1, label: 'Molto peggio' },
  { value: 2, label: 'Peggio' },
  { value: 3, label: 'Uguale' },
  { value: 4, label: 'Meglio' },
  { value: 5, label: 'Molto meglio' },
];

const screenWidth = Dimensions.get('window').width;

export default function Monitoring() {
  const router = useRouter();
  const { relationshipId } = useLocalSearchParams<{ relationshipId: string }>();
  const [questions, setQuestions] = useState<MonitoringQuestion[]>([]);
  const [history, setHistory] = useState<MonitoringEntry[]>([]);
  const [phase2Data, setPhase2Data] = useState<Phase2Data | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [questionsRes, historyRes, phase2Res] = await Promise.all([
        api.get('/monitoring/questions'),
        api.get(`/monitoring/${relationshipId}`),
        api.get(`/phase2/${relationshipId}`),
      ]);
      
      setQuestions(questionsRes.data.questions);
      setHistory(historyRes.data);
      setPhase2Data(phase2Res.data);
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
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
    if (!questions || questions.length === 0 || !questions[currentQuestionIndex]) {
      return;
    }
    const questionId = questions[currentQuestionIndex].id;
    setResponses(prev => ({ ...prev, [questionId]: value }));

    if (currentQuestionIndex < questions.length - 1) {
      setTimeout(() => setCurrentQuestionIndex(currentQuestionIndex + 1), 300);
    }
  };

  const handleQuestionsComplete = () => {
    if (Object.keys(responses).length < questions.length) {
      Alert.alert('Attenzione', 'Rispondi a tutte le domande.');
      return;
    }
    // Show title input screen
    setShowTitleInput(true);
  };

  const handleSubmitCheckin = async () => {
    setIsSubmitting(true);
    try {
      await api.post(`/monitoring/${relationshipId}`, { 
        responses,
        episode_title: episodeTitle.trim() || null
      });
      setShowCheckin(false);
      setShowTitleInput(false);
      setCurrentQuestionIndex(0);
      setResponses({});
      setEpisodeTitle('');
      fetchData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile salvare il check-in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getChartData = () => {
    const sortedHistory = [...history].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Add initial compatibility as first point
    const data = [];
    if (phase2Data?.initial_compatibility) {
      data.push({
        value: phase2Data.initial_compatibility,
        label: 'Inizio',
        dataPointText: `${Math.round(phase2Data.initial_compatibility)}%`,
      });
    }

    sortedHistory.forEach((entry, idx) => {
      data.push({
        value: entry.compatibility,
        label: format(new Date(entry.created_at), 'dd/MM', { locale: it }),
        dataPointText: `${Math.round(entry.compatibility)}%`,
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

  // Show title input screen (after questions)
  if (showCheckin && showTitleInput) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowTitleInput(false)}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Titolo dell'episodio</Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView contentContainerStyle={styles.titleInputContent}>
            <View style={styles.titleInputCard}>
              <Ionicons name="bookmark-outline" size={48} color={Colors.primary} />
              <Text style={styles.titleInputTitle}>Dai un titolo a questo momento</Text>
              <Text style={styles.titleInputSubtitle}>
                Puoi aggiungere un titolo per ricordare meglio questo check-in nella timeline. È facoltativo.
              </Text>
              
              <TextInput
                style={styles.titleInput}
                value={episodeTitle}
                onChangeText={setEpisodeTitle}
                placeholder="Es: Discussione sul lavoro, Weekend insieme..."
                placeholderTextColor={Colors.textMuted}
                maxLength={100}
                multiline={false}
              />
              
              <Text style={styles.titleInputHint}>
                {episodeTitle.length}/100 caratteri
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSubmitCheckin}
              disabled={isSubmitting}
            >
              <Text style={styles.skipButtonText}>Salta</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmitCheckin}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Salva check-in</Text>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Show check-in form (questions)
  if (showCheckin) {
    const currentQuestion = questions[currentQuestionIndex];
    const currentAnswer = responses[currentQuestion?.id];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowCheckin(false)}
          >
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Check-in</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {currentQuestionIndex + 1} di {questions.length}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.questionCard}>
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
            onPress={() => setCurrentQuestionIndex(prev => prev - 1)}
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
              style={styles.submitButton}
              onPress={handleQuestionsComplete}
            >
              <Text style={styles.submitButtonText}>Avanti</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Main monitoring view
  const chartData = getChartData();
  const latestCompatibility = history.length > 0 
    ? history[0].compatibility 
    : phase2Data?.initial_compatibility || 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monitoraggio</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.currentCompatibility}>
          <Text style={styles.currentLabel}>Compatibilità attuale</Text>
          <Text style={styles.currentValue}>{Math.round(latestCompatibility)}%</Text>
          {history.length > 0 && phase2Data?.initial_compatibility && (
            <Text style={styles.changeText}>
              {latestCompatibility >= phase2Data.initial_compatibility ? '+' : ''}
              {Math.round(latestCompatibility - phase2Data.initial_compatibility)}% dall'inizio
            </Text>
          )}
        </View>

        {chartData.length > 1 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Evoluzione nel tempo</Text>
            <View style={styles.chartWrapper}>
              <LineChart
                data={chartData}
                width={screenWidth - 80}
                height={180}
                color={Colors.primary}
                thickness={3}
                dataPointsColor={Colors.primary}
                dataPointsRadius={5}
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
                spacing={60}
              />
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.checkinButton}
          onPress={() => setShowCheckin(true)}
        >
          <Ionicons name="create-outline" size={22} color="#FFFFFF" />
          <Text style={styles.checkinButtonText}>Nuovo check-in</Text>
        </TouchableOpacity>

        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Timeline</Text>
            {history.slice(0, 10).map((entry, idx) => (
              <View key={entry.id} style={styles.historyItem}>
                <View style={styles.historyLeft}>
                  <View style={styles.historyDot} />
                  {idx < history.length - 1 && <View style={styles.historyLine} />}
                </View>
                <View style={styles.historyContent}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyDateText}>
                      {format(new Date(entry.created_at), "d MMMM yyyy", { locale: it })}
                    </Text>
                    <View style={styles.historyCompatibility}>
                      <Text style={styles.historyCompatibilityText}>
                        {Math.round(entry.compatibility)}%
                      </Text>
                    </View>
                  </View>
                  {entry.episode_title && (
                    <View style={styles.episodeTitleContainer}>
                      <Ionicons name="bookmark" size={14} color={Colors.primary} />
                      <Text style={styles.episodeTitleText}>{entry.episode_title}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {history.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="pulse-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Nessun check-in ancora</Text>
            <Text style={styles.emptyText}>
              Fai il tuo primo check-in per iniziare a monitorare l'evoluzione della relazione.
            </Text>
          </View>
        )}
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  currentCompatibility: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  currentLabel: {
    ...Typography.body,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  currentValue: {
    fontSize: 56,
    fontWeight: '700',
    color: '#FFFFFF',
    marginVertical: 8,
  },
  changeText: {
    ...Typography.bodySmall,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  chartContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  chartTitle: {
    ...Typography.h3,
    fontSize: 16,
    marginBottom: 16,
  },
  chartWrapper: {
    alignItems: 'center',
    marginLeft: -10,
  },
  checkinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    marginBottom: 24,
  },
  checkinButtonText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
  historySection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  historyTitle: {
    ...Typography.h3,
    fontSize: 16,
    marginBottom: 20,
  },
  historyItem: {
    flexDirection: 'row',
    minHeight: 70,
  },
  historyLeft: {
    width: 24,
    alignItems: 'center',
  },
  historyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    marginTop: 4,
  },
  historyLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginTop: 4,
  },
  historyContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 20,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyDateText: {
    ...Typography.bodySmall,
    color: Colors.textLight,
    fontWeight: '500',
  },
  historyCompatibility: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyCompatibilityText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.primary,
  },
  episodeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  episodeTitleText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    ...Typography.h3,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // Check-in form styles
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
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
  // Title input styles
  titleInputContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  titleInputCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  titleInputTitle: {
    ...Typography.h2,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  titleInputSubtitle: {
    ...Typography.body,
    color: Colors.textLight,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  titleInput: {
    width: '100%',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
  },
  titleInputHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 8,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  skipButtonText: {
    ...Typography.body,
    color: Colors.textLight,
  },
});
