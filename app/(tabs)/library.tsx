/**
 * Library Screen Component
 * 
 * This screen displays a grid of stories the user has started reading.
 * It fetches data from the user's Firestore library collection and
 * shows cover images and titles for each story. When a user taps on
 * a story, they are navigated to the correct page in the story reader.
 */

import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { fetchUserLibrary } from '@/services/userService';
import type { LibraryItem } from '@/services/userService';

export default function LibraryScreen() {
  const colorScheme = useColorScheme();
  const [refreshing, setRefreshing] = useState(false);

  const { 
    data: libraryItems, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['user-library'],
    queryFn: fetchUserLibrary,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Navigate to the story reader at the specific page
  const handleStoryPress = (item: LibraryItem) => {
    if (!item.story) {
      // Handle the case where story metadata isn't available
      Alert.alert('Error', 'Story details not available');
      return;
    }
    
    try {
      // Navigate directly to the story reader with the story ID and current page
      // Make sure the currentPage is passed as a string for the router
      router.push({
        pathname: `/[id]` as const,
        params: { 
          id: item.storyId, 
          currentPageIndex: item.currentPage 
        }
      });
      console.log(`Navigating to story ${item.storyId} at page ${item.currentPage}`);
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert(
        'Navigation Error',
        'Unable to open the story. Please try again.'
      );
    }
  };

  const renderLibraryItem = ({ item }: { item: LibraryItem }) => {
    // If story data isn't available, show a placeholder
    if (!item.story) {
      return (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1c1c1c' : '#ffffff' }]}
          onPress={() => handleStoryPress(item)}
        >
          <View style={[styles.coverPlaceholder, { backgroundColor: colorScheme === 'dark' ? '#333' : '#e0e0e0' }]}>
            <MaterialIcons name="book" size={40} color={colorScheme === 'dark' ? '#888' : '#aaa'} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.title}>Unknown Story</Text>
            <Text style={styles.subtitle}>Unable to load details</Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1c1c1c' : '#ffffff' }]}
        onPress={() => handleStoryPress(item)}
      >
        <Image
          source={item.story.coverImage}
          style={styles.coverImage}
          contentFit="cover"
          transition={1000}
        />
        <View style={styles.cardContent}>
          <Text style={styles.title}>{item.story.title}</Text>
          <Text style={styles.subtitle}>Page {item.currentPage}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Show loading indicator while data is being fetched
  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        <Text style={styles.loadingText}>Loading your library...</Text>
      </View>
    );
  }

  // Show error message if there was an error
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error" size={50} color="#ff6b6b" />
        <Text style={styles.errorText}>
          Error loading your library. Please try again.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show empty state if there are no items in the library
  if (!libraryItems || libraryItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="library-books" size={70} color="#aaaaaa" />
        <Text style={styles.emptyTitle}>Your Library is Empty</Text>
        <Text style={styles.emptyText}>
          Start reading stories to see them appear here
        </Text>
        <TouchableOpacity 
          style={styles.exploreButton} 
          onPress={() => router.push('/')}
        >
          <Text style={styles.exploreButtonText}>Explore Stories</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render the grid of library items
  return (
    <View style={styles.container}>
      <FlatList
        data={libraryItems}
        renderItem={renderLibraryItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors[colorScheme ?? 'light'].tint]}
            tintColor={Colors[colorScheme ?? 'light'].tint}
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
  gridContainer: {
    padding: 10,
  },
  card: {
    flex: 1,
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  coverImage: {
    width: '100%',
    height: 180,
  },
  coverPlaceholder: {
    width: '100%',
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#4a90e2',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  exploreButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#4a90e2',
    borderRadius: 8,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 