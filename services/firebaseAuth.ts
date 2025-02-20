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
  initializeAuth,
  Auth
} from 'firebase/auth';
import { getReactNativePersistence } from 'firebase/auth/react-native';
import { FirebaseApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import { maybeCompleteAuthSession } from 'expo-web-browser';
import firebaseApp from './firebaseConfig';

// Finish any remaining auth session
maybeCompleteAuthSession();

// Initialize Firebase Auth with AsyncStorage persistence
let auth: Auth;
try {
  auth = initializeAuth(firebaseApp as FirebaseApp, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error) {
  // If auth is already initialized, get the existing instance
  console.warn('Auth may already be initialized, getting existing instance');
  auth = getAuth(firebaseApp as FirebaseApp);
}

// Types
export interface AuthResponse {
  user: User | null;
  error?: string;
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
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  scopes: ['profile', 'email']
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