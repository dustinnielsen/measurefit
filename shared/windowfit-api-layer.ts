// ============================================================
// WindowFit Platform — Supabase API Layer
// lib/supabase.ts
// Shared by: React Native mobile app + React admin portal
// ============================================================

import { createClient } from '@supabase/supabase-js';

// ── Environment variables ────────────────────────────────────
// In React Native:  set in .env and access via process.env or react-native-config
// In React (admin): set in .env.local as VITE_SUPABASE_URL etc.
// NEVER hardcode these in committed code.

const SUPABASE_URL = process.env.SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || 'https://vqtuuncnolvkxyelapdo.supabase.co';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdHV1bmNub2x2a3h5ZWxhcGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODU0ODQsImV4cCI6MjA4ODc2MTQ4NH0.q0HuKI3QWfih2jDdsJWwLTCfRnAJpDXG2li8vqIUsOA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export type Plan = 'trial' | 'basic' | 'pro' | 'enterprise';
export type DealerStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'suspended';
export type MountType = 'inside' | 'outside';
export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'declined' | 'ordered' | 'installed';
export type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type StickerStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface Dealer {
  id: string;
  auth_user_id: string | null;
  name: string;
  owner_name: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  zip?: string;
  brand_color: string;
  logo_initials?: string;
  logo_url?: string;
  app_name?: string;
  plan: Plan;
  status: DealerStatus;
  stripe_customer_id?: string;
  stripe_sub_id?: string;
  mrr_cents: number;
  trial_ends_at?: string;
  features: Record<string, boolean>;
  default_overlap_in: number;
  joined_at: string;
  last_active_at?: string;
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  material?: string;
  description?: string;
  base_price_cents: number;
  msrp_cents?: number;
  is_motorized: boolean;
  available_colors: { name: string; hex: string }[];
  image_url?: string;
  is_active: boolean;
  sort_order: number;
}

export interface DealerProduct {
  id: string;
  dealer_id: string;
  product_id: string;
  custom_price_cents?: number;
  is_visible: boolean;
  custom_name?: string;
  custom_description?: string;
  product?: Product; // joined
}

export interface Customer {
  id: string;
  dealer_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  created_at: string;
}

export interface Room {
  id: string;
  dealer_id: string;
  customer_id?: string;
  name: string;
  icon_emoji?: string;
  floor_level?: string;
  notes?: string;
  windows?: Window[]; // joined
  created_at: string;
}

export interface Window {
  id: string;
  room_id: string;
  dealer_id: string;
  label: string;
  mount_type: MountType;
  width_in?: number;
  height_in?: number;
  area_sqft?: number;
  overlap_in?: number;
  calibration_method: 'sticker' | 'lidar' | 'manual';
  accuracy_in?: number;
  sticker_detected: boolean;
  scan_device?: string;
  scan_confidence?: number;
  photo_url?: string;
  product_id?: string;
  selected_color?: string;
  notes?: string;
  product?: Product; // joined
  created_at: string;
}

export interface Quote {
  id: string;
  dealer_id: string;
  customer_id?: string;
  quote_number: string;
  status: QuoteStatus;
  subtotal_cents: number;
  install_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  notes?: string;
  pdf_url?: string;
  sent_at?: string;
  viewed_at?: string;
  approved_at?: string;
  install_date?: string;
  expires_at?: string;
  line_items?: QuoteLineItem[]; // joined
  customer?: Customer; // joined
  created_at: string;
}

export interface QuoteLineItem {
  id: string;
  quote_id: string;
  window_id?: string;
  product_id?: string;
  product_name: string;
  window_label?: string;
  room_name?: string;
  mount_type?: string;
  width_in?: number;
  height_in?: number;
  selected_color?: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  notes?: string;
  sort_order: number;
}

export interface StickerOrder {
  id: string;
  dealer_id: string;
  order_number: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  status: StickerStatus;
  tracking_number?: string;
  carrier?: string;
  shipped_at?: string;
  delivered_at?: string;
  brand_color?: string;
  logo_initials?: string;
  created_at: string;
}

