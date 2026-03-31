import React, { useCallback, useMemo, useState } from 'react';
import { Stack, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Search, X, Check } from 'lucide-react-native';
import { supabase } from '../../services/supabase';

type LendRecord = {
  id: number;
  patient_name: string;
  phone: string;
  place: string;
  in_lend: number;
  lended_at: string;
  closed_at: string | null;
  status: string;
};

type LendItem = {
  id: number;
  session_id: number;
  l_item: string;
  returned_at: string | null;
};

type ItemDetail = {
  id: string;
  serial_number: string;
  category_id: string;
  categoryName: string;
};

type PatientLend = {
  lend: LendRecord;
  items: (ItemDetail & { lendItemId: number; returnedAt: string | null })[];
};

export default function CheckinScreen() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [patientLends, setPatientLends] = useState<PatientLend[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientLend | null>(null);
  const [returningItems, setReturningItems] = useState<Set<string>>(new Set());

  const loadActiveLends = useCallback(async () => {
    setLoading(true);

    try {
      // Get all session_items where items haven't been returned yet
      const { data: unreturnedItems, error: unreturnedError } = await supabase
        .from('session_items')
        .select('session_id')
        .is('returned_at', null);

      if (unreturnedError) {
        Alert.alert('Load failed', unreturnedError.message);
        setLoading(false);
        return;
      }

      const unreturnedData = (unreturnedItems ?? []) as { session_id: number }[];
      const uniqueSessionIds = [...new Set(unreturnedData.map((item) => item.session_id))];

      if (uniqueSessionIds.length === 0) {
        setPatientLends([]);
        setLoading(false);
        return;
      }

      // Get all active sessions that still have unreturned items
      const { data: lendRows, error: lendError } = await supabase
        .from('sessions')
        .select('id, patient_name, phone, place, in_lend, lended_at, closed_at, status')
        .in('id', uniqueSessionIds)
        .order('lended_at', { ascending: false });

      if (lendError) {
        Alert.alert('Load failed', lendError.message);
        setLoading(false);
        return;
      }

      const lends = (lendRows ?? []) as LendRecord[];

      // Get all unreturned session_items for active sessions
      const sessionIds = uniqueSessionIds;
      const { data: lendItemRows, error: lendItemError } = await supabase
        .from('session_items')
        .select('id, session_id, l_item, returned_at')
        .in('session_id', sessionIds)
        .is('returned_at', null);

      if (lendItemError) {
        Alert.alert('Load failed', lendItemError.message);
        setLoading(false);
        return;
      }

      const lendItems = (lendItemRows ?? []) as LendItem[];

      // Get all items with categories
      const itemIds = lendItems.map((li) => li.l_item);
      if (itemIds.length === 0) {
        setPatientLends([]);
        setLoading(false);
        return;
      }

      const { data: itemRows, error: itemError } = await supabase
        .from('items')
        .select('id, serial_number, category_id')
        .in('id', itemIds);

      if (itemError) {
        Alert.alert('Load failed', itemError.message);
        setLoading(false);
        return;
      }

      const items = (itemRows ?? []) as { id: string; serial_number: string; category_id: string }[];

      // Get categories
      const categoryIds = [...new Set(items.map((i) => i.category_id))];
      if (categoryIds.length === 0) {
        setPatientLends([]);
        setLoading(false);
        return;
      }

      const { data: categoryRows, error: categoryError } = await supabase
        .from('categories')
        .select('id, name')
        .in('id', categoryIds);

      if (categoryError) {
        Alert.alert('Load failed', categoryError.message);
        setLoading(false);
        return;
      }

      const categories = new Map(
        ((categoryRows ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
      );
      const itemMap = new Map(items.map((item) => [item.id, item]));

      // Build session item details
      const lendItemMap = new Map<string, any[]>();
      lendItems.forEach((li) => {
        const item = itemMap.get(li.l_item);
        if (item) {
          const categoryName = categories.get(item.category_id) || 'Unknown';
          const itemDetail = {
            id: item.id,
            serial_number: item.serial_number,
            category_id: item.category_id,
            categoryName,
            lendItemId: li.id,
            returnedAt: li.returned_at,
          };
          const key = String(li.session_id);
          if (!lendItemMap.has(key)) {
            lendItemMap.set(key, []);
          }
          lendItemMap.get(key)!.push(itemDetail);
        }
      });

      // Build active session
      const patientMap = new Map<string, PatientLend>();
      lends.forEach((lend) => {
        const key = String(lend.id);
        const items = lendItemMap.get(key) || [];
        patientMap.set(key, {
          lend,
          items,
        });
      });

      setPatientLends(Array.from(patientMap.values()));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load active lends.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActiveLends();
    }, [loadActiveLends])
  );

  const filteredPatients = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return patientLends;

    return patientLends.filter(
      (p) =>
        p.lend.patient_name.toLowerCase().includes(needle) ||
        p.lend.phone.toLowerCase().includes(needle)
    );
  }, [search, patientLends]);

  const handleReturnItem = async (lendItemId: number, itemId: string, sessionId: number) => {
    setReturningItems((prev) => new Set(prev).add(String(lendItemId)));

    try {
      const nowIso = new Date().toISOString();

      // Update session_items to mark as returned
      const { error: updateLendItemError } = await supabase
        .from('session_items')
        .update({ returned_at: nowIso })
        .eq('id', lendItemId);

      if (updateLendItemError) throw updateLendItemError;

      // Update item status back to available
      const { error: updateItemError } = await supabase
        .from('items')
        .update({ status: 'available' })
        .eq('id', itemId);

      if (updateItemError) throw updateItemError;

      // Reduce in_lend and close session when it reaches zero
      const { data: sessionRow, error: sessionReadError } = await supabase
        .from('sessions')
        .select('id, in_lend')
        .eq('id', sessionId)
        .single();

      if (sessionReadError) throw sessionReadError;

      const currentInLend = Number((sessionRow as { in_lend: number }).in_lend ?? 0);
      const nextInLend = Math.max(currentInLend - 1, 0);
      const sessionPatch: {
        in_lend: number;
        status?: string;
        closed_at?: string | null;
      } = {
        in_lend: nextInLend,
      };

      if (nextInLend === 0) {
        sessionPatch.status = 'completed';
        sessionPatch.closed_at = nowIso;
      }

      const { error: sessionUpdateError } = await supabase
        .from('sessions')
        .update(sessionPatch)
        .eq('id', sessionId);

      if (sessionUpdateError) throw sessionUpdateError;

      // Refresh the UI
      setSelectedPatient(null);
      await loadActiveLends();

      Alert.alert('Success', 'Item returned successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to return item.';
      Alert.alert('Error', message);
    } finally {
      setReturningItems((prev) => {
        const next = new Set(prev);
        next.delete(String(lendItemId));
        return next;
      });
    }
  };

  const PatientCard = ({ patientLend }: { patientLend: PatientLend }) => {
    const itemCount = patientLend.items.length;
    return (
      <View style={styles.patientCard}>
        <View style={styles.patientHeader}>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{patientLend.lend.patient_name}</Text>
            <Text style={styles.patientPhone}>{patientLend.lend.phone}</Text>
            <Text style={styles.patientPhone}>{patientLend.lend.place}</Text>
          </View>
          <View style={styles.itemCountBadge}>
            <Text style={styles.itemCountText}>{itemCount}</Text>
          </View>
        </View>

        <ScrollView style={styles.itemsList} nestedScrollEnabled>
          {patientLend.items.map((item) => (
            <View key={item.lendItemId} style={styles.itemRow}>
              <View style={styles.itemDetails}>
                <Text style={styles.itemCategory}>{item.categoryName}</Text>
                <Text style={styles.itemSerial}>{item.serial_number}</Text>
              </View>
              <Text style={styles.lendDateSmall}>
                {new Date(patientLend.lend.lended_at).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={styles.returnButton}
          onPress={() => setSelectedPatient(patientLend)}
        >
          <Text style={styles.returnButtonText}>Return Items</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Check-In',
          headerStyle: { backgroundColor: '#0C8577' },
          headerTintColor: '#fff',
        }}
      />

      <View style={styles.container}>
        <View style={styles.searchWrap}>
          <Search size={18} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by patient name or phone"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color="#0C8577" />
        ) : filteredPatients.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {search.trim().length > 0 ? 'No patient found.' : 'No active loans.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredPatients}
            keyExtractor={(item) => String(item.lend.id)}
            renderItem={({ item }) => <PatientCard patientLend={item} />}
            contentContainerStyle={styles.listContent}
            scrollEnabled={true}
          />
        )}
      </View>

      <Modal visible={selectedPatient !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Return Items - {selectedPatient?.lend.patient_name}
              </Text>
              <TouchableOpacity onPress={() => setSelectedPatient(null)}>
                <X size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList}>
              {selectedPatient?.items.map((item) => (
                <View key={item.lendItemId} style={styles.returnItemRow}>
                  <View style={styles.returnItemInfo}>
                    <Text style={styles.returnItemCategory}>{item.categoryName}</Text>
                    <Text style={styles.returnItemSerial}>{item.serial_number}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.individualReturnButton}
                    onPress={() => handleReturnItem(item.lendItemId, item.id, selectedPatient.lend.id)}
                    disabled={returningItems.has(String(item.lendItemId))}
                  >
                    {returningItems.has(String(item.lendItemId)) ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Check size={16} color="#fff" />
                        <Text style={styles.individualReturnText}>Return</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setSelectedPatient(null)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF2F6',
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
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: '#111827',
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  patientCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5EAF0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  patientPhone: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  itemCountBadge: {
    backgroundColor: '#0C8577',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 12,
  },
  itemCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  itemsList: {
    marginTop: 12,
    maxHeight: 110,
    borderTopWidth: 1,
    borderTopColor: '#E5EAF0',
    paddingTop: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F3',
  },
  itemDetails: {
    flex: 1,
  },
  itemCategory: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemSerial: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  lendDateSmall: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  returnButton: {
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  returnButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 18,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  modalList: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  returnItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F3',
  },
  returnItemInfo: {
    flex: 1,
  },
  returnItemCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  returnItemSerial: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  individualReturnButton: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 12,
  },
  individualReturnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  modalCloseButton: {
    backgroundColor: '#E5EAF0',
    borderTopWidth: 1,
    borderTopColor: '#E5EAF0',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  modalCloseText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
  },
});
