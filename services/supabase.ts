import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const isWeb = Platform.OS === 'web';
const isBrowser = typeof window !== 'undefined';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: isWeb
		? {
			// During web SSR there is no window/localStorage; disable persistence server-side.
			autoRefreshToken: isBrowser,
			persistSession: isBrowser,
			detectSessionInUrl: isBrowser,
		}
		: {
			storage: AsyncStorage,
			autoRefreshToken: true,
			persistSession: true,
			detectSessionInUrl: false,
		},
});