export interface ScanEvent {
  dealer_id: string;
  window_id?: string;
  device_model?: string;
  mount_type?: MountType;
  calibration_method?: string;
  sticker_detected?: boolean;
  scan_success: boolean;
  duration_ms?: number;
  confidence?: number;
  city?: string;
  state?: string;
}

export interface DealerSummary {
  id: string;
  name: string;
  owner_name: string;
  email: string;
  city?: string;
  state?: string;
  plan: Plan;
  status: DealerStatus;
  mrr_cents: number;
  brand_color: string;
  logo_initials?: string;
  joined_at: string;
  last_active_at?: string;
  customer_count: number;
  room_count: number;
  window_count: number;
  total_scans: number;
  total_quotes: number;
  total_revenue_cents: number;
}

// ============================================================
// AUTH SERVICE
// ============================================================

export const authService = {

  // Sign in (dealer or super-admin)
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Get current session
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  // Get current user
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },

  // Check if current user is super-admin
  async isSuperAdmin(): Promise<boolean> {
    const user = await authService.getUser();
    return user?.user_metadata?.role === 'super_admin';
  },

  // Get dealer record for current user
  async getCurrentDealer(): Promise<Dealer | null> {
    const user = await authService.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('dealers')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();
    if (error) return null;
    return data;
  },

  // Listen for auth state changes
  onAuthStateChange(callback: (session: any) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  },

  // Reset password
  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },
};

// ============================================================
// DEALERS SERVICE (super-admin operations)
// ============================================================

