/**
 * User Service
 * 
 * Provides functions to interact with user data, including
 * user profile, library, and other user-specific functionality.
 */

import { db } from './firebaseConfig';
import { getCurrentUser } from './firebaseAuth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  Timestamp,
  setDoc,
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { fetchStoryMetadata, StoryMetadata } from './storyService';
import { User } from 'firebase/auth';
import { updateReadingProgressSecure, updateUserCoinsSecure } from './cloudFunctions';

// Types
export interface LibraryItem {
  id: string;
  storyId: string;
  currentChapter: number | string; // Can be number or string for backward compatibility
  lastReadTimestamp: Timestamp;
  story?: StoryMetadata; // Joined story data
  unlockedChapters?: number[]; // Track which chapters are unlocked
}

/**
 * Creates a new user document in Firestore with default fields
 * @param user The Firebase Auth user object
 * @returns Promise that resolves when the user document is created
 */
export async function createUserDocument(user: User): Promise<void> {
  try {
    if (!user) {
      throw new Error('User object is required');
    }
    
    const userId = user.uid;
    const userRef = doc(db, 'users', userId);
    
    // Check if the user document already exists
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // Get current date in YYYY-MM-DD format
      const today = new Date();
      const joinDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      
      // Create new user document with default fields
      const userData = {
        coins: 20, // Default starting coins
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email,
        joinDate: joinDate,
      };
      
      await setDoc(userRef, userData);
      console.log(`Created new user document for ${userId}`);
    } else {
      console.log(`User document already exists for ${userId}`);
    }
  } catch (error) {
    console.error('Error creating user document:', error);
    throw error;
  }
}

/**
 * Fetches the user's library of stories they have started reading
 * @returns Promise resolving to array of library items with story metadata
 */
export async function fetchUserLibrary(): Promise<LibraryItem[]> {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      console.log('User not authenticated, returning empty library');
      throw new Error('User not authenticated');
    }
    
    const userId = currentUser.uid;
    console.log(`Fetching library for user: ${userId}`); // Debug log
    
    const libraryRef = collection(db, 'users', userId, 'userLibrary');
    const libraryQuery = query(
      libraryRef,
      orderBy('timestamp', 'desc') // Use timestamp field from your Firebase structure
    );
    
    const librarySnapshot = await getDocs(libraryQuery);
    
    if (librarySnapshot.empty) {
      console.log('Library is empty, returning empty array');
      return [];
    }
    
    console.log(`Found ${librarySnapshot.size} items in the user library`); // Debug log
    
    // Get all library items, handling both new and legacy data structures
    const libraryItems = librarySnapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`Processing library item: ${doc.id}`, data); // Debug log
      
      return {
        id: doc.id,
        storyId: data.storyId || doc.id, // Use document ID if storyId field is missing
        currentChapter: data.currentChapter !== undefined ? data.currentChapter : 0,
        // For backward compatibility, if only currentPage exists but no currentChapter
        ...(!data.hasOwnProperty('currentChapter') && { currentChapter: 0 }),
        lastReadTimestamp: data.timestamp || data.lastReadTimestamp || Timestamp.now(),
      };
    }) as LibraryItem[];
    
    // Fetch story metadata for each library item
    const itemsWithStories = await Promise.all(
      libraryItems.map(async (item) => {
        try {
          console.log(`Fetching metadata for story: ${item.storyId}`); // Debug log
          const storyData = await fetchStoryMetadata(item.storyId);
          return {
            ...item,
            story: storyData,
          };
        } catch (error) {
          console.error(`Error fetching story ${item.storyId}:`, error);
          // Return the item without story data if there's an error
          // This allows the item to still appear in the library but with placeholder data
          return {
            ...item,
            story: {
              id: item.storyId,
              title: `Story ${item.storyId}`,
              author: "Unknown",
              coverImage: "https://via.placeholder.com/150",
              description: "Story details unavailable",
              defaultCharacterName: "Reader",
            }
          };
        }
      })
    );
    
    console.log(`Returning ${itemsWithStories.length} library items`); // Debug log
    return itemsWithStories;
  } catch (error) {
    console.error('Error fetching user library:', error);
    throw error;
  }
}

/**
 * Fetches user profile data
 * @returns Promise resolving to user profile data
 */
