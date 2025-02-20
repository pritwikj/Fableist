/**
 * Story Service
 * 
 * Centralizes story fetching logic and provides consistent interfaces for
 * accessing story data throughout the application.
 */

import { Story, StoryPage, Chapter } from '@/types/story';
import { db } from './firebaseConfig';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

export interface StoryMetadata {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  description: string;
  defaultCharacterName: string;
}

/**
 * Fetches story metadata for preview/listing purposes
 * @param id Story ID to fetch
 * @returns Promise resolving to story metadata
 */
export async function fetchStoryMetadata(id: string): Promise<StoryMetadata> {
  try {
    const storyRef = doc(db, 'stories', id);
    const storyDoc = await getDoc(storyRef);

    if (!storyDoc.exists()) {
      throw new Error(`Story with ID ${id} not found`);
    }

    const data = storyDoc.data();
    return {
      id: storyDoc.id,
      title: data.title,
      author: data.author,
      coverImage: data.coverImage,
      description: data.description,
      defaultCharacterName: data.defaultCharacterName,
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