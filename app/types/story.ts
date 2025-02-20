/**
 * Story Types
 * 
 * Defines the type structure for stories, chapters, pages, and related components
 * in the application.
 */

/**
 * Represents a decision point in a story page
 */
export interface DecisionPoint {
  choices: string[];                     // Available choices for the user
  responses: { [key: string]: string }; // Responses mapped to choices
  remainingContent: string;             // Content to be revealed after the decision
}

/**
 * Represents a single page in a story
 */
export interface StoryPage {
  id: string;                  // Unique identifier for the page
  mainContent: string;         // Main content text of the page
  decisionPoint?: DecisionPoint; // Optional decision point for this page
}

/**
 * Represents a chapter in a story
 */
export interface Chapter {
  title: string;              // Chapter title
  pages: StoryPage[];         // Array of pages in this chapter
}

/**
 * Represents story metadata for preview/listing purposes
 */
export interface StoryMetadata {
  id: string;                 // Unique identifier for the story
  title: string;              // Story title
  author: string;             // Author name
  coverImage: string;         // URL to the cover image
  description: string;        // Story description/summary
  defaultCharacterName: string; // Default name for the main character
}

/**
 * Represents a complete story with metadata and content
 */
export interface Story extends StoryMetadata {
  chapters: Chapter[];        // Array of chapters in the story
}

/**
 * Represents user's progress in a story
 */
export interface StoryProgress {
  storyId: string;           // ID of the story
  currentChapter: number;    // Index of current chapter
  currentPage: number;       // Index of current page within chapter
  lastReadAt: Date;         // Timestamp of last reading session
  characterName?: string;    // Custom character name (if provided)
  isBookmarked: boolean;    // Whether the story is bookmarked
}

/**
 * Represents a story's reading state
 */
export interface StoryReadingState {
  story: Story;              // The current story
  progress: StoryProgress;   // User's progress in the story
  isLoading: boolean;        // Loading state
  error?: string;           // Error state if any
  currentDecision?: {        // Current decision state if applicable
    selected?: number;       // Index of selected choice
    isRevealed: boolean;     // Whether the response is revealed
  };
}

/**
 * Navigation parameter types
 */
export type StoryScreenParams = {
  storyId: string;
  chapterIndex?: number;
  pageIndex?: number;
  characterName?: string;
};

/**
 * Navigation prop types for type-safe navigation
 */
export type StoryStackParamList = {
  StoryList: undefined;
  StoryDetail: { storyId: string };
  StoryReader: StoryScreenParams;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends StoryStackParamList {}
  }
}

const StoryTypes = {
  DecisionPoint: {} as DecisionPoint,
  StoryPage: {} as StoryPage,
  Chapter: {} as Chapter,
  StoryMetadata: {} as StoryMetadata,
  Story: {} as Story,
  StoryProgress: {} as StoryProgress,
  StoryReadingState: {} as StoryReadingState,
  StoryScreenParams: {} as StoryScreenParams,
  StoryStackParamList: {} as StoryStackParamList,
};

export default StoryTypes; 