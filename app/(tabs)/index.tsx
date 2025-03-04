import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchAllStories, fetchUserLibrary } from '@/services/storyService';
import type { StoryMetadata, LibraryStory } from '@/services/storyService';
import { isAuthenticated } from '@/services/firebaseAuth';
import { useFocusEffect } from '@react-navigation/native';

// Types
type Story = StoryMetadata & {
  progress?: number;
  currentChapter?: number | string;
};

export default function StoriesScreen() {
  const colorScheme = useColorScheme();
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Query for stories
  const { 
    data: stories, 
    isLoading: isStoriesLoading, 
    refetch: refetchStories 
  } = useQuery({
    queryKey: ['stories'],
    queryFn: fetchAllStories,
  });

  // Query for user library
  const { 
    data: userLibraryData, 
    isLoading: isLibraryLoading,
    refetch: refetchLibrary
  } = useQuery({
    queryKey: ['userLibrary'],
    queryFn: fetchUserLibrary,
    // Only fetch if user is authenticated
    enabled: isAuthenticated(),
    // Convert array to map for easier lookup
    select: (data: LibraryStory[]) => {
      const libraryMap: Record<string, LibraryStory> = {};
      data.forEach(item => {
        libraryMap[item.id] = item;
      });
      return libraryMap;
    }
  });

  // Use empty object as fallback when library is loading or not available
  const userLibrary = userLibraryData || {};

  // Refresh library data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated()) {
        refetchLibrary();
      }
    }, [refetchLibrary])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchStories(),
      isAuthenticated() ? refetchLibrary() : Promise.resolve()
    ]);
    setRefreshing(false);
  }, [refetchStories, refetchLibrary]);

  const handleStoryPress = (item: Story) => {
    // Navigate to story description page instead of directly to reader
    router.push({
      pathname: `/story/[id]` as const,
      params: { id: item.id }
    });
    console.log(`Navigating to story description for ${item.id}`);
  };

  const renderStoryCard = ({ item }: { item: Story }) => {
    // Check if we have progress info from the user library
    const hasProgress = !!userLibrary[item.id];
    
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1c1c1c' : '#ffffff' }]}
        onPress={() => handleStoryPress(item)}
      >
        <Image
          source={item.coverImage}
          style={styles.coverImage}
          contentFit="cover"
          transition={1000}
        />
        <View style={styles.cardContent}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={styles.cardFooter}>
            {hasProgress && userLibrary[item.id].currentChapter ? (
              <View style={styles.progressContainer}>
                <View 
                  style={[
                    styles.progressBar,
                    // Show a simple progress indicator based on chapter number
                    // This could be improved with actual chapter count data if available
                    { width: `${hasProgress ? Math.min((Number(userLibrary[item.id].currentChapter) + 1) * 20, 90) : 0}%` },
                    { backgroundColor: colorScheme === 'dark' ? '#4a9eff' : '#2b7de9' }
                  ]}
                />
              </View>
            ) : null}
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: colorScheme === 'dark' ? '#4a9eff' : '#2b7de9' }
              ]}
              onPress={() => handleStoryPress(item)}
            >
              <Text style={styles.buttonText}>
                {hasProgress ? 'Continue' : 'Start'}
              </Text>
              <MaterialIcons
                name={hasProgress ? 'play-circle-filled' : 'arrow-forward'}
                size={20}
                color="#fff"
                style={styles.buttonIcon}
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const isLoading = isStoriesLoading;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#4a9eff' : '#2b7de9'} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={stories}
        renderItem={renderStoryCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colorScheme === 'dark' ? '#4a9eff' : '#2b7de9'}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  coverImage: {
    width: '100%',
    height: 150,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardContent: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressContainer: {
    flex: 1,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginRight: 16,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    marginRight: 4,
  },
  buttonIcon: {
    marginLeft: 4,
  },
});
