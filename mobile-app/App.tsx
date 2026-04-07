import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
// Screens
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import ScanScreen from './screens/ScanScreen';
import SearchScreen from './screens/SearchScreen';
import ProductDetailScreen from './screens/ProductDetailScreen';
import RoomsScreen from './screens/RoomsScreen';
import RoomDetailScreen from './screens/RoomDetailScreen';
import QuoteScreen from './screens/QuoteScreen';
import QuoteBuilderScreen from './screens/QuoteBuilderScreen';
import SettingsScreen from './screens/SettingsScreen';
import { TabBarIcon } from './components/TabBarIcon';

const Tab = createBottomTabNavigator();
const SearchStack = createNativeStackNavigator();
const RoomsStack  = createNativeStackNavigator();
const QuoteStack  = createNativeStackNavigator();

function SearchStackNav() {
  return (
    <SearchStack.Navigator screenOptions={{ headerShown: false }}>
      <SearchStack.Screen name="SearchList"    component={SearchScreen} />
      <SearchStack.Screen name="ProductDetail" component={ProductDetailScreen} />
    </SearchStack.Navigator>
  );
}

function RoomsStackNav() {
  return (
    <RoomsStack.Navigator screenOptions={{ headerShown: false }}>
      <RoomsStack.Screen name="RoomsList"  component={RoomsScreen} />
      <RoomsStack.Screen name="RoomDetail" component={RoomDetailScreen} />
    </RoomsStack.Navigator>
  );
}

function QuoteStackNav() {
  return (
    <QuoteStack.Navigator screenOptions={{ headerShown: false }}>
      <QuoteStack.Screen name="QuoteList"    component={QuoteScreen} />
      <QuoteStack.Screen name="QuoteBuilder" component={QuoteBuilderScreen} />
    </QuoteStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0D1520',
          borderTopColor: 'rgba(255,255,255,0.07)',
          borderTopWidth: 1,
          paddingBottom: 56,
          paddingTop: 8,
          height: 116,
        },
        tabBarActiveTintColor: '#0A84FF',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
        tabBarIcon: ({ color, focused }) => (
          <TabBarIcon name={route.name} color={color} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Scan"     component={ScanScreen} />
      <Tab.Screen name="Rooms"    component={RoomsStackNav} />
      <Tab.Screen name="Search"   component={SearchStackNav} />
      <Tab.Screen name="Quotes"   component={QuoteStackNav} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { isLoading, isSignedIn } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0A84FF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isSignedIn ? <MainTabs /> : <LoginScreen />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TenantProvider>
          <RootNavigator />
        </TenantProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#080C14',
    alignItems: 'center',
    justifyContent: 'center',
  },
});