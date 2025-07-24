
import React from 'react';
import { DocketDeletionLog } from '../types';
import { formatDate } from '../services';

interface DeletedDocketsLogProps {
  logs: DocketDeletionLog[];
}

export const DeletedDocketsLog: React.FC<DeletedDocketsLogProps> = ({ logs }) => {
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500">{log.docketId}</td>
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
      </div>
    </div>
  );
};
