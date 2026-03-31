import React, { useCallback, useMemo, useState } from 'react';
import { Stack, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Search } from 'lucide-react-native';
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
  categoryName: string;
};

type HistoryEntry = {
  lend: LendRecord;
  items: (ItemDetail & { lendItemId: number; returnedAt: string | null })[];
};

export default function History() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const loadHistory = useCallback(async () => {
    setLoading(true);

    try {
      // Get ALL sessions (both active and completed)
      const { data: lendRows, error: lendError } = await supabase
        .from('sessions')
        .select('id, patient_name, phone, place, in_lend, lended_at, closed_at, status')
        .order('lended_at', { ascending: false });

      if (lendError) {
        Alert.alert('Load failed', lendError.message);
        setLoading(false);
        return;
      }

      const lends = (lendRows ?? []) as LendRecord[];

      // Get all session_items for all sessions
      const lendIds = lends.map((l) => l.id);
      if (lendIds.length === 0) {
        setHistory([]);
        setLoading(false);
        return;
      }

      const { data: lendItemRows, error: lendItemError } = await supabase
        .from('session_items')
        .select('id, session_id, l_item, returned_at')
        .in('session_id', lendIds);

      if (lendItemError) {
        Alert.alert('Load failed', lendItemError.message);
        setLoading(false);
        return;
      }

      const lendItems = (lendItemRows ?? []) as LendItem[];

      // Get all items with categories
      const itemIds = lendItems.map((li) => li.l_item);
      if (itemIds.length === 0) {
        const entries = lends.map((lend) => ({ lend, items: [] }));
        setHistory(entries);
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

      // Build history entries
      const entries = lends.map((lend) => ({
        lend,
        items: lendItemMap.get(String(lend.id)) || [],
      }));

      setHistory(entries);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load history.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const filteredHistory = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return history;

    return history.filter(
      (entry) =>
        entry.lend.patient_name.toLowerCase().includes(needle) ||
        entry.lend.phone.toLowerCase().includes(needle) ||
        entry.lend.place.toLowerCase().includes(needle) ||
        entry.items.some(
          (item) =>
            item.serial_number.toLowerCase().includes(needle) ||
            item.categoryName.toLowerCase().includes(needle)
        )
    );
  }, [search, history]);

  const getStatusInfo = (entry: HistoryEntry) => {
    const normalizedStatus = (entry.lend.status ?? '').toLowerCase();
    const allReturned = entry.items.length > 0 && entry.items.every((item) => item.returnedAt !== null);
    const completed = normalizedStatus === 'completed' || entry.lend.in_lend === 0 || allReturned;

    return {
      status: completed ? 'Completed' : 'Active',
      color: completed ? '#059669' : '#DC2626',
    };
  };

  const HistoryCard = ({ entry }: { entry: HistoryEntry }) => {
    const statusInfo = getStatusInfo(entry);
    const returnedDate =
      entry.lend.closed_at ||
      entry.items
        .map((item) => item.returnedAt)
        .filter((v): v is string => Boolean(v))
        .sort()
        .at(-1) ||
      null;

    const showInLend = !(entry.lend.in_lend === 0 && statusInfo.status === 'Completed');

    return (
      <View style={styles.historyCard}>
        <View style={styles.cardHeader}>
          <View style={styles.patientSection}>
            <Text style={styles.patientName}>{entry.lend.patient_name}</Text>
            <Text style={styles.patientPhone}>{entry.lend.phone}</Text>
            <Text style={styles.patientPhone}>{entry.lend.place}</Text>
          </View>

          <View style={styles.headerRight}>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: statusInfo.color,
                  },
                ]}
              />
              <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.status}</Text>
            </View>

            <Text style={styles.metaText}>Lended: {new Date(entry.lend.lended_at).toLocaleDateString()}</Text>
            {returnedDate ? (
              <Text style={styles.metaText}>Returned: {new Date(returnedDate).toLocaleDateString()}</Text>
            ) : null}

            {showInLend ? (
              <View style={styles.inLendBadge}>
                <Text style={styles.inLendText}>In Lend: {entry.lend.in_lend}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.itemsSection}>
          <Text style={styles.itemsTitle}>Items ({entry.items.length})</Text>
          {entry.items.map((item) => (
            <View key={item.lendItemId} style={styles.itemDetail}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemCategory}>{item.categoryName}</Text>
                <Text style={styles.itemSerial}>{item.serial_number}</Text>
              </View>
              {item.returnedAt && (
                <View style={styles.returnedBadge}>
                  <Text style={styles.returnedText}>Returned</Text>
                  <Text style={styles.metaText}>{new Date(item.returnedAt).toLocaleDateString()}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'History',
          headerStyle: { backgroundColor: '#0C8577' },
          headerTintColor: '#fff',
        }}
      />

      <View style={styles.container}>
        <View style={styles.searchWrap}>
          <Search size={18} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by patient, phone, place, item, or serial"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color="#0C8577" />
        ) : filteredHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {search.trim().length > 0 ? 'No records found.' : 'No lending history.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredHistory}
            keyExtractor={(item) => String(item.lend.id)}
            renderItem={({ item }) => <HistoryCard entry={item} />}
            contentContainerStyle={styles.listContent}
            scrollEnabled={true}
          />
        )}
      </View>
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
  historyCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5EAF0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  patientSection: {
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  headerRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  inLendBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inLendText: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  itemsSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5EAF0',
    paddingTop: 12,
    paddingBottom: 1,
    marginBottom: 1,
  },
  itemsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  itemDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  itemInfo: {
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
  returnedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  returnedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
});
