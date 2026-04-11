import { useEffect, useState } from 'react';
import { supabase } from './supabase';

interface QuoteData {
  id: string;
  quote_number: string;
  status: string;
  subtotal_cents: number;
  install_cents: number;
  total_cents: number;
  notes: string | null;
  created_at: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string | null;
    address_line1: string | null;
    city: string | null;
    state: string | null;
  };
  dealer: {
    name: string;
    brand_color: string | null;
    logo_initials: string | null;
    app_name: string | null;
    phone: string | null;
    email: string | null;
  };
  line_items: {
    id: string;
    product_name: string;
    window_label: string | null;
    room_name: string | null;
    width_in: number | null;
    height_in: number | null;
    mount_type: string | null;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
  }[];
}

type PageState = 'loading' | 'error' | 'expired' | 'already_actioned' | 'ready' | 'approved' | 'declined' | 'changes_requested';

export default function QuotePage({ token }: { token: string }) {
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [changeMessage, setChangeMessage] = useState('');
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadQuote();
  }, [token]);

const loadQuote = async () => {
    try {
      // Step 1 — just look up the token
      const { data: tokenData, error: tokenError } = await supabase
        .from('quote_tokens')
        .select('*')
        .eq('token', token)
        .single();

      console.log('Token lookup:', tokenData, tokenError);

      if (tokenError || !tokenData) {
        setPageState('error');
        setErrorMsg('This quote link is invalid.');
        return;
      }

      // Step 2 — load the quote separately
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*, customer:customers(*), dealer:dealers(*), line_items:quote_line_items(*)')
        .eq('id', tokenData.quote_id)
        .single();

      console.log('Quote lookup:', quoteData, quoteError);

      if (quoteError || !quoteData) {
        setPageState('error');
        setErrorMsg('Quote not found.');
        return;
      }

      const q = quoteData as QuoteData;

      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        setPageState('expired');
        return;
      }

      if (['approved', 'declined', 'ordered', 'installed'].includes(q.status)) {
  setQuote(q);
  setPageState('already_actioned');
  return;
}

setQuote(q);
setPageState('ready');

if (q.status === 'sent' || q.status === 'viewed') {
  await supabase
    .from('quotes')
    .update({ status: 'viewed' })
    .eq('id', q.id);
}

    } catch (e: any) {
      setPageState('error');
      setErrorMsg(e.message ?? 'Something went wrong.');
    }
  };

  const handleApprove = async () => {
    if (!quote) return;
    setSubmitting(true);
    try {
      await supabase
        .from('quotes')
        .update({ status: 'approved' })
        .eq('id', quote.id);
      setPageState('approved');
    } catch (e: any) {
      alert('Failed to approve. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!quote) return;
    setSubmitting(true);
    try {
      await supabase
        .from('quotes')
        .update({ status: 'declined' })
        .eq('id', quote.id);
      setPageState('declined');
    } catch (e: any) {
      alert('Failed to decline. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!quote || !changeMessage.trim()) return;
    setSubmitting(true);
    try {
      // Save message to quote_messages table
      await supabase
        .from('quote_messages')
        .insert({
          quote_id: quote.id,
          sender: 'customer',
          message: changeMessage.trim(),
        });

      // Update quote status
      await supabase
        .from('quotes')
        .update({ status: 'viewed' })
        .eq('id', quote.id);

      setPageState('changes_requested');
    } catch (e: any) {
      alert('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const brandColor = quote?.dealer?.brand_color ?? '#0A84FF';
  const dealerName = quote?.dealer?.app_name ?? quote?.dealer?.name ?? 'Your Dealer';
  const initials = quote?.dealer?.logo_initials ?? dealerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const customerName = quote ? `${quote.customer.first_name} ${quote.customer.last_name}` : '';

  // ── Loading ──
  if (pageState === 'loading') {
    return (
      <div style={styles.centered}>
        <div style={{ ...styles.spinner, borderTopColor: brandColor }} />
      </div>
    );
  }

  // ── Error ──
  if (pageState === 'error' || pageState === 'expired') {
    return (
      <div style={styles.centered}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          {pageState === 'expired' ? 'Quote Link Expired' : 'Invalid Link'}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', maxWidth: 300 }}>
          {pageState === 'expired'
            ? 'This quote link has expired. Please contact your dealer for a new one.'
            : errorMsg}
        </p>
      </div>
    );
  }

  // ── Approved confirmation ──
  if (pageState === 'approved') {
    return (
      <div style={styles.centered}>
        <div style={{ ...styles.successCircle, borderColor: '#30D158' }}>
          <span style={{ fontSize: 36, color: '#30D158' }}>✓</span>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Quote Approved!</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', maxWidth: 300 }}>
          {dealerName} has been notified and will be in touch to schedule your installation.
        </p>
      </div>
    );
  }

  // ── Declined confirmation ──
  if (pageState === 'declined') {
    return (
      <div style={styles.centered}>
        <div style={{ ...styles.successCircle, borderColor: 'rgba(255,255,255,0.2)' }}>
          <span style={{ fontSize: 36 }}>✕</span>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Quote Declined</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', maxWidth: 300 }}>
          Your response has been sent to {dealerName}.
        </p>
      </div>
    );
  }

  // ── Changes requested confirmation ──
  if (pageState === 'changes_requested') {
    return (
      <div style={styles.centered}>
        <div style={{ ...styles.successCircle, borderColor: brandColor }}>
          <span style={{ fontSize: 36 }}>💬</span>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Message Sent!</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', maxWidth: 300 }}>
          {dealerName} will review your requested changes and send you an updated quote.
        </p>
      </div>
    );
  }

  // ── Already actioned ──
  if (pageState === 'already_actioned' && quote) {
    const statusLabel: Record<string, string> = {
      approved: '✅ You approved this quote',
      declined: 'You declined this quote',
      ordered: '✅ This order is in progress',
      installed: '✅ Installation complete',
    };
    return (
      <div style={styles.centered}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          {statusLabel[quote.status] ?? `Quote is ${quote.status}`}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center' }}>
          Contact {dealerName} if you have any questions.
        </p>
        {quote.dealer.phone && (
          <a href={`tel:${quote.dealer.phone}`} style={{ ...styles.callBtn, backgroundColor: brandColor }}>
            Call {dealerName}
          </a>
        )}
      </div>
    );
  }

  // ── Main quote view ──
  if (!quote) return null;

  return (
    <div style={styles.page}>

      {/* Header */}
      <div style={{ ...styles.header, backgroundColor: brandColor }}>
        <div style={styles.dealerLogo}>
          <span style={styles.dealerInitials}>{initials}</span>
        </div>
        <div>
          <div style={styles.dealerName}>{dealerName}</div>
          <div style={styles.poweredBy}>Powered by WindowFit</div>
        </div>
      </div>

      <div style={styles.container}>

        {/* Quote info */}
        <div style={styles.quoteInfoCard}>
          <div style={styles.quoteInfoRow}>
            <span style={styles.quoteInfoLabel}>Quote</span>
            <span style={styles.quoteInfoVal}>{quote.quote_number}</span>
          </div>
          <div style={styles.quoteInfoRow}>
            <span style={styles.quoteInfoLabel}>Prepared for</span>
            <span style={styles.quoteInfoVal}>{customerName}</span>
          </div>
          <div style={styles.quoteInfoRow}>
            <span style={styles.quoteInfoLabel}>Date</span>
            <span style={styles.quoteInfoVal}>{new Date(quote.created_at).toLocaleDateString()}</span>
          </div>
          {quote.customer.address_line1 && (
            <div style={styles.quoteInfoRow}>
              <span style={styles.quoteInfoLabel}>Address</span>
              <span style={styles.quoteInfoVal}>{quote.customer.address_line1}</span>
            </div>
          )}
        </div>

        {/* Line items */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Items</div>
          {quote.line_items.map(item => (
            <div key={item.id} style={styles.lineItem}>
              <div style={{ flex: 1 }}>
                <div style={styles.lineItemName}>{item.product_name}</div>
                {item.room_name && (
                  <div style={styles.lineItemSub}>{item.room_name}</div>
                )}
                {item.window_label && (
                  <div style={styles.lineItemSub}>{item.window_label}</div>
                )}
                {item.width_in && item.height_in && (
                  <div style={styles.lineItemSub}>{item.width_in}" × {item.height_in}" · {item.mount_type ?? 'inside'} mount</div>
                )}
              </div>
              <div style={styles.lineItemPrice}>
                ${(item.line_total_cents / 100).toFixed(0)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={styles.totalsCard}>
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>Subtotal</span>
            <span style={styles.totalVal}>${(quote.subtotal_cents / 100).toFixed(0)}</span>
          </div>
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>Installation</span>
            <span style={styles.totalVal}>${(quote.install_cents / 100).toFixed(0)}</span>
          </div>
          <div style={styles.divider} />
          <div style={styles.totalRow}>
            <span style={styles.grandTotalLabel}>Total</span>
            <span style={{ ...styles.grandTotalVal, color: brandColor }}>
              ${(quote.total_cents / 100).toFixed(0)}
            </span>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div style={styles.notesCard}>
            <div style={styles.sectionLabel}>Notes from {dealerName}</div>
            <p style={styles.notesText}>{quote.notes}</p>
          </div>
        )}

        {/* Actions */}
        {!showChangeForm ? (
          <div style={styles.actions}>
            <button
              style={{ ...styles.approveBtn, backgroundColor: brandColor, opacity: submitting ? 0.5 : 1 }}
              onClick={handleApprove}
              disabled={submitting}
            >
              {submitting ? 'Processing...' : '✓ Approve Quote'}
            </button>
            <div style={styles.secondaryActions}>
              <button
                style={styles.changesBtn}
                onClick={() => setShowChangeForm(true)}
              >
                Request Changes
              </button>
              <button
                style={styles.declineBtn}
                onClick={handleDecline}
                disabled={submitting}
              >
                Decline
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.changeForm}>
            <div style={styles.sectionLabel}>Request Changes</div>
            <textarea
              value={changeMessage}
              onChange={e => setChangeMessage(e.target.value)}
              placeholder="Describe what you'd like changed — different colors, sizes, products, or anything else..."
              style={styles.textarea}
              rows={4}
            />
            <div style={styles.secondaryActions}>
              <button
                style={{ ...styles.approveBtn, backgroundColor: brandColor, opacity: submitting || !changeMessage.trim() ? 0.5 : 1 }}
                onClick={handleRequestChanges}
                disabled={submitting || !changeMessage.trim()}
              >
                {submitting ? 'Sending...' : 'Send Request'}
              </button>
              <button
                style={styles.changesBtn}
                onClick={() => setShowChangeForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Contact */}
        {(quote.dealer.phone || quote.dealer.email) && (
          <div style={styles.contactCard}>
            <div style={styles.sectionLabel}>Questions?</div>
            <div style={styles.contactRow}>
              {quote.dealer.phone && (
                <a href={`tel:${quote.dealer.phone}`} style={{ ...styles.contactBtn, color: brandColor }}>
                  📞 {quote.dealer.phone}
                </a>
              )}
              {quote.dealer.email && (
                <a href={`mailto:${quote.dealer.email}`} style={{ ...styles.contactBtn, color: brandColor }}>
                  ✉️ {quote.dealer.email}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          <span>Powered by </span>
          <span style={{ color: brandColor, fontWeight: 700 }}>WindowFit</span>
        </div>

      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#0A0F1A' },
  centered: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12,
  },
  spinner: {
    width: 40, height: 40, borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#0A84FF',
    animation: 'spin 0.8s linear infinite',
  },
  successCircle: {
    width: 80, height: 80, borderRadius: '50%',
    border: '2px solid', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  callBtn: {
    marginTop: 16, padding: '12px 24px', borderRadius: 12,
    color: 'white', fontWeight: 700, fontSize: 15,
    textDecoration: 'none', display: 'inline-block',
  },
  header: {
    padding: '24px 20px', display: 'flex',
    alignItems: 'center', gap: 14,
  },
  dealerLogo: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  dealerInitials: { color: 'white', fontWeight: 800, fontSize: 18 },
  dealerName: { color: 'white', fontWeight: 800, fontSize: 18 },
  poweredBy: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },
  container: { maxWidth: 480, margin: '0 auto', padding: '20px 20px 60px' },
  quoteInfoCard: {
    backgroundColor: '#111827', borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.07)',
    padding: 16, marginBottom: 20,
  },
  quoteInfoRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', paddingBottom: 10, marginBottom: 10,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  quoteInfoLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  quoteInfoVal: { color: 'white', fontWeight: 600, fontSize: 13 },
  section: { marginBottom: 20 },
  sectionLabel: {
    color: 'rgba(255,255,255,0.4)', fontSize: 11,
    fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 10,
  },
  lineItem: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingBottom: 14, marginBottom: 14,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  lineItemName: { color: 'white', fontWeight: 600, fontSize: 15, marginBottom: 4 },
  lineItemSub: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 2 },
  lineItemPrice: { color: 'white', fontWeight: 700, fontSize: 16, marginLeft: 16 },
  totalsCard: {
    backgroundColor: '#111827', borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.07)',
    padding: 16, marginBottom: 20,
  },
  totalRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 10 },
  totalLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  totalVal: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', margin: '8px 0 16px' },
  grandTotalLabel: { color: 'white', fontWeight: 700, fontSize: 18 },
  grandTotalVal: { fontWeight: 800, fontSize: 24 },
  notesCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.06)',
    padding: 14, marginBottom: 20,
  },
  notesText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6 },
  actions: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 },
  approveBtn: {
    width: '100%', padding: '16px', borderRadius: 14,
    color: 'white', fontWeight: 700, fontSize: 16,
    border: 'none', cursor: 'pointer',
  },
  secondaryActions: { display: 'flex', gap: 10 },
  changesBtn: {
    flex: 1, padding: '14px', borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 14,
    border: 'none', cursor: 'pointer',
  },
  declineBtn: {
    flex: 1, padding: '14px', borderRadius: 14,
    backgroundColor: 'rgba(255,69,58,0.1)',
    color: 'rgba(255,69,58,0.8)', fontWeight: 600, fontSize: 14,
    border: '1px solid rgba(255,69,58,0.2)', cursor: 'pointer',
  },
  changeForm: { marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 },
  textarea: {
    width: '100%', padding: 14, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white', fontSize: 14, lineHeight: 1.6, resize: 'vertical',
  },
  contactCard: {
    backgroundColor: '#111827', borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.07)',
    padding: 16, marginBottom: 20,
  },
  contactRow: { display: 'flex', flexDirection: 'column', gap: 8 },
  contactBtn: { fontSize: 14, fontWeight: 600, textDecoration: 'none' },
  footer: {
    textAlign: 'center', color: 'rgba(255,255,255,0.25)',
    fontSize: 12, paddingTop: 20,
  },
};