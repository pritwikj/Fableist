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

// Types
export interface LibraryItem {
  id: string;
  storyId: string;
  currentPage: string;
  lastReadTimestamp: Timestamp;
  story?: StoryMetadata; // Joined story data
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
      throw new Error('User not authenticated');
    }
    
    const userId = currentUser.uid;
    const libraryRef = collection(db, 'users', userId, 'userLibrary');
    const libraryQuery = query(
      libraryRef,
      orderBy('lastReadTimestamp', 'desc')
    );
    
    const librarySnapshot = await getDocs(libraryQuery);
    
    if (librarySnapshot.empty) {
      return [];
    }
    
    // Get all library items
    const libraryItems = librarySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as LibraryItem[];
    
    // Fetch story metadata for each library item
    const itemsWithStories = await Promise.all(
      libraryItems.map(async (item) => {
        try {
          const storyData = await fetchStoryMetadata(item.storyId);
          return {
            ...item,
            story: storyData,
          };
        } catch (error) {
          console.error(`Error fetching story ${item.storyId}:`, error);
          return item; // Return the item without story data if there's an error
        }
      })
    );
    
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
 * @param currentPage The current page index the user is on
 * @returns Promise that resolves when the update is complete
 */
export async function updateUserProgress(storyId: string, currentPage: number): Promise<void> {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    
    const userId = currentUser.uid;
    const libraryItemRef = doc(db, 'users', userId, 'userLibrary', storyId);
    
    // Check if the library item exists
    const itemSnapshot = await getDoc(libraryItemRef);
    
    const libraryItemData = {
      storyId,
      currentPage: currentPage.toString(),
      lastReadTimestamp: serverTimestamp(),
    };
    
    if (itemSnapshot.exists()) {
      // Update existing record
      await updateDoc(libraryItemRef, libraryItemData);
      console.log(`Updated progress for story ${storyId} to page ${currentPage}`);
    } else {
      // Create new record
      await setDoc(libraryItemRef, libraryItemData);
      console.log(`Added story ${storyId} to library at page ${currentPage}`);
    }
  } catch (error: unknown) {
    console.error('Error updating reading progress:', error);
    throw error;
  }
} 