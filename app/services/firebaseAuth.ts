import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  User,
  AuthError,
  OAuthProvider,
  updateProfile,
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import { maybeCompleteAuthSession } from 'expo-web-browser';
import { auth } from './firebase';

// Finish any remaining auth session
maybeCompleteAuthSession();

// Types
export interface AuthResponse {
  user: User | null;
  error?: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastReadStory?: string;
  lastReadPage?: number;
  bookmarks?: string[];
}

// Email/Password Authentication
export async function registerUser(email: string, password: string): Promise<AuthResponse> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user };
  } catch (error) {
    const authError = error as AuthError;
    return {
      user: null,
      error: authError.message || 'Failed to register user'
    };
  }
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user };
  } catch (error) {
    const authError = error as AuthError;
    return {
      user: null,
      error: authError.message || 'Failed to login'
    };
  }
}

// Google Authentication
const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
  clientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
});

export async function signInWithGoogle(): Promise<AuthResponse> {
  try {
    const result = await promptGoogleAsync();
    
    if (result.type === 'success') {
      const { id_token } = result.params;
      const credential = GoogleAuthProvider.credential(id_token);
      const userCredential = await signInWithCredential(auth, credential);
      return { user: userCredential.user };
    }
    
    return {
      user: null,
      error: 'Google sign in was cancelled or failed'
    };
  } catch (error) {
    const authError = error as AuthError;
    return {
      user: null,
      error: authError.message || 'Failed to sign in with Google'
    };
  }
}

// Apple Authentication
// Note: This requires the expo-apple-authentication package to be installed
// Install using: npx expo install expo-apple-authentication
let AppleAuthentication: any;
try {
  AppleAuthentication = require('expo-apple-authentication');
} catch (error) {
  console.warn('expo-apple-authentication is not installed. Apple Sign In will not be available.');
}

export async function isAppleAuthAvailable(): Promise<boolean> {
  try {
    return AppleAuthentication?.isAvailableAsync() || false;
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<AuthResponse> {
  if (!AppleAuthentication) {
    return {
      user: null,
      error: 'Apple authentication is not available. Please install expo-apple-authentication.'
    };
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const provider = new OAuthProvider('apple.com');
    const oAuthCredential = provider.credential({
      idToken: credential.identityToken!,
    });

    const userCredential = await signInWithCredential(auth, oAuthCredential);
    return { user: userCredential.user };
  } catch (error: any) {
    if (error?.code === 'ERR_CANCELED') {
      return {
        user: null,
        error: 'Apple sign in was cancelled'
      };
    }
    return {
      user: null,
      error: 'Failed to sign in with Apple'
    };
  }
}

// General Auth Functions
export async function logoutUser(): Promise<{ error?: string }> {
  try {
    await signOut(auth);
    return {};
  } catch (error) {
    const authError = error as AuthError;
    return {
      error: authError.message || 'Failed to logout'
    };
  }
}

export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// Get current user
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return auth.currentUser !== null;
}

// Update user profile
export async function updateUserProfile(profile: Partial<UserProfile>): Promise<AuthResponse> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }

    await updateProfile(user, {
      displayName: profile.displayName || user.displayName,
      photoURL: profile.photoURL || user.photoURL,
    });

    return { user };
  } catch (error) {
    const authError = error as AuthError;
    return {
      user: null,
      error: authError.message || 'Failed to update profile'
    };
  }
}

const firebaseAuth = {
  registerUser,
  loginUser,
  signInWithGoogle,
  signInWithApple,
  isAppleAuthAvailable,
  logoutUser,
  subscribeToAuthChanges,
  getCurrentUser,
  isAuthenticated,
  updateUserProfile,
};

export default firebaseAuth; 