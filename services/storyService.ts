/**
 * Story Service
 * 
 * Centralizes story fetching logic and provides consistent interfaces for
 * accessing story data throughout the application.
 */

import { Story, Chapter, StorySegment } from '@/types/story';
import { db } from './firebaseConfig';
import { collection, doc, getDoc, getDocs, query, where, setDoc, Timestamp, DocumentReference, addDoc, collectionGroup } from 'firebase/firestore';
import { getCurrentUser, isAuthenticated } from './firebaseAuth';
import { updateReadingProgressSecure } from './cloudFunctions';

export interface StoryMetadata {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  description: string;
  defaultCharacterName: string;
}

/**
 * Represents a user's reading progress for a story in their library
 */
export interface UserStoryProgress {
  storyId: string;
  currentChapter: number | string; // Can be number or string for backward compatibility
  lastReadTimestamp: Timestamp;
  unlockedChapters?: number[]; // List of unlocked chapter indices
  chapterHistory?: Record<string, any>; // History of decisions made in chapters
  characterName?: string; // User's custom character name for this story
}

/**
 * Represents a story in the user's library with reading progress and metadata
 */
export interface LibraryStory extends StoryMetadata {
  currentChapter: number | string; // Can be number or string for backward compatibility
  lastReadTimestamp: Timestamp;
  characterName?: string; // User's custom character name for this story
}

/**
 * Fetches story metadata for preview/listing purposes
 * @param id Story ID to fetch
 * @returns Promise resolving to story metadata
 */
export async function fetchStoryMetadata(id: string): Promise<StoryMetadata> {
  try {
    // Log the story ID we're trying to fetch for debugging
    console.log(`Attempting to fetch story metadata for ID: ${id}`);
    
    // Validate the story ID to avoid invalid Firestore paths
    if (!id || id.includes('/') || id.includes('.')) {
      throw new Error(`Invalid story ID format: ${id}`);
    }
    
    const storyRef = doc(db, 'stories', id);
    const storyDoc = await getDoc(storyRef);

    if (!storyDoc.exists()) {
      console.warn(`Story with ID ${id} not found in the database`);
      throw new Error(`Story with ID ${id} not found`);
    }

    const data = storyDoc.data();
    return {
      id: storyDoc.id,
      title: data.title || 'Untitled Story',
      author: data.author || 'Unknown Author',
      coverImage: data.coverImage || 'https://via.placeholder.com/150',
      description: data.description || 'No description available.',
      defaultCharacterName: data.defaultCharacterName || 'Reader',
    };
  } catch (error) {
    console.error('Error fetching story metadata:', error);
    throw error;
  }
}

/**
 * Fetches complete story content including all chapters and their segments
 * @param id Story ID to fetch
 * @returns Promise resolving to complete story data
 */
export async function fetchStoryContent(id: string): Promise<Story> {
  try {
    // First, get the story metadata
    const metadata = await fetchStoryMetadata(id);

    // Then, get the chapters from the subcollection
    const chaptersRef = collection(db, 'stories', id, 'chapters');
    const chaptersSnapshot = await getDocs(chaptersRef);

    if (chaptersSnapshot.empty) {
      throw new Error(`No chapters found for story ${id}`);
    }

    // Process chapters and their segments
    const chapters: Chapter[] = chaptersSnapshot.docs.map(chapterDoc => {
      const chapterData = chapterDoc.data();
      
      // Process segments from the chapter data
      const segments: StorySegment[] = chapterData.segments || [];
      
      return {
        id: chapterDoc.id,
        title: chapterData.title,
        segments: segments,
      };
    });

    // Sort chapters by their document IDs
    chapters.sort((a, b) => a.id.localeCompare(b.id));

    // Combine metadata and chapters
    return {
      ...metadata,
      chapters,
    };
  } catch (error) {
    console.error('Error fetching story content:', error);
    throw error;
  }
}

/**
 * Fetches all available stories for the home page
 * @returns Promise resolving to array of story metadata
 */
