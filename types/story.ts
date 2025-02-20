/**
 * Core types for the story app
 */

/**
 * Represents a decision point in a story page
 */
export interface DecisionPoint {
  choices: string[];
  responses: { [key: string]: string };
  remainingContent: string;
}

/**
 * Represents a single page in a story
 */
export interface StoryPage {
  id: string;
  mainContent: string;
  decisionPoint?: DecisionPoint;
}

/**
 * Represents a chapter in a story
 */
export interface Chapter {
  title: string;
  pages: StoryPage[];
}

/**
 * Represents a complete story with metadata and chapters
 */
export interface Story {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  description: string;
  defaultCharacterName: string;
  chapters: Chapter[];
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