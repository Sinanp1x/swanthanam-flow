import React, { useEffect, useMemo, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { supabase } from '../../services/supabase';

type Category = {
  id: string;
  name: string;
  prefix: string;
  image_url: string | null;
};

type Item = {
  id: string;
  category_id: string;
  serial_number: string | null;
  status: string | null;
};

type SearchResult = {
  itemId: string;
  categoryId: string;
  categoryName: string;
  prefix: string;
  serialNumber: string;
  status: string;
};

const normalizeStatus = (status: string | null) => {
  const normalized = (status ?? '').trim().toLowerCase();
  return normalized || 'unknown';
};

export default function Checkout() {
  const router = useRouter();
  const { itemName } = useLocalSearchParams();

  const initialSearch = useMemo(() => {
    if (Array.isArray(itemName)) return itemName[0] ?? '';
    return typeof itemName === 'string' ? itemName : '';
  }, [itemName]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState(initialSearch);

  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [place, setPlace] = useState('');

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedItems, setSelectedItems] = useState<SearchResult[]>([]);

  useEffect(() => {
    const loadAvailableItems = async () => {
      setLoading(true);

      const { data: categoryRows, error: categoryError } = await supabase
        .from('categories')
        .select('id, name, prefix, image_url');

      if (categoryError) {
        setLoading(false);
        Alert.alert('Load failed', categoryError.message);
        return;
      }

      const categories = (categoryRows ?? []) as Category[];
      const categoryMap = new Map<string, Category>(categories.map((c) => [c.id, c]));

      const { data: itemRows, error: itemError } = await supabase
        .from('items')
        .select('id, category_id, serial_number, status');

      if (itemError) {
        setLoading(false);
        Alert.alert('Load failed', itemError.message);
        return;
      }

      const mapped = ((itemRows ?? []) as Item[])
        .map((item) => {
          const category = categoryMap.get(item.category_id);
          if (!category) return null;

          return {
            itemId: item.id,
            categoryId: category.id,
            categoryName: category.name,
            prefix: category.prefix,
            serialNumber: item.serial_number ?? 'N/A',
            status: normalizeStatus(item.status),
          } as SearchResult;
        })
        .filter((row): row is SearchResult => Boolean(row));

      setSearchResults(mapped);
      setLoading(false);
    };

    loadAvailableItems();
  }, []);

  const filteredResults = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return [];

    const selectedSet = new Set(selectedItems.map((row) => row.itemId));

    return searchResults.filter((row) => {
      if (selectedSet.has(row.itemId)) return false;
      return (
        row.categoryName.toLowerCase().includes(needle) ||
        row.prefix.toLowerCase().includes(needle) ||
        row.serialNumber.toLowerCase().includes(needle)
      );
    });
  }, [search, searchResults, selectedItems]);

  const addSelectedItem = (item: SearchResult) => {
    if (item.status !== 'available') {
      const reason = item.status === 'lended' ? 'already lended' : `currently ${item.status}`;
      Alert.alert('Item unavailable', `${item.serialNumber} is ${reason}.`);
      return;
    }
    setSelectedItems((prev) => [...prev, item]);
    setSearch('');
  };

  const removeSelectedItem = (itemId: string) => {
    setSelectedItems((prev) => prev.filter((row) => row.itemId !== itemId));
  };

  const handleConfirm = async () => {
    if (!patientName.trim() || !phone.trim() || !place.trim()) {
      Alert.alert('Missing details', 'Please fill patient name, phone, and address/place.');
      return;
    }

    if (selectedItems.length === 0) {
      Alert.alert('No item selected', 'Search and add at least one item (category/serial).');
      return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      Alert.alert('Invalid phone', 'Please enter a valid phone number.');
      return;
    }

    setSaving(true);

    try {
      const itemIds = selectedItems.map((row) => row.itemId);

      const { data: sessionId, error: rpcError } = await supabase.rpc('create_session_checkout', {
        _patient_name: patientName.trim(),
        _phone: phone.trim(),
        _place: place.trim(),
        _item_ids: itemIds,
      });

      if (rpcError) throw rpcError;

      const selectedIdSet = new Set(itemIds);
      setSearchResults((prev) =>
        prev.map((row) =>
          selectedIdSet.has(row.itemId) ? { ...row, status: 'lended' } : row
        )
      );

      setSelectedItems([]);
      setPatientName('');
      setPhone('');
      setPlace('');
      setSearch('');

      Alert.alert(
        'Success',
        `Session #${sessionId ?? ''} created. ${selectedItems.length} item(s) assigned to ${patientName.trim()}.`
      );
      router.back();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to complete checkout. Ensure RPC create_session_checkout exists.';
      Alert.alert('Checkout failed', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <Stack.Screen
        options={{
          title: 'Checkout',
          headerStyle: { backgroundColor: '#0C8577' },
          headerTintColor: '#fff',
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Selected Equipment</Text>
          <Text style={styles.heroValue}>
            {selectedItems.length > 0
              ? `${selectedItems.length} item(s) selected`
              : 'Search and add category/serial'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Items</Text>
          <View style={styles.searchWrap}>
            <Search size={18} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by category, prefix, or serial number"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <View style={styles.selectedBox}>
            {selectedItems.length === 0 ? (
              <Text style={styles.selectedPlaceholder}>No items selected yet.</Text>
            ) : (
              <View style={styles.chipWrap}>
                {selectedItems.map((item) => (
                  <View key={item.itemId} style={styles.chip}>
                    <Text style={styles.chipText}>{item.categoryName} • {item.serialNumber}</Text>
                    <TouchableOpacity onPress={() => removeSelectedItem(item.itemId)}>
                      <X size={14} color="#155E75" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator style={styles.loader} color="#0C8577" />
          ) : (
            <ScrollView style={styles.resultsList} nestedScrollEnabled>
              {filteredResults.slice(0, 8).map((item) => (
                <View key={item.itemId}>
                  {(() => {
                    const isUnavailable = item.status !== 'available';
                    const statusText =
                      item.status === 'lended'
                        ? 'Already lended'
                        : `Status: ${item.status}`;
                    return (
                  <TouchableOpacity
                    style={[styles.resultCard, isUnavailable && styles.resultCardLended]}
                    onPress={() => addSelectedItem(item)}
                  >
                    <Text style={styles.resultTitle} numberOfLines={1}>{item.categoryName}</Text>
                    <Text style={styles.resultSub} numberOfLines={1}>{item.serialNumber}</Text>
                    {isUnavailable ? <Text style={styles.lendedText}>{statusText}</Text> : null}
                  </TouchableOpacity>
                    );
                  })()}
                </View>
              ))}

              {search.trim().length > 0 && filteredResults.length === 0 ? (
                <Text style={styles.emptyText}>No available item found.</Text>
              ) : null}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Details</Text>

          <Text style={styles.inputLabel}>Patient Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter patient full name"
            value={patientName}
            onChangeText={setPatientName}
          />

          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Text style={styles.inputLabel}>Address / Place</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter address or place"
            value={place}
            onChangeText={setPlace}
          />

          <TouchableOpacity style={styles.submitButton} onPress={handleConfirm} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Confirm Checkout</Text>
            )}
          </TouchableOpacity>
          {saving ? <Text style={styles.processingText}>Processing lending...</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EEF2F6',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: '#0C8577',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 18,
  },
  heroLabel: {
    color: '#D8FFF6',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  heroValue: {
    color: '#fff',
    marginTop: 8,
    fontSize: 18,
    fontWeight: '700',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 14,
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7EDF2',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D8E1EA',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: '#F7FAFD',
  },
  searchInput: {
    flex: 1,
    color: '#111827',
  },
  resultsList: {
    marginTop: 10,
    maxHeight: 260,
    gap: 8,
  },
  selectedBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#D6E0EA',
    borderRadius: 12,
    backgroundColor: '#F8FCFF',
    padding: 10,
    minHeight: 56,
    justifyContent: 'center',
  },
  selectedPlaceholder: {
    color: '#64748B',
    fontSize: 13,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFE7DF',
    backgroundColor: '#ECFDF8',
  },
  chipText: {
    flexShrink: 1,
    maxWidth: 190,
    color: '#0F766E',
    fontWeight: '600',
    fontSize: 12,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: '#E5EAF0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  resultCardLended: {
    borderColor: '#F6B5B5',
    backgroundColor: '#FFF4F4',
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  resultSub: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  lendedText: {
    marginTop: 4,
    color: '#C62828',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  loader: {
    marginTop: 12,
  },
  emptyText: {
    marginTop: 12,
    textAlign: 'center',
    color: '#64748B',
  },
  inputLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#DCE5EE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  submitButton: {
    marginTop: 18,
    backgroundColor: '#16A34A',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  processingText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#0F766E',
    fontWeight: '600',
  },
});