import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TenantConfig {
  dealer_id: string;
  dealer_name: string;
  brand_key: string;
  brand_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string | null;
  product_noun: string;
  product_noun_plural: string;
  measurement_unit_label: string;
  tenant_config: Record<string, unknown>;
}

const DEFAULT_CONFIG: TenantConfig = {
  dealer_id: '',
  dealer_name: 'WindowFit',
  brand_key: 'windowfit',
  brand_name: 'WindowFit',
  primary_color: '#2563EB',
  secondary_color: '#1D4ED8',
  accent_color: '#BFDBFE',
  logo_url: null,
  product_noun: 'window',
  product_noun_plural: 'windows',
  measurement_unit_label: 'window opening',
  tenant_config: {},
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface TenantContextValue {
  tenantConfig: TenantConfig;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const TenantContext = createContext<TenantContextValue>({
  tenantConfig: DEFAULT_CONFIG,
  isLoading: false,
  error: null,
  refetch: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

const API_BASE = 'https://windowfit-production.up.railway.app';
const NSS_DEALER_ID = '064bead2-5fd9-4f8f-a06a-13b4e48a2f8c';

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenantConfig, setTenantConfig] = useState<TenantConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadTenantConfig() {
      setIsLoading(true);
      setError(null);

      try {
        // Pull dealerId from AsyncStorage (mirrors portal's localStorage)
        const storedDealerId = await AsyncStorage.getItem('dealer_id');
        const dealerId = storedDealerId || NSS_DEALER_ID;

        const response = await fetch(
          `${API_BASE}/api/tenant/config/${dealerId}`,
          { headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.ok) {
          throw new Error(`Tenant config fetch failed: ${response.status}`);
        }

        const data: TenantConfig = await response.json();

        if (!cancelled) {
          console.log('[TenantContext] Loaded:', data.brand_name, data.primary_color);
setTenantConfig(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          console.warn('[TenantContext] Using default config:', err);
          setError(err instanceof Error ? err.message : 'Unknown error');
          // Falls back to DEFAULT_CONFIG — app still works
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadTenantConfig();
    return () => { cancelled = true; };
  }, [fetchKey]);

  const refetch = () => setFetchKey(k => k + 1);

  return (
    <TenantContext.Provider value={{ tenantConfig, isLoading, error, refetch }}>
      {children}
    </TenantContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}