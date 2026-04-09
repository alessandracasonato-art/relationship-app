import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

interface DashboardStats {
  phase1_completed: boolean;
  phase1_traits: string[];
  relationships_count: number;
  max_relationships: number;
  relationships: Array<{
    id: string;
    person_name: string;
    relationship_type: string | null;
    phase2_completed: boolean;
    compatibility: number | null;
    monitoring_active: boolean;
  }>;
}

interface Notification {
  id: string;
  notification_type: string;
  message: string;
  read: boolean;
  created_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [statsRes, notifRes, unreadRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/notifications'),
        api.get('/notifications/unread-count'),
      ]);
      setStats(statsRes.data);
      setNotifications(notifRes.data.slice(0, 3));
      setUnreadCount(unreadRes.data.count);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Ciao{user?.name ? `, ${user.name}` : ''}!</Text>
          <Text style={styles.subtitle}>
            Benvenuto nel tuo percorso di consapevolezza relazionale
          </Text>
        </View>

        {/* Video Introduttivo Banner */}
        <TouchableOpacity
          style={styles.videoBanner}
          onPress={() => router.push('/intro-video')}
        >
          <View style={styles.videoBannerIcon}>
            <Ionicons name="play-circle" size={32} color={Colors.secondary} />
          </View>
          <View style={styles.videoBannerText}>
            <Text style={styles.videoBannerTitle}>Introduzione</Text>
            <Text style={styles.videoBannerSubtitle}>Guarda il video di benvenuto</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.secondary} />
        </TouchableOpacity>

        {/* Notifications */}
        {unreadCount > 0 && (
          <View style={styles.notificationSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Notifiche</Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            {notifications.filter(n => !n.read).map(notification => (
              <TouchableOpacity
                key={notification.id}
                style={styles.notificationCard}
                onPress={() => markAsRead(notification.id)}
              >
                <Text style={styles.notificationText}>{notification.message}</Text>
                <Ionicons name="close" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Phase 1 Status */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons name="person" size={24} color={Colors.primary} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Profilo Relazionale</Text>
              <Text style={styles.cardSubtitle}>Fase 1</Text>
            </View>
            {stats?.phase1_completed && (
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
            )}
          </View>
          
          {stats?.phase1_completed ? (
            <View style={styles.traitsContainer}>
              {stats.phase1_traits.slice(0, 2).map((trait, index) => (
                <View key={index} style={styles.traitTag}>
                  <Text style={styles.traitText}>{trait}</Text>
                </View>
              ))}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/phase1')}
            >
              <Text style={styles.actionButtonText}>Inizia il questionario</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Relationships */}
        <View style={styles.sectionHeader}>
          <Ionicons name="heart" size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Le tue relazioni</Text>
          <Text style={styles.sectionCount}>
            {stats?.relationships_count || 0}/{stats?.max_relationships || 3}
          </Text>
        </View>

        {stats?.relationships && stats.relationships.length > 0 ? (
          stats.relationships.map(rel => (
            <TouchableOpacity
              key={rel.id}
              style={styles.relationshipCard}
              onPress={() => router.push(`/relationship/${rel.id}`)}
            >
              <View style={styles.relationshipInfo}>
                <Text style={styles.relationshipName}>{rel.person_name}</Text>
                {rel.relationship_type && (
                  <Text style={styles.relationshipType}>{rel.relationship_type}</Text>
                )}
              </View>
              
              {rel.compatibility !== null ? (
                <View style={styles.compatibilityContainer}>
                  <Text style={styles.compatibilityValue}>
                    {Math.round(rel.compatibility)}%
                  </Text>
                  <Text style={styles.compatibilityLabel}>Compatibilità</Text>
                </View>
              ) : (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingText}>
                    {rel.phase2_completed ? 'Analisi completa' : 'Da analizzare'}
                  </Text>
                </View>
              )}
              
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="heart-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nessuna relazione salvata</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/(tabs)/relationships')}
            >
              <Text style={styles.addButtonText}>Aggiungi la prima relazione</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/(tabs)/resources')}
          >
            <Ionicons name="book-outline" size={28} color={Colors.primary} />
            <Text style={styles.quickActionText}>Risorse</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Ionicons name="settings-outline" size={28} color={Colors.primary} />
            <Text style={styles.quickActionText}>Profilo</Text>
          </TouchableOpacity>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    ...Typography.h1,
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textLight,
  },
  videoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryDark,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  videoBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.secondary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  videoBannerText: {
    flex: 1,
  },
  videoBannerTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  videoBannerSubtitle: {
    ...Typography.caption,
    color: Colors.secondary,
    marginTop: 2,
  },
  notificationSection: {
    marginBottom: 20,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight + '15',
    padding: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  notificationText: {
    ...Typography.bodySmall,
    flex: 1,
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    ...Typography.h3,
    fontSize: 18,
  },
  cardSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textLight,
  },
  traitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 8,
  },
  traitTag: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  traitText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '10',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  actionButtonText: {
    ...Typography.button,
    color: Colors.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    ...Typography.h3,
    fontSize: 18,
    flex: 1,
  },
  sectionCount: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  badge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  relationshipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  relationshipInfo: {
    flex: 1,
  },
  relationshipName: {
    ...Typography.body,
    fontWeight: '600',
  },
  relationshipType: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  compatibilityContainer: {
    alignItems: 'center',
    marginRight: 12,
  },
  compatibilityValue: {
    ...Typography.h3,
    color: Colors.primary,
  },
  compatibilityLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  pendingBadge: {
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  pendingText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: 12,
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addButtonText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    marginTop: 8,
  },
});
