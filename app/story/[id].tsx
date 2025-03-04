/**
 * Story Details Screen Component
 * 
 * This screen displays detailed information about a story before the user starts reading it.
 * It shows:
 * - Story title and author
 * - Cover image 
 * - Description
 * - Read Now button
 * - Themed components for dark/light mode support
 *
 * When the user taps "Read Now":
 * - If first time reading: they are directed to character name input page
 * - If previously started: they continue from their last position
 */


import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchStoryMetadata } from "../../services/storyService";
import type { StoryMetadata } from "../../services/storyService";
import { hasStartedReading } from "../../services/userService";
import { isAuthenticated } from "../../services/firebaseAuth";

export default function StoryDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [isLoading, setIsLoading] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  const { data: story, isLoading: isStoryLoading, error } = useQuery<StoryMetadata>({
    queryKey: ['story-details', id],
    queryFn: () => fetchStoryMetadata(id as string),
  });

  // Check if user has started reading this story before
  useEffect(() => {
    const checkReadingStatus = async () => {
      if (isAuthenticated() && story) {
        try {
          const result = await hasStartedReading(id as string);
          setHasStarted(result.hasStarted);
        } catch (error) {
          console.error('Error checking reading status:', error);
        }
      }
      setIsLoading(false);
    };

    if (!isStoryLoading && story) {
      checkReadingStatus();
    }
  }, [id, isStoryLoading, story]);

  // Configure the navigation header
  React.useEffect(() => {
    router.setParams({
      title: story?.title || 'Story Details',
    });
  }, [story?.title]);

  if (isStoryLoading || isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#4a9eff' : '#2b7de9'} />
      </View>
    );
  }

  if (error || !story) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load story details</Text>
      </View>
    );
  }

  const handleReadNow = () => {
    // Navigate to the story reader page
    // The story reader component will handle showing the character input screen 
    // or continuing from the last position based on Firebase data
    router.push(`/${story.id}`);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: story.title,
          headerBackTitle: 'Home',
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Image
          source={{ uri: story.coverImage }}
          style={styles.coverImage}
          resizeMode="cover"
        />
        
        <View style={styles.detailsContainer}>
          <Text style={styles.title}>{story.title}</Text>
          <Text style={styles.author}>by {story.author}</Text>
          
          <Text style={styles.description}>{story.description}</Text>
          
          <TouchableOpacity
            style={[
              styles.readButton,
              { backgroundColor: colorScheme === 'dark' ? '#4a9eff' : '#2b7de9' }
            ]}
            onPress={handleReadNow}
          >
            <Text style={styles.readButtonText}>
              {hasStarted ? 'Continue Reading' : 'Read Now'}
            </Text>
            <MaterialIcons name="arrow-forward" size={24} color="white" style={styles.readButtonIcon} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  coverImage: {
    width: '100%',
    height: 400,
  },
  detailsContainer: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  author: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  readButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  readButtonIcon: {
    marginLeft: 4,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    margin: 24,
  },
}); 