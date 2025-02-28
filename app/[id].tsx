/**
 * Story Reader Screen Component
 * 
 * This is the main screen for reading an interactive story. It handles:
 * - Loading and displaying story content chapter by chapter
 * - Character name input on the first page
 * - Decision points where users can make choices
 * - Navigation between chapters
 * - Animated text transitions
 * - Dark/light mode theming
 * - Registration requirement after the first chapter
 *
 * Story content is structured into chapters with segments that can be text or decision points.
 * The first page always prompts for the character's name which is then used throughout the story.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  Alert,
  Animated,
  Easing,
  Text as RNText,
  View as RNView,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchStoryContent, updateReadingProgress } from '@/services/storyService';
import { isAuthenticated } from '@/services/firebaseAuth';

export default function StoryReader() {
  const { id, initialChapter, currentPageIndex: savedPageIndex } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const [characterName, setCharacterName] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [showingResponse, setShowingResponse] = useState(false);
  const [isNavigatingToSavedPosition, setIsNavigatingToSavedPosition] = useState(false);
  
  // Add animation values
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const choicesFadeAnim = React.useRef(new Animated.Value(0)).current;
  const responseFadeAnim = React.useRef(new Animated.Value(0)).current;

  const { data: story, isLoading, error } = useQuery({
    queryKey: ['story-content', id],
    queryFn: () => fetchStoryContent(id as string),
  });

  const router = useRouter();

  // Safe to use in effects since undefined is handled
  const currentChapter = story?.chapters[currentChapterIndex];
  const currentSegment = currentChapter?.segments[currentSegmentIndex];
  const isFirstPage = currentSegmentIndex === -1;

  useEffect(() => {
    if (story) {
      setCharacterName(story.defaultCharacterName);
    }
  }, [story]);

  useEffect(() => {
    // Show choices if the current segment is a decision point and no choice has been made
    const shouldShowChoices = currentSegment?.type === 'decisionPoint' && !selectedChoice;
    if (shouldShowChoices) {
      showChoices();
    }
  }, [currentChapterIndex, currentSegmentIndex, currentSegment, selectedChoice]);

  // Handle initial chapter after registration
  useEffect(() => {
    if (story && initialChapter && currentChapterIndex === 0) {
      const targetChapter = parseInt(initialChapter as string, 10);
      if (!isNaN(targetChapter) && targetChapter > 0 && targetChapter < story.chapters.length) {
        setCurrentChapterIndex(targetChapter);
        setCurrentSegmentIndex(0);
      }
    }
  }, [story, initialChapter]);

  // Handle navigation to saved page position from library
  useEffect(() => {
    if (story && savedPageIndex && !isNavigatingToSavedPosition) {
      const pageIndexToNavigate = parseInt(typeof savedPageIndex === 'string' ? savedPageIndex : Array.isArray(savedPageIndex) ? savedPageIndex[0] : '0', 10);
      
      if (!isNaN(pageIndexToNavigate) && pageIndexToNavigate >= 0) {
        setIsNavigatingToSavedPosition(true);
        
        // Skip the character name input screen if we're navigating to a saved position
        if (currentSegmentIndex === -1) {
          setCurrentSegmentIndex(0);
        }
        
        // Calculate which chapter this page belongs to
        let foundPage = false;
        let totalSegmentsPassed = 0;
        
        for (let i = 0; i < story.chapters.length; i++) {
          const chapter = story.chapters[i];
          if (totalSegmentsPassed + chapter.segments.length > pageIndexToNavigate) {
            // Found the chapter containing our target page
            setCurrentChapterIndex(i);
            setCurrentSegmentIndex(pageIndexToNavigate - totalSegmentsPassed);
            foundPage = true;
            break;
          }
          totalSegmentsPassed += chapter.segments.length;
        }
        
        if (!foundPage) {
          // If we couldn't find the exact page, just go to the first segment
          setCurrentChapterIndex(0);
          setCurrentSegmentIndex(0);
        }
      }
    }
  }, [story, savedPageIndex, isNavigatingToSavedPosition]);

  // Update reading progress when page changes
  useEffect(() => {
    if (isAuthenticated() && story && currentChapter && !isFirstPage) {
      // Calculate the absolute page index across all chapters
      let absolutePageIndex = 0;
      for (let i = 0; i < currentChapterIndex; i++) {
        absolutePageIndex += story.chapters[i].segments.length;
      }
      absolutePageIndex += currentSegmentIndex;
      
      // Update reading progress in Firestore
      updateReadingProgress(story.id, absolutePageIndex.toString())
        .catch(error => console.error('Failed to update reading progress:', error));
    }
  }, [currentChapterIndex, currentSegmentIndex, story, isFirstPage]);

  // Configure the navigation header
  useEffect(() => {
    if (story) {
      router.setParams({
        title: story.title,
      });
    }
  }, [story?.title]);

  const animateContentChange = (callback?: () => void) => {
    // Fade out current content
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Execute callback (page change logic)
      if (callback) callback();
      
      // Reset animation values
      slideAnim.setValue(50);
      
      // Fade in new content
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const showChoices = () => {
    Animated.timing(choicesFadeAnim, {
      toValue: 1,
      duration: 500,
      delay: 500,
      useNativeDriver: true,
    }).start();
  };

  const showResponse = () => {
    Animated.timing(responseFadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const handleNextSegment = () => {
    if (!story || !currentChapter) return;
    
    // First page validation - require character name
    if (isFirstPage) {
      if (!characterName.trim()) {
        Alert.alert('Name Required', 'Please enter a name before continuing.');
        return;
      }
      
      // Move from name input screen to first actual segment
      animateContentChange(() => {
        setCurrentSegmentIndex(0); // Start at the first segment (index 0)
      });
      return;
    }
    
    // If we're at a decision point and haven't made a choice yet, don't proceed
    if (currentSegment?.type === 'decisionPoint' && !selectedChoice) {
      Alert.alert('Make a choice', 'Please select one of the options to continue.');
      return;
    }
    
    // Check if we're at the end of the first chapter and user is not authenticated
    if (currentChapterIndex === 0 && 
        currentSegmentIndex === currentChapter.segments.length - 1 && 
        !isAuthenticated()) {
      Alert.alert(
        'Sign Up Required',
        'To continue reading further chapters, please register for an account.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Register', 
            onPress: () => router.push({
              pathname: '/register',
              params: { 
                returnTo: `/${id}`,
                returnToChapter: '1'  // We want to return to chapter 1 (index 1)
              }
            })
          }
        ]
      );
      return;
    }
    
    animateContentChange(() => {
      // Reset choice state
      setSelectedChoice(null);
      setShowingResponse(false);
      
      // Reset animation values
      choicesFadeAnim.setValue(0);
      responseFadeAnim.setValue(0);
      
      // Check if we're at the end of the current chapter
      if (currentSegmentIndex >= currentChapter.segments.length - 1) {
        // Check if we're at the last chapter
        if (currentChapterIndex >= story.chapters.length - 1) {
          // We're at the end of the story
          Alert.alert(
            'End of Story',
            'You have reached the end of this story.',
            [
              {
                text: 'Return to Home',
                onPress: () => router.push('/'),
              },
            ]
          );
          return;
        }
        
        // Move to the next chapter
        setCurrentChapterIndex(currentChapterIndex + 1);
        setCurrentSegmentIndex(0);
      } else {
        // Move to the next segment in the current chapter
        setCurrentSegmentIndex(currentSegmentIndex + 1);
      }
    });
  };

  const handlePreviousSegment = () => {
    if (!story || !currentChapter) return;
    
    // Don't allow going back from the first segment of the first chapter
    if (currentChapterIndex === 0 && currentSegmentIndex <= 0) {
      return;
    }
    
    animateContentChange(() => {
      // Reset choice state
      setSelectedChoice(null);
      setShowingResponse(false);
      
      // Reset animation values
      choicesFadeAnim.setValue(0);
      responseFadeAnim.setValue(0);
      
      // Check if we're at the beginning of the current chapter
      if (currentSegmentIndex <= 0) {
        // Move to the previous chapter
        const previousChapterIndex = currentChapterIndex - 1;
        const previousChapter = story.chapters[previousChapterIndex];
        
        setCurrentChapterIndex(previousChapterIndex);
        setCurrentSegmentIndex(previousChapter.segments.length - 1);
      } else {
        // Move to the previous segment in the current chapter
        setCurrentSegmentIndex(currentSegmentIndex - 1);
      }
    });
  };

  const handleChoice = (choice: string) => {
    setSelectedChoice(choice);
    setShowingResponse(true);
    showResponse();
  };

  const renderContent = () => {
    if (isFirstPage) {
      return (
        <View style={styles.firstPageContainer}>
          <Text style={styles.storyTitle}>
            Welcome to {story?.title}
          </Text>
          <Text style={styles.namePrompt}>
            Before we begin your adventure, what shall we call you?
          </Text>
          <TextInput
            style={[
              styles.nameInput,
              { borderColor: colorScheme === 'dark' ? '#4a9eff' : '#2b7de9' }
            ]}
            value={characterName}
            onChangeText={setCharacterName}
            placeholder="Enter your name"
            placeholderTextColor="#666"
          />
        </View>
      );
    }

    if (!currentChapter || !currentSegment) {
      return (
        <Text style={styles.errorText}>
          Error: Could not load chapter or segment content
        </Text>
      );
    }

    if (currentSegment.type === 'text') {
      const processedContent = currentSegment.content?.replace(
        /({characterName}|{YN})/g,
        characterName
      ) || '';

      return (
        <>
          <Text style={styles.chapterTitle}>
            {currentChapter.title}
          </Text>
          <RNText style={{
            fontSize: 18,
            marginBottom: 20,
            color: colorScheme === 'dark' ? '#fff' : '#000'
          }}>
            {processedContent}
          </RNText>
        </>
      );
    }

    if (currentSegment.type === 'decisionPoint') {
      return (
        <>
          <Text style={styles.chapterTitle}>
            {currentChapter.title}
          </Text>
          
          {!showingResponse && (
            <View style={styles.decisionContainer}>
              {currentSegment.choices?.map((choice) => (
                <TouchableOpacity
                  key={choice}
                  style={[
                    styles.choiceButton,
                    {
                      backgroundColor:
                        selectedChoice === choice
                          ? colorScheme === 'dark'
                            ? '#4a9eff'
                            : '#2b7de9'
                          : 'transparent',
                      borderColor: colorScheme === 'dark' ? '#4a9eff' : '#2b7de9',
                    },
                  ]}
                  onPress={() => handleChoice(choice)}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      selectedChoice === choice && styles.selectedChoiceText,
                    ]}
                  >
                    {choice}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {showingResponse && currentSegment.responses && (
            <View>
              <Text style={styles.responseText}>
                {currentSegment.responses[selectedChoice!].replace(
                  /({characterName}|{YN})/g,
                  characterName
                )}
              </Text>
            </View>
          )}
        </>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#4a9eff' : '#2b7de9'} />
      </View>
    );
  }

  if (error || !story) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load story content</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: story.title,
          headerBackTitle: 'Home',
        }}
      />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
        >
          <Animated.View
            style={[
              styles.contentWrapper,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {renderContent()}
          </Animated.View>
        </ScrollView>

        <View style={[
          styles.navigationContainer,
          isFirstPage && styles.firstPageNavigationContainer
        ]}>
          {isFirstPage ? (
            <TouchableOpacity
              style={[
                styles.startButton,
                { backgroundColor: colorScheme === 'dark' ? '#4a9eff' : '#2b7de9' },
              ]}
              onPress={handleNextSegment}
            >
              <Text style={styles.startButtonText}>Begin</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.navButton,
                  { backgroundColor: colorScheme === 'dark' ? '#333' : '#e0e0e0' },
                ]}
                onPress={handlePreviousSegment}
                disabled={currentChapterIndex === 0 && currentSegmentIndex === 0}
              >
                <MaterialIcons
                  name="arrow-back"
                  size={24}
                  color={
                    currentChapterIndex === 0 && currentSegmentIndex === 0
                      ? '#999'
                      : colorScheme === 'dark'
                      ? '#fff'
                      : '#333'
                  }
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.navButton,
                  { backgroundColor: colorScheme === 'dark' ? '#333' : '#e0e0e0' },
                ]}
                onPress={handleNextSegment}
                disabled={
                  currentSegment?.type === 'decisionPoint' && !selectedChoice
                }
              >
                <MaterialIcons
                  name="arrow-forward"
                  size={24}
                  color={
                    currentSegment?.type === 'decisionPoint' && !selectedChoice
                      ? '#999'
                      : colorScheme === 'dark'
                      ? '#fff'
                      : '#333'
                  }
                />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  firstPageContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  storyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  chapterTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  namePrompt: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  nameInput: {
    width: '100%',
    padding: 15,
    borderWidth: 2,
    borderRadius: 10,
    fontSize: 18,
    marginBottom: 20,
  },
  decisionContainer: {
    marginVertical: 20,
  },
  choiceButton: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 15,
    marginVertical: 8,
  },
  choiceText: {
    fontSize: 16,
    textAlign: 'center',
  },
  selectedChoiceText: {
    color: 'white',
  },
  responseText: {
    fontSize: 16,
    fontStyle: 'italic',
    marginVertical: 10,
    color: '#666',
  },
  mainContent: {
    fontSize: 16,
    marginTop: 10,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  navButton: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  contentWrapper: {
    flex: 1,
  },
  startButton: {
    width: 200,
    height: 60,
    borderWidth: 0,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  startButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  firstPageNavigationContainer: {
    justifyContent: 'center',
  },
}); 