export const dealersService = {

  // Get all dealers with summary stats (super-admin only)
  async getAllDealers(): Promise<DealerSummary[]> {
    const { data, error } = await supabase
      .from('dealer_summary')
      .select('*')
      .order('joined_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Get single dealer by ID
  async getDealer(id: string): Promise<Dealer> {
    const { data, error } = await supabase
      .from('dealers')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  // Update dealer config (branding, features, etc.)
  async updateDealer(id: string, updates: Partial<Dealer>): Promise<Dealer> {
    const { data, error } = await supabase
      .from('dealers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Update dealer branding specifically
  async updateBranding(id: string, branding: {
    brand_color?: string;
    logo_initials?: string;
    logo_url?: string;
    app_name?: string;
  }): Promise<Dealer> {
    return dealersService.updateDealer(id, branding);
  },

  // Update feature flags
  async updateFeatures(id: string, features: Record<string, boolean>): Promise<Dealer> {
    return dealersService.updateDealer(id, { features });
  },

  // Update last_active_at (called on every app action)
  async pingActive(id: string): Promise<void> {
    await supabase
      .from('dealers')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', id);
  },

  // Create new dealer (super-admin onboarding)
  async createDealer(dealer: Omit<Dealer, 'id' | 'joined_at' | 'mrr_cents' | 'features'>): Promise<Dealer> {
    const { data, error } = await supabase
      .from('dealers')
      .insert({
        ...dealer,
        mrr_cents: 0,
        features: {
          ar_scanner: true,
          manual_measurement: true,
          quote_builder: true,
          install_scheduling: false,
          before_after_photos: false,
          customer_portal: false,
          analytics_dashboard: false,
        },
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Upload dealer logo to Supabase Storage
  async uploadLogo(dealerId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop();
    const path = `dealer-logos/${dealerId}/logo.${ext}`;
    const { error } = await supabase.storage
      .from('windowfit-assets')
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('windowfit-assets').getPublicUrl(path);
    return data.publicUrl;
  },
};

// ============================================================
// PRODUCTS SERVICE
// ============================================================

export const productsService = {

  // Get master catalog
  async getMasterCatalog(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return data || [];
  },

  // Get products for a specific dealer (with overrides applied)
  async getDealerCatalog(dealerId: string): Promise<(Product & { dealer_price_cents?: number; is_visible: boolean })[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        dealer_products!left (
          custom_price_cents,
          is_visible,
          custom_name,
          custom_description
        )
      `)
      .eq('is_active', true)
      .eq('dealer_products.dealer_id', dealerId)
      .order('sort_order');
    if (error) throw error;

    return (data || []).map((p: any) => {
      const override = p.dealer_products?.[0];
      return {
        ...p,
        name: override?.custom_name || p.name,
        description: override?.custom_description || p.description,
        dealer_price_cents: override?.custom_price_cents || p.base_price_cents,
        is_visible: override?.is_visible ?? true,
        dealer_products: undefined,
      };
    }).filter((p: any) => p.is_visible);
  },

  // Update dealer product override
  async upsertDealerProduct(dealerId: string, productId: string, overrides: {
    custom_price_cents?: number;
    is_visible?: boolean;
    custom_name?: string;
    custom_description?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('dealer_products')
      .upsert({ dealer_id: dealerId, product_id: productId, ...overrides });
    if (error) throw error;
  },
};

// ============================================================
// CUSTOMERS SERVICE
// ============================================================

export const customersService = {

  async getCustomers(dealerId: string): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('dealer_id', dealerId)
      .order('last_name');
    if (error) throw error;
    return data || [];
  },

  async getCustomer(id: string): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createCustomer(customer: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .insert(customer)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCustomer(id: string): Promise<void> {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
  },
};

// ============================================================
// ROOMS & WINDOWS SERVICE (mobile app core)
// ============================================================

export const roomsService = {

  // Get all rooms for a dealer, with windows nested
  async getRooms(dealerId: string): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select(`
        *,
        windows (
          *,
          product:products (id, name, category, base_price_cents)
        )
      `)
      .eq('dealer_id', dealerId)
      .order('created_at');
    if (error) throw error;
    return data || [];
  },

  // Get rooms for a specific customer
  async getRoomsForCustomer(dealerId: string, customerId: string): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, windows(*)')
      .eq('dealer_id', dealerId)
      .eq('customer_id', customerId)
      .order('created_at');
    if (error) throw error;
    return data || [];
  },

  async createRoom(room: Omit<Room, 'id' | 'created_at' | 'windows'>): Promise<Room> {
    const { data, error } = await supabase
      .from('rooms')
      .insert(room)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room> {
    const { data, error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteRoom(id: string): Promise<void> {
    const { error } = await supabase.from('rooms').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Windows ──

  async createWindow(window: Omit<Window, 'id' | 'created_at' | 'product'>): Promise<Window> {
    const { data, error } = await supabase
      .from('windows')
      .insert(window)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Save a completed scan result
  async saveScanResult(params: {
    dealerId: string;
    roomId: string;
    label: string;
    mountType: MountType;
    widthIn: number;
    heightIn: number;
    overlapIn?: number;
    accuracyIn: number;
    stickerDetected: boolean;
    scanDevice?: string;
    scanConfidence?: number;
    photoUrl?: string;
  }): Promise<Window> {
    const area = (params.widthIn * params.heightIn) / 144;
    return roomsService.createWindow({
      dealer_id: params.dealerId,
      room_id: params.roomId,
      label: params.label,
      mount_type: params.mountType,
      width_in: params.widthIn,
      height_in: params.heightIn,
      area_sqft: Math.round(area * 1000) / 1000,
      overlap_in: params.overlapIn,
      calibration_method: params.stickerDetected ? 'sticker' : 'lidar',
      accuracy_in: params.accuracyIn,
      sticker_detected: params.stickerDetected,
      scan_device: params.scanDevice,
      scan_confidence: params.scanConfidence,
      photo_url: params.photoUrl,
    });
  },

  async updateWindow(id: string, updates: Partial<Window>): Promise<Window> {
    const { data, error } = await supabase
      .from('windows')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Assign a product to a window
  async assignProduct(windowId: string, productId: string, color?: string): Promise<Window> {
    return roomsService.updateWindow(windowId, {
      product_id: productId,
      selected_color: color,
    });
  },

  // Upload window photo
  async uploadWindowPhoto(dealerId: string, windowId: string, file: File): Promise<string> {
    const path = `window-photos/${dealerId}/${windowId}.jpg`;
    const { error } = await supabase.storage
      .from('windowfit-assets')
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('windowfit-assets').getPublicUrl(path);
    return data.publicUrl;
  },

  async deleteWindow(id: string): Promise<void> {
    const { error } = await supabase.from('windows').delete().eq('id', id);
    if (error) throw error;
  },
};

// ============================================================
// QUOTES SERVICE
// ============================================================

export const quotesService = {

  async getQuotes(dealerId: string): Promise<Quote[]> {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        customer:customers (id, first_name, last_name, email),
        line_items:quote_line_items (*)
      `)
      .eq('dealer_id', dealerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getQuote(id: string): Promise<Quote> {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        customer:customers (*),
        line_items:quote_line_items (*)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  // Generate next quote number for a dealer e.g. NSS-2024-0048
  async nextQuoteNumber(dealerId: string, initials: string): Promise<string> {
    const { count } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_id', dealerId);
    const num = String((count || 0) + 1).padStart(4, '0');
    const year = new Date().getFullYear();
    return `${initials}-${year}-${num}`;
  },

  // Create a quote from a list of windows
  async createQuote(params: {
    dealerId: string;
    customerId?: string;
    quoteNumber: string;
    windows: Array<{
      window: Window;
      product: Product;
      dealerPriceCents: number;
    }>;
    installPercent?: number; // default 15
    notes?: string;
  }): Promise<Quote> {
    const installPct = params.installPercent ?? 0.15;
    const lineItems = params.windows.map((w, i) => ({
      product_id: w.product.id,
      window_id: w.window.id,
      product_name: w.product.name,
      window_label: w.window.label,
      mount_type: w.window.mount_type,
      width_in: w.window.width_in,
      height_in: w.window.height_in,
      selected_color: w.window.selected_color,
      unit_price_cents: w.dealerPriceCents,
      quantity: 1,
      line_total_cents: w.dealerPriceCents,
      sort_order: i,
    }));

    const subtotal = lineItems.reduce((s, l) => s + l.line_total_cents, 0);
    const install = Math.round(subtotal * installPct);
    const total = subtotal + install;

    const { data: quote, error: qErr } = await supabase
      .from('quotes')
      .insert({
        dealer_id: params.dealerId,
        customer_id: params.customerId,
        quote_number: params.quoteNumber,
        status: 'draft',
        subtotal_cents: subtotal,
        install_cents: install,
        discount_cents: 0,
        tax_cents: 0,
        total_cents: total,
        notes: params.notes,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();
    if (qErr) throw qErr;

    const { error: liErr } = await supabase
      .from('quote_line_items')
      .insert(lineItems.map(l => ({ ...l, quote_id: quote.id })));
    if (liErr) throw liErr;

    return quotesService.getQuote(quote.id);
  },

  // Transition quote status
  async updateStatus(id: string, status: QuoteStatus): Promise<Quote> {
    const timestamps: Partial<Quote> = { status };
    if (status === 'sent')     timestamps.sent_at = new Date().toISOString();
    if (status === 'approved') timestamps.approved_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('quotes')
      .update(timestamps)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Generate approval token for customer email link
  async createApprovalToken(quoteId: string): Promise<string> {
    const { data, error } = await supabase
      .from('quote_tokens')
      .insert({ quote_id: quoteId })
      .select('token')
      .single();
    if (error) throw error;
    return data.token;
  },

  // Customer approves via token
  async approveWithToken(token: string): Promise<void> {
    const { data, error } = await supabase
      .from('quote_tokens')
      .select('quote_id, expires_at, used_at')
      .eq('token', token)
      .single();
    if (error) throw new Error('Invalid approval link');
    if (data.used_at) throw new Error('This link has already been used');
    if (new Date(data.expires_at) < new Date()) throw new Error('This link has expired');

    await quotesService.updateStatus(data.quote_id, 'approved');
    await supabase
      .from('quote_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);
  },

  async deleteQuote(id: string): Promise<void> {
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) throw error;
  },
};

// ============================================================
// SCAN EVENTS SERVICE (usage metering + analytics)
// ============================================================

export const scanService = {

  // Log a scan attempt (fire and forget — don't await in UI)
  async logScan(event: ScanEvent): Promise<void> {
    await supabase.from('scan_events').insert(event);
  },

  // Get scan count for a dealer (for plan limit checks)
  async getScanCount(dealerId: string, since?: Date): Promise<number> {
    let query = supabase
      .from('scan_events')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_id', dealerId)
      .eq('scan_success', true);
    if (since) query = query.gte('created_at', since.toISOString());
    const { count } = await query;
    return count || 0;
  },

  // Get monthly scan stats for admin analytics
  async getMonthlyScanStats(): Promise<{ month: string; scan_count: number; active_dealers: number }[]> {
    const { data, error } = await supabase
      .from('monthly_platform_stats')
      .select('*')
      .order('month', { ascending: false })
      .limit(12);
    if (error) throw error;
    return data || [];
  },
};

// ============================================================
// STICKER ORDERS SERVICE
// ============================================================

export const stickersService = {

  async getOrders(dealerId?: string): Promise<StickerOrder[]> {
    let query = supabase
      .from('sticker_orders')
      .select('*, dealer:dealers(name, brand_color, logo_initials)')
      .order('created_at', { ascending: false });
    if (dealerId) query = query.eq('dealer_id', dealerId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async placeOrder(params: {
    dealerId: string;
    quantity: number;
    brandColor: string;
    logoInitials: string;
    shipTo: {
      name: string;
      address: string;
      city: string;
      state: string;
      zip: string;
    };
  }): Promise<StickerOrder> {
    // Pricing: 100=$12, 250=$24, 500=$40, 1000=$70
    const pricing: Record<number, number> = { 100: 1200, 250: 2400, 500: 4000, 1000: 7000 };
    const unitCents = Math.round((pricing[params.quantity] || 4000) / params.quantity);
    const totalCents = unitCents * params.quantity;

    // Generate order number
    const { count } = await supabase
      .from('sticker_orders')
      .select('*', { count: 'exact', head: true });
    const orderNumber = `SO-${1040 + (count || 0) + 1}`;

    const { data, error } = await supabase
      .from('sticker_orders')
      .insert({
        dealer_id: params.dealerId,
        order_number: orderNumber,
        quantity: params.quantity,
        unit_price_cents: unitCents,
        total_cents: totalCents,
        status: 'pending',
        brand_color: params.brandColor,
        logo_initials: params.logoInitials,
        ship_to_name: params.shipTo.name,
        ship_to_address: params.shipTo.address,
        ship_to_city: params.shipTo.city,
        ship_to_state: params.shipTo.state,
        ship_to_zip: params.shipTo.zip,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateOrderStatus(id: string, status: StickerStatus, trackingNumber?: string): Promise<void> {
    const updates: Partial<StickerOrder> = { status };
    if (trackingNumber) updates.tracking_number = trackingNumber;
    if (status === 'shipped') updates.shipped_at = new Date().toISOString();
    if (status === 'delivered') updates.delivered_at = new Date().toISOString();
    const { error } = await supabase.from('sticker_orders').update(updates).eq('id', id);
    if (error) throw error;
  },
};

// ============================================================
// REALTIME SUBSCRIPTIONS
// ============================================================

export const realtimeService = {

  // Subscribe to new quotes for a dealer (admin portal live feed)
  subscribeToQuotes(dealerId: string, callback: (quote: Quote) => void) {
    return supabase
      .channel(`quotes:${dealerId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'quotes',
        filter: `dealer_id=eq.${dealerId}`,
      }, payload => callback(payload.new as Quote))
      .subscribe();
  },

  // Subscribe to all new quotes (super-admin dashboard live feed)
  subscribeToAllQuotes(callback: (quote: Quote) => void) {
    return supabase
      .channel('quotes:all')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'quotes',
      }, payload => callback(payload.new as Quote))
      .subscribe();
  },

  // Unsubscribe
  unsubscribe(channel: any) {
    supabase.removeChannel(channel);
  },
};

// ============================================================
// STORAGE HELPERS
// ============================================================

export const storageService = {

  getPublicUrl(bucket: string, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  async uploadFile(bucket: string, path: string, file: File): Promise<string> {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    return storageService.getPublicUrl(bucket, path);
  },

  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
  },
};
