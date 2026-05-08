import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import api from '../../src/services/api';

interface Relationship {
  id: string;
  person_name: string;
  relationship_type: string | null;
  created_at: string;
  phase2_completed: boolean;
  latest_compatibility: number | null;
  monitoring_active: boolean;
}

const RELATIONSHIP_TYPES = [
  'Partner',
  'Familiare',
  'Amico/a',
  'Collega',
  'Altro',
];

export default function Relationships() {
  const router = useRouter();
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRelationships = async () => {
    try {
      const response = await api.get('/relationships');
      setRelationships(response.data);
    } catch (error) {
      console.error('Error fetching relationships:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchRelationships();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchRelationships();
  };

  const handleAddRelationship = async () => {
    if (!newName.trim()) {
      Alert.alert('Errore', 'Inserisci il nome della persona');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/relationships', {
        person_name: newName.trim(),
        relationship_type: newType || null,
      });
      setModalVisible(false);
      setNewName('');
      setNewType('');
      fetchRelationships();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante la creazione');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRelationship = (id: string, name: string) => {
    Alert.alert(
      'Elimina relazione',
      `Sei sicuro di voler eliminare la relazione con ${name}? Tutti i dati associati verranno persi.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/relationships/${id}`);
              fetchRelationships();
            } catch (error) {
              Alert.alert('Errore', 'Errore durante l\'eliminazione');
            }
          },
        },
      ]
    );
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Le tue relazioni</Text>
        <Text style={styles.subtitle}>{relationships.length}/3 relazioni salvate</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {relationships.length > 0 ? (
          relationships.map(rel => (
            <TouchableOpacity
              key={rel.id}
              style={styles.card}
              onPress={() => router.push(`/relationship/${rel.id}`)}
            >
              <View style={styles.cardContent}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={24} color={Colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{rel.person_name}</Text>
                  {rel.relationship_type && (
                    <Text style={styles.cardType}>{rel.relationship_type}</Text>
                  )}
                  <View style={styles.statusRow}>
                    {rel.phase2_completed ? (
                      <View style={styles.completedBadge}>
                        <Ionicons name="checkmark" size={12} color={Colors.success} />
                        <Text style={styles.completedText}>Analisi completa</Text>
                      </View>
                    ) : (
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingText}>Da analizzare</Text>
                      </View>
                    )}
                    {rel.monitoring_active && (
                      <View style={styles.monitoringBadge}>
                        <Ionicons name="pulse" size={12} color={Colors.primary} />
                        <Text style={styles.monitoringText}>Monitoraggio attivo</Text>
                      </View>
                    )}
                  </View>
                </View>
                {rel.latest_compatibility !== null && (
                  <View style={styles.compatibilityBox}>
                    <Text style={styles.compatibilityValue}>
                      {Math.round(rel.latest_compatibility)}%
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteRelationship(rel.id, rel.person_name)}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Nessuna relazione</Text>
            <Text style={styles.emptyText}>
              Aggiungi la tua prima relazione per iniziare l'analisi.
            </Text>
          </View>
        )}
      </ScrollView>

      {relationships.length < 3 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Add Relationship Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuova relazione</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nome della persona</Text>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="Es. Marco"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tipo di relazione (opzionale)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.typeButtons}>
                  {RELATIONSHIP_TYPES.map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        newType === type && styles.typeButtonActive,
                      ]}
                      onPress={() => setNewType(newType === type ? '' : type)}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          newType === type && styles.typeButtonTextActive,
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
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleAddRelationship}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Aggiungi relazione</Text>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    ...Typography.h1,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    marginTop: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    ...Typography.body,
    fontWeight: '600',
  },
  cardType: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  completedText: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '500',
  },
  pendingBadge: {
    backgroundColor: Colors.warning + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pendingText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '500',
  },
  monitoringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  monitoringText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '500',
  },
  compatibilityBox: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  compatibilityValue: {
    ...Typography.h3,
    color: Colors.primary,
  },
  deleteButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    ...Typography.h2,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
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
  submitButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
});
