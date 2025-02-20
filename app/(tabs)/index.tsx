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
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchAllStories } from '@/services/storyService';
import type { StoryMetadata } from '@/services/storyService';

// Types
type Story = StoryMetadata & {
  progress?: number;
};

export default function StoriesScreen() {
  const colorScheme = useColorScheme();
  const [refreshing, setRefreshing] = useState(false);

  const { data: stories, isLoading, refetch } = useQuery({
    queryKey: ['stories'],
    queryFn: fetchAllStories,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderStoryCard = ({ item }: { item: Story }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1c1c1c' : '#ffffff' }]}
      onPress={() => router.push(`/story/${item.id}`)}
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
          {item.progress ? (
            <View style={styles.progressContainer}>
              <View 
                style={[
                  styles.progressBar,
                  { width: `${item.progress * 100}%` },
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
            onPress={() => router.push(`/story/${item.id}`)}
          >
            <Text style={styles.buttonText}>
              {item.progress ? 'Continue' : 'Start'}
            </Text>
            <MaterialIcons
              name={item.progress ? 'play-circle-filled' : 'arrow-forward'}
              size={20}
              color="#fff"
              style={styles.buttonIcon}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

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
