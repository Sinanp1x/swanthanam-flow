import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Phone, Building, LogOut, Edit2, Eye, EyeOff, Camera } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import {
    View,
    ScrollView,
    StyleSheet,
    Text,
    KeyboardAvoidingView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
    Image,
    Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabase';

type UserMeta = {
    full_name?: string;
    phone?: string;
    phone_number?: string;
    unit_code?: string;
    unit_name?: string;
    show_unit_code?: boolean;
    imageurl?: string | null;
    user_row_id?: number;
};

type UserRow = {
    id: number;
    user_name: string | null;
    phone: string | null;
    unit: string | null;
    imageurl: string | null;
};

type UnitMemberRow = {
    user_name: string | null;
};

type ProfileItemProps = {
    icon: React.ReactNode;
    label: string;
    value: string;
    onEdit?: () => void;
};

export default function Profile() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('Not available');
    const [meta, setMeta] = useState<UserMeta>({});
    const [userRowId, setUserRowId] = useState<number | null>(null);
    const [showUnitCode, setShowUnitCode] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editFullName, setEditFullName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [saving, setSaving] = useState(false);
    const [unitMembers, setUnitMembers] = useState<string[]>([]);

    useEffect(() => {
        const loadProfile = async () => {
            setLoading(true);
            const { data, error } = await supabase.auth.getUser();
            if (error) {
                Alert.alert('Profile error', error.message);
            } else {
                setEmail(data.user?.email ?? 'Not available');

                const userMeta = (data.user?.user_metadata ?? {}) as UserMeta;
                const storedUserRowId = Number(userMeta.user_row_id ?? 0);
                const fallbackPhone = (userMeta.phone_number ?? userMeta.phone ?? '').trim();

                let row: UserRow | null = null;

                if (storedUserRowId > 0) {
                    const { data: byId } = await supabase
                        .from('users')
                        .select('id, user_name, phone, unit, imageurl')
                        .eq('id', storedUserRowId)
                        .maybeSingle();
                    row = (byId as UserRow | null) ?? null;
                }

                if (!row && fallbackPhone) {
                    const { data: byPhone } = await supabase
                        .from('users')
                        .select('id, user_name, phone, unit, imageurl')
                        .eq('phone', fallbackPhone)
                        .maybeSingle();
                    row = (byPhone as UserRow | null) ?? null;
                }

                const unitCode = row?.unit ?? userMeta.unit_code ?? '';
                let unitName = userMeta.unit_name ?? '';

                if (unitCode) {
                    const { data: keyRow } = await supabase
                        .from('committee_keys')
                        .select('unit_name')
                        .eq('secret_key', unitCode)
                        .maybeSingle();
                    unitName = keyRow?.unit_name ?? unitName;
                }

                const mergedMeta: UserMeta = {
                    full_name: row?.user_name ?? userMeta.full_name ?? '',
                    phone: row?.phone ?? userMeta.phone ?? '',
                    phone_number: row?.phone ?? userMeta.phone_number ?? '',
                    unit_code: unitCode,
                    unit_name: unitName,
                    show_unit_code: userMeta.show_unit_code ?? false,
                    imageurl: row?.imageurl ?? userMeta.imageurl ?? null,
                    user_row_id: row?.id ?? (storedUserRowId > 0 ? storedUserRowId : undefined),
                };

                setMeta(mergedMeta);
                setUserRowId(row?.id ?? null);
                setShowUnitCode(Boolean(userMeta.show_unit_code));

                setEditFullName(mergedMeta.full_name ?? '');
                setEditPhone(mergedMeta.phone_number ?? mergedMeta.phone ?? '');

                const normalizedUnitCode = (unitCode ?? '').trim();
                if (normalizedUnitCode) {
                    const { data: memberRows } = await supabase
                        .from('users')
                        .select('user_name')
                        .eq('unit', normalizedUnitCode);

                    const currentName = (mergedMeta.full_name ?? '').trim().toLowerCase();
                    const uniqueMembers = new Set<string>();

                    for (const member of (memberRows ?? []) as UnitMemberRow[]) {
                        const rawName = (member.user_name ?? '').trim();
                        if (!rawName) continue;
                        if (rawName.toLowerCase() === currentName) continue;
                        uniqueMembers.add(rawName);
                    }

                    setUnitMembers(Array.from(uniqueMembers));
                } else {
                    setUnitMembers([]);
                }
            }
            setLoading(false);
        };

        loadProfile();
    }, []);

    const displayName = useMemo(() => {
        const name = meta.full_name?.trim();
        return name || 'Volunteer';
    }, [meta.full_name]);

    const displayPhone = useMemo(() => {
        return meta.phone_number?.trim() || meta.phone?.trim() || 'Not provided';
    }, [meta.phone_number, meta.phone]);

    const displayUnitCode = useMemo(() => {
        return meta.unit_code?.trim() || 'Not set';
    }, [meta.unit_code]);

    const displayUnitName = useMemo(() => {
        return meta.unit_name?.trim() || 'Not set';
    }, [meta.unit_name]);

    const displayImageUrl = useMemo(() => {
        return meta.imageurl?.trim() || '';
    }, [meta.imageurl]);

    const avatarLetter = displayName.charAt(0).toUpperCase();

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            Alert.alert('Logout failed', error.message);
            return;
        }
        router.replace('/(auth)/login');
    };

    const handleOpenEditModal = () => {
        setEditFullName(meta.full_name ?? '');
        setEditPhone(meta.phone_number ?? meta.phone ?? '');
        setEditModalVisible(true);
    };

    const uploadProfileImage = async (uri: string, seed: string) => {
        const response = await fetch(uri);
        const blob = await response.blob();
        const fileExt = blob.type.split('/')[1] || 'jpg';
        const fileName = `USER_${seed}_${Date.now()}.${fileExt}`;

        const { error } = await supabase.storage
            .from('category_images')
            .upload(fileName, blob, {
                contentType: blob.type,
                upsert: true,
            });

        if (error) throw error;

        const { data: urlData } = supabase.storage
            .from('category_images')
            .getPublicUrl(fileName);

        return urlData.publicUrl;
    };

    const handlePickProfileImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission needed', 'Please allow photo access to update your profile photo.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
        });

        if (result.canceled) return;

        setSaving(true);
        try {
            const uri = result.assets[0].uri;
            const imageurlValue = await uploadProfileImage(uri, (meta.unit_code ?? 'USER').toUpperCase());
            const phoneValue = (meta.phone_number ?? meta.phone ?? '').trim();
            const unitCodeValue = (meta.unit_code ?? '').trim();
            const userNameValue = (meta.full_name ?? '').trim();
            let currentUserRowId = userRowId;

            if (userRowId) {
                const { error: updateUserRowError } = await supabase
                    .from('users')
                    .update({ imageurl: imageurlValue })
                    .eq('id', userRowId);
                if (updateUserRowError) throw updateUserRowError;
            } else {
                const { data: insertedUser, error: insertUserRowError } = await supabase
                    .from('users')
                    .insert({
                        user_name: userNameValue || null,
                        phone: phoneValue || null,
                        unit: unitCodeValue || null,
                        imageurl: imageurlValue,
                    })
                    .select('id')
                    .single();

                if (insertUserRowError) throw insertUserRowError;
                currentUserRowId = insertedUser.id as number;
                setUserRowId(currentUserRowId);
            }

            const resolvedUserRowId = currentUserRowId ?? undefined;

            const { error: authUpdateError } = await supabase.auth.updateUser({
                data: {
                    ...meta,
                    imageurl: imageurlValue,
                    user_row_id: resolvedUserRowId,
                },
            });
            if (authUpdateError) throw authUpdateError;

            setMeta((prev) => ({ ...prev, imageurl: imageurlValue, user_row_id: resolvedUserRowId }));
            Alert.alert('Success', 'Profile photo updated.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update profile photo';
            Alert.alert('Update failed', message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!editFullName.trim()) {
            Alert.alert('Missing field', 'Please enter your full name.');
            return;
        }

        setSaving(true);
        try {
            const phoneValue = editPhone.trim();
            const imageurlValue = meta.imageurl ?? null;
            const unitCodeValue = (meta.unit_code ?? '').trim();
            let currentUserRowId = userRowId;

            let unitNameValue = (meta.unit_name ?? '').trim();
            if (unitCodeValue) {
                const { data: keyRow, error: keyError } = await supabase
                    .from('committee_keys')
                    .select('unit_name')
                    .eq('secret_key', unitCodeValue)
                    .maybeSingle();

                if (keyError) throw keyError;
                if (keyRow?.unit_name) {
                    unitNameValue = keyRow.unit_name;
                }
            }

            if (userRowId) {
                const { error: updateUserRowError } = await supabase
                    .from('users')
                    .update({
                        user_name: editFullName.trim(),
                        phone: phoneValue,
                        unit: unitCodeValue || null,
                        imageurl: imageurlValue,
                    })
                    .eq('id', userRowId);

                if (updateUserRowError) throw updateUserRowError;
            } else {
                const { data: insertedUser, error: insertUserRowError } = await supabase
                    .from('users')
                    .insert({
                        user_name: editFullName.trim(),
                        phone: phoneValue,
                        unit: unitCodeValue || null,
                        imageurl: imageurlValue,
                    })
                    .select('id')
                    .single();

                if (insertUserRowError) throw insertUserRowError;
                currentUserRowId = insertedUser.id as number;
                setUserRowId(currentUserRowId);
            }

            const resolvedUserRowId = currentUserRowId ?? undefined;

            const { error } = await supabase.auth.updateUser({
                data: {
                    full_name: editFullName.trim(),
                    phone: phoneValue,
                    phone_number: phoneValue,
                    unit_code: unitCodeValue,
                    unit_name: unitNameValue,
                    show_unit_code: showUnitCode,
                    imageurl: imageurlValue,
                    user_row_id: resolvedUserRowId,
                },
            });

            if (error) throw error;

            const updatedMeta: UserMeta = {
                full_name: editFullName.trim(),
                phone: phoneValue,
                phone_number: phoneValue,
                unit_name: unitNameValue,
                unit_code: unitCodeValue,
                show_unit_code: showUnitCode,
                imageurl: imageurlValue,
                user_row_id: resolvedUserRowId,
            };
            setMeta(updatedMeta);
            setEditModalVisible(false);
            Alert.alert('Success', 'Profile updated successfully.');
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Failed to update profile';
            Alert.alert('Update failed', message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
        >
            <Stack.Screen
                options={{
                    title: 'Profile',
                    headerStyle: { backgroundColor: '#0C8577' },
                    headerTintColor: '#fff',
                }}
            />

            <View style={styles.header}>
                <View style={styles.avatarContainer}>
                    <View style={styles.avatarCircle}>
                        {displayImageUrl ? (
                            <Image source={{ uri: displayImageUrl }} style={styles.avatarImage} />
                        ) : (
                            <Text style={styles.avatarText}>{avatarLetter || 'U'}</Text>
                        )}
                    </View>
                    <TouchableOpacity style={styles.cameraButton} onPress={handlePickProfileImage}>
                        <Camera color="#fff" size={16} />
                    </TouchableOpacity>
                </View>
                <Text style={styles.userName}>{displayName}</Text>
                <Text style={styles.userRole}>Committee Member</Text>
            </View>

            {loading ? (
                <ActivityIndicator style={styles.loader} size="large" color="#008060" />
            ) : (
                <>
                    <View style={styles.infoSection}>
                        <ProfileItem
                            icon={<Mail size={20} color="#666" />}
                            label="Email"
                            value={email}
                        />
                        <ProfileItem
                            icon={<Phone size={20} color="#666" />}
                            label="Phone"
                            value={displayPhone}
                        />
                        <ProfileItem
                            icon={<Building size={20} color="#666" />}
                            label="Unit Name"
                            value={displayUnitName}
                        />
                        <View style={styles.unitCodeRow}>
                            <View style={styles.unitCodeInfo}>
                                <Text style={styles.unitCodeLabel}>Unit Code</Text>
                                <Text style={[styles.unitCodeValue, !showUnitCode && styles.unitCodeHidden]}>
                                    {showUnitCode ? displayUnitCode : '******'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() => setShowUnitCode((prev) => !prev)}
                            >
                                {showUnitCode ? (
                                    <Eye size={20} color="#0C8577" />
                                ) : (
                                    <EyeOff size={20} color="#94A3B8" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {unitMembers.length > 0 ? (
                        <View style={styles.membersSection}>
                            <Text style={styles.membersTitle}>Members In Your Unit</Text>
                            <View style={styles.membersTable}>
                                <View style={styles.membersHeaderRow}>
                                    <Text style={styles.membersHeaderText}>Name</Text>
                                </View>

                                {unitMembers.map((memberName, index) => (
                                    <View
                                        key={`${memberName}-${index}`}
                                        style={styles.membersDataRow}
                                    >
                                        <Text style={styles.membersDataText}>{memberName}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : null}
                </>
            )}

            <TouchableOpacity
                style={styles.editButton}
                onPress={handleOpenEditModal}
                disabled={loading}
            >
                <Edit2 color="#fff" size={18} />
                <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <LogOut color="#FF0000" size={20} />
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

            <Modal
                visible={editModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Profile</Text>
                            <TouchableOpacity
                                onPress={() => setEditModalVisible(false)}
                                disabled={saving}
                            >
                                <Text style={styles.closeButton}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                            <Text style={styles.inputLabel}>Full Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your full name"
                                value={editFullName}
                                onChangeText={setEditFullName}
                                editable={!saving}
                            />

                            <Text style={styles.inputLabel}>Phone Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter phone number"
                                value={editPhone}
                                onChangeText={setEditPhone}
                                keyboardType="phone-pad"
                                editable={!saving}
                            />

                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setEditModalVisible(false)}
                                disabled={saving}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleSaveProfile}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Save Changes</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
        </KeyboardAvoidingView>
    );
}

function ProfileItem({ icon, label, value, onEdit }: ProfileItemProps) {
    return (
        <View style={styles.itemRow}>
            <View style={styles.iconBox}>{icon}</View>
            <View style={styles.itemTextWrap}>
                <Text style={styles.itemLabel}>{label}</Text>
                <Text style={styles.itemValue}>{value}</Text>
            </View>
            {onEdit && (
                <TouchableOpacity onPress={onEdit}>
                    <Edit2 size={18} color="#0C8577" />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7' },
    contentContainer: { paddingBottom: 40 },
    header: {
        backgroundColor: '#0C8577',
        alignItems: 'center',
        paddingVertical: 40,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 15,
    },
    avatarCircle: {
        width: 86,
        height: 86,
        borderRadius: 43,
        backgroundColor: '#E8F5F2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: { color: '#0C8577', fontSize: 32, fontWeight: 'bold' },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 43,
    },
    cameraButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#0C8577',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    userName: { fontSize: 22, fontWeight: 'bold', color: '#FFF' },
    userRole: { fontSize: 14, color: '#D8FFF6', marginTop: 4 },
    loader: { marginTop: 30 },
    infoSection: {
        backgroundColor: '#fff',
        marginTop: 20,
        marginHorizontal: 14,
        paddingHorizontal: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E8F5F2',
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    iconBox: { marginRight: 15, width: 30, alignItems: 'center' },
    itemTextWrap: { flex: 1 },
    itemLabel: { fontSize: 12, color: '#999', textTransform: 'uppercase' },
    itemValue: { fontSize: 16, color: '#333', fontWeight: '500' },
    unitCodeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        paddingHorizontal: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    unitCodeInfo: {
        flex: 1,
    },
    unitCodeLabel: {
        fontSize: 12,
        color: '#999',
        textTransform: 'uppercase',
    },
    unitCodeValue: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
        marginTop: 4,
    },
    unitCodeHidden: {
        letterSpacing: 1,
    },
    eyeButton: {
        padding: 8,
        marginLeft: 8,
    },
    membersSection: {
        backgroundColor: '#fff',
        marginTop: 14,
        marginHorizontal: 14,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E8F5F2',
    },
    membersTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    membersTable: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        overflow: 'hidden',
    },
    membersHeaderRow: {
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    membersHeaderText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#334155',
        textTransform: 'uppercase',
    },
    membersDataRow: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    membersDataText: {
        fontSize: 14,
        color: '#0F172A',
        fontWeight: '600',
    },
    editButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        marginHorizontal: 14,
        gap: 10,
        backgroundColor: '#0C8577',
        paddingVertical: 14,
        borderRadius: 12,
    },
    editButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    logoutButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        gap: 10,
    },
    logoutText: { color: '#FF0000', fontWeight: 'bold', fontSize: 16 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '85%',
        paddingTop: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E8F5F2',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111',
    },
    closeButton: {
        fontSize: 24,
        color: '#999',
        fontWeight: '300',
    },
    modalBody: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    inputLabel: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '700',
        marginBottom: 6,
        marginTop: 12,
        textTransform: 'uppercase',
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#DCE5EE',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0F172A',
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#E8F5F2',
    },
    toggleLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111',
    },
    toggleDesc: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#E8F5F2',
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#EEF2F6',
    },
    cancelButtonText: {
        color: '#334155',
        fontWeight: '700',
        fontSize: 14,
    },
    saveButton: {
        backgroundColor: '#0C8577',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
});