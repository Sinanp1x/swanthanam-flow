import { Tabs } from 'expo-router';
import { Home, Package, Download, Upload, Clock } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: '#0C8577',
      tabBarInactiveTintColor: '#94A3B8',
      tabBarShowLabel: false,
      headerShown: false,
    }}>
      <Tabs.Screen
        name="index" // This matches index.tsx
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="inventory" // This matches inventory.tsx
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color }) => <Package color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="checkout" // This matches checkout.tsx
        options={{
          title: 'Checkout',
          headerShown: true,
          headerStyle: { backgroundColor: '#0C8577' },
          headerTintColor: '#fff',
          tabBarIcon: ({ color }) => <Upload color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="checkin" // This matches checkin.tsx
        options={{
          title: 'CheckIn',
          headerShown: true,
          headerStyle: { backgroundColor: '#0C8577' },
          headerTintColor: '#fff',
          tabBarIcon: ({ color }) => <Download color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          headerShown: true,
          headerStyle: { backgroundColor: '#0C8577' },
          headerTintColor: '#fff',
          tabBarIcon: ({ color }) => <Clock color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="category-items"
        options={{
          href: null,
          headerShown: true,
          headerStyle: { backgroundColor: '#0C8577' },
          headerTintColor: '#fff',
        }}
      />
    </Tabs>
  );
}