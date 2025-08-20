

import React, { useState, useMemo } from 'react';
import { Docket, BookingStatus, Agent } from '../types';
import { STATUS_COLORS } from '../constants';
import { formatCurrency, formatDate, toYYYYMMDD } from '../services';
import { Icons } from './common';

interface DocketCardProps {
  docket: Docket;
  agentName?: string;
  onClick: () => void;
}

const DocketCard: React.FC<DocketCardProps> = ({ docket, agentName, onClick }) => {
    const { status, client, id, itinerary, passengers } = docket;
    const statusStyle = STATUS_COLORS[status];

    const financialSummary = useMemo(() => {
        const grossBilled = [
            ...itinerary.flights.flatMap(f => f.passengerDetails.map(pd => pd.grossBilled)),
            ...itinerary.hotels.map(h => h.grossBilled),
            ...itinerary.excursions.map(a => a.grossBilled),
            ...itinerary.transfers.map(t => t.grossBilled),
        ].reduce((sum, current) => sum + current, 0);

        const totalPaid = docket.payments.reduce((sum, p) => sum + p.amount, 0);
        const balanceDue = grossBilled - totalPaid;

        return { grossBilled, balanceDue };
    }, [docket]);

    const mainDestination = itinerary.flights[0]?.arrivalAirport || itinerary.hotels[0]?.name || 'N/A';
    const travelDate = itinerary.flights[0]?.departureDate || itinerary.hotels[0]?.checkIn || 'N/A';

    return (
        <div onClick={onClick} className={`bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 cursor-pointer border-l-4 ${statusStyle.border}`}>
            <div className="p-5">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-lg font-bold text-brand-primary truncate">{client.name}</h3>
                        <p className="text-xs text-slate-500">{id}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusStyle.bg} ${statusStyle.text}`}>{status}</span>
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span>{mainDestination}</span>
                    </div>
                     <div className="flex items-center">
                        {Icons.calendar}
                        <span className="ml-2">{formatDate(travelDate)}</span>
                    </div>
                    <div className="flex items-center">
                        {Icons.user}
                        <span className="ml-2">{passengers.length} PAX</span>
                    </div>
                    {agentName && (
                        <div className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a4 4 0 100 8 4 4 0 000-8z" clipRule="evenodd" /></svg>
                            <span>Agent: {agentName}</span>
                        </div>
                    )}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Total Billed:</span>
                        <span className="font-semibold text-slate-700">{formatCurrency(financialSummary.grossBilled)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-1">
                        <span className="text-slate-500">Balance Due:</span>
                        <span className="font-bold text-orange-600">{formatCurrency(financialSummary.balanceDue)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const OutstandingBalances: React.FC<{ dockets: Docket[]; onSelectDocket: (id: string) => void }> = ({ dockets, onSelectDocket }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const outstandingDockets = useMemo(() => {
    const getEarliestDate = (itinerary: Docket['itinerary']) => {
        const dates = [
            ...itinerary.flights.map(f => f.departureDate),
            ...itinerary.hotels.map(h => h.checkIn)
        ].filter(Boolean).map(d => new Date(`${d as string}T00:00:00`));
        
        if (dates.length === 0) return null;

        const validDates = dates.filter(d => !isNaN(d.getTime()));
        if (validDates.length === 0) return null;

        return new Date(Math.min.apply(null, validDates as any));
    };

    return dockets
      .map(docket => {
        const { itinerary, payments, client, id, status, passengers } = docket;
        const grossBilled = [
          ...itinerary.flights.flatMap(f => f.passengerDetails.map(pd => pd.grossBilled)),
          ...itinerary.hotels.map(h => h.grossBilled),
          ...itinerary.excursions.map(a => a.grossBilled),
          ...itinerary.transfers.map(t => t.grossBilled),
        ].reduce((sum, current) => sum + (current || 0), 0);

        const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const balanceDue = grossBilled - totalPaid;
        const mainDestination = itinerary.flights[0]?.arrivalAirport || itinerary.hotels[0]?.name || 'N/A';
        const earliestDeparture = getEarliestDate(itinerary);

        return {
          id,
          clientName: client.name,
          grossBilled,
          totalPaid,
          balanceDue,
          status,
          passengers,
          mainDestination,
          earliestDeparture,
        };
      })
      .filter(d => d.status === BookingStatus.Confirmed && d.balanceDue > 0)
      .sort((a, b) => {
          if (!a.earliestDeparture && !b.earliestDeparture) return b.balanceDue - a.balanceDue;
          if (!a.earliestDeparture) return 1;
          if (!b.earliestDeparture) return -1;
          return a.earliestDeparture.getTime() - b.earliestDeparture.getTime();
      });
  }, [dockets]);

  const filteredOutstandingDockets = useMemo(() => {
    if (!searchTerm) return outstandingDockets;
    const lowercasedFilter = searchTerm.toLowerCase();
    return outstandingDockets.filter(d =>
      d.id.toLowerCase().includes(lowercasedFilter) ||
      d.clientName.toLowerCase().includes(lowercasedFilter) ||
      d.mainDestination.toLowerCase().includes(lowercasedFilter) ||
      d.passengers.some(p => p.fullName.toLowerCase().includes(lowercasedFilter))
    );
  }, [outstandingDockets, searchTerm]);

  if (outstandingDockets.length === 0) {
    return null;
  }

  return (
    <div className="mt-12 bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Outstanding Balances</h2>
      <div className="mb-4">
        <div className="relative">
            <input
              type="text"
              placeholder="Search by client, PAX, destination, ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full max-w-sm pl-10 pr-4 py-2 border bg-white border-slate-300 rounded-full shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Docket ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Client Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Departure Date</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total Billed</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Amount Paid</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Balance Due</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredOutstandingDockets.map(docket => (
              <tr key={docket.id} className={docket.balanceDue > 50000 ? 'bg-red-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500">{docket.docketNo || docket.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{docket.clientName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{docket.earliestDeparture ? formatDate(toYYYYMMDD(docket.earliestDeparture)) : 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatCurrency(docket.grossBilled)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{formatCurrency(docket.totalPaid)}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${docket.balanceDue > 50000 ? 'text-red-700' : 'text-orange-600'}`}>{formatCurrency(docket.balanceDue)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button onClick={() => onSelectDocket(docket.id)} className="text-brand-primary hover:underline font-semibold">
                    View Docket
                  </button>
                </td>
              </tr>
            ))}
             {filteredOutstandingDockets.length === 0 && (
                <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">
                        No outstanding balances match your search.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};


interface DashboardProps {
  dockets: Docket[];
  agents: Agent[];
  onSelectDocket: (id: string) => void;
  searchTerm?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ dockets, agents, onSelectDocket, searchTerm = '' }) => {
  const filteredDockets = useMemo(() => {
    if (!searchTerm) return dockets;
    const lowercasedFilter = searchTerm.toLowerCase();
    return dockets.filter(docket => 
        docket.id.toLowerCase().includes(lowercasedFilter) ||
        docket.searchTags.some(tag => tag.includes(lowercasedFilter))
    );
  }, [dockets, searchTerm]);

  return (
    <div className="p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
            {filteredDockets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredDockets.map(docket => {
                        const agentName = docket.agentId ? agents.find(a => a.id === docket.agentId)?.name : undefined;
                        return <DocketCard key={docket.id} docket={docket} agentName={agentName} onClick={() => onSelectDocket(docket.id)} />
                    })}
                </div>
            ) : (
                <div className="text-center py-16 bg-white rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-slate-700">No Dockets Found</h3>
                    <p className="text-slate-500 mt-2">Try adjusting your search or create a new docket.</p>
                </div>
            )}
            
            <OutstandingBalances dockets={dockets} onSelectDocket={onSelectDocket} />
        </div>
    </div>
  );
};