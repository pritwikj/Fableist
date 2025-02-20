/**
 * Story Reader Screen Component
 * 
 * This is the main screen for reading an interactive story. It handles:
 * - Loading and displaying story content page by page
 * - Character name input on the first page
 * - Decision points where users can make choices
 * - Navigation between pages and chapters
 * - Animated text transitions
 * - Dark/light mode theming
 *
 * Story content is structured into pages with optional decision points that affect
 * the narrative flow. The first page always prompts for the character's name which is then used throughout the story.
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
import { useLocalSearchParams, Stack } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchStoryContent } from '@/services/storyService';

export default function StoryReader() {
  const { id } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(-1);
  const [characterName, setCharacterName] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [showingResponse, setShowingResponse] = useState(false);
  
  // Add animation values
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const choicesFadeAnim = React.useRef(new Animated.Value(0)).current;
  const responseFadeAnim = React.useRef(new Animated.Value(0)).current;

  const { data: story, isLoading, error } = useQuery({
    queryKey: ['story-content', id],
    queryFn: () => fetchStoryContent(id as string),
  });

  // Safe to use in effects since undefined is handled
  const currentChapter = story?.chapters[currentChapterIndex];
  const currentPage = currentChapter?.pages[currentPageIndex];

  useEffect(() => {
    if (story) {
      setCharacterName(story.defaultCharacterName);
    }
  }, [story]);

  useEffect(() => {
    // Move condition inside the effect
    const shouldShowChoices = currentPage?.decisionPoint && !selectedChoice;
    if (shouldShowChoices) {
      showChoices();
    }
  }, [currentChapterIndex, currentPageIndex, currentPage, selectedChoice]);

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
        <Text style={styles.errorText}>Failed to load story</Text>
      </View>
    );
  }

  const isFirstPage = currentPageIndex === -1;
  const isLastPage = currentChapterIndex === story.chapters.length - 1 && 
                    currentChapter && currentPageIndex === currentChapter.pages.length - 1;

  const animateContentChange = (callback?: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(slideAnim, {
        toValue: -20,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (callback) callback();
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
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
      easing: Easing.out(Easing.ease),
    }).start();
  };

  const showResponse = () => {
    Animated.timing(responseFadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start();
  };

  const handleNextPage = () => {
    // First page validation - require character name
    if (isFirstPage) {
      if (!characterName.trim()) {
        Alert.alert('Name Required', 'Please enter a name before continuing.');
        return;
      }
    }
    // Only check for decisions if we're not on the first page
    else if (currentPage?.decisionPoint && !showingResponse) {
      if (!selectedChoice) {
        Alert.alert('Make a choice', 'Please select a choice before continuing.');
        return;
      }
    }

    animateContentChange(() => {
      // If we're at the end of the current chapter but not the last chapter
      if (currentChapter && currentPageIndex === currentChapter.pages.length - 1 && 
          currentChapterIndex < story.chapters.length - 1) {
        setCurrentChapterIndex(prev => prev + 1);
        setCurrentPageIndex(0);
      } else if (!isLastPage) {
        setCurrentPageIndex(prev => prev + 1);
      }
      setSelectedChoice(null);
      setShowingResponse(false);
      choicesFadeAnim.setValue(0);
      responseFadeAnim.setValue(0);
    });
  };

  const handlePreviousPage = () => {
    if (!isFirstPage) {
      animateContentChange(() => {
        // If we're at the start of a chapter (but not the first chapter)
        if (currentPageIndex === 0 && currentChapterIndex > 0) {
          setCurrentChapterIndex(prev => prev - 1);
          const previousChapter = story.chapters[currentChapterIndex - 1];
          setCurrentPageIndex(previousChapter.pages.length - 1);
        } else {
          setCurrentPageIndex(prev => prev - 1);
        }
        setSelectedChoice(null);
        setShowingResponse(false);
        choicesFadeAnim.setValue(0);
        responseFadeAnim.setValue(0);
      });
    }
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
            Welcome to {story.title}
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

    if (!currentChapter || !currentPage) {
      return (
        <Text style={styles.errorText}>
          Error: Could not load chapter or page content
        </Text>
      );
    }

    const processedContent = currentPage.mainContent.replace(
      /{characterName}/g,
      characterName
    );

    return (
      <>
        <Text style={styles.chapterTitle}>
          {currentChapter.title}
        </Text>
        <RNText style={{
          fontSize: 18,
          marginBottom: 20,
          color: '#000'
        }}>
          {processedContent}
        </RNText>
        
        {currentPage.decisionPoint && !showingResponse && (
          <View style={styles.decisionContainer}>
            {currentPage.decisionPoint.choices.map((choice) => (
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

        {showingResponse && currentPage.decisionPoint && (
          <View>
            <Text style={styles.responseText}>
              {currentPage.decisionPoint.responses[selectedChoice!]}
            </Text>
            <Text style={styles.mainContent}>
              {currentPage.decisionPoint.remainingContent}
            </Text>
          </View>
        )}
      </>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: story.title,
          headerBackTitle: 'Stories',
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#fff', padding: 20 }}>
        <ScrollView>
          {renderContent()}
        </ScrollView>

        <View style={styles.navigationContainer}>
          <TouchableOpacity
            style={[
              styles.navButton,
              isFirstPage && styles.disabledButton,
              { borderColor: colorScheme === 'dark' ? '#4a9eff' : '#2b7de9' },
            ]}
            onPress={handlePreviousPage}
            disabled={isFirstPage}
          >
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={
                isFirstPage
                  ? '#666'
                  : colorScheme === 'dark'
                  ? '#4a9eff'
                  : '#2b7de9'
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.navButton,
              isLastPage && styles.disabledButton,
              { borderColor: colorScheme === 'dark' ? '#4a9eff' : '#2b7de9' },
            ]}
            onPress={handleNextPage}
            disabled={isLastPage}
          >
            <MaterialIcons
              name="arrow-forward"
              size={24}
              color={
                isLastPage
                  ? '#666'
                  : colorScheme === 'dark'
                  ? '#4a9eff'
                  : '#2b7de9'
              }
            />
          </TouchableOpacity>
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
}); 