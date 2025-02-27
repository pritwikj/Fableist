/**
 * Story Service
 * 
 * Centralizes story fetching logic and provides consistent interfaces for
 * accessing story data throughout the application.
 */

import { Story, StoryPage, Chapter } from '@/types/story';
import { db } from './firebaseConfig';
import { collection, doc, getDoc, getDocs, query, where, setDoc, Timestamp, DocumentReference, addDoc } from 'firebase/firestore';
import { getCurrentUser, isAuthenticated } from './firebaseAuth';

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
  currentPage: string;
  lastReadTimestamp: Timestamp;
}

/**
 * Represents a story in the user's library with reading progress and metadata
 */
export interface LibraryStory extends StoryMetadata {
  currentPage: string;
  lastReadTimestamp: Timestamp;
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
 * Fetches complete story content including all chapters and their pages
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

    // Fetch pages for each chapter
    const chapters: Chapter[] = await Promise.all(
      chaptersSnapshot.docs.map(async (chapterDoc) => {
        const chapterData = chapterDoc.data();
        
        // Get pages from the nested subcollection
        const pagesRef = collection(chaptersRef, chapterDoc.id, 'pages');
        const pagesSnapshot = await getDocs(pagesRef);

        if (pagesSnapshot.empty) {
          console.warn(`No pages found for chapter ${chapterDoc.id} in story ${id}`);
          return {
            title: chapterData.title,
            pages: [],
          };
        }

        // Convert pages to array and sort by page number/id
        const pages: StoryPage[] = pagesSnapshot.docs
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              mainContent: data.mainContent,
              decisionPoint: data.decisionPoint ? {
                choices: data.decisionPoint.choices,
                responses: data.decisionPoint.responses,
                remainingContent: data.decisionPoint.remainingContent,
              } : undefined,
            };
          })
          .sort((a, b) => a.id.localeCompare(b.id));

        return {
          title: chapterData.title,
          pages,
        };
      })
    );

    // Sort chapters by their document IDs
    chapters.sort((a, b) => a.title.localeCompare(b.title));

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
        currentPage: data.currentPage || "1",
        lastReadTimestamp: data.lastReadTimestamp || Timestamp.now(),
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
            currentPage: progress.currentPage,
            lastReadTimestamp: progress.lastReadTimestamp,
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
            currentPage: progress.currentPage,
            lastReadTimestamp: progress.lastReadTimestamp,
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
 * @param currentPage Current page identifier
 * @returns Promise resolving to success/failure status
 */
export async function updateReadingProgress(
  storyId: string, 
  currentPage: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user is authenticated
    if (!isAuthenticated() || !getCurrentUser()) {
      return { 
        success: false, 
        error: 'User not authenticated' 
      };
    }

    // Validate inputs
    if (!storyId) {
      return {
        success: false,
        error: 'Story ID is required'
      };
    }

    const userId = getCurrentUser()!.uid;
    console.log(`Updating reading progress for user ${userId}, story ${storyId}, page ${currentPage}`);
    
    // Create progress data
    const progressData: UserStoryProgress = {
      storyId,
      currentPage,
      lastReadTimestamp: Timestamp.now()
    };

    try {
      // First check if the story is already in the user's library
      const userLibraryRef = collection(db, 'users', userId, 'userLibrary');
      const q = query(userLibraryRef, where('storyId', '==', storyId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // Story not in library yet, add it with the document ID matching the storyId
        // for easier reference
        await setDoc(doc(userLibraryRef, storyId), progressData);
        console.log(`Added new story ${storyId} to user's library`);
      } else {
        // Update existing progress
        const docRef = doc(db, 'users', userId, 'userLibrary', querySnapshot.docs[0].id);
        await setDoc(docRef, progressData, { merge: true });
        console.log(`Updated reading progress for existing story ${storyId}`);
      }

      return { success: true };
    } catch (dbError) {
      console.error('Database error updating reading progress:', dbError);
      return {
        success: false,
        error: dbError instanceof Error ? dbError.message : 'Database error occurred'
      };
    }
  } catch (error) {
    console.error('Error updating reading progress:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
} 