export async function fetchAllStories(): Promise<StoryMetadata[]> {
  try {
    const storiesRef = collection(db, 'stories');
    const storiesSnapshot = await getDocs(storiesRef);

    if (storiesSnapshot.empty) {
      return [];
    }

    return storiesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        author: data.author,
        coverImage: data.coverImage,
        description: data.description,
        defaultCharacterName: data.defaultCharacterName,
      };
    });
  } catch (error) {
    console.error('Error fetching all stories:', error);
    throw error;
  }
}

/**
 * Fetches stories from the user's library with associated metadata
 * @returns Promise resolving to array of library stories with reading progress
 */
export async function fetchUserLibrary(): Promise<LibraryStory[]> {
  try {
    // Check if user is authenticated
    if (!isAuthenticated() || !getCurrentUser()) {
      console.log('User not authenticated, returning empty library');
      return [];
    }

    const userId = getCurrentUser()!.uid;
    const userLibraryRef = collection(db, 'users', userId, 'userLibrary');
    const librarySnapshot = await getDocs(userLibraryRef);

    if (librarySnapshot.empty) {
      return [];
    }

    // Get progress data from the user's library
    const progressData = librarySnapshot.docs.map(doc => {
      const data = doc.data() as UserStoryProgress;
      return {
        storyId: data.storyId || doc.id, // Use document ID as a fallback if storyId field is missing
        // Handle both legacy currentPage field and new currentChapter field
        currentChapter: data.currentChapter || "0",
        // For backward compatibility, if only currentPage exists but no currentChapter
        ...(data.hasOwnProperty('currentPage') && !data.hasOwnProperty('currentChapter') && { currentChapter: "0" }),
        lastReadTimestamp: data.lastReadTimestamp || Timestamp.now(),
        characterName: data.characterName, // Include character name if available
        docId: doc.id
      };
    });

    // Fetch metadata for each story in the library
    const libraryStories = await Promise.all(
      progressData.map(async (progress) => {
        try {
          // Get the story metadata
          const metadata = await fetchStoryMetadata(progress.storyId);
          
          // Combine metadata with reading progress
          return {
            ...metadata,
            currentChapter: progress.currentChapter,
            lastReadTimestamp: progress.lastReadTimestamp,
            characterName: progress.characterName, // Include character name in the returned data
          };
        } catch (error) {
          console.error(`Error fetching metadata for story ${progress.storyId}:`, error);
          
          // Create a placeholder metadata when the actual story can't be found
          // This allows us to still show something in the library
          return {
            id: progress.storyId,
            title: `Story ${progress.storyId}`,
            author: "Unknown",
            coverImage: "https://via.placeholder.com/150",
            description: "Story details unavailable",
            defaultCharacterName: "Reader",
            currentChapter: progress.currentChapter,
            lastReadTimestamp: progress.lastReadTimestamp,
            characterName: progress.characterName, // Include character name in the returned data
          };
        }
      })
    );

    return libraryStories;
  } catch (error) {
    console.error('Error fetching user library:', error);
    // Return empty array on error rather than throwing
    return [];
  }
}

/**
 * Updates the user's reading progress for a specific story
 * @param storyId ID of the story being read
 * @param currentChapter Current chapter index as a number or string
 * @param decisions Optional object containing decisions made in chapters
 * @returns Promise resolving to success/failure status
 */
export async function updateReadingProgress(
  storyId: string, 
  currentChapter: number | string,
  decisions?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate inputs
    if (!storyId) {
      return {
        success: false,
        error: 'Story ID is required'
      };
    }

    // Use Cloud Function to securely update reading progress
    // This approach ensures server-side security rules are enforced
    const result = await updateReadingProgressSecure(storyId, currentChapter, decisions);
    
    if (result.success) {
      console.log(`Successfully updated reading progress for story ${storyId}, chapter ${currentChapter} via Cloud Function`);
    } else {
      console.error(`Failed to update reading progress via Cloud Function: ${result.error}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error updating reading progress:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
} 