import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface TenantConfig {
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

const defaultConfig: TenantConfig = {
  dealer_id: '',
  dealer_name: '',
  brand_key: 'windowfit',
  brand_name: 'WindowFit',
  primary_color: '#2563EB',
  secondary_color: '#1D4ED8',
  accent_color: '#BFDBFE',
  logo_url: null,
  product_noun: 'window',
  product_noun_plural: 'windows',
  measurement_unit_label: 'window opening',
  tenant_config: {}
};

const TenantContext = createContext<TenantConfig>(defaultConfig);

export const useTenant = () => useContext(TenantContext);

interface TenantProviderProps {
  children: ReactNode;
  dealerId: string | null;
}

export const TenantProvider = ({ children, dealerId }: TenantProviderProps) => {
  const [config, setConfig] = useState<TenantConfig>(defaultConfig);

  useEffect(() => {
    if (!dealerId) return;

    const fetchConfig = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/tenant/config/${dealerId}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setConfig(data);

        // Apply brand colors as CSS variables
        document.documentElement.style.setProperty('--brand-primary', data.primary_color);
        document.documentElement.style.setProperty('--brand-secondary', data.secondary_color);
        document.documentElement.style.setProperty('--brand-accent', data.accent_color);
      } catch (err) {
        console.error('Failed to fetch tenant config:', err);
      }
    };

    fetchConfig();
  }, [dealerId]);

  return (
    <TenantContext.Provider value={config}>
      {children}
    </TenantContext.Provider>
  );
};