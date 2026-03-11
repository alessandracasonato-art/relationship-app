import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import api from '../src/services/api';
import { useAuthStore } from '../src/store/authStore';

interface Question {
  id: string;
  category: string;
  text: string;
}

const ANSWER_OPTIONS = [
  { value: 1, label: 'Per niente' },
  { value: 2, label: 'Poco' },
  { value: 3, label: 'Abbastanza' },
  { value: 4, label: 'Molto' },
  { value: 5, label: 'Completamente' },
];

// Introduction component
function Introduction({ onStart }: { onStart: () => void }) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.introContent}>
        <View style={styles.introHeader}>
          <View style={styles.introIconContainer}>
            <Ionicons name="compass-outline" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.introTitle}>Il tuo percorso di consapevolezza</Text>
          <Text style={styles.introSubtitle}>
            Questo strumento ti guiderà attraverso un percorso di riflessione sulle tue relazioni.
          </Text>
        </View>

        <View style={styles.phasesContainer}>
          <Text style={styles.phasesTitle}>Le tre fasi del percorso</Text>
          
          <View style={styles.phaseCard}>
            <View style={styles.phaseNumber}>
              <Text style={styles.phaseNumberText}>1</Text>
            </View>
            <View style={styles.phaseContent}>
              <Text style={styles.phaseTitle}>Profilo Relazionale Personale</Text>
              <Text style={styles.phaseDescription}>
                Scopri il tuo stile relazionale attraverso domande su comunicazione, bisogni emotivi, aspettative, gestione dei conflitti e confini personali.
              </Text>
              <View style={styles.phaseInfo}>
                <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.phaseInfoText}>~10 minuti • 17 domande</Text>
              </View>
            </View>
          </View>

          <View style={styles.phaseCard}>
            <View style={[styles.phaseNumber, styles.phaseNumberInactive]}>
              <Text style={[styles.phaseNumberText, styles.phaseNumberTextInactive]}>2</Text>
            </View>
            <View style={styles.phaseContent}>
              <Text style={[styles.phaseTitle, styles.phaseTitleInactive]}>Analisi della Relazione</Text>
              <Text style={styles.phaseDescription}>
                Analizza una specifica relazione attraverso 5 aree tematiche e ricevi un indice di compatibilità.
              </Text>
              <View style={styles.phaseInfo}>
                <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.phaseInfoText}>~15 minuti • 25 domande</Text>
              </View>
            </View>
          </View>

          <View style={styles.phaseCard}>
            <View style={[styles.phaseNumber, styles.phaseNumberInactive]}>
              <Text style={[styles.phaseNumberText, styles.phaseNumberTextInactive]}>3</Text>
            </View>
            <View style={styles.phaseContent}>
              <Text style={[styles.phaseTitle, styles.phaseTitleInactive]}>Monitoraggio nel Tempo</Text>
              <Text style={styles.phaseDescription}>
                Osserva l'evoluzione della relazione attraverso check-in settimanali e visualizza i cambiamenti.
              </Text>
              <View style={styles.phaseInfo}>
                <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.phaseInfoText}>~2 minuti • settimanale</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={22} color={Colors.primary} />
          <Text style={styles.noteText}>
            Non esistono risposte giuste o sbagliate. Rispondi in base a come ti senti realmente, non a come pensi dovresti sentirti. Le tue risposte sono private e serviranno solo per la tua riflessione personale.
          </Text>
        </View>

        <View style={styles.currentPhaseCard}>
          <Text style={styles.currentPhaseLabel}>Inizierai con</Text>
          <Text style={styles.currentPhaseTitle}>Fase 1: Profilo Relazionale</Text>
          <Text style={styles.currentPhaseDescription}>
            Ti verranno poste 17 domande per comprendere il tuo stile relazionale. Prenditi il tempo necessario per riflettere su ogni domanda.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.introFooter}>
        <TouchableOpacity style={styles.startButton} onPress={onStart}>
          <Text style={styles.startButtonText}>Inizia il questionario</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function Phase1() {
  const router = useRouter();
  const { setUser, user } = useAuthStore();
  const [showIntro, setShowIntro] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await api.get('/phase1/questions');
      setQuestions(response.data.questions);
    } catch (error) {
      console.error('Error fetching questions:', error);
      Alert.alert('Errore', 'Impossibile caricare le domande');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (value: number) => {
    const questionId = questions[currentIndex].id;
    setResponses(prev => ({ ...prev, [questionId]: value }));

    if (currentIndex < questions.length - 1) {
      setTimeout(() => setCurrentIndex(currentIndex + 1), 300);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(responses).length < questions.length) {
      Alert.alert('Attenzione', 'Rispondi a tutte le domande prima di continuare.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/phase1', { responses });
      if (user) {
        setUser({ ...user, has_completed_phase1: true });
      }
      router.replace('/(tabs)/dashboard');
    } catch (error) {
      Alert.alert('Errore', 'Impossibile salvare le risposte');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show introduction first
  if (showIntro) {
    return <Introduction onStart={() => setShowIntro(false)} />;
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const isLastQuestion = currentIndex === questions.length - 1;
  const currentAnswer = responses[currentQuestion?.id];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Alert.alert(
              'Esci dal questionario',
              'I progressi non salvati andranno persi. Vuoi continuare?',
              [
                { text: 'Annulla', style: 'cancel' },
                { text: 'Esci', onPress: () => router.back() },
              ]
            );
          }}
        >
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fase 1 - Profilo Relazionale</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {currentIndex + 1} di {questions.length}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.questionCard}>
          <Text style={styles.categoryLabel}>
            {currentQuestion?.category.replace('_', ' ').toUpperCase()}
          </Text>
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
          style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
          onPress={handlePrevious}
          disabled={currentIndex === 0}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={currentIndex === 0 ? Colors.textMuted : Colors.text}
          />
          <Text style={[
            styles.navButtonText,
            currentIndex === 0 && styles.navButtonTextDisabled,
          ]}>
            Indietro
          </Text>
        </TouchableOpacity>

        {isLastQuestion && currentAnswer ? (
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Completa</Text>
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
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
    marginBottom: 32,
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
  introSubtitle: {
    ...Typography.body,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 24,
  },
  phasesContainer: {
    marginBottom: 24,
  },
  phasesTitle: {
    ...Typography.h3,
    marginBottom: 16,
  },
  phaseCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  phaseNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  phaseNumberInactive: {
    backgroundColor: Colors.border,
  },
  phaseNumberText: {
    ...Typography.body,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  phaseNumberTextInactive: {
    color: Colors.textMuted,
  },
  phaseContent: {
    flex: 1,
  },
  phaseTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: 6,
  },
  phaseTitleInactive: {
    color: Colors.textLight,
  },
  phaseDescription: {
    ...Typography.bodySmall,
    color: Colors.textLight,
    lineHeight: 20,
    marginBottom: 8,
  },
  phaseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phaseInfoText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  noteCard: {
    flexDirection: 'row',
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  noteText: {
    ...Typography.bodySmall,
    color: Colors.text,
    flex: 1,
    lineHeight: 20,
  },
  currentPhaseCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 24,
  },
  currentPhaseLabel: {
    ...Typography.caption,
    color: '#FFFFFF',
    opacity: 0.8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  currentPhaseTitle: {
    ...Typography.h2,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  currentPhaseDescription: {
    ...Typography.body,
    color: '#FFFFFF',
    opacity: 0.9,
    lineHeight: 24,
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
  // Questionnaire styles
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
});
