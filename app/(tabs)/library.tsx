/**
 * Library Screen Component
 * 
 * This screen displays a grid of stories the user has started reading.
 * It fetches data from the user's Firestore library collection and
 * shows cover images and titles for each story. When a user taps on
 * a story, they are navigated to the correct page in the story reader.
 */

import { 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  FlatList, 
  Alert, 
  RefreshControl 
} from 'react-native';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { fetchUserLibrary, LibraryStory } from '@/services/storyService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useState, useRef, useCallback } from 'react';
import { db } from '@/services/firebaseConfig';
import { getCurrentUser } from '@/services/firebaseAuth';
import { collection, onSnapshot, orderBy, query, doc, getDoc } from 'firebase/firestore';

// Interface for rendered library items
interface LibraryItem {
  storyId: string;
  currentChapter: number | string;
  lastReadTimestamp: any;
  docId?: string;
  story?: {
    id: string;
    title: string;
    author: string;
    coverImage: string;
    description: string;
    defaultCharacterName: string;
  };
  unlockedChapters?: number[];
  chapterHistory?: Record<string, any>;
}

export default function LibraryScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const { 
    data: libraryItems, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['user-library'],
    queryFn: async () => {
      const library = await fetchUserLibrary();
      
      // Convert results to LibraryItem format
      return library.map(item => ({
        storyId: item.id || '',
        currentChapter: typeof item.currentChapter === 'string' 
          ? parseInt(item.currentChapter, 10) 
          : item.currentChapter,
        lastReadTimestamp: item.lastReadTimestamp,
        story: {
          id: item.id,
          title: item.title,
          author: item.author,
          coverImage: item.coverImage,
          description: item.description,
          defaultCharacterName: item.defaultCharacterName,
        }
      }));
    },
  });

  // Set up a Firestore real-time listener when the screen is focused
  useFocusEffect(
    useCallback(() => {
      const currentUser = getCurrentUser();
      if (!currentUser) return;
      
      const userId = currentUser.uid;
      console.log('Setting up real-time listener for user library');
      
      const libraryRef = collection(db, 'users', userId, 'userLibrary');
      const libraryQuery = query(libraryRef, orderBy('timestamp', 'desc'));
      
      // Create the snapshot listener
      unsubscribeRef.current = onSnapshot(libraryQuery, 
        // Success handler
        (snapshot) => {
          console.log('Library data changed, invalidating query cache');
          // Invalidate and refetch the query when data changes
          queryClient.invalidateQueries({ queryKey: ['user-library'] });
        },
        // Error handler
        (error) => {
          console.error('Error in Firestore listener:', error);
        }
      );
      
      // Clean up the listener when component unmounts or screen loses focus
      return () => {
        console.log('Cleaning up real-time listener');
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    }, [queryClient])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Navigate to the story description page instead of directly to the reader
  const handleStoryPress = (item: LibraryItem) => {
    if (!item.story) {
      // Handle the case where story metadata isn't available
      Alert.alert('Error', 'Story details not available');
      return;
    }
    
    try {
      // Navigate to the story description page instead of directly to the reader
      router.push({
        pathname: `/story/[id]` as const,
        params: { id: item.storyId }
      });
      console.log(`Navigating to story description for ${item.storyId}`);
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
          <Text style={styles.subtitle}>Chapter {typeof item.currentChapter === 'number' 
            ? item.currentChapter + 1 
            : parseInt(item.currentChapter as string) + 1}
          </Text>
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
      <View style={styles.emptyLibraryContainer}>
        <MaterialIcons name="library-books" size={80} color={colorScheme === 'dark' ? '#444' : '#ccc'} />
        <Text style={styles.emptyLibraryText}>Your library is empty</Text>
        <Text style={styles.emptyLibrarySubtext}>Start reading stories to see them here</Text>
      </View>
    );
  }

  // Render the grid of library items
  return (
    <View style={styles.container}>
      {!libraryItems || libraryItems.length === 0 ? (
        <View style={styles.emptyLibraryContainer}>
          <MaterialIcons name="library-books" size={80} color={colorScheme === 'dark' ? '#444' : '#ccc'} />
          <Text style={styles.emptyLibraryText}>Your library is empty</Text>
          <Text style={styles.emptyLibrarySubtext}>Start reading stories to see them here</Text>
        </View>
      ) : (
        <FlatList
          data={libraryItems}
          renderItem={renderLibraryItem}
          keyExtractor={(item) => item.storyId}
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
      )}
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
  emptyLibraryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyLibraryText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyLibrarySubtext: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
}); 