import React, { useCallback, useMemo, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Plus, Search } from 'lucide-react-native';
import { supabase } from '../../services/supabase';

type ItemRow = {
  id: string;
  category_id: string;
  serial_number: string | null;
  status: string | null;
  description: string | null;
};

const STATUS_OPTIONS = ['available', 'lended', 'broken'] as const;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
};

const showErrorAlert = (title: string, message: string) => {
  // On some devices, alert calls made inside another alert callback can be dropped.
  setTimeout(() => Alert.alert(title, message), 80);
};

export default function CategoryItemsScreen() {
  const params = useLocalSearchParams();
  const categoryId = typeof params.categoryId === 'string' ? params.categoryId : '';
  const categoryName = typeof params.categoryName === 'string' ? params.categoryName : 'Category';
  const prefix = typeof params.prefix === 'string' ? params.prefix.toUpperCase() : '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ItemRow[]>([]);

  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemRow | null>(null);
  const [statusInput, setStatusInput] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ItemRow | null>(null);
  const [descriptionModalVisible, setDescriptionModalVisible] = useState(false);
  const [selectedItemForDesc, setSelectedItemForDesc] = useState<ItemRow | null>(null);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const loadItems = useCallback(async () => {
    if (!categoryId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('items')
      .select('id, category_id, serial_number, status, description')
      .eq('category_id', categoryId)
      .order('id', { ascending: true });

    if (error) {
      showErrorAlert('Load failed', error.message);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as ItemRow[]);
    setLoading(false);
  }, [categoryId]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;

    return items.filter((row) => {
      const serial = (row.serial_number ?? '').toLowerCase();
      const status = (row.status ?? '').toLowerCase();
      return serial.includes(needle) || status.includes(needle);
    });
  }, [items, search]);

  const getNextSerial = () => {
    let maxSerial = 0;
    for (const row of items) {
      const serial = row.serial_number ?? '';
      const match = serial.match(/-(\d+)$/);
      if (!match) continue;
      const parsed = Number(match[1]);
      if (Number.isInteger(parsed) && parsed > maxSerial) {
        maxSerial = parsed;
      }
    }
    return `${prefix}-${maxSerial + 1}`;
  };

  const openDescriptionModal = (item: ItemRow) => {
    setSelectedItemForDesc(item);
    setDescriptionInput(item.description ?? '');
    setDescriptionModalVisible(true);
  };

  const handleSaveDescription = async () => {
    if (!selectedItemForDesc) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('items')
        .update({ description: descriptionInput.trim() || null })
        .eq('id', selectedItemForDesc.id);

      if (error) throw error;

      setDescriptionModalVisible(false);
      setSelectedItemForDesc(null);
      setDescriptionInput('');
      await loadItems();
      setActionMessage('Description updated');
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to update description');
      setActionMessage(`Description update failed: ${message}`);
      showErrorAlert('Update failed', message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddChild = async () => {
    if (!categoryId || !prefix) {
      Alert.alert('Missing data', 'Category id or prefix is missing.');
      return;
    }

    setSaving(true);
    try {
      const serial = getNextSerial();
      const { error } = await supabase.from('items').insert({
        category_id: categoryId,
        serial_number: serial,
        status: 'available',
      });

      if (error) throw error;

      await loadItems();
      setActionMessage(`Created ${serial}`);
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to create item');
      setActionMessage(`Create failed: ${message}`);
      showErrorAlert('Create failed', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = (item: ItemRow) => {
    setDeleteTarget(item);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    try {
      const { error, count } = await supabase
        .from('items')
        .delete({ count: 'exact' })
        .eq('id', deleteTarget.id);

      if (error) throw error;

      if (!count) {
        throw new Error('Delete was blocked. Check RLS delete policy for items table.');
      }

      setActionMessage('');
      setDeleteModalVisible(false);
      setDeleteTarget(null);
      await loadItems();
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to delete item');
      setActionMessage(`Delete failed: ${message}`);
      showErrorAlert('Delete failed', message);
    } finally {
      setSaving(false);
    }
  };

  const openStatusModal = (item: ItemRow) => {
    const normalized = (item.status ?? 'available').toLowerCase();
    const nextStatus = STATUS_OPTIONS.includes(normalized as (typeof STATUS_OPTIONS)[number])
      ? normalized
      : 'available';

    setSelectedItem(item);
    setStatusInput(nextStatus);
    setStatusModalVisible(true);
  };

  const handleSaveStatus = async () => {
    if (!selectedItem) return;

    const normalized = statusInput.trim().toLowerCase();
    if (!STATUS_OPTIONS.includes(normalized as (typeof STATUS_OPTIONS)[number])) {
      showErrorAlert('Invalid status', 'Please select available, lended, or broken.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('items')
        .update({ status: normalized })
        .eq('id', selectedItem.id);

      if (error) throw error;

      setStatusModalVisible(false);
      setSelectedItem(null);
      setStatusInput('');
      await loadItems();
      setActionMessage(`Status updated to ${normalized}`);
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to update status');
      setActionMessage(`Status update failed: ${message}`);
      showErrorAlert('Update failed', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: categoryName,
          headerStyle: { backgroundColor: '#008060' },
          headerTintColor: '#fff',
        }}
      />

      <View style={styles.toolbar}>
        <View style={styles.searchBar}>
          <Search size={18} color="#6A6A6A" />
          <TextInput
            placeholder="Search serial or status"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddChild} disabled={saving}>
          <Plus size={16} color="#fff" />
          <Text style={styles.addButtonText}>New Child</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>Prefix: {prefix}</Text>
        <Text style={styles.summaryText}>Total: {items.length}</Text>
      </View>

      {actionMessage ? <Text style={styles.actionMessage}>{actionMessage}</Text> : null}

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#008060" />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.rowCard}>
              <View style={styles.rowMain}>
                <Text style={styles.serialText}>{item.serial_number ?? 'N/A'}</Text>
                <Text style={styles.statusText}>Status: {(item.status ?? 'unknown').toLowerCase()}</Text>
              </View>

              {item.description && (
                <Text style={styles.descriptionText} numberOfLines={2}>{item.description}</Text>
              )}

              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.statusButton]}
                  onPress={() => openStatusModal(item)}
                  disabled={saving}
                >
                  <Text style={styles.actionText}>Edit Status</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.descButton]}
                  onPress={() => openDescriptionModal(item)}
                  disabled={saving}
                >
                  <Text style={styles.actionText}>{item.description ? 'Edit Desc' : 'Add Desc'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDeleteItem(item)}
                  disabled={saving}
                >
                  <Text style={styles.actionText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No child items found.</Text>}
        />
      )}

      <Modal visible={statusModalVisible} transparent animationType="fade" onRequestClose={() => setStatusModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update Item Status</Text>
            <Text style={styles.modalSub}>{selectedItem?.serial_number ?? ''}</Text>
            <View style={styles.statusSelectorRow}>
              {STATUS_OPTIONS.map((option) => {
                const active = statusInput === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.statusOption, active ? styles.statusOptionActive : null]}
                    onPress={() => setStatusInput(option)}
                  >
                    <Text style={[styles.statusOptionText, active ? styles.statusOptionTextActive : null]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setStatusModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveStatus}
                disabled={saving}
              >
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Item</Text>
            <Text style={styles.modalSub}>Are you sure you want to delete {deleteTarget?.serial_number ?? 'this item'}?</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setDeleteTarget(null);
                }}
                disabled={saving}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.dangerButton]}
                onPress={handleConfirmDelete}
                disabled={saving}
              >
                <Text style={styles.saveText}>{saving ? 'Deleting...' : 'Delete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={descriptionModalVisible} transparent animationType="fade" onRequestClose={() => setDescriptionModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Item Description</Text>
            <Text style={styles.modalSub}>{selectedItemForDesc?.serial_number ?? ''}</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Enter item description"
              value={descriptionInput}
              onChangeText={setDescriptionInput}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setDescriptionModalVisible(false);
                  setSelectedItemForDesc(null);
                  setDescriptionInput('');
                }}
                disabled={saving}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveDescription}
                disabled={saving}
              >
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECF1F4',
  },
  toolbar: {
    padding: 12,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E7EAEE',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: '#E4E9EF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: '#111827',
  },
  addButton: {
    height: 44,
    backgroundColor: '#008060',
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  summaryRow: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
  actionMessage: {
    marginHorizontal: 14,
    marginBottom: 8,
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '600',
  },
  loader: {
    marginTop: 30,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 20,
    gap: 10,
  },
  rowCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    padding: 12,
    gap: 10,
  },
  rowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serialText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  statusButton: {
    backgroundColor: '#E8F5F2',
  },
  descButton: {
    backgroundColor: '#FFF3E0',
  },
  deleteButton: {
    backgroundColor: '#FDECEC',
  },
  descriptionText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 4,
  },
  descriptionInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#DCE5EE',
    borderRadius: 10,
    padding: 10,
    color: '#111827',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  actionText: {
    fontWeight: '700',
    color: '#1F2937',
    fontSize: 12,
  },
  emptyText: {
    marginTop: 24,
    textAlign: 'center',
    color: '#64748B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  modalSub: {
    color: '#64748B',
    fontWeight: '600',
  },
  statusSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DCE5EE',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  statusOptionActive: {
    borderColor: '#008060',
    backgroundColor: '#E8F5F2',
  },
  statusOptionText: {
    color: '#334155',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  statusOptionTextActive: {
    color: '#075E54',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  cancelButton: {
    backgroundColor: '#EEF2F6',
  },
  saveButton: {
    backgroundColor: '#008060',
  },
  dangerButton: {
    backgroundColor: '#B42318',
  },
  cancelText: {
    color: '#334155',
    fontWeight: '700',
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
  },
});
