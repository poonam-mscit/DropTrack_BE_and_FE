import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LoginScreen } from '@/screens/LoginScreen';
import { AcceptInviteScreen } from '@/screens/AcceptInviteScreen';
import { JobsScreen } from '@/screens/JobsScreen';
import { JobDetailScreen } from '@/screens/JobDetailScreen';
import { ActiveScreen } from '@/screens/ActiveScreen';
import { SummaryScreen } from '@/screens/SummaryScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { useAuth } from '@/auth/AuthContext';
import type { AuthStackParamList, AppTabParamList, JobsStackParamList } from './types';
import { colors } from '@/theme';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const JobsStack = createNativeStackNavigator<JobsStackParamList>();
const Tabs = createBottomTabNavigator<AppTabParamList>();

/** Stack hosted INSIDE the Jobs tab — handles the queue → detail → active → summary flow. */
function JobsStackNav() {
  return (
    <JobsStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <JobsStack.Screen name="JobsHome" component={JobsScreen} />
      <JobsStack.Screen name="JobDetail" component={JobDetailScreen} />
      <JobsStack.Screen name="Active" component={ActiveScreen} options={{ gestureEnabled: false }} />
      <JobsStack.Screen name="Summary" component={SummaryScreen} options={{ gestureEnabled: false }} />
    </JobsStack.Navigator>
  );
}

/** Instagram-style bottom tabs visible across the whole signed-in app. */
function AppTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.borderSoft,
          height: 64,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => {
          const name: keyof typeof Ionicons.glyphMap =
            route.name === 'Jobs'
              ? focused
                ? 'home'
                : 'home-outline'
              : focused
                ? 'person-circle'
                : 'person-circle-outline';
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Jobs" component={JobsStackNav} options={{ title: 'Home' }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tabs.Navigator>
  );
}

export function RootStack() {
  const { session } = useAuth();
  if (!session) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="AcceptInvite">
          {({ route, navigation }) => (
            <AcceptInviteScreen
              token={route.params.token}
              onCancel={() => navigation.navigate('Login')}
            />
          )}
        </AuthStack.Screen>
      </AuthStack.Navigator>
    );
  }
  return <AppTabs />;
}
