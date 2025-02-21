import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';

export function GoogleSignInButton() {
  const { signInWithGoogle, isGoogleAuthReady } = useGoogleSignIn();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const response = await signInWithGoogle();
      if (response.error) {
        // Handle error - you might want to show this in your UI
        console.error('Google sign in error:', response.error);
      }
      // On success, the user will be automatically signed in and
      // your auth state listener will handle the state change
    } catch (error) {
      console.error('Unexpected error during Google sign in:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleGoogleSignIn}
      disabled={!isGoogleAuthReady || isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.buttonText}>Sign in with Google</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#4285F4',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
}); 