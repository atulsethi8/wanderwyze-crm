
import React from 'react';
import { DocketDeletionLog, Docket } from '../types';
import { formatDate } from '../services';
import { supabase } from '../services';
import { Modal } from './common';
import { DocketForm } from './DocketForm';

interface DeletedDocketsLogProps {
  logs: DocketDeletionLog[];
}

export const DeletedDocketsLog: React.FC<DeletedDocketsLogProps> = ({ logs }) => {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [docket, setDocket] = React.useState<Docket | null>(null);
  const [loading, setLoading] = React.useState(false);

  const fetchDocket = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('dockets').select('*').eq('id', id).single();
      if (!error && data) { setDocket(data as unknown as Docket); return; }
      // Fallback: try snapshot from deletion_log (if column exists)
      let snap: any = null;
      try {
        const { data: logWithSnap } = await supabase.from('deletion_log').select('snapshot, client_name, deleted_at, reason').eq('docket_id', id).order('id', { ascending: false }).limit(1).maybeSingle();
        snap = (logWithSnap as any)?.snapshot || null;
        if (!snap && logWithSnap) {
          // Build a minimal stub if only basic info exists
          const nowIso = new Date().toISOString();
          snap = {
            id,
            client: { name: (logWithSnap as any).client_name || 'Unknown', contactInfo: '', leadSource: 'Walk-in' },
            status: 'In Progress', tag: 'Individual', agentId: null,
            passengers: [], itinerary: { flights: [], hotels: [], excursions: [], transfers: [] }, files: [], comments: [], payments: [], invoices: [],
            searchTags: [], createdBy: '', createdAt: (logWithSnap as any).deleted_at || nowIso, updatedAt: nowIso
          } as Docket;
        }
      } catch {}
      if (snap) setDocket(snap as Docket);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-6">Deleted Dockets Log</h1>
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Docket ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Client Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Deleted By</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Deleted At</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Reason</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {logs.length > 0 ? logs.map((log) => (
                  <tr key={log.docketId} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-700 underline cursor-pointer" onClick={() => { setOpenId(log.docketId); fetchDocket(log.docketId); }}>{log.docketId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{log.clientName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{log.deletedBy}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{new Date(log.deletedAt).toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{log.reason}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">No dockets have been deleted yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <Modal isOpen={!!openId} onClose={() => { setOpenId(null); setDocket(null); }} title="Read Only View – Deleted Docket" width="max-w-6xl">
          {docket ? (
            <DocketForm
              docket={docket}
              onSave={async () => {}}
              onDelete={() => {}}
              onClose={() => { setOpenId(null); setDocket(null); }}
              suppliers={[]}
              saveSupplier={() => {}}
              agents={[]}
              loading={loading}
              forceReadOnly
              readOnlyBanner="Read Only View – Deleted Docket"
            />
          ) : (
            <div className="p-6 text-slate-600">{loading ? 'Loading docket details…' : 'Docket not found. No snapshot available in deletion log.'}</div>
          )}
        </Modal>
      </div>
    </div>
  );
};
