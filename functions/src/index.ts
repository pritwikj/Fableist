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
  const { storyId, currentChapter } = data;
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
      // Update existing document
      await libraryItemRef.update(progressData);
    } else {
      // Create new document
      await libraryItemRef.set(progressData);
    }
    
    // Also update the reading progress collection (if it's being used)
    const progressRef = db.doc(`users/${userId}/readingProgress/${storyId}`);
    await progressRef.set(progressData, { merge: true });

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