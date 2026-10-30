import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import WelcomeScreen from '../screens/WelcomeScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import StationConnectionScreen from '../screens/StationConnectionScreen';
import FileSelectionScreen from '../screens/FileSelectionScreen';
import PrintOptionsScreen from '../screens/PrintOptionsScreen';
import UploadProgressScreen from '../screens/UploadProgressScreen';
import PrintStatusScreen from '../screens/PrintStatusScreen';
import HistoryScreen from '../screens/HistoryScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: '#0f172a' },
  headerTintColor: '#f1f5f9',
  headerTitleStyle: { fontWeight: '600' as const },
  contentStyle: { backgroundColor: '#0f172a' },
};

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={screenOptions}>
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="QRScanner"
          component={QRScannerScreen}
          options={{ title: 'Scan QR Code' }}
        />
        <Stack.Screen
          name="StationConnection"
          component={StationConnectionScreen}
          options={{ title: 'Connect to Station' }}
        />
        <Stack.Screen
          name="FileSelection"
          component={FileSelectionScreen}
          options={{ title: 'Select Document' }}
        />
        <Stack.Screen
          name="PrintOptions"
          component={PrintOptionsScreen}
          options={{ title: 'Print Options' }}
        />
        <Stack.Screen
          name="UploadProgress"
          component={UploadProgressScreen}
          options={{ title: 'Uploading', headerLeft: () => null }}
        />
        <Stack.Screen
          name="PrintStatus"
          component={PrintStatusScreen}
          options={{ title: 'Print Status', headerLeft: () => null }}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: 'My Print Jobs' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
