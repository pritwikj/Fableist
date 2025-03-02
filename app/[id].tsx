/**
 * Story Reader Screen Component
 * 
 * This is the main screen for reading an interactive story. It handles:
 * - Loading and displaying story content chapter by chapter
 * - Character name input on the first page
 * - Decision points where users can make choices
 * - Scrollable reading experience with blocked scrolling at decision points
 * - Animated text transitions
 * - Dark/light mode theming
 * - Registration requirement after the first chapter
 *
 * Story content is structured into chapters with segments that can be text or decision points.
 * The first page always prompts for the character's name which is then used throughout the story.
 */

import React, { useState, useEffect, useRef } from 'react';
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
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchStoryContent, updateReadingProgress } from '@/services/storyService';
import { fetchUserProfile, updateUserCoins, isChapterUnlocked, unlockChapter as unlockChapterService } from '@/services/userService';
import { isAuthenticated } from '@/services/firebaseAuth';

// Define user profile interface
interface UserProfile {
  id: string;
  displayName?: string;
  email?: string;
  coins?: number;
  joinDate?: string;
  [key: string]: any;
}

export default function StoryReader() {
  const { id, initialChapter } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isFirstPage, setIsFirstPage] = useState(true);
  const [characterName, setCharacterName] = useState('');
  const [storySegments, setStorySegments] = useState<any[]>([]);
  const [isChapterEnd, setIsChapterEnd] = useState(false);
  const [isNavigatingToSavedPosition, setIsNavigatingToSavedPosition] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [unlockedChapters, setUnlockedChapters] = useState<number[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  // Remove the direction tracking and use a more reliable approach
  const [lastScrollAction, setLastScrollAction] = useState<number>(0);
  // Track scroll position consistently
  const [isAtTop, setIsAtTop] = useState<boolean>(false);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(false);
  
  // Add animation values
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const responseFadeAnim = React.useRef(new Animated.Value(0)).current;
  const nextChapterFadeAnim = React.useRef(new Animated.Value(0)).current;

  const { data: story, isLoading, error } = useQuery({
    queryKey: ['story-content', id],
    queryFn: () => fetchStoryContent(id as string),
  });
  
  // Fetch user profile to get coin balance
  const { data: userProfile, refetch: refetchUserProfile } = useQuery<UserProfile>({
    queryKey: ['user-profile'],
    queryFn: fetchUserProfile,
    enabled: isAuthenticated(),
  });

  const router = useRouter();

  // Safe to use in effects since undefined is handled
  const currentChapter = story?.chapters[currentChapterIndex];
  const hasNextChapter = story && currentChapterIndex < story.chapters.length - 1;
  const hasPreviousChapter = story && currentChapterIndex > 0;

  useEffect(() => {
    if (story) {
      setCharacterName(story.defaultCharacterName);
    }
  }, [story]);

  // Handle navigation to saved chapter position from library
  useEffect(() => {
    if (story && initialChapter && !isNavigatingToSavedPosition) {
      const chapterIndexToNavigate = typeof initialChapter === 'number' 
        ? initialChapter 
        : parseInt(typeof initialChapter === 'string' ? initialChapter : Array.isArray(initialChapter) ? initialChapter[0] : '0', 10);
      
      if (!isNaN(chapterIndexToNavigate) && chapterIndexToNavigate >= 0 && chapterIndexToNavigate < story.chapters.length) {
        setIsNavigatingToSavedPosition(true);
        setCurrentChapterIndex(chapterIndexToNavigate);
        
        // Skip the character name input screen
        if (isFirstPage) {
          setIsFirstPage(false);
          loadChapterSegments(chapterIndexToNavigate);
        }
      }
    }
  }, [story, initialChapter, isNavigatingToSavedPosition]);

  // Load user's unlocked chapters from their progress
  useEffect(() => {
    const loadUnlockedChapters = async () => {
      if (story && isAuthenticated()) {
        // We consider all chapters <= 4 (first 5 chapters) as free
        const freeChapters = Array.from({ length: 5 }, (_, i) => i);
        
        // For chapters > 4, check if they've been previously unlocked
        if (story.chapters.length > 5) {
          const storyId = id as string;
          
          // Initialize with free chapters
          let allUnlockedChapters = [...freeChapters];
          
          // Check each non-free chapter if it's already unlocked
          for (let i = 5; i < story.chapters.length; i++) {
            const isUnlocked = await isChapterUnlocked(storyId, i);
            if (isUnlocked) {
              allUnlockedChapters.push(i);
            }
          }
          
          setUnlockedChapters(allUnlockedChapters);
        } else {
          // If there are 5 or fewer chapters, all are free
          setUnlockedChapters(freeChapters);
        }
      }
    };
    
    loadUnlockedChapters();
  }, [story, id]);

  // Update reading progress when chapter changes
  useEffect(() => {
    if (isAuthenticated() && story && currentChapter && !isFirstPage) {
      // Update reading progress via Cloud Function to ensure secure database operations
      // This approach ensures server-side security rules are enforced
      updateReadingProgress(story.id, currentChapterIndex)
        .catch(error => console.error('Failed to update reading progress:', error));
      
      // Mark this chapter as unlocked
      setUnlockedChapters(prev => {
        if (!prev.includes(currentChapterIndex)) {
          return [...prev, currentChapterIndex];
        }
        return prev;
      });
    }
  }, [currentChapterIndex, story, isFirstPage]);

  // Configure the navigation header
  useEffect(() => {
    if (story) {
      router.setParams({
        title: story.title,
      });
    }
  }, [story?.title]);

  const loadChapterSegments = (chapterIndex: number, maxSegmentIndex?: number) => {
    if (!story || !story.chapters[chapterIndex]) return;
    
    const chapter = story.chapters[chapterIndex];
    const segments = [];
    
    // Determine how many segments to load
    let endIndex = maxSegmentIndex !== undefined 
      ? maxSegmentIndex 
      : chapter.segments.length;
    
    // If no max index specified, load segments until we hit a decision point or the end
    if (maxSegmentIndex === undefined) {
      for (let i = 0; i < chapter.segments.length; i++) {
        segments.push({
          ...chapter.segments[i],
          index: i
        });
        
        // Stop if we hit a decision point
        if (chapter.segments[i].type === 'decisionPoint') {
          endIndex = i;
          break;
        }
      }
    } else {
      // Load up to the specified max index
      for (let i = 0; i <= endIndex; i++) {
        segments.push({
          ...chapter.segments[i],
          index: i
        });
      }
    }
    
    setStorySegments(segments);
    
    // Check if we're at the end of the chapter
    if (endIndex === chapter.segments.length - 1) {
      setIsChapterEnd(true);
      // Show the "Next Chapter" indicator with animation
      setTimeout(() => {
        Animated.timing(nextChapterFadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();
      }, 500);
    } else {
      setIsChapterEnd(false);
      nextChapterFadeAnim.setValue(0);
    }
  };

  // Check if a chapter requires payment
  const isChapterLocked = (chapterIndex: number): boolean => {
    // First 5 chapters (indices 0-4) are free
    if (chapterIndex <= 4) return false;
    
    // If chapter is in unlockedChapters, it's already been unlocked
    if (unlockedChapters.includes(chapterIndex)) return false;
    
    return true;
  };

  // Unlock a chapter by paying coins
  const unlockChapter = async (chapterIndex: number): Promise<boolean> => {
    if (!isAuthenticated() || !userProfile) {
      Alert.alert('Authentication Required', 'Please log in to unlock chapters.');
      return false;
    }

    const coinCost = 5; // Cost per chapter
    const currentCoins = userProfile.coins || 0;

    if (currentCoins < coinCost) {
      Alert.alert('Insufficient Coins', 
        `You need ${coinCost} coins to unlock this chapter. You currently have ${currentCoins} coins.`);
      return false;
    }

    try {
      // First subtract coins using the cloud function
      const coinResult = await updateUserCoins(coinCost, 'subtract');
      
      if (!coinResult.success) {
        Alert.alert('Error', coinResult.error || 'Failed to update coin balance');
        return false;
      }

      // Then mark the chapter as unlocked in the database
      const unlockResult = await unlockChapterService(id as string, chapterIndex);
      
      if (!unlockResult) {
        // If unlocking failed, attempt to refund the coins
        await updateUserCoins(coinCost, 'add');
        Alert.alert('Error', 'Failed to unlock chapter. Your coins have been refunded.');
        return false;
      }

      // Update the local unlocked chapters state
      setUnlockedChapters(prev => [...prev, chapterIndex]);
      
      // Refresh user profile to get updated coin balance
      refetchUserProfile();
      
      return true;
    } catch (error) {
      console.error('Error unlocking chapter:', error);
      Alert.alert('Error', 'Failed to unlock chapter. Please try again.');
      return false;
    }
  };

  // Modified handleNextChapter with coin check
  const handleNextChapter = async () => {
    if (hasNextChapter) {
      const nextChapterIndex = currentChapterIndex + 1;
      
      // Check if chapter needs to be unlocked
      if (isChapterLocked(nextChapterIndex)) {
        Alert.alert(
          'Unlock Chapter',
          `This chapter costs 5 coins to unlock. Do you want to continue?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Unlock',
              onPress: async () => {
                const unlocked = await unlockChapter(nextChapterIndex);
                if (unlocked) {
                  // Continue with chapter navigation
                  setCurrentChapterIndex(nextChapterIndex);
                  animateContentChange(() => {
                    setIsChapterEnd(false);
                    loadChapterSegments(nextChapterIndex);
                    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                  });
                }
              },
            },
          ]
        );
        return;
      }
      
      // If chapter is free or already unlocked, proceed normally
      setCurrentChapterIndex(nextChapterIndex);
      animateContentChange(() => {
        setIsChapterEnd(false);
        loadChapterSegments(nextChapterIndex);
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      });
    }
  };

  // Modified handleScroll with coin check for next chapter
  const handleScroll = async (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    
    // Don't process scroll events during animations
    if (isAnimating) return;
    
    // First, just track the scroll position without taking action
    const paddingToBottom = 20;
    const atBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    const atTop = contentOffset.y <= 0;
    
    // Update position state
    setIsAtBottom(atBottom);
    setIsAtTop(atTop);
    
    // Don't proceed with navigation logic if we're not at chapter end
    if (atBottom && isChapterEnd && hasNextChapter) {
      // Only navigate if we've been at the bottom for a moment (prevents accidental triggers)
      const now = Date.now();
      if (now - lastScrollAction < 600) return;
      
      // Set timestamp to prevent rapid navigation
      setLastScrollAction(now);
      
      // Rest of next chapter navigation code
      const nextChapterIndex = currentChapterIndex + 1;
      
      // Check if chapter needs to be unlocked
      if (isChapterLocked(nextChapterIndex)) {
        Alert.alert(
          'Unlock Chapter',
          `This chapter costs 5 coins to unlock. Do you want to continue?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Unlock',
              onPress: async () => {
                const unlocked = await unlockChapter(nextChapterIndex);
                if (unlocked) {
                  // Continue with chapter navigation
                  setCurrentChapterIndex(nextChapterIndex);
                  animateContentChange(() => {
                    setIsChapterEnd(false);
                    loadChapterSegments(nextChapterIndex);
                    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
                  });
                }
              },
            },
          ]
        );
        return;
      }
      
      // If chapter is free or already unlocked, proceed normally
      setCurrentChapterIndex(nextChapterIndex);
      
      // Load segments from the next chapter with animation
      animateContentChange(() => {
        setIsChapterEnd(false);
        loadChapterSegments(nextChapterIndex);
        
        // Scroll to the top for the new chapter
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      });
    }
    // Separate condition for previous chapter
    else if (atTop && hasPreviousChapter) {
      // Add a slight delay to ensure this is intentional
      const now = Date.now();
      if (now - lastScrollAction < 600) return;
      
      // Set timestamp to prevent rapid navigation
      setLastScrollAction(now);
      
      const prevChapterIndex = currentChapterIndex - 1;
      setCurrentChapterIndex(prevChapterIndex);
      
      // Load segments from the previous chapter with animation
      animateContentChange(() => {
        setIsChapterEnd(true); // Set to true since we're loading a complete chapter
        loadChapterSegments(prevChapterIndex);
        
        // Scroll to the bottom of the previous chapter to position correctly
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }, 100);
      });
    }
  };

  const handlePreviousChapter = () => {
    if (hasPreviousChapter) {
      const prevChapterIndex = currentChapterIndex - 1;
      setCurrentChapterIndex(prevChapterIndex);
      
      // Load segments from the previous chapter with animation
      animateContentChange(() => {
        setIsChapterEnd(true); // Set to true since we're loading a complete chapter
        loadChapterSegments(prevChapterIndex);
        
        // Scroll to the top for the new chapter
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      });
    }
  };

  const animateContentChange = (callback?: () => void) => {
    // Set animating flag to prevent other animations from starting
    setIsAnimating(true);
    
    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start(() => {
      // Execute the callback when faded out
      if (callback) callback();
      
      // Reset values for animation
      slideAnim.setValue(50);
      
      // Fade in with slide
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Animation completed, clear animating flag
        setIsAnimating(false);
      });
    });
  };

  const handleChoice = (segment: any, choice: string) => {
    // Update the segment with the selected choice
    const updatedSegments = storySegments.map(s => {
      if (s.index === segment.index) {
        return {
          ...s,
          selectedChoice: choice,
          showResponse: true
        };
      }
      return s;
    });
    
    setStorySegments(updatedSegments);
    
    // Show the response with animation
    Animated.timing(responseFadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    
    // After a brief delay, load the next segments
    setTimeout(() => {
      if (currentChapter) {
        const lastSegmentIndex = segment.index;
        
        // Check if there are more segments in the chapter
        if (lastSegmentIndex < currentChapter.segments.length - 1) {
          // Load segments until the next decision point or end of chapter
          const nextSegments = [...updatedSegments];
          let foundNextDecisionPoint = false;
          
          for (let i = lastSegmentIndex + 1; i < currentChapter.segments.length; i++) {
            const nextSegment = {
              ...currentChapter.segments[i],
              index: i
            };
            
            nextSegments.push(nextSegment);
            
            // Stop if we hit another decision point
            if (nextSegment.type === 'decisionPoint') {
              foundNextDecisionPoint = true;
              break;
            }
          }
          
          // Check if we're at the end of the chapter
          if (nextSegments[nextSegments.length - 1].index === currentChapter.segments.length - 1) {
            setIsChapterEnd(true);
            // Show the "Next Chapter" indicator with animation
            setTimeout(() => {
              Animated.timing(nextChapterFadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
              }).start();
            }, 500);
          }
          
          setStorySegments(nextSegments);
          
          // Scroll down a bit to show new content
          if (foundNextDecisionPoint) {
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 300);
          }
        } else {
          // We're at the end of the chapter, show the "next chapter" indicator
          setIsChapterEnd(true);
          
          // Show the "Next Chapter" indicator with animation
          setTimeout(() => {
            Animated.timing(nextChapterFadeAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }).start();
          }, 500);
        }
      }
    }, 500);
  };

  const handleStartReading = () => {
    if (!characterName.trim()) {
      Alert.alert('Name Required', 'Please enter a name before continuing.');
      return;
    }
    
    // Move from name input screen to first actual segment
    animateContentChange(() => {
      setIsFirstPage(false);
      loadChapterSegments(currentChapterIndex);
    });
  };

  const renderFirstPage = () => {
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
        <TouchableOpacity
          style={[
            styles.startButton,
            { backgroundColor: colorScheme === 'dark' ? '#4a9eff' : '#2b7de9' }
          ]}
          onPress={handleStartReading}
        >
          <Text style={styles.startButtonText}>Begin</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderNextChapterIndicator = () => {
    if (!isChapterEnd || !hasNextChapter) return null;
    
    const nextChapterIndex = currentChapterIndex + 1;
    const isNextChapterLocked = isChapterLocked(nextChapterIndex);
    
    return (
      <Animated.View 
        style={[
          styles.nextChapterContainer,
          { opacity: nextChapterFadeAnim }
        ]}
      >
        <RNText style={styles.nextChapterText}>
          {story?.chapters[nextChapterIndex]?.title}
        </RNText>
        <MaterialIcons 
          name={isNextChapterLocked ? "lock" : "keyboard-arrow-down"} 
          size={32} 
          color={colorScheme === 'dark' ? '#4a9eff' : '#2b7de9'} 
        />
        <RNText style={styles.nextChapterInstructions}>
          {isNextChapterLocked 
            ? "Costs 5 coins to unlock" 
            : "Scroll down to continue"}
        </RNText>
      </Animated.View>
    );
  };

  const renderSegment = (segment: any) => {
    if (segment.type === 'text') {
      const processedContent = segment.content?.replace(
        /({characterName}|{YN})/g,
        characterName
      ) || '';

      return (
        <RNView key={`text-${segment.index}`} style={styles.textSegment}>
          <RNText style={{
            fontSize: 18,
            color: colorScheme === 'dark' ? '#fff' : '#000'
          }}>
            {processedContent}
          </RNText>
        </RNView>
      );
    }

    if (segment.type === 'decisionPoint') {
      const hasSelectedChoice = segment.selectedChoice;
      
      return (
        <RNView key={`decision-${segment.index}`} style={styles.decisionContainer}>
          {/* Decision choices */}
          {!hasSelectedChoice && (
            <RNView style={styles.choicesContainer}>
              {segment.choices?.map((choice: string) => (
                <TouchableOpacity
                  key={choice}
                  style={[
                    styles.choiceButton,
                    {
                      backgroundColor: 'transparent',
                      borderColor: colorScheme === 'dark' ? '#4a9eff' : '#2b7de9',
                    },
                  ]}
                  onPress={() => handleChoice(segment, choice)}
                >
                  <Text style={styles.choiceText}>
                    {choice}
                  </Text>
                </TouchableOpacity>
              ))}
            </RNView>
          )}

          {/* Response after selection */}
          {hasSelectedChoice && segment.responses && (
            <Animated.View 
              style={{ 
                opacity: responseFadeAnim,
                marginVertical: 10
              }}
            >
              <Text style={styles.responseText}>
                {segment.responses[segment.selectedChoice].replace(
                  /({characterName}|{YN})/g,
                  characterName
                )}
              </Text>
            </Animated.View>
          )}
        </RNView>
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
        {isFirstPage ? (
          // Render character name input screen
          renderFirstPage()
        ) : (
          // Render scrollable story content without the navigation bar
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            overScrollMode="never"
            bounces={isChapterEnd || hasPreviousChapter}
          >
            <Text style={styles.chapterTitle}>
              {currentChapter?.title}
            </Text>
            
            <Animated.View
              style={[
                styles.contentWrapper,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {storySegments.map(segment => renderSegment(segment))}
            </Animated.View>
            
            {renderNextChapterIndicator()}
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  firstPageContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
  textSegment: {
    marginBottom: 20,
  },
  decisionContainer: {
    marginVertical: 20,
  },
  choicesContainer: {
    marginVertical: 10,
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
  nextChapterContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    marginTop: 20,
  },
  nextChapterText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#666',
  },
  nextChapterInstructions: {
    fontSize: 14,
    marginTop: 5,
    color: '#666',
    fontStyle: 'italic',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
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
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    margin: 24,
  },
}); 