import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, Audio } from 'expo-av';
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import api from '../src/services/api';
import Logo from '../src/components/Logo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_WIDTH = SCREEN_WIDTH - 48;
const VIDEO_HEIGHT = VIDEO_WIDTH * (16 / 9);

export default function IntroVideo() {
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    // Force iOS audio session into playback mode (overrides silent switch)
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      
      // Play a silent audio to force-activate the playback audio session on iOS
      // This is a known workaround for the silent switch issue
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/silent.mp3'),
        { shouldPlay: true, volume: 0 }
      );
      // Wait briefly for audio session to activate
      await new Promise(resolve => setTimeout(resolve, 300));
      await sound.unloadAsync();
      
      setAudioReady(true);
      console.log('Audio session activated with playsInSilentModeIOS=true');
    } catch (error) {
      console.log('Audio setup error:', error);
      setAudioReady(true);
    }
    await fetchVideoUrl();
  };

  const fetchVideoUrl = async () => {
    try {
      const res = await api.get('/intro-video');
      if (res.data.has_video && res.data.url) {
        const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
        const fullUrl = res.data.url.startsWith('http')
          ? res.data.url
          : `${baseUrl}${res.data.url}`;
        console.log('Video URL:', fullUrl);
        setVideoUrl(fullUrl);
        setHasVideo(true);
      }
    } catch (error) {
      console.log('No intro video available:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    router.replace('/phase1');
  };

  if (isLoading || !audioReady) {
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Introduzione</Text>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleContinue}
        >
          <Text style={styles.skipText}>Salta</Text>
        </TouchableOpacity>
      </View>

      {hasVideo && videoUrl ? (
        <>
          <ScrollView
            contentContainerStyle={styles.videoScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.videoContainer}>
              <Video
                ref={videoRef}
                source={{ uri: videoUrl }}
                style={styles.video}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls
                shouldPlay={false}
                isMuted={false}
                volume={1.0}
              />
            </View>

            <View style={styles.textSection}>
              <Text style={styles.videoTitle}>Benvenuto nel tuo percorso</Text>
              <Text style={styles.videoSubtitle}>
                {"Guarda questo breve video introduttivo per comprendere come funziona lo strumento e come potrà aiutarti a sviluppare maggiore consapevolezza nelle tue relazioni."}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueButtonText}>Inizia il percorso</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={styles.content}>
            <View style={styles.placeholderSection}>
              <Logo size="large" />
              <View style={{ height: 32 }} />
              <Text style={styles.title}>Benvenuto nel tuo percorso</Text>
              <Text style={styles.subtitle}>
                {"Il video introduttivo sarà disponibile a breve.\nNel frattempo, puoi iniziare il tuo percorso di consapevolezza relazionale."}
              </Text>
              
              <View style={styles.infoCards}>
                <View style={styles.infoCard}>
                  <View style={styles.infoIconContainer}>
                    <Ionicons name="compass-outline" size={28} color={Colors.primary} />
                  </View>
                  <Text style={styles.infoTitle}>Esplora</Text>
                  <Text style={styles.infoText}>
                    Scopri il tuo stile relazionale attraverso domande mirate
                  </Text>
                </View>

                <View style={styles.infoCard}>
                  <View style={styles.infoIconContainer}>
                    <Ionicons name="analytics-outline" size={28} color={Colors.primary} />
                  </View>
                  <Text style={styles.infoTitle}>Analizza</Text>
                  <Text style={styles.infoText}>
                    Comprendi le dinamiche delle tue relazioni
                  </Text>
                </View>

                <View style={styles.infoCard}>
                  <View style={styles.infoIconContainer}>
                    <Ionicons name="trending-up-outline" size={28} color={Colors.primary} />
                  </View>
                  <Text style={styles.infoTitle}>Evolvi</Text>
                  <Text style={styles.infoText}>
                    Monitora i cambiamenti nel tempo
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueButtonText}>Inizia il percorso</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </>
      )}
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
  headerTitle: {
    ...Typography.h3,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    ...Typography.body,
    color: Colors.textLight,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  videoScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  videoContainer: {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    maxHeight: 520,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 20,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  textSection: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  videoTitle: {
    ...Typography.h2,
    textAlign: 'center',
    marginBottom: 8,
  },
  videoSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  placeholderSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...Typography.h1,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  infoCards: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  infoIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  infoText: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  footer: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: Colors.background,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  continueButtonText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
});
