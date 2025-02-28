import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import 'react-native-reanimated';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useColorScheme } from '@/components/useColorScheme';
import { subscribeToAuthChanges } from '../services/firebaseAuth';
import { createUserDocument } from '../services/userService';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// This function checks if the current route is in the auth group
function useProtectedRoute(user: User | null, loaded: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!loaded) return;

    const inAuthGroup = segments[0] === '(auth)';
    
    // Define protected routes - routes that require authentication
    const protectedRoutes = ['(tabs)/profile'];
    const currentRoute = segments.join('/');
    const isProtectedRoute = protectedRoutes.includes(currentRoute);

    if (!user && isProtectedRoute) {
      // If the user is not signed in and trying to access a protected route,
      // redirect to the sign-in page
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // If the user is signed in and the initial segment is in the auth group,
      // redirect to the home page
      router.replace('/');
    }
  }, [user, segments, loaded]);
}

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (user) => {
      setUser(user);
      
      // If a user has logged in, ensure they have a user document
      if (user) {
        try {
          await createUserDocument(user);
        } catch (error) {
          console.error('Error ensuring user document exists:', error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Protect routes based on authentication state
  useProtectedRoute(user, loaded);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="story/[id]" options={{ headerShown: true }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
