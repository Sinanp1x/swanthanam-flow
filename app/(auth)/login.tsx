import React, { useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { supabase } from '../../services/supabase';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isEmFocused, setIsEmFocused] = useState(false);
    const [isPsFocused, setIsPsFocused] = useState(false);
    const [loading, setLoading] = useState(false);

    const passwordRef = useRef<TextInput>(null);
    const router = useRouter();

    const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

    const handleLogin = async () => {
        const trimmedEmail = email.trim().toLowerCase();
        const trimmedPassword = password.trim();

        if (!trimmedEmail || !trimmedPassword){
            Alert.alert("Missing details", "Please enter email and password.");
            return;
        }

        if (!isValidEmail(trimmedEmail)) {
            Alert.alert("Invalid email", "Please enter a valid email address.");
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: trimmedEmail,
                password: trimmedPassword,
            });

            if (error) {
                throw error;
            }

            router.replace('/(tabs)');
        } catch (error) {
            const message = error instanceof Error ? error.message : "Login failed";
            Alert.alert("Login failed", message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <View style={styles.container}>
                <Stack.Screen options={{title:'Login', headerShown: false }}/>

                <View style={styles.headerContainer}>
                    <Image source={require('../../assets/images/logo.png')} style={styles.logo}/>
                    <Text style={styles.title}>Swanthanam Login</Text>
                </View>

                <View style={styles.formContainer}>
                    <TextInput
                        placeholder="Email"
                        value={email}
                        onChangeText={setEmail}
                        style={[styles.input, isEmFocused && styles.inputFocused]}
                        onFocus={() => setIsEmFocused(true)}
                        onBlur={() => setIsEmFocused(false)}
                        returnKeyType="next"
                        onSubmitEditing={() => passwordRef.current?.focus()}
                    />
                    <TextInput
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={true}
                        style={[styles.input, isPsFocused && styles.inputFocused]}
                        onFocus={() => setIsPsFocused(true)}
                        onBlur={() => setIsPsFocused(false)}
                        ref={passwordRef}
                    />
                    <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#fff"/>
                        ):(
                            <Text style={styles.buttonText}>Login</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.replace('/(auth)/signup')}>
                        <Text style={styles.linkText}>Don&apos;t have an account? Sign up</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
     );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#fff'
    },
    headerContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    formContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%'
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: '#FF4444',
        marginTop: 10,
        marginBottom: 20,
        letterSpacing: 0.5,
    },
    input: {
        width: '80%',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#eee',
        marginVertical: 10,
        padding: 15,
        borderRadius: 10,
        elevation: 2,

        shadowColor: '#000',
        shadowOffset:{width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    inputFocused: {
        borderWidth: 2,
        borderColor: '#32CD32',
        backgroundColor: '#FFFFE0'
    },
    button: {
        backgroundColor: '#FF0000ca',
        padding: 15,
        borderRadius: 10,
        width: '80%',
        alignItems: 'center',
        marginTop: 20,
        elevation: 3,
    },
    buttonText: {
        color: '#efebeb',
        fontWeight: 'bold',
        fontSize: 16,

    },
    linkText: {
        marginTop: 18,
        fontSize: 14,
        color: '#008060',
        fontWeight: '600',
    },
    logo: {
        width: 140,
        height:100,
        resizeMode: 'contain',
    },
});