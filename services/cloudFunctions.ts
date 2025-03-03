/**
 * Cloud Functions Service
 * 
 * Provides functions for interacting with Firebase Cloud Functions,
 * particularly for operations that require server-side permissions
 * like updating protected user data.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { getCurrentUser } from './firebaseAuth';

// Initialize Firebase Functions
const functions = getFunctions();

/**
 * Updates the user's reading progress securely via Cloud Functions
 * @param storyId ID of the story being read
 * @param currentChapter Current chapter index (number or string)
 * @param decisions Optional object containing user's decision history
 * @returns Promise resolving to success/failure status
 */
export async function updateReadingProgressSecure(
  storyId: string,
  currentChapter: number | string,
  decisions?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify user is authenticated
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    // Call the Cloud Function
    const updateProgressFunction = httpsCallable(functions, 'updateReadingProgress');
    const result = await updateProgressFunction({
      storyId,
      currentChapter,
      decisions
    });

    // Parse and return the result
    const data = result.data as { success: boolean };
    return {
      success: data.success
    };
  } catch (error) {
    console.error('Error updating reading progress via Cloud Functions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Update user's coin balance securely via Cloud Functions
 * @param amount Amount of coins to add, subtract, or set
 * @param operation The operation to perform ('add', 'subtract', or 'set')
 * @returns Promise resolving to the updated balance information
 */
export async function updateUserCoinsSecure(
  amount: number,
  operation: 'add' | 'subtract' | 'set'
): Promise<{ 
  success: boolean; 
  previousBalance?: number;
  newBalance?: number;
  error?: string 
}> {
  try {
    // Verify user is authenticated
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    // Validate input
    if (amount < 0) {
      return {
        success: false,
        error: 'Amount cannot be negative'
      };
    }

    // Call the Cloud Function
    const updateCoinsFunction = httpsCallable(functions, 'updateUserCoins');
    const result = await updateCoinsFunction({
      amount,
      operation
    });

    // Parse and return the result
    const data = result.data as { 
      success: boolean;
      previousBalance: number;
      newBalance: number;
    };
    
    return {
      success: data.success,
      previousBalance: data.previousBalance,
      newBalance: data.newBalance
    };
  } catch (error) {
    console.error('Error updating user coins via Cloud Functions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
} 