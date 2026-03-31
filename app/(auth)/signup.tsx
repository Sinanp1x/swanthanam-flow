import React, { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	KeyboardAvoidingView,
	Platform,
	Alert,
	ActivityIndicator,
} from 'react-native';
import { supabase } from '../../services/supabase';

export default function Signup() {
	const router = useRouter();

	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [unitCode, setUnitCode] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);

	const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

	const handleSignup = async () => {
		const trimmedName = name.trim();
		const trimmedEmail = email.trim().toLowerCase();
		const trimmedPhone = phone.trim();
		const trimmedUnitCode = unitCode.trim();
		const trimmedPassword = password.trim();

		if (!trimmedName || !trimmedEmail || !trimmedPhone || !trimmedUnitCode || !trimmedPassword) {
			Alert.alert('Missing details', 'Please fill all fields.');
			return;
		}

		if (!isValidEmail(trimmedEmail)) {
			Alert.alert('Invalid email', 'Please enter a valid email address.');
			return;
		}

		if (trimmedPassword.length < 6) {
			Alert.alert('Weak password', 'Password must be at least 6 characters.');
			return;
		}

		const phoneDigits = trimmedPhone.replace(/\D/g, '');
		if (phoneDigits.length < 10) {
			Alert.alert('Invalid phone', 'Please enter a valid phone number.');
			return;
		}

		setLoading(true);

		try {
			const { data: keyRow, error: keyError } = await supabase
				.from('committee_keys')
				.select('secret_key, unit_name')
				.eq('secret_key', trimmedUnitCode)
				.maybeSingle();

			if (keyError) {
				throw keyError;
			}

			if (!keyRow) {
				Alert.alert('Invalid unit code', 'The unit code is not recognized.');
				return;
			}

			const { data: insertedUser, error: userInsertError } = await supabase
				.from('users')
				.insert({
					user_name: trimmedName,
					phone: trimmedPhone,
					unit: trimmedUnitCode,
					imageurl: null,
				})
				.select('id')
				.single();

			if (userInsertError) {
				throw userInsertError;
			}

			const insertedUserId = insertedUser.id as number;

			const { error: signupError } = await supabase.auth.signUp({
				email: trimmedEmail,
				password: trimmedPassword,
				options: {
					data: {
						full_name: trimmedName,
						phone: trimmedPhone,
						phone_number: trimmedPhone,
						unit_code: trimmedUnitCode,
						unit_name: keyRow.unit_name,
						imageurl: null,
						user_row_id: insertedUserId,
					},
				},
			});

			if (signupError) {
				await supabase.from('users').delete().eq('id', insertedUserId);
				throw signupError;
			}

			Alert.alert('Signup successful', 'Your account has been created.');
			router.replace('/(tabs)');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Something went wrong.';
			Alert.alert('Signup failed', message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			style={styles.root}
		>
			<Stack.Screen options={{ title: 'Signup', headerShown: false }} />

			<View style={styles.container}>
				<Text style={styles.title}>Create Account</Text>
				<Text style={styles.subtitle}>Register with your unit code</Text>

				<View style={styles.formContainer}>
					<TextInput
						placeholder="Name"
						value={name}
						onChangeText={setName}
						style={styles.input}
						autoCapitalize="words"
					/>

					<TextInput
						placeholder="Email"
						value={email}
						onChangeText={setEmail}
						style={styles.input}
						keyboardType="email-address"
						autoCapitalize="none"
					/>

					<TextInput
						placeholder="Phone Number"
						value={phone}
						onChangeText={setPhone}
						style={styles.input}
						keyboardType="phone-pad"
					/>

					<TextInput
						placeholder="Unit Code"
						value={unitCode}
						onChangeText={setUnitCode}
						style={styles.input}
						autoCapitalize="none"
					/>

					<TextInput
						placeholder="Password"
						value={password}
						onChangeText={setPassword}
						style={styles.input}
						secureTextEntry
						autoCapitalize="none"
					/>

					<TouchableOpacity
						style={[styles.button, loading && styles.buttonDisabled]}
						onPress={handleSignup}
						disabled={loading}
					>
						{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign Up</Text>}
					</TouchableOpacity>

					<TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
						<Text style={styles.linkText}>Already have an account? Login</Text>
					</TouchableOpacity>
				</View>
			</View>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		backgroundColor: '#fff',
	},
	container: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 20,
	},
	title: {
		fontSize: 28,
		fontWeight: '800',
		color: '#FF4444',
	},
	subtitle: {
		marginTop: 8,
		marginBottom: 24,
		fontSize: 14,
		color: '#666',
	},
	formContainer: {
		width: '100%',
		alignItems: 'center',
	},
	input: {
		width: '90%',
		backgroundColor: '#fff',
		borderWidth: 1,
		borderColor: '#eee',
		marginVertical: 8,
		padding: 15,
		borderRadius: 10,
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	button: {
		backgroundColor: '#FF0000CA',
		padding: 15,
		borderRadius: 10,
		width: '90%',
		alignItems: 'center',
		marginTop: 14,
	},
	buttonDisabled: {
		opacity: 0.7,
	},
	buttonText: {
		color: '#EFEBEB',
		fontWeight: 'bold',
		fontSize: 16,
	},
	linkText: {
		marginTop: 18,
		fontSize: 14,
		color: '#008060',
		fontWeight: '600',
	},
});
