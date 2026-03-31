import React, { useCallback, useMemo, useState } from 'react';
import { Stack, router, useFocusEffect } from 'expo-router';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Search, Plus, Pencil, ImagePlus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../services/supabase';

type Category = {
  id: string;
  name: string;
  prefix: string;
  image_url: string | null;
};

type ItemCountMap = Record<string, { total: number; available: number }>;

type ItemRow = {
  id: string;
  category_id: string;
  status: string | null;
};

export default function InventoryScreen() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [itemCountMap, setItemCountMap] = useState<ItemCountMap>({});

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [quantity, setQuantity] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const CATEGORY_TABLE = 'categories';

  const loadCategories = useCallback(async () => {
    setLoading(true);

    const { data: categoryRows, error: categoryError } = await supabase
      .from(CATEGORY_TABLE)
      .select('id, name, prefix, image_url')
      .order('name', { ascending: true });

    if (categoryError) {
      setLoading(false);
      Alert.alert('Load failed', categoryError.message);
      return;
    }

    const categoryData = (categoryRows ?? []) as Category[];
    setCategories(categoryData);

    const categoryIds = categoryData.map((row) => row.id);
    if (categoryIds.length === 0) {
      setItemCountMap({});
      setLoading(false);
      return;
    }

    const { data: itemRows, error: itemError } = await supabase
      .from('items')
      .select('id, category_id, status')
      .in('category_id', categoryIds);

    if (itemError) {
      setLoading(false);
      Alert.alert('Load failed', itemError.message);
      return;
    }

    const summary: ItemCountMap = {};
    for (const row of itemRows as ItemRow[]) {
      if (!summary[row.category_id]) {
        summary[row.category_id] = { total: 0, available: 0 };
      }
      summary[row.category_id].total += 1;
      if ((row.status ?? '').toLowerCase() === 'available') {
        summary[row.category_id].available += 1;
      }
    }

    setItemCountMap(summary);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

  const filteredCategories = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return categories;
    return categories.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) || row.prefix.toLowerCase().includes(needle)
    );
  }, [categories, search]);

  const resetForm = () => {
    setName('');
    setPrefix('');
    setQuantity('');
    setImageUri(null);
    setEditing(null);
  };

  const openCreateForm = () => {
    resetForm();
    setFormVisible(true);
  };

  const openEditForm = (category: Category) => {
    setEditing(category);
    setName(category.name);
    setPrefix(category.prefix);
    setQuantity('');
    setImageUri(category.image_url);
    setFormVisible(true);
  };

  const closeForm = () => {
    setFormVisible(false);
    resetForm();
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to select category image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadCategoryImage = async (uri: string, safePrefix: string) => {
    const response = await fetch(uri);
    const blob = await response.blob();

    const fileExt = blob.type.split('/')[1] || 'jpg';
    const fileName = `${safePrefix.toUpperCase()}_${Date.now()}.${fileExt}`;

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



  const handleSaveCategory = async () => {
    const trimmedName = name.trim();
    const trimmedPrefix = prefix.trim().toUpperCase();
    const parsedQuantity = Number(quantity) || 0;

    if (!trimmedName || !trimmedPrefix) {
      Alert.alert('Missing fields', 'Please fill name and prefix.');
      return;
    }

    setSaving(true);

    try {
      // 1. Handle Image Upload if needed
      let finalImageUrl = editing?.image_url ?? null;
      if (imageUri && imageUri !== editing?.image_url) {
        finalImageUrl = await uploadCategoryImage(imageUri, trimmedPrefix);
      }

      // 2. The One-Shot RPC
      const { error } = await supabase.rpc('save_category_and_items', {
        _id: editing ? editing.id : null,
        _name: trimmedName,
        _prefix: trimmedPrefix,
        _image_url: finalImageUrl,
        _target_quantity: editing ? 0 : parsedQuantity,
      });

      if (error) {
        throw new Error(error.message || 'RPC call failed');
      }

      // Success!
      setSaving(false);
      closeForm();
      await loadCategories();
      Alert.alert('Success', 'Category and inventory items are synced.');
    } catch (error) {
      setSaving(false);
      const message = error instanceof Error ? error.message : 'Unable to save category';
      console.error('Save error:', message);
      Alert.alert('Save failed', message);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Inventory',
          headerShown: true,
          headerStyle: { backgroundColor: '#008060' },
          headerTintColor: '#fff',
        }}
      />

      <View style={styles.topBar}>
        <View style={styles.searchBar}>
          <Search color="#6A6A6A" size={18} />
          <TextInput
            placeholder="Search category..."
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openCreateForm}>
          <Plus color="#fff" size={18} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#008060" style={styles.loadingIndicator} />
      ) : (
        <FlatList
          data={filteredCategories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const summary = itemCountMap[item.id] ?? {
              total: 0,
              available: 0,
            };

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/category-items',
                    params: {
                      categoryId: item.id,
                      categoryName: item.name,
                      prefix: item.prefix,
                    },
                  })
                }
              >
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.cardImage} />
                ) : (
                  <View style={styles.cardImagePlaceholder}>
                    <Text style={styles.cardImageText}>{item.prefix}</Text>
                  </View>
                )}

                <View style={styles.infoContainer}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.prefixText}>Prefix: {item.prefix}</Text>

                  <View style={styles.statsRow}>
                    <View style={styles.statsBox}>
                      <Text style={styles.statsLabel}>Total</Text>
                      <Text style={styles.statsNumber}>{summary.total}</Text>
                    </View>

                    <View style={styles.statsBox}>
                      <Text style={styles.statsLabel}>Available</Text>
                      <Text
                        style={[
                          styles.statsNumber,
                          { color: summary.available > 0 ? '#1F9D55' : '#D14343' },
                        ]}
                      >
                        {summary.available}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.editButton} onPress={() => openEditForm(item)}>
                  <Pencil size={16} color="#1E5B54" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>No categories found.</Text>}
        />
      )}

      <Modal visible={formVisible} animationType="slide" transparent onRequestClose={closeForm}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editing ? 'Edit Category' : 'New Category'}</Text>

              <TextInput
                style={styles.input}
                placeholder="Category Name"
                value={name}
                onChangeText={setName}
              />

              <TextInput
                style={styles.input}
                placeholder="Prefix (example: WC)"
                value={prefix}
                onChangeText={setPrefix}
                autoCapitalize="characters"
              />

              {!editing ? (
                <TextInput
                  style={styles.input}
                  placeholder="Quantity (initial children count)"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                />
              ) : null}

              <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                <ImagePlus size={18} color="#0D5C91" />
                <Text style={styles.imagePickerText}>Select Category Image</Text>
              </TouchableOpacity>

              {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImage} /> : null}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={closeForm} disabled={saving}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveButton} onPress={handleSaveCategory} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECF1F4',
  },
  topBar: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E7EAEE',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E9EF',
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 44,
    minWidth: 80,
    backgroundColor: '#008060',
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingIndicator: {
    marginTop: 24,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    alignItems: 'center',
  },
  cardImage: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: '#F1F4F7',
  },
  cardImagePlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: '#DCE9E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImageText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E5B54',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  prefixText: {
    marginTop: 4,
    color: '#5C6B7A',
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 16,
  },
  statsBox: {
    flexDirection: 'column',
    gap: 2,
  },
  statsLabel: {
    fontSize: 11,
    color: '#7A8795',
    textTransform: 'uppercase',
  },
  statsNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C2530',
  },
  editButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EDF6F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyText: {
    marginTop: 30,
    textAlign: 'center',
    color: '#64748B',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 18, 29, 0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  modalScroll: {
    paddingBottom: 30,
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E3E8EF',
    borderRadius: 12,
    backgroundColor: '#F9FBFC',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  imagePickerButton: {
    borderWidth: 1,
    borderColor: '#CFE2F1',
    backgroundColor: '#EFF7FF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  imagePickerText: {
    color: '#0D5C91',
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#EDF2F7',
  },
  modalActions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D3DBE6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#475569',
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#008060',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});