import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Get Firestore instance
const db = admin.firestore();

/**
 * Updates user reading progress
 * 
 * Secure server-side function to update a user's reading progress
 * that would otherwise be protected by Firestore rules.
 */
export const updateReadingProgress = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to update reading progress'
    );
  }

  // Extract user ID from auth context
  const userId = context.auth.uid;

  // Validate required parameters
  const { storyId, currentChapter, decisions } = data;
  if (!storyId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Story ID is required'
    );
  }

  if (currentChapter === undefined || currentChapter === null) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Current chapter is required'
    );
  }

  try {
    // Format chapter as number if possible
    const numericChapter = typeof currentChapter === 'string' 
      ? parseInt(currentChapter, 10) 
      : currentChapter;

    // Prepare progress data
    const progressData = {
      storyId,
      currentChapter: !isNaN(numericChapter) ? numericChapter : 0,
      lastReadTimestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    // Update user library document
    const libraryItemRef = db.doc(`users/${userId}/userLibrary/${storyId}`);
    
    // Check if document exists
    const docSnapshot = await libraryItemRef.get();
    
    if (docSnapshot.exists) {
      // Get existing data
      const existingData = docSnapshot.data() || {};
      
      // Get the current unlocked chapters or initialize empty array
      let unlockedChapters = existingData.unlockedChapters || [];
      
      // Get existing decision history or initialize empty object
      let chapterHistory = existingData.chapterHistory || {};
      
      // First 5 chapters (0-4) are always free
      // If the current chapter is already in unlocked chapters, nothing to add
      if (numericChapter > 4 && !unlockedChapters.includes(numericChapter)) {
        // Add current chapter to unlocked chapters
        unlockedChapters.push(numericChapter);
      }
      
      // Update chapter history with new decisions if provided
      if (decisions && typeof decisions === 'object') {
        // Merge with existing history, preserving previous chapters' decisions
        chapterHistory = {
          ...chapterHistory,
          ...decisions
        };
      }
      
      // Update with new data including unlocked chapters and decision history
      await libraryItemRef.update({
        ...progressData,
        unlockedChapters,
        chapterHistory
      });
    } else {
      // Create new document with initial unlocked chapters (free + current)
      const initialUnlockedChapters = Array.from({ length: 5 }, (_, i) => i); // First 5 chapters (0-4)
      
      // If the current chapter is > 4, add it to unlocked chapters
      if (numericChapter > 4 && !initialUnlockedChapters.includes(numericChapter)) {
        initialUnlockedChapters.push(numericChapter);
      }
      
      // Include decision history if provided
      const initialChapterHistory = decisions && typeof decisions === 'object' ? decisions : {};
      
      // Create library item with initial unlocked chapters and decision history
      await libraryItemRef.set({
        ...progressData,
        unlockedChapters: initialUnlockedChapters,
        chapterHistory: initialChapterHistory
      });
    }
    
    // Also update the reading progress collection (if it's being used)
    const progressRef = db.doc(`users/${userId}/readingProgress/${storyId}`);
    await progressRef.set({
      ...progressData,
      chapterHistory: decisions && typeof decisions === 'object' ? decisions : {}
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error('Error updating reading progress:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to update reading progress',
      error
    );
  }
});

/**
 * Updates user coin balance
 * 
 * Secure server-side function to update a user's coin balance
 * that would otherwise be protected by Firestore rules.
 */
export const updateUserCoins = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to update coin balance'
    );
  }

  // Extract user ID from auth context
  const userId = context.auth.uid;

  // Validate required parameters
  const { amount, operation } = data;
  if (amount === undefined || amount === null) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Amount is required'
    );
  }

  if (!operation || !['add', 'subtract', 'set'].includes(operation)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Valid operation (add, subtract, or set) is required'
    );
  }

  try {
    // Reference to the user document
    const userRef = db.doc(`users/${userId}`);
    
    // Get current user data
    const userSnapshot = await userRef.get();
    if (!userSnapshot.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'User profile not found'
      );
    }

    const userData = userSnapshot.data();
    if (!userData) {
      throw new functions.https.HttpsError(
        'internal',
        'User data is empty'
      );
    }

    // Calculate new coin balance
    let newCoinBalance: number;
    const currentCoins = userData.coins || 0;
    
    switch (operation) {
      case 'add':
        newCoinBalance = currentCoins + amount;
        break;
      case 'subtract':
        newCoinBalance = Math.max(0, currentCoins - amount); // Prevent negative balance
        break;
      case 'set':
        newCoinBalance = amount;
        break;
      default:
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid operation'
        );
    }

    // Update user document with new coin balance
    await userRef.update({ coins: newCoinBalance });

    return { 
      success: true, 
      previousBalance: currentCoins,
      newBalance: newCoinBalance
    };
  } catch (error) {
    console.error('Error updating user coins:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to update coin balance',
      error
    );
  }
}); 