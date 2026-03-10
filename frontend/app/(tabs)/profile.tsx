import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';

interface Phase1Data {
  id: string;
  traits: string[];
  profile_score: Record<string, number>;
}

const CATEGORY_LABELS: Record<string, string> = {
  comunicazione: 'Comunicazione',
  bisogni_emotivi: 'Bisogni Emotivi',
  aspettative: 'Aspettative',
  conflitti: 'Gestione Conflitti',
  confini: 'Confini Personali',
};

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [phase1Data, setPhase1Data] = useState<Phase1Data | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPhase1Data();
  }, []);

  const fetchPhase1Data = async () => {
    try {
      const response = await api.get('/phase1');
      setPhase1Data(response.data);
    } catch (error) {
      console.error('Error fetching phase1 data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Esci',
      'Sei sicuro di voler uscire?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Esci',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return Colors.success;
    if (score >= 3) return Colors.primary;
    return Colors.warning;
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Phase 1 Profile */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Il tuo profilo relazionale</Text>
          
          {phase1Data ? (
            <>
              <View style={styles.traitsCard}>
                <Text style={styles.traitsTitle}>Tratti principali</Text>
                <View style={styles.traitsList}>
                  {phase1Data.traits.map((trait, index) => (
                    <View key={index} style={styles.traitItem}>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                      <Text style={styles.traitText}>{trait}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.scoresCard}>
                <Text style={styles.scoresTitle}>Punteggi per area</Text>
                {Object.entries(phase1Data.profile_score).map(([key, value]) => (
                  <View key={key} style={styles.scoreRow}>
                    <Text style={styles.scoreName}>{CATEGORY_LABELS[key] || key}</Text>
                    <View style={styles.scoreBar}>
                      <View 
                        style={[
                          styles.scoreBarFill,
                          { 
                            width: `${(value / 5) * 100}%`,
                            backgroundColor: getScoreColor(value),
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.scoreValue}>{value.toFixed(1)}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.retakeButton}
                onPress={() => router.push('/phase1')}
              >
                <Ionicons name="refresh" size={18} color={Colors.primary} />
                <Text style={styles.retakeButtonText}>Rifai il questionario</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.emptyProfile}>
              <Ionicons name="clipboard-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                Non hai ancora completato il profilo relazionale.
              </Text>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => router.push('/phase1')}
              >
                <Text style={styles.startButtonText}>Inizia il questionario</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Impostazioni</Text>
          
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingItem}>
              <Ionicons name="notifications-outline" size={22} color={Colors.text} />
              <Text style={styles.settingText}>Notifiche</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <Ionicons name="shield-outline" size={22} color={Colors.text} />
              <Text style={styles.settingText}>Privacy</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <Ionicons name="help-circle-outline" size={22} color={Colors.text} />
              <Text style={styles.settingText}>Aiuto</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={Colors.error} />
          <Text style={styles.logoutText}>Esci dall'account</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Versione 1.0.0</Text>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  email: {
    ...Typography.body,
    color: Colors.textLight,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: 12,
  },
  traitsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  traitsTitle: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.textLight,
    marginBottom: 12,
  },
  traitsList: {
    gap: 10,
  },
  traitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  traitText: {
    ...Typography.body,
    flex: 1,
  },
  scoresCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  scoresTitle: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.textLight,
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreName: {
    ...Typography.bodySmall,
    width: 120,
  },
  scoreBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreValue: {
    ...Typography.bodySmall,
    fontWeight: '600',
    width: 30,
    textAlign: 'right',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '10',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  retakeButtonText: {
    ...Typography.button,
    color: Colors.primary,
  },
  emptyProfile: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  startButtonText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
  settingsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingText: {
    ...Typography.body,
    flex: 1,
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error + '10',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    ...Typography.button,
    color: Colors.error,
  },
  version: {
    ...Typography.caption,
    textAlign: 'center',
    marginTop: 24,
    color: Colors.textMuted,
  },
});
