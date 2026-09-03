import React, { useEffect, useMemo, useState } from 'react';
import { Docket, Invoice, InvoiceLineItem, Passenger } from '../types';
import { formatCurrency, formatDate } from '../services';
import { deriveDocketLineItems, docketServiceCharge } from '../services/docketLineItems';
import {
  GstMode,
  GST_MODES,
  GST_MODE_LABELS,
  STATE_NAMES,
  buildZohoInvoice,
  gstModeWarning,
  previewZohoInvoiceTotals,
  ZohoMappingError,
} from '../services/zohoInvoice';
import { zohoService, ZohoContact, ZohoInvoiceSummary } from '../services/zohoService';
import { Modal, FormInput, FormSelect, FormTextarea, Spinner, Badge, Button } from './common';

interface ZohoInvoicePanelProps {
  isOpen: boolean;
  onClose: () => void;
  docket: Docket;
  passengers: Passenger[];
  /** Persists a created/updated invoice record onto the docket, same callback the built-in generator uses. */
  onSaveInvoice: (invoice: Invoice) => void;
}

/** Status pill tone for a Zoho invoice status. */
const statusTone = (status: string): 'neutral' | 'ok' | 'warn' | 'danger' => {
  if (status === 'paid') return 'ok';
  if (status === 'overdue' || status === 'void') return 'danger';
  if (status === 'partially_paid' || status === 'sent') return 'warn';
  return 'neutral'; // draft
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const buildLocalInvoiceId = () => `ZOHO-LOCAL-${Date.now()}`;

/** Turns a Zoho summary into the CRM's own Invoice record, so it lives in docket.invoices
 *  alongside anything the built-in generator creates. */
const toLocalInvoice = (
  summary: ZohoInvoiceSummary,
  input: {
    lineItems: InvoiceLineItem[];
    billedToName: string;
    placeOfSupply: string;
    gstMode: GstMode;
    date: string;
    dueDate: string;
    notes: string;
    existingId?: string;
  },
): Invoice => {
  const preview = previewZohoInvoiceTotals({
    lineItems: input.lineItems,
    serviceCharge: 0,
    gstMode: input.gstMode,
  });
  return {
    id: input.existingId || buildLocalInvoiceId(),
    invoiceNumber: summary.invoiceNumber,
    date: input.date,
    billedTo: { name: input.billedToName },
    lineItems: input.lineItems,
    notes: input.notes,
    placeOfSupply: input.placeOfSupply,
    subtotal: summary.subTotal ?? preview.subtotal,
    gstAmount: summary.taxTotal ?? preview.gstAmount,
    grandTotal: summary.total,
    gstType: 'IGST',
    companySettings: {} as Invoice['companySettings'], // not used for Zoho-backed invoices
    terms: 'Zoho Books',
    dueDate: input.dueDate,
    zoho: {
      invoiceId: summary.invoiceId,
      invoiceNumber: summary.invoiceNumber,
      status: summary.status,
      balance: summary.balance,
      invoiceUrl: summary.invoiceUrl,
      gstMode: input.gstMode,
      syncedAt: new Date().toISOString(),
    },
  };
};

export const ZohoInvoicePanel: React.FC<ZohoInvoicePanelProps> = ({
  isOpen,
  onClose,
  docket,
  onSaveInvoice,
}) => {
  // Existing Zoho-linked invoices already on this docket.
  const existing = useMemo(() => docket.invoices.filter((inv) => inv.zoho), [docket.invoices]);

  // --- customer search -------------------------------------------------------------------
  const [customerQuery, setCustomerQuery] = useState(docket.client.name || '');
  const [customerResults, setCustomerResults] = useState<ZohoContact[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<ZohoContact | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const query = customerQuery.trim();
    if (query.length < 2 || selectedCustomer) {
      setCustomerResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const results = await zohoService.searchContacts(query);
        setCustomerResults(results);
      } catch (err: any) {
        setSearchError(err?.message || 'Could not search Zoho contacts.');
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [customerQuery, selectedCustomer, isOpen]);

  const pickCustomer = (contact: ZohoContact) => {
    setSelectedCustomer(contact);
    setCustomerQuery(contact.name);
    setCustomerResults([]);
    if (contact.placeOfSupply) setPlaceOfSupply(contact.placeOfSupply);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery('');
  };

  // --- invoice fields ----------------------------------------------------------------------
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [gstMode, setGstMode] = useState<GstMode>('service_charge_18');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [date, setDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(todayIso());
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLineItems(deriveDocketLineItems(docket));
    setServiceCharge(docketServiceCharge(docket));
  }, [isOpen, docket]);

  const updateLine = (id: string, field: 'description' | 'rate', value: string) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, [field]: field === 'rate' ? Number(value) || 0 : value }
          : item,
      ),
    );
  };

  const warning = gstModeWarning(gstMode, selectedCustomer?.gstTreatment);
  const preview = useMemo(
    () => previewZohoInvoiceTotals({ lineItems, serviceCharge, gstMode }),
    [lineItems, serviceCharge, gstMode],
  );

  // --- create --------------------------------------------------------------------------------
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<Invoice | null>(null);

  const handleCreateDraft = async () => {
    setCreateError(null);
    if (!selectedCustomer) {
      setCreateError('Search for and select the Zoho customer to bill first.');
      return;
    }
    setCreating(true);
    try {
      const payload = buildZohoInvoice({
        customerId: selectedCustomer.contactId,
        date,
        dueDate,
        placeOfSupply,
        lineItems,
        serviceCharge,
        gstMode,
        gstTreatment: selectedCustomer.gstTreatment,
        reference: docket.docketNo || docket.id,
        notes,
      });
      const summary = await zohoService.createDraftInvoice(payload);
      const invoice = toLocalInvoice(summary, {
        lineItems,
        billedToName: selectedCustomer.name,
        placeOfSupply,
        gstMode,
        date,
        dueDate,
        notes,
      });
      onSaveInvoice(invoice);
      setJustCreated(invoice);
    } catch (err: any) {
      setCreateError(
        err instanceof ZohoMappingError
          ? err.message
          : err?.message || 'Could not create the invoice in Zoho.',
      );
    } finally {
      setCreating(false);
    }
  };

  // --- mark sent / re-sync for any invoice already linked to this docket ---------------------
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const markSent = async (invoice: Invoice) => {
    if (!invoice.zoho) return;
    setBusyInvoiceId(invoice.id);
    setRowError(null);
    try {
      const summary = await zohoService.markSent(invoice.zoho.invoiceId);
      onSaveInvoice({
        ...invoice,
        zoho: { ...invoice.zoho, status: summary.status, balance: summary.balance, syncedAt: new Date().toISOString() },
      });
    } catch (err: any) {
      setRowError(err?.message || 'Could not mark the invoice as sent.');
    } finally {
      setBusyInvoiceId(null);
    }
  };

  const refreshStatus = async (invoice: Invoice) => {
    if (!invoice.zoho) return;
    setBusyInvoiceId(invoice.id);
    setRowError(null);
    try {
      const [summary] = await zohoService.syncStatus([invoice.zoho.invoiceId]);
      if (summary?.error) throw new Error(summary.error);
      onSaveInvoice({
        ...invoice,
        zoho: { ...invoice.zoho, status: summary.status, balance: summary.balance, syncedAt: new Date().toISOString() },
      });
    } catch (err: any) {
      setRowError(err?.message || 'Could not refresh this invoice from Zoho.');
    } finally {
      setBusyInvoiceId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Zoho Books Invoice" width="max-w-3xl">
      <div className="space-y-6">
        {existing.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-label font-semibold uppercase text-ink-subtle">
              Already in Zoho
            </h4>
            {rowError && (
              <p className="text-sm text-danger bg-danger-subtle border border-danger-line rounded-lg px-3 py-2">
                {rowError}
              </p>
            )}
            {existing.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-line rounded-lg px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink text-sm">
                      {invoice.zoho!.invoiceNumber}
                    </span>
                    <Badge tone={statusTone(invoice.zoho!.status)}>{invoice.zoho!.status}</Badge>
                  </div>
                  <p className="text-xs text-ink-subtle mt-0.5">
                    {formatCurrency(invoice.grandTotal)} total ·{' '}
                    {invoice.zoho!.balance > 0
                      ? `${formatCurrency(invoice.zoho!.balance)} due`
                      : 'settled'}{' '}
                    · synced {formatDate(invoice.zoho!.syncedAt.slice(0, 10))}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {invoice.zoho!.invoiceUrl && (
                    <a
                      href={invoice.zoho!.invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      Open in Zoho
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyInvoiceId === invoice.id}
                    onClick={() => refreshStatus(invoice)}
                  >
                    {busyInvoiceId === invoice.id ? <Spinner size="sm" /> : 'Refresh'}
                  </Button>
                  {invoice.zoho!.status === 'draft' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyInvoiceId === invoice.id}
                      onClick={() => markSent(invoice)}
                    >
                      Mark as sent
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {justCreated ? (
          <div className="border border-ok-line bg-ok-subtle rounded-lg p-4 space-y-2">
            <p className="text-sm font-semibold text-ok">
              Draft {justCreated.zoho!.invoiceNumber} created in Zoho.
            </p>
            <p className="text-sm text-ink-muted">
              Review it in Zoho before sending — nothing has gone to the client yet.
            </p>
            <div className="flex gap-2 pt-1">
              {justCreated.zoho!.invoiceUrl && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => window.open(justCreated.zoho!.invoiceUrl, '_blank')}
                >
                  Open in Zoho
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => markSent(justCreated)}>
                Mark as sent
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setJustCreated(null)}>
                Create another
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <h4 className="text-label font-semibold uppercase text-ink-subtle mb-2">
                Bill to
              </h4>
              {selectedCustomer ? (
                <div className="flex items-center justify-between border border-line rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-ink">{selectedCustomer.name}</p>
                    <p className="text-xs text-ink-subtle">
                      {selectedCustomer.gstTreatment || 'no GST treatment set in Zoho'}
                      {selectedCustomer.gstNo ? ` · ${selectedCustomer.gstNo}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={clearCustomer}
                    className="text-sm text-ink-subtle hover:text-ink"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <FormInput
                    label=""
                    placeholder="Search Zoho contacts by name…"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                  />
                  {searching && (
                    <div className="absolute right-3 top-2.5">
                      <Spinner size="sm" />
                    </div>
                  )}
                  {customerResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-surface border border-line rounded-lg shadow-overlay max-h-56 overflow-y-auto scroll-slim">
                      {customerResults.map((c) => (
                        <button
                          key={c.contactId}
                          onClick={() => pickCustomer(c)}
                          className="w-full text-left px-3 py-2 hover:bg-canvas text-sm border-b border-line last:border-0"
                        >
                          <p className="font-medium text-ink">{c.name}</p>
                          <p className="text-xs text-ink-subtle">
                            {c.gstTreatment || 'no GST treatment'} {c.email ? `· ${c.email}` : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchError && <p className="text-xs text-danger mt-1">{searchError}</p>}
                  {!searching &&
                    customerQuery.trim().length >= 2 &&
                    customerResults.length === 0 &&
                    !searchError && (
                      <p className="text-xs text-ink-subtle mt-1">
                        No matching contact in Zoho. Create it there first — this does not
                        create contacts automatically.
                      </p>
                    )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormSelect
                label="Place of supply"
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
              >
                <option value="">Select a state…</option>
                {STATE_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </FormSelect>
              <FormInput
                label="Invoice date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <FormInput
                label="Due date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <FormInput
                label="Reference"
                value={docket.docketNo || docket.id}
                readOnly
              />
            </div>

            <div>
              <h4 className="text-label font-semibold uppercase text-ink-subtle mb-2">
                GST treatment
              </h4>
              <div className="space-y-1.5">
                {GST_MODES.map((mode) => (
                  <label
                    key={mode}
                    className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm ${
                      gstMode === mode ? 'border-brand bg-brand-subtle' : 'border-line'
                    }`}
                  >
                    <input
                      type="radio"
                      name="gstMode"
                      checked={gstMode === mode}
                      onChange={() => setGstMode(mode)}
                    />
                    <span className="text-ink">{GST_MODE_LABELS[mode]}</span>
                  </label>
                ))}
              </div>
              {warning && (
                <p className="text-xs text-warn bg-warn-subtle border border-warn-line rounded-lg px-3 py-2 mt-2">
                  {warning}
                </p>
              )}
            </div>

            {gstMode === 'service_charge_18' && (
              <FormInput
                label="Service charge"
                type="number"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(Number(e.target.value) || 0)}
              />
            )}

            <div>
              <h4 className="text-label font-semibold uppercase text-ink-subtle mb-2">
                Line items
              </h4>
              <div className="space-y-2">
                {lineItems.map((item) => (
                  <div key={item.id} className="flex gap-2 items-start">
                    <FormInput
                      label=""
                      containerClassName="flex-1"
                      value={item.description}
                      onChange={(e) => updateLine(item.id, 'description', e.target.value)}
                    />
                    <FormInput
                      label=""
                      containerClassName="w-32"
                      type="number"
                      value={item.rate}
                      onChange={(e) => updateLine(item.id, 'rate', e.target.value)}
                    />
                  </div>
                ))}
                {lineItems.length === 0 && (
                  <p className="text-sm text-ink-subtle">
                    This docket has no billed itinerary items yet.
                  </p>
                )}
              </div>
            </div>

            <FormTextarea
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <div className="border-t border-line pt-4 flex items-center justify-between">
              <div className="text-sm">
                <p className="text-ink-muted">
                  Subtotal {formatCurrency(preview.subtotal)} · GST{' '}
                  {formatCurrency(preview.gstAmount)}
                </p>
                <p className="text-lg font-semibold text-ink tabular">
                  {formatCurrency(preview.grandTotal)}
                </p>
                <p className="text-xs text-ink-subtle mt-0.5">
                  Estimate — Zoho computes the authoritative total on creation.
                </p>
              </div>
              <Button variant="primary" disabled={creating} onClick={handleCreateDraft}>
                {creating ? <Spinner size="sm" /> : 'Create draft in Zoho'}
              </Button>
            </div>
            {createError && (
              <p className="text-sm text-danger bg-danger-subtle border border-danger-line rounded-lg px-3 py-2">
                {createError}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
