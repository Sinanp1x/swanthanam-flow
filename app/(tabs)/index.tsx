import React, { useEffect, useMemo, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { User, Activity, Package, History, Download, Upload } from 'lucide-react-native';
import { supabase } from '../../services/supabase';

type UserMeta = {
  full_name?: string;
  unit_name?: string;
};

type LastCheckout = {
  id: string;
  patient_name: string;
  lended_at: string;
  in_lend: number;
  status: string;
};

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<UserMeta>({});
  const [activeSessions, setActiveSessions] = useState(0);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [latestCheckouts, setLatestCheckouts] = useState<LastCheckout[]>([]);

  const loadDashboard = React.useCallback(async () => {
    setLoading(true);

    const { data } = await supabase.auth.getUser();
    const userMeta = (data.user?.user_metadata ?? {}) as UserMeta;
    setMeta(userMeta);

    const { count: active } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: completed } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed');

    const { data: lastCheckoutArray } = await supabase
      .from('sessions')
      .select('id, patient_name, lended_at, in_lend, status')
      .order('lended_at', { ascending: false })
      .limit(3);

    setActiveSessions(active ?? 0);
    setCompletedSessions(completed ?? 0);
    setLatestCheckouts((lastCheckoutArray ?? []) as LastCheckout[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useFocusEffect(
    React.useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const displayName = useMemo(() => {
    const rawName = meta.full_name?.trim();
    if (rawName) return rawName;
    return 'Volunteer';
  }, [meta.full_name]);

  const displayUnit = useMemo(() => {
    const rawUnit = meta.unit_name?.trim();
    if (rawUnit) return `${rawUnit} Unit`;
    return 'Unit Name Not Set';
  }, [meta.unit_name]);

  const formatDate = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return `Today at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
      } else if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      return 'Unknown date';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerStyle: {
            backgroundColor: '#0C8577',
          },
          headerLeft: () => (
            <View style={styles.headerLeftWrap}>
              <Image source={require('../../assets/images/logo.png')} style={styles.headerLogo} />
              <Text style={styles.brandText}>SAWNTHANAM</Text>
            </View>
          ),
        }}
      />

      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <Text style={styles.unitName}>{displayUnit}</Text>
          <TouchableOpacity onPress={() => router.push('/profile')}>
            <View style={styles.userIcon}>
              <User color="#fff" size={20} />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.welcomeText}>Welcome back,</Text>
        {loading ? (
          <ActivityIndicator color="#fff" style={styles.loader} />
        ) : (
          <Text style={styles.userName}>{displayName}</Text>
        )}

        <View style={styles.statusPill}>
          <Activity color="#32CD32" size={14} />
          <Text style={styles.statusText}>System Active</Text>
        </View>
      </View>

      {!loading && latestCheckouts.length > 0 && (
        <View style={styles.lastCheckoutCard}>
          <Text style={styles.lastCheckoutSectionTitle}>Latest Checkouts</Text>
          {latestCheckouts.map((checkout, index) => (
            <View
              key={checkout.id}
              style={[styles.lastCheckoutHeader, index > 0 ? styles.lastCheckoutRowDivider : null]}
            >
              <View style={styles.lastCheckoutIconBox}>
                <Upload color="#0C8577" size={20} />
              </View>
              <View style={styles.lastCheckoutInfo}>
                <Text style={styles.lastCheckoutPatient} numberOfLines={1}>{checkout.patient_name}</Text>
                <Text style={styles.lastCheckoutDate}>{formatDate(checkout.lended_at)}</Text>
              </View>
              <View style={[styles.lastCheckoutBadge, checkout.status === 'active' ? styles.activeBadge : styles.completedBadge]}>
                <Text style={styles.badgeText}>{checkout.in_lend}</Text>
                <Text style={styles.badgeLabel}>Items</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Quick Actions</Text>

      <View style={styles.actionsGrid}>
        <ActionCard
          title="Inventory"
          icon={<Package color="#0C8577" size={18} />}
          onPress={() => router.push('/(tabs)/inventory')}
        />
        <ActionCard
          title="Checkout"
          icon={<Upload color="#FF6B35" size={18} />}
          onPress={() => router.push('/(tabs)/checkout')}
        />
        <ActionCard
          title="Checkin"
          icon={<Download color="#2F95DC" size={18} />}
          onPress={() => router.push('/(tabs)/checkin')}
        />
        <ActionCard
          title="History"
          icon={<History color="#6366F1" size={18} />}
          onPress={() => router.push('/(tabs)/history')}
        />
      </View>

      <Text style={styles.sectionTitle}>Snapshot</Text>

      <View style={styles.snapshotRow}>
        <SnapshotCard label="Active Sessions" value={String(activeSessions)} color="#FF6B35" />
        <SnapshotCard label="Completed Sessions" value={String(completedSessions)} color="#0C8577" />
      </View>
    </ScrollView>
  );
}

type ActionCardProps = {
  title: string;
  icon: React.ReactNode;
  onPress: () => void;
};

function ActionCard({ title, icon, onPress }: ActionCardProps) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <View style={styles.actionIconWrap}>{icon}</View>
      <Text style={styles.actionTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

type SnapshotCardProps = {
  label: string;
  value: string;
  color: string;
};

function SnapshotCard({ label, value, color }: SnapshotCardProps) {
  return (
    <View style={styles.snapshotCard}>
      <Text style={styles.snapshotValue}>{value}</Text>
      <Text style={[styles.snapshotDot, { color }]}>●</Text>
      <Text style={styles.snapshotLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  headerLeftWrap: {
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerLogo: {
    width: 74,
    height: 44,
    resizeMode: 'contain',
  },
  heroCard: {
    backgroundColor: '#0C8577',
    margin: 20,
    padding: 22,
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  brandText: {
    color: '#FFFFE0',
    fontWeight: 'bold',
    fontSize: 18,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  userIcon: {
    backgroundColor: 'rgba(255,255,255,0.24)',
    padding: 10,
    borderRadius: 20,
  },
  unitName: {
    color: '#D8FFF6',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  welcomeText: {
    color: '#E0F5F2',
    fontSize: 16,
    opacity: 0.95,
  },
  loader: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  userName: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 15,
    gap: 5,
  },
  statusText: {
    color: '#0C8577',
    fontSize: 12,
    fontWeight: '600',
  },
  lastCheckoutCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8F5F2',
  },
  lastCheckoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lastCheckoutSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  lastCheckoutRowDivider: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  lastCheckoutIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E8F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastCheckoutInfo: {
    flex: 1,
  },
  lastCheckoutPatient: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  lastCheckoutDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  lastCheckoutBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  activeBadge: {
    backgroundColor: '#E0F2FE',
  },
  completedBadge: {
    backgroundColor: '#F0FDF4',
  },
  badgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  badgeLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  sectionTitle: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
    color: '#111',
    fontSize: 18,
    fontWeight: '700',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    rowGap: 10,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E9E9EE',
    alignItems: 'center',
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F5F6FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    color: '#111',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  snapshotRow: {
    marginHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  snapshotCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E9E9EE',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  snapshotValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#222',
  },
  snapshotDot: {
    fontSize: 12,
    marginTop: 2,
  },
  snapshotLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#555',
    textAlign: 'center',
    fontWeight: '600',
  },
});