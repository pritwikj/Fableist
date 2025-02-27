/**
 * Profile Screen Component
 * 
 * This screen displays user profile information fetched from Firestore.
 * It shows the user's display name, email, coin balance, and join date.
 * A logout button is provided to sign out the user.
 */

import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useQuery } from '@tanstack/react-query';
import { fetchUserProfile } from '@/services/userService';
import { logoutUser } from '@/services/firebaseAuth';
import Colors from '@/constants/Colors';
import { MaterialIcons } from '@expo/vector-icons';

// Define the user profile interface to match Firestore structure
interface UserProfile {
  id: string;
  displayName?: string;
  email?: string;
  coins?: number; // Stored as number in Firestore
  joinDate?: string; // Stored as string in YYYY-MM-DD format
  [key: string]: any; // For other potential fields
}

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  
  // Fetch user profile data from Firestore
  const { 
    data: userProfile, 
    isLoading, 
    error,
    refetch
  } = useQuery<UserProfile>({
    queryKey: ['user-profile'],
    queryFn: fetchUserProfile,
  });
  
  // Handle logout
  const handleLogout = async () => {
    try {
      const result = await logoutUser();
      
      if (result.error) {
        Alert.alert('Logout Error', result.error);
        return;
      }
      
      // Navigate to the login screen or home screen
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred during logout');
    }
  };

  // Format date from string (YYYY-MM-DD) to a more readable format
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    
    try {
      // Append 'T12:00:00' to ensure it's interpreted as noon in local timezone
      const date = new Date(`${dateStr}T12:00:00`);
      
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  // Show loading indicator while fetching data
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // Show error message if data fetch fails
  if (error || !userProfile) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load profile';
    return (
      <View style={styles.container}>
        <MaterialIcons name="error-outline" size={50} color="red" />
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity 
          style={[styles.button, styles.retryButton]}
          onPress={() => refetch()}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {userProfile.displayName ? userProfile.displayName.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <Text style={styles.displayName}>{userProfile.displayName || 'User'}</Text>
      </View>

      {/* Profile Information */}
      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{userProfile.email || 'No email'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Coin Balance</Text>
          <Text style={styles.infoValue}>
            {userProfile.coins || 0} coins
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Member Since</Text>
          <Text style={styles.infoValue}>{formatDate(userProfile.joinDate)}</Text>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#CCC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  infoContainer: {
    width: '100%',
    marginBottom: 30,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButton: {
    backgroundColor: '#7f8c8d',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    marginTop: 10,
    marginBottom: 20,
    fontSize: 16,
    textAlign: 'center',
  },
}); 