import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  AuthError,
  initializeAuth,
  Auth
} from 'firebase/auth';
import { getReactNativePersistence } from 'firebase/auth';
import { FirebaseApp } from 'firebase/app';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { maybeCompleteAuthSession } from 'expo-web-browser';
import firebaseApp from './firebaseConfig';

// Finish any remaining auth session
maybeCompleteAuthSession();

// Initialize Firebase Auth with AsyncStorage persistence
let auth: Auth;
try {
  auth = initializeAuth(firebaseApp as FirebaseApp, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
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