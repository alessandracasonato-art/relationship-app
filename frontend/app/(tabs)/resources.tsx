import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import api from '../../src/services/api';

interface Resource {
  id: string;
  title: string;
  content_type: string;
  description: string;
  link: string | null;
  is_premium: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  video: 'play-circle-outline',
  lettura: 'book-outline',
  strumento: 'construct-outline',
  ebook: 'document-text-outline',
};

export default function Resources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      const response = await api.get('/resources');
      setResources(response.data);
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredResources = resources.filter(r => {
    if (activeFilter === 'all') return true;
    return r.content_type === activeFilter;
  });

  const filters = [
    { key: 'all', label: 'Tutti' },
    { key: 'ebook', label: 'Ebook' },
    { key: 'video', label: 'Video' },
    { key: 'lettura', label: 'Letture' },
    { key: 'strumento', label: 'Strumenti' },
  ];

  const handleResourcePress = async (resource: Resource) => {
    if (resource.is_premium) return;
    if (resource.link) {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      const fullUrl = resource.link.startsWith('http') ? resource.link : `${baseUrl}${resource.link}`;
      try {
        await Linking.openURL(fullUrl);
      } catch (error) {
        Alert.alert('Errore', 'Impossibile aprire la risorsa');
      }
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
      <View style={styles.header}>
        <Text style={styles.title}>Risorse</Text>
        <Text style={styles.subtitle}>
          Strumenti e contenuti per la tua crescita relazionale
        </Text>
      </View>

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filters.map(filter => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                activeFilter === filter.key && styles.filterButtonActive,
              ]}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === filter.key && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {filteredResources.map(resource => (
          <TouchableOpacity
            key={resource.id}
            style={[
              styles.card,
              resource.is_premium && styles.cardPremium,
            ]}
            disabled={resource.is_premium && !resource.link}
            onPress={() => handleResourcePress(resource)}
          >
            <View style={styles.cardIcon}>
              <Ionicons
                name={(TYPE_ICONS[resource.content_type] || 'document-outline') as any}
                size={24}
                color={resource.is_premium ? Colors.textMuted : Colors.primary}
              />
            </View>
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{resource.title}</Text>
                {resource.is_premium && (
                  <View style={styles.premiumBadge}>
                    <Ionicons name="lock-closed" size={12} color={Colors.warning} />
                    <Text style={styles.premiumText}>Premium</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardDescription}>{resource.description}</Text>
              <View style={styles.cardFooter}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeText}>
                    {resource.content_type.charAt(0).toUpperCase() + resource.content_type.slice(1)}
                  </Text>
                </View>
                {!resource.is_premium && resource.link && (
                  <View style={styles.downloadBadge}>
                    <Ionicons name="download-outline" size={14} color={Colors.secondary} />
                    <Text style={styles.downloadText}>Scarica</Text>
                  </View>
                )}
                {!resource.is_premium && !resource.link && (
                  <Ionicons name="arrow-forward" size={18} color={Colors.primary} />
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {filteredResources.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nessuna risorsa trovata</Text>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    ...Typography.h1,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textLight,
    marginTop: 4,
  },
  filters: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    ...Typography.bodySmall,
    color: Colors.text,
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
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
  cardPremium: {
    opacity: 0.7,
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
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitle: {
    ...Typography.body,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  premiumText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '500',
  },
  cardDescription: {
    ...Typography.bodySmall,
    color: Colors.textLight,
    marginTop: 6,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  typeBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  downloadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  downloadText: {
    ...Typography.caption,
    color: Colors.secondary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textMuted,
    marginTop: 12,
  },
});
