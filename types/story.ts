/**
 * Core types for the story app
 */

/**
 * Represents a decision point in a story segment
 */
export interface DecisionPoint {
  id: string;
  choices: string[];
  responses: { [key: string]: string };
}

/**
 * Represents a segment in a story chapter
 */
export interface StorySegment {
  type: 'text' | 'decisionPoint';
  content?: string;
  id?: string;
  choices?: string[];
  responses?: { [key: string]: string };
}

/**
 * Represents a chapter in a story
 */
export interface Chapter {
  id: string;
  title: string;
  segments: StorySegment[];
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