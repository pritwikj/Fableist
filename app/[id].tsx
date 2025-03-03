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
 * - Continuous scrolling with chapters appended to the bottom
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
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchStoryContent, updateReadingProgress } from '@/services/storyService';
import { fetchUserProfile, updateUserCoins, isChapterUnlocked, unlockChapter as unlockChapterService } from '@/services/userService';
import { isAuthenticated } from '@/services/firebaseAuth';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getCurrentUser } from '@/services/firebaseAuth';
import { db } from '@/services/firebaseConfig';

// Define interfaces for our data structures
interface UserChoice {
  choice: string;
  response: string;
  chapterIndex: number;
  segmentIndex: number;
  timestamp?: number;
}

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
  const [loadedChapters, setLoadedChapters] = useState<number[]>([]);
  const [isFirstPage, setIsFirstPage] = useState(true);
  const [characterName, setCharacterName] = useState('');
  const [storySegments, setStorySegments] = useState<any[]>([]);
  const [isNavigatingToSavedPosition, setIsNavigatingToSavedPosition] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [unlockedChapters, setUnlockedChapters] = useState<number[]>([]);
  const [decisionHistory, setDecisionHistory] = useState<Record<string, any>>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const [lastScrollAction, setLastScrollAction] = useState<number>(0);
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

  // Load the story content and user progress
  useEffect(() => {
    if (story && !isLoading) {
      console.log("STORY LOADED, PREPARING TO HANDLE USER PROGRESS");
      setCharacterName(story.defaultCharacterName);
      
      // Convert initialChapter to number safely
      const initChapter = initialChapter 
        ? (typeof initialChapter === 'string' 
           ? parseInt(initialChapter, 10) 
           : Array.isArray(initialChapter) 
             ? parseInt(initialChapter[0], 10) 
             : typeof initialChapter === 'number' 
               ? initialChapter 
               : 0)
        : 0;
      
      // Load user's progress from library if available
      const loadUserProgress = async () => {
        if (isAuthenticated() && story) {
          try {
            const userId = getCurrentUser()?.uid;
            if (userId) {
              console.log('ATTEMPTING TO LOAD USER PROGRESS:', {
                userId, 
                storyId: id,
                currentDecisionHistoryState: Object.keys(decisionHistory).length
              });
              
              const libraryDocRef = doc(db, 'users', userId, 'userLibrary', id as string);
              const libraryDoc = await getDoc(libraryDocRef);
              
              if (libraryDoc.exists()) {
                const data = libraryDoc.data();
                
                // DIAGNOSTICS: Log raw Firestore data
                console.log('RAW FIRESTORE LIBRARY DATA:', JSON.stringify(data, null, 2));
                
                // Extract user choices from the Firestore data format
                const userChoices = data.userChoices || [];
                
                // Convert array of choices to the format our app expects (key-value pairs)
                const formattedHistory: Record<string, any> = {};
                
                userChoices.forEach((choice: UserChoice) => {
                  // Create keys in the format "chapterIndex-segmentIndex"
                  const key = `${choice.chapterIndex}-${choice.segmentIndex}`;
                  formattedHistory[key] = {
                    choice: choice.choice,
                    response: choice.response,
                    chapterIndex: choice.chapterIndex,
                    segmentIndex: choice.segmentIndex,
                    timestamp: choice.timestamp || new Date().getTime()
                  };
                });
                
                console.log('CONVERTED USER CHOICES TO FORMATTED HISTORY:', formattedHistory);
                
                // Set the formatted decision history
                setDecisionHistory(formattedHistory);
                
                // Check if we need to load previous chapters
                if (initChapter > 0) {
                  // Load all chapters up to and including the current one
                  for (let i = 0; i <= initChapter; i++) {
                    // Check if chapter should be loaded
                    if (!loadedChapters.includes(i) && i < story.chapters.length) {
                      console.log(`LOADING CHAPTER ${i} FROM LIBRARY PROGRESS`);
                      loadChapterContent(i);
                    }
                  }
                  
                  // Set flag to scroll to saved position once chapters are loaded
                  setIsNavigatingToSavedPosition(true);
                } else {
                  // Just load the first chapter
                  console.log('LOADING FIRST CHAPTER FROM LIBRARY PROGRESS');
                  loadChapterContent(0);
                }
              } else {
                // No progress, start from the beginning
                console.log('NO LIBRARY PROGRESS FOUND, STARTING FROM BEGINNING');
                setDecisionHistory({}); // Initialize empty decision history
                loadChapterContent(0);
              }
            }
          } catch (error) {
            console.error('Failed to load user progress:', error);
            // Fallback to loading first chapter
            setDecisionHistory({}); // Initialize empty decision history
            loadChapterContent(0);
          }
        } else {
          // User not authenticated, just load the specified chapter
          console.log('USER NOT AUTHENTICATED, LOADING WITHOUT PROGRESS');
          setDecisionHistory({}); // Initialize empty decision history
          if (initChapter > 0 && initChapter < story.chapters.length) {
            loadChapterContent(initChapter);
          } else {
            loadChapterContent(0);
          }
        }
      };
      
      if (!isFirstPage) {
        // Load user progress if not on the first (name input) page
        loadUserProgress();
      } else {
        // Initialize empty decision history on first page
        setDecisionHistory({});
      }
    }
  }, [story, isLoading, isFirstPage, id, initialChapter]);

  // Scroll to the appropriate position when navigating from library
  useEffect(() => {
    if (isNavigatingToSavedPosition && scrollViewRef.current && storySegments.length > 0) {
      // Safely convert initialChapter to number
      const targetChapter = typeof initialChapter === 'string' 
        ? parseInt(initialChapter, 10) 
        : Array.isArray(initialChapter)
          ? parseInt(initialChapter[0], 10)
          : typeof initialChapter === 'number'
            ? initialChapter
            : 0;
      
      // Find the first segment of the target chapter
      const chapterStartIndex = storySegments.findIndex(seg => 
        seg.chapterIndex === targetChapter
      );
      
      if (chapterStartIndex >= 0) {
        // Create a function to scroll to the chapter
        const scrollToChapter = () => {
          // Get layout measurements for the chapter segment
          const segmentToScrollTo = chapterStartIndex;
          
          // Use requestAnimationFrame to ensure the scrollView has rendered
          requestAnimationFrame(() => {
            // Scroll to the start of the chapter with animation
            scrollViewRef.current?.scrollTo({
              y: segmentToScrollTo * 150, // Approximate height per segment
              animated: true
            });
          });
        };
        
        // Apply previous decisions to segments if they haven't been applied already
        // Double-check that all segments with history entries have the correct selectedChoice
        if (Object.keys(decisionHistory).length > 0) {
          const updatedSegments = [...storySegments];
          let hasChanges = false;
          
          // Apply decisions from history to any segments that might have been missed
          for (let i = 0; i < updatedSegments.length; i++) {
            const segment = updatedSegments[i];
            if (segment.type === 'decisionPoint') {
              const decisionKey = `${segment.chapterIndex}-${segment.index}`;
              const historyEntry = decisionHistory[decisionKey];
              
              if (historyEntry && !segment.selectedChoice) {
                // Apply the saved decision to this segment
                const updatedSegment = {
                  ...segment,
                  selectedChoice: historyEntry.choice,
                };
                
                // If a response is stored in history, prioritize that
                if (historyEntry.response) {
                  // Keep the original responses object but ensure the chosen response is there
                  if (!updatedSegment.responses) {
                    updatedSegment.responses = {};
                  }
                  updatedSegment.responses[historyEntry.choice] = historyEntry.response;
                } 
                // Otherwise make sure we at least have a default response
                else if (!updatedSegment.responses || !updatedSegment.responses[historyEntry.choice]) {
                  if (!updatedSegment.responses) {
                    updatedSegment.responses = {};
                  }
                  updatedSegment.responses[historyEntry.choice] = `You chose: ${historyEntry.choice}`;
                }
                
                updatedSegments[i] = updatedSegment;
                hasChanges = true;
              }
            }
          }
          
          // Only update segments if we made changes
          if (hasChanges) {
            setStorySegments(updatedSegments);
          }
        }
        
        // Perform the scroll after a short delay to ensure rendering is complete
        setTimeout(scrollToChapter, 500);
        
        // Reset the flag to avoid repeated scrolling
        setIsNavigatingToSavedPosition(false);
      }
    }
  }, [isNavigatingToSavedPosition, initialChapter, storySegments, decisionHistory]);

  // Update reading progress when chapter changes
  useEffect(() => {
    if (isAuthenticated() && story && currentChapter && !isFirstPage) {
      // DIAGNOSTICS: Log the current decision history before saving
      console.log('SAVING PROGRESS TO FIRESTORE:', {
        storyId: story.id,
        currentChapterIndex,
        decisionHistoryKeyCount: Object.keys(decisionHistory).length,
        decisionHistorySample: Object.entries(decisionHistory).slice(0, 2).map(([key, val]) => ({key, val}))
      });
      
      // Update reading progress via Cloud Function to ensure secure database operations
      // This approach ensures server-side security rules are enforced
      updateReadingProgress(story.id, currentChapterIndex, decisionHistory)
        .then(() => console.log('Successfully updated reading progress'))
        .catch(error => console.error('Failed to update reading progress:', error));
      
      // Mark this chapter as unlocked
      setUnlockedChapters(prev => {
        if (prev.includes(currentChapterIndex)) {
          return prev;
        }
        return [...prev, currentChapterIndex];
      });
    }
  }, [story, currentChapterIndex, decisionHistory, isFirstPage]);

  // Configure the navigation header
  useEffect(() => {
    if (story) {
      router.setParams({
        title: story.title,
      });
    }
  }, [story?.title]);

  const loadChapterContent = (chapterIndex: number) => {
    if (!story || !story.chapters[chapterIndex]) return;
    
    // If we've already loaded this chapter, don't duplicate it
    if (loadedChapters.includes(chapterIndex)) {
      console.log(`CHAPTER ${chapterIndex} ALREADY LOADED, SKIPPING`);
      return;
    }
    
    const chapter = story.chapters[chapterIndex];
    let newSegments = [];
    
    // Check if this is a previously read chapter from library
    const chapterHistoryKeys = Object.keys(decisionHistory).filter(
      key => key.startsWith(`${chapterIndex}-`)
    );
    
    const isPreviouslyReadChapter = chapterHistoryKeys.length > 0;
    
    // DIAGNOSTICS: Log chapter loading info
    console.log('LOADING CHAPTER:', {
      chapterIndex,
      title: chapter.title,
      segmentCount: chapter.segments.length,
      isPreviouslyReadChapter,
      decisionHistoryKeyCount: Object.keys(decisionHistory).length,
      chapterHistoryKeys
    });
    
    // Always add the chapter title as the first item for this chapter
    let stopAtDecisionPoint = false;
    
    // Process the segments of the chapter
    for (let i = 0; i < chapter.segments.length; i++) {
      // Add this segment with any needed additional properties
      const segment: any = {
        ...chapter.segments[i],
        index: i,
        chapterIndex: chapterIndex,
        chapterTitle: chapter.title
      };
      
      // Check if this segment has a previous decision in history
      if (segment.type === 'decisionPoint') {
        const decisionKey = `${chapterIndex}-${i}`;
        const historyEntry = decisionHistory[decisionKey];
        
        // DIAGNOSTICS: Log decision point processing
        console.log('PROCESSING DECISION POINT:', {
          decisionKey,
          hasHistoryEntry: !!historyEntry,
          historyChoice: historyEntry?.choice,
          historyResponse: historyEntry?.response,
          segmentContent: segment.content?.substring(0, 30) + '...',
          choicesCount: segment.choices?.length
        });
        
        if (historyEntry && historyEntry.choice) {
          // Apply the saved decision to this segment
          segment.selectedChoice = historyEntry.choice;
          
          // If a response is stored in history, prioritize that
          if (historyEntry.response) {
            // Keep the original responses object but ensure the chosen response is there
            if (!segment.responses) {
              segment.responses = {};
            }
            segment.responses[historyEntry.choice] = historyEntry.response;
            
            // DIAGNOSTICS: Log that we're using a response from history
            console.log(`USING RESPONSE FROM HISTORY FOR ${decisionKey}:`, historyEntry.response);
          } 
          // Otherwise make sure we at least have a default response
          else if (!segment.responses || !segment.responses[historyEntry.choice]) {
            if (!segment.responses) {
              segment.responses = {};
            }
            segment.responses[historyEntry.choice] = `You chose: ${historyEntry.choice}`;
            
            // DIAGNOSTICS: Log that we're using a default response
            console.log(`USING DEFAULT RESPONSE FOR ${decisionKey}:`, `You chose: ${historyEntry.choice}`);
          }
          
          // DIAGNOSTICS: Log after applying history
          console.log('APPLIED HISTORY TO SEGMENT:', {
            decisionKey,
            selectedChoice: segment.selectedChoice,
            hasResponses: !!segment.responses,
            responseKeys: segment.responses ? Object.keys(segment.responses) : []
          });
        } else {
          // DIAGNOSTICS: Log no history for this decision
          console.log(`NO HISTORY FOUND FOR DECISION ${decisionKey}`);
        }
      }
      
      newSegments.push(segment);
      
      // Stop loading content after the first unanswered decision point
      // but only if we're not loading a previously read chapter from library
      if (!isPreviouslyReadChapter && 
          segment.type === 'decisionPoint' && 
          !segment.selectedChoice) {
        console.log(`STOPPING CHAPTER LOAD AT FIRST UNANSWERED DECISION: ${chapterIndex}-${i}`);
        stopAtDecisionPoint = true;
        break;
      }
    }
    
    // Append the new segments to the existing ones
    setStorySegments(prevSegments => [...prevSegments, ...newSegments]);
    
    // Add this chapter to the list of loaded chapters
    setLoadedChapters(prev => [...prev, chapterIndex]);
    
    // Update current chapter index if this is the most recent chapter
    if (chapterIndex > currentChapterIndex) {
      setCurrentChapterIndex(chapterIndex);
    }
    
    // Show the "Next Chapter" indicator if there are more chapters and we've reached the end of content
    // Only show it if we didn't stop at a decision point (meaning we reached the end of the chapter)
    if (hasNextChapter && chapterIndex === currentChapterIndex && !stopAtDecisionPoint) {
      setTimeout(() => {
        Animated.timing(nextChapterFadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();
      }, 500);
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

  // Modified handleScroll to load next chapter when reaching bottom
  const handleScroll = async (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    
    // Don't process scroll events during animations or choice handling
    if (isAnimating) return;
    
    // Check if we're near the bottom of the content
    const paddingToBottom = 20;
    const atBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    // Update position state
    setIsAtBottom(atBottom);
    
    // Check if we should load the next chapter
    if (atBottom && hasNextChapter) {
      // Only navigate if we've been at the bottom for a moment (prevents accidental triggers)
      const now = Date.now();
      if (now - lastScrollAction < 800) return;
      
      // Set timestamp to prevent rapid navigation
      setLastScrollAction(now);
      
      // Find the last segment's chapter and index
      if (storySegments.length === 0) return;
      
      const lastSegment = storySegments[storySegments.length - 1];
      const lastChapterIndex = lastSegment.chapterIndex;
      const lastSegmentIndex = lastSegment.index;
      
      // Only proceed if we're at the end of a chapter
      if (lastChapterIndex !== currentChapterIndex) return;
      
      const chapter = story?.chapters[lastChapterIndex];
      if (!chapter || !chapter.segments) return;
      
      // If we're not at the end of the chapter or we're at a decision point that hasn't been answered, don't load next chapter
      const isLastSegmentOfChapter = lastSegmentIndex === chapter.segments.length - 1;
      const isAtUnansweredDecision = lastSegment.type === 'decisionPoint' && !lastSegment.selectedChoice;
      
      if (!isLastSegmentOfChapter || isAtUnansweredDecision) return;
      
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
                  // Load the next chapter and append it
                  loadChapterContent(nextChapterIndex);
                }
              },
            },
          ]
        );
        return;
      }
      
      // If chapter is free or already unlocked, load it
      loadChapterContent(nextChapterIndex);
    }
  };

  const handlePreviousChapter = () => {
    if (hasPreviousChapter) {
      const prevChapterIndex = currentChapterIndex - 1;
      setCurrentChapterIndex(prevChapterIndex);
      
      // Load segments from the previous chapter with animation
      animateContentChange(() => {
        loadChapterContent(prevChapterIndex);
        
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
    // Don't allow multiple selections
    if (segment.selectedChoice) return;
    
    // Set animation state to prevent scroll events during transition
    setIsAnimating(true);
    
    // Get the selected choice response and create a complete response segment
    const response = segment.responses?.[choice] || `You chose: ${choice}`;
    
    // Update the decision segment to show the chosen response
    const updatedSegments = storySegments.map(s => {
      if (s.index === segment.index && s.chapterIndex === segment.chapterIndex) {
        return {
          ...s,
          selectedChoice: choice,
          // Ensure we keep the responses object to render the selected response
          responses: {
            ...s.responses,
            [choice]: response
          }
        };
      }
      return s;
    });
    
    // Set the updated segments with the selected choice
    setStorySegments(updatedSegments);
    
    // Add this decision to the history - now including the response text
    const decisionKey = `${segment.chapterIndex}-${segment.index}`;
    const updatedHistory = {
      ...decisionHistory,
      [decisionKey]: {
        choice,
        response: response,
        chapterIndex: segment.chapterIndex,
        segmentIndex: segment.index,
        timestamp: new Date().getTime()
      }
    };
    
    // Update the decision history state
    setDecisionHistory(updatedHistory);
    
    // Create the new user choice to add to Firestore
    const newChoice = {
      choice,
      response,
      chapterIndex: segment.chapterIndex,
      segmentIndex: segment.index,
      timestamp: new Date().getTime()
    };
    
    // IMMEDIATELY save this decision to Firestore
    // This ensures it's saved even if the user doesn't change chapters
    if (isAuthenticated() && story) {
      console.log('SAVING CHOICE TO FIRESTORE:', newChoice);
      
      // Get existing user choices from Firestore
      const userId = getCurrentUser()?.uid;
      if (userId) {
        const libraryDocRef = doc(db, 'users', userId, 'userLibrary', story.id);
        getDoc(libraryDocRef).then(docSnap => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            let userChoices = data.userChoices || [];
            
            // Remove any existing choice for this same decision point
            userChoices = userChoices.filter((c: UserChoice) => 
              !(c.chapterIndex === segment.chapterIndex && c.segmentIndex === segment.index)
            );
            
            // Add the new choice
            userChoices.push(newChoice);
            
            // Update the Firestore document
            updateDoc(libraryDocRef, {
              userChoices,
              currentChapter: segment.chapterIndex,
              lastReadTimestamp: serverTimestamp()
            })
            .then(() => console.log('Successfully saved user choice to Firestore'))
            .catch(error => console.error('Failed to save user choice to Firestore:', error));
          } else {
            // Document doesn't exist, create it
            setDoc(libraryDocRef, {
              storyId: story.id,
              userChoices: [newChoice],
              currentChapter: segment.chapterIndex,
              lastReadTimestamp: serverTimestamp()
            })
            .then(() => console.log('Successfully created user library entry with choice'))
            .catch(error => console.error('Failed to create user library entry:', error));
          }
        }).catch(error => {
          console.error('Error getting library document:', error);
        });
      }
    }
    
    // Animate the response appearing
    Animated.timing(responseFadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start();
    
    // After a brief delay, load the next segments
    setTimeout(() => {
      if (currentChapter && currentChapter.segments) {
        const lastSegmentIndex = segment.index;
        
        // Check if there are more segments in the chapter
        if (lastSegmentIndex < (currentChapter.segments?.length ?? 0) - 1) {
          // Load segments until the next decision point or end of chapter
          const nextSegments = [...updatedSegments];
          let foundNextDecisionPoint = false;
          
          for (let i = lastSegmentIndex + 1; i < (currentChapter.segments?.length ?? 0); i++) {
            const nextSegment = {
              ...currentChapter.segments[i],
              index: i,
              chapterIndex: currentChapterIndex,
              chapterTitle: currentChapter.title
            };
            
            nextSegments.push(nextSegment);
            
            // Stop if we hit another decision point
            if (nextSegment.type === 'decisionPoint') {
              foundNextDecisionPoint = true;
              break;
            }
          }
          
          // Check if this is the last segment and we have more chapters
          const isLastSegment = nextSegments.length > 0 && 
            (currentChapter.segments?.length ?? 0) > 0 && 
            nextSegments[nextSegments.length - 1].index === (currentChapter.segments?.length ?? 0) - 1;
            
          if (isLastSegment && hasNextChapter) {
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
        }
      }
      
      // Reset animation state to allow scrolling again
      setIsAnimating(false);
    }, 800);
  };

  const handleStartReading = () => {
    if (!characterName.trim()) {
      Alert.alert('Name Required', 'Please enter a name before continuing.');
      return;
    }
    
    // Move from name input screen to first actual segment
    animateContentChange(() => {
      setIsFirstPage(false);
      loadChapterContent(0);
    });
  };

  const renderFirstPage = () => {
    if (!story) return null;
    
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.firstPageContainer}>
          <Text style={styles.storyTitle}>{story.title}</Text>
          <Text style={styles.namePrompt}>What is your name?</Text>
          <TextInput
            style={[
              styles.nameInput,
              {
                borderColor: colorScheme === 'dark' ? '#4a9eff' : '#2b7de9',
                color: colorScheme === 'dark' ? '#fff' : '#000',
              },
            ]}
            value={characterName}
            onChangeText={setCharacterName}
            placeholder="Enter your name"
            placeholderTextColor="#999"
            autoCapitalize="words"
            autoFocus
          />
          <TouchableOpacity
            style={[
              styles.startButton,
              { backgroundColor: colorScheme === 'dark' ? '#4a9eff' : '#2b7de9' },
            ]}
            onPress={handleStartReading}
          >
            <Text style={styles.startButtonText}>Start Reading</Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  const renderNextChapterIndicator = () => {
    if (!hasNextChapter || !storySegments.length) return null;
    
    // Find the last segment's chapter index
    const lastSegment = storySegments[storySegments.length - 1];
    const lastChapterIndex = lastSegment.chapterIndex;
    
    // Don't show indicator if we're not at the last loaded chapter
    if (lastChapterIndex !== currentChapterIndex) return null;

    // Check if we're at the end of the chapter
    const isLastSegmentOfChapter = lastSegment.index === (currentChapter?.segments?.length ?? 0) - 1;
    if (!isLastSegmentOfChapter) return null;
    
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

  // Modified to group segments by chapter and display chapter headers
  const renderSegment = (segment: any) => {
    // DIAGNOSTICS: Log segment type and decision history for decision points
    if (segment.type === 'decisionPoint') {
      const decisionKey = `${segment.chapterIndex}-${segment.index}`;
      const historyEntry = decisionHistory[decisionKey];
      
      console.log('RENDER DECISION POINT:', {
        decisionKey,
        hasHistory: !!historyEntry,
        historyChoice: historyEntry?.choice,
        historyResponse: historyEntry?.response,
        segmentSelectedChoice: segment.selectedChoice,
        showingChoices: !(segment.selectedChoice || historyEntry?.choice)
      });
    }
    
    // Render chapter title at the beginning of each chapter's segments
    const isFirstSegmentInChapter = segment.index === 0;
    const chapterTitle = isFirstSegmentInChapter ? (
      <View style={styles.chapterHeaderContainer}>
        <Text style={styles.chapterHeader}>
          {segment.chapterTitle}
        </Text>
      </View>
    ) : null;

    if (segment.type === 'text') {
      // For regular text segments, just render the content
      const processedContent = segment.content?.replace(
        /({characterName}|{YN}|{character})/g, 
        characterName
      ) || '';

      return (
        <>
          {chapterTitle}
          <View style={styles.textSegment}>
            <Text style={{
              fontSize: 18,
              color: colorScheme === 'dark' ? '#fff' : '#000'
            }}>
              {processedContent}
            </Text>
          </View>
        </>
      );
    } else if (segment.type === 'decisionPoint') {
      // For decision points, check if it has already been answered
      const decisionKey = `${segment.chapterIndex}-${segment.index}`;
      const historyEntry = decisionHistory[decisionKey];
      
      // Check from both local state and decision history
      const hasSelectedChoice = !!(segment.selectedChoice || historyEntry?.choice);
      
      // Get the selected choice from segment or history
      const selectedChoice = segment.selectedChoice || (historyEntry?.choice);
      
      // Get the response text - prioritize history response if available
      let responseText = '';
      if (historyEntry?.response) {
        // Use the stored response text from decision history
        responseText = historyEntry.response;
      } else if (hasSelectedChoice && segment.responses && selectedChoice) {
        // Fall back to response from the segment if available
        responseText = segment.responses[selectedChoice] || `You chose: ${selectedChoice}`;
      }
      
      // Set opacity to 1 for pre-loaded decisions
      if (hasSelectedChoice) {
        responseFadeAnim.setValue(1);
      }
      
      return (
        <>
          {chapterTitle}
          <View style={styles.decisionContainer}>
            {/* Display decision content text */}
            <Text style={{
              fontSize: 18,
              color: colorScheme === 'dark' ? '#fff' : '#000'
            }}>
              {segment.content?.replace(/({characterName}|{YN}|{character})/g, characterName)}
            </Text>
            
            {/* Only show choices if this decision hasn't been answered yet */}
            {!hasSelectedChoice && (
              <View style={styles.choicesContainer}>
                {segment.choices?.map((choice: string) => (
                  <TouchableOpacity
                    key={choice}
                    style={[
                      styles.choiceButton,
                      {
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
              </View>
            )}

            {/* Show response for previously answered decisions */}
            {hasSelectedChoice && responseText && (
              <Text style={styles.responseText}>
                {responseText.replace(/({characterName}|{YN}|{character})/g, characterName)}
              </Text>
            )}
          </View>
        </>
      );
    }
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
            overScrollMode="always"
            bounces={true}
            scrollEnabled={!isAnimating}
          >
            {/* Chapter titles now rendered with each segment group */}
            <Animated.View
              style={[
                styles.contentWrapper,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {storySegments.map((segment, index) => (
                <React.Fragment key={`${segment.chapterIndex}-${segment.index}`}>
                  {renderSegment(segment)}
                </React.Fragment>
              ))}
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
    paddingBottom: 60,
    paddingTop: 20,
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
  chapterHeaderContainer: {
    marginBottom: 24,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  chapterHeader: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  storyText: {
    fontSize: 18,
    color: '#000',
  },
}); 