export async function fetchUserProfile() {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    
    const userId = currentUser.uid;
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User profile not found');
    }
    
    return {
      id: userDoc.id,
      ...userDoc.data(),
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

/**
 * Updates the user's reading progress for a specific story
 * @param storyId The ID of the story being read
 * @param currentChapter The current chapter index the user is on
 * @returns Promise that resolves when the update is complete
 */
export async function updateUserProgress(storyId: string, currentChapter: number): Promise<void> {
  try {
    // Validate inputs
    if (!storyId) {
      throw new Error('Story ID is required');
    }
    
    // Use Cloud Function to securely update reading progress
    // This approach ensures server-side security rules are enforced
    const result = await updateReadingProgressSecure(storyId, currentChapter);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update reading progress');
    }
    
    console.log(`Successfully updated progress for story ${storyId} to chapter ${currentChapter} via Cloud Function`);
  } catch (error: unknown) {
    console.error('Error updating reading progress:', error);
    throw error;
  }
}

/**
 * Updates the user's coin balance
 * @param amount Amount of coins to add, subtract, or set
 * @param operation The operation to perform ('add', 'subtract', or 'set')
 * @returns Promise resolving to the updated balance information
 */
export async function updateUserCoins(
  amount: number,
  operation: 'add' | 'subtract' | 'set'
): Promise<{ 
  success: boolean; 
  previousBalance?: number;
  newBalance?: number;
  error?: string 
}> {
  try {
    // Validate input
    if (amount < 0) {
      return {
        success: false,
        error: 'Amount cannot be negative'
      };
    }
    
    // Use Cloud Function to securely update user coins
    // This approach ensures server-side security rules are enforced
    const result = await updateUserCoinsSecure(amount, operation);
    
    if (result.success) {
      console.log(`Successfully updated user coins via Cloud Function: ${operation} ${amount} coins`);
    } else {
      console.error(`Failed to update user coins via Cloud Function: ${result.error}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error updating user coins:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Checks if a chapter is unlocked for a user
 * @param storyId The ID of the story
 * @param chapterIndex The chapter index to check
 * @returns Promise resolving to a boolean indicating if the chapter is unlocked
 */
export async function isChapterUnlocked(storyId: string, chapterIndex: number): Promise<boolean> {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      console.log('User not authenticated, chapters are not unlocked');
      return false;
    }
    
    // Free chapters (first 5) are always unlocked
    if (chapterIndex <= 4) {
      return true;
    }
    
    const userId = currentUser.uid;
    const libraryItemRef = doc(db, 'users', userId, 'userLibrary', storyId);
    const libraryItemDoc = await getDoc(libraryItemRef);
    
    if (!libraryItemDoc.exists()) {
      // Item not in library, only free chapters are available
      return false;
    }
    
    const data = libraryItemDoc.data();
    const unlockedChapters = data.unlockedChapters || [];
    
    // Check if chapter is in the unlocked list
    return unlockedChapters.includes(chapterIndex);
  } catch (error) {
    console.error('Error checking if chapter is unlocked:', error);
    return false;
  }
}

/**
 * Marks a chapter as unlocked for a user
 * @param storyId The ID of the story
 * @param chapterIndex The chapter index to unlock
 * @returns Promise resolving to a boolean indicating success
 */
export async function unlockChapter(storyId: string, chapterIndex: number): Promise<boolean> {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      console.log('User not authenticated, cannot unlock chapter');
      return false;
    }
    
    const userId = currentUser.uid;
    const libraryItemRef = doc(db, 'users', userId, 'userLibrary', storyId);
    const libraryItemDoc = await getDoc(libraryItemRef);
    
    // Prepare update data
    let unlockedChapters: number[] = [];
    
    if (libraryItemDoc.exists()) {
      const data = libraryItemDoc.data();
      unlockedChapters = data.unlockedChapters || [];
      
      // Add the chapter if it's not already unlocked
      if (!unlockedChapters.includes(chapterIndex)) {
        unlockedChapters.push(chapterIndex);
      }
      
      // Update the document
      await updateDoc(libraryItemRef, { unlockedChapters });
    } else {
      // Create a new library item with the unlocked chapter
      unlockedChapters = [chapterIndex];
      await setDoc(libraryItemRef, {
        storyId,
        currentChapter: 0,
        lastReadTimestamp: serverTimestamp(),
        unlockedChapters
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error unlocking chapter:', error);
    return false;
  }
} 