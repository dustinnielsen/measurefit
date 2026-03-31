import { useTenant } from '../context/TenantContext';

const PLAN_LIMITS = {
  basic: {
    maxScansPerMonth: 10,
    canAccessCatalog: true,
    canGenerateQuotes: true,
    canProcessPayments: false,
    canExportPDF: false,
  },
  pro: {
    maxScansPerMonth: Infinity,
    canAccessCatalog: true,
    canGenerateQuotes: true,
    canProcessPayments: true,
    canExportPDF: true,
  },
  enterprise: {
    maxScansPerMonth: Infinity,
    canAccessCatalog: true,
    canGenerateQuotes: true,
    canProcessPayments: true,
    canExportPDF: true,
  },
};

export function usePlanGating() {
  const { tenantConfig } = useTenant();
  const tier = (tenantConfig?.subscription_tier || 'basic') as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[tier] ?? PLAN_LIMITS.basic;

  return {
    tier,
    limits,
    isBasic: tier === 'basic',
    isPro: tier === 'pro',
    isEnterprise: tier === 'enterprise',
    canScan: limits.maxScansPerMonth === Infinity,
    canAccessCatalog: limits.canAccessCatalog,
    canGenerateQuotes: limits.canGenerateQuotes,
    canProcessPayments: limits.canProcessPayments,
    canExportPDF: limits.canExportPDF,
  };
}