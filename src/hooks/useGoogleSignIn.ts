import { useCallback } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential, getAuth, User, AuthError } from 'firebase/auth';
import firebaseApp from '../../services/firebaseConfig';
import { createUserDocument } from '../../services/userService';

// Types
export interface AuthResponse {
  user: User | null;
  error?: string;
}

export function useGoogleSignIn() {
  const auth = getAuth(firebaseApp);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    scopes: ['profile', 'email']
  });

  const signInWithGoogle = useCallback(async (): Promise<AuthResponse> => {
    try {
      const result = await promptAsync();
      
      if (result.type === 'success') {
        const { id_token } = result.params;
        const credential = GoogleAuthProvider.credential(id_token);
        const userCredential = await signInWithCredential(auth, credential);
        
        // Create user document in Firestore with default fields
        await createUserDocument(userCredential.user);
        
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
  }, [promptAsync]);

  return {
    signInWithGoogle,
    isGoogleAuthReady: !!request,
    googleAuthRequest: request,
    googleAuthResponse: response
  };
} 