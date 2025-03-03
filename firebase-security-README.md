# Firebase Security Rules for Fableist App

This document describes the Firestore security rules for the Fableist story-reading app and how to deploy them.

## Overview of Security Rules

The `firestore.rules` file contains the security rules that control access to your Firestore database. These rules enforce:

1. **Authentication Checks**: All data access requires proper authentication
2. **User Data Protection**: Users can only access their own profile and reading progress
3. **Read-Only Story Access**: All authenticated users can read stories, but no client-side modification is allowed
4. **Protected Fields**: Users cannot modify their coins or reading progress

## Detailed Rule Explanations

### Helper Functions

```
function isAuthenticated() {
  return request.auth != null;
}

function isOwner(userId) {
  return request.auth.uid == userId;
}
```

These helper functions simplify the rules by abstracting common checks:
- `isAuthenticated()` verifies that the user is signed in
- `isOwner(userId)` checks if the current user is accessing their own data

### Story Content Rules

```
match /stories/{storyId} {
  allow read: if isAuthenticated();
  allow write: if false;
  
  match /chapters/{chapterId} {
    allow read: if isAuthenticated();
    allow write: if false;
  }
}
```

These rules ensure:
- Any authenticated user can read story content and chapters
- No client-side code can create, update, or delete stories and chapters
- Story content must be managed through backend services

### User Data Rules

```
match /users/{userId} {
  allow read: if isOwner(userId);
  allow update: if isOwner(userId) && 
                 (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['coins']));
  allow create, delete: if isOwner(userId);
  
  match /userLibrary/{itemId} {
    allow read, write: if isOwner(userId);
  }
  
  match /readingProgress/{progressId} {
    allow read: if isOwner(userId);
    allow write: if false;
  }
}
```

These rules protect user data:
- Users can only access their own profile data
- Users can update their profile but cannot modify their coin balance
- Users can only read and write to their own library items
- Users can read but not modify their reading progress
- No other users can directly access another user's data

### Default Deny Rule

```
match /{document=**} {
  allow read, write: if false;
}
```

This catchall rule ensures that any collection or document not explicitly allowed is automatically denied. This follows the security principle of "deny by default."

## Testing Your Rules

Before deploying to production, test your rules using the Firebase Rules Simulator:

1. Open the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Firestore Database
4. Click on the "Rules" tab
5. Click on "Rules Playground" to test different scenarios

Test the following scenarios:
- Anonymous user tries to read story data (should be denied)
- Authenticated user tries to modify a story (should be denied)
- User tries to access another user's data (should be denied)
- User tries to modify their own profile (should be allowed)
- User tries to modify their coins (should be denied)
- User tries to modify their reading progress (should be denied)

## Deploying Rules

1. Place the `firestore.rules` file in the root of your project
2. Deploy using Firebase CLI:
   ```
   firebase deploy --only firestore:rules
   ```

## Security Best Practices

1. **Validation**: Add validation logic in your rules to verify the structure and values of data being written
2. **Field-Level Security**: If needed, implement field-level security for more granular control
3. **Regular Audits**: Review and test your security rules regularly as your app evolves

## Troubleshooting Common Issues

- **Rules Too Restrictive**: If legitimate operations are being blocked, gradually relax your rules while maintaining security
- **Performance Issues**: Very complex rules can cause performance issues; simplify where possible
- **Unexpected Denials**: Use the Rules Playground to debug specific operations that are being denied unexpectedly 