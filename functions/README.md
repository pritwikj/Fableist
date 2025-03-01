# Fableist Cloud Functions

This directory contains Firebase Cloud Functions that handle server-side operations requiring elevated privileges beyond what's allowed in client-side security rules.

## Purpose

The Firestore security rules for this application restrict direct client-side updates to certain user data, including:

1. Reading progress data in the `readingProgress` collection
2. User's coin balance in the main user document

These Cloud Functions provide secure server-side endpoints to perform these operations.

## Available Functions

### `updateReadingProgress`

Updates a user's reading progress for a specific story. This function has access to write to the protected `readingProgress` collection.

Parameters:
- `storyId`: The ID of the story being read
- `currentChapter`: The current chapter number or index the user is on

### `updateUserCoins`

Updates a user's coin balance. This function can modify the protected `coins` field in the user document.

Parameters:
- `amount`: The number of coins to add, subtract, or set
- `operation`: The operation to perform ('add', 'subtract', or 'set')

## Deployment

To deploy these functions to Firebase:

```bash
# Install dependencies
cd functions
npm install

# Build the TypeScript code
npm run build

# Deploy to Firebase
npm run deploy
# Or from the parent directory
npm run deploy:functions
```

## Local Testing

You can test these functions locally using the Firebase emulator:

```bash
cd functions
npm run serve
```

## Client-side Usage

The application's services have been updated to use these Cloud Functions instead of direct Firestore writes. The relevant services are:

- `cloudFunctions.ts`: Contains wrapper functions for calling the Cloud Functions
- `userService.ts`: Updated to use Cloud Functions for protected operations
- `storyService.ts`: Updated to use Cloud Functions for reading progress updates

## Security Considerations

These Cloud Functions enforce proper authentication and authorization:

1. They verify that the request comes from an authenticated user
2. They only allow users to update their own data
3. They validate inputs before processing
4. They provide appropriate error handling and responses

## Troubleshooting

If you encounter issues with the Cloud Functions:

1. Check the Firebase Functions logs in the Firebase Console
2. Verify that the functions have been deployed successfully
3. Ensure that the client is properly authenticated before calling functions
4. Check for any error messages in the function responses 