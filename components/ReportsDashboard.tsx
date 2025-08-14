
import React, { useState, useMemo } from 'react';
import { Docket, Agent, AuthUser } from '../types';
import { formatCurrency, formatDate } from '../services';
import { FormInput, Icons } from './common';
import { useAuth } from '../hooks';

interface ReportsDashboardProps {
  dockets: Docket[];
  agents: Agent[];
  onOpenDocket: (id: string) => void;
}

const calculateDocketTotals = (docket: Docket) => {
    const allPayableItems = [
        ...docket.itinerary.flights.flatMap(f => f.passengerDetails),
        ...docket.itinerary.hotels,
        ...docket.itinerary.excursions,
        ...docket.itinerary.transfers,
    ];

    return allPayableItems.reduce((acc, item) => ({
        grossBilled: acc.grossBilled + (item.grossBilled || 0),
        netCost: acc.netCost + (item.netCost || 0)
    }), { grossBilled: 0, netCost: 0 });
};

export const ReportsDashboard: React.FC<ReportsDashboardProps> = ({ dockets, agents, onOpenDocket }) => {
  const { currentUser } = useAuth();
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [filterType, setFilterType] = useState<'creation' | 'departure'>('departure');

  const docketsForReporting = useMemo(() => {
    if (currentUser?.role === 'admin') {
      return dockets;
    }
    return dockets.filter(d => d.createdBy === currentUser?.id);
  }, [dockets, currentUser]);

  const filteredDockets = useMemo(() => {
    const startDate = new Date(`${dateRange.start}T00:00:00`);
    const endDate = new Date(`${dateRange.end}T23:59:59`);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return [];

    return docketsForReporting.filter(docket => {
      let dateToCompare: Date | null = null;
      if (filterType === 'creation') {
        if (docket.createdAt) {
          dateToCompare = new Date(docket.createdAt); // ISO string creates local time Date object
        }
      } else { // 'departure'
        const departureDateStr = docket.itinerary.flights[0]?.departureDate || docket.itinerary.hotels[0]?.checkIn;
        if (departureDateStr) {
          // It's a YYYY-MM-DD string, parse as local time to avoid timezone shift
          dateToCompare = new Date(`${departureDateStr}T00:00:00`);
        }
      }

      if (!dateToCompare || isNaN(dateToCompare.getTime())) return false;
      
      return dateToCompare >= startDate && dateToCompare <= endDate;

    }).sort((a,b) => {
        const getDate = (docket: Docket): Date | null => {
            if (filterType === 'creation') {
                const d = docket.createdAt ? new Date(docket.createdAt) : null;
                return d && !isNaN(d.getTime()) ? d : null;
            }
            const dateStr = docket.itinerary.flights[0]?.departureDate || docket.itinerary.hotels[0]?.checkIn;
            const d = dateStr ? new Date(`${dateStr}T00:00:00`) : null;
            return d && !isNaN(d.getTime()) ? d : null;
        }

        const dateA = getDate(a);
        const dateB = getDate(b);
        
        if (!dateA) return 1;
        if (!dateB) return -1;
        
        return dateA.getTime() - dateB.getTime();
    });
  }, [docketsForReporting, dateRange, filterType]);

  const agentPerformanceData = useMemo(() => {
    const data: { [agentId: string]: { name: string; sales: number; profit: number; bookings: number } } = {};
    agents.forEach(agent => {
        data[agent.id] = { name: agent.name, sales: 0, profit: 0, bookings: 0 };
    });
    data['unassigned'] = { name: 'Unassigned', sales: 0, profit: 0, bookings: 0 };

    filteredDockets.forEach(docket => {
        const agentId = docket.agentId || 'unassigned';
        const { grossBilled, netCost } = calculateDocketTotals(docket);
        if (data[agentId]) {
            data[agentId].sales += grossBilled;
            data[agentId].profit += (grossBilled - netCost);
            data[agentId].bookings += 1;
        }
    });

    return Object.values(data).filter(d => d.bookings > 0).sort((a,b) => b.sales - a.sales);
  }, [filteredDockets, agents]);

  const handleOpen = (id: string) => onOpenDocket(id);

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-slate-100 min-h-full">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-6">Docket Reports</h1>
        
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600 shrink-0">Filter by:</span>
                <div className="flex items-center bg-slate-200 rounded-full p-1">
                    <button
                        onClick={() => setFilterType('creation')}
                        className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${
                            filterType === 'creation' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-600 hover:bg-slate-300'
                        }`}
                        >
                        Creation Date
                    </button>
                    <button
                        onClick={() => setFilterType('departure')}
                        className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${
                            filterType === 'departure' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-600 hover:bg-slate-300'
                        }`}
                        >
                        Departure Date
                    </button>
                </div>
            </div>
            <FormInput 
                label={filterType === 'creation' ? 'Created From:' : 'Departure From:'} 
                type="date" 
                id="startDate" 
                value={dateRange.start} 
                onChange={e => setDateRange(p => ({...p, start: e.target.value}))} 
                icon={Icons.calendar} 
            />
            <FormInput 
                label={filterType === 'creation' ? 'Created To:' : 'Departure To:'} 
                type="date" 
                id="endDate" 
                value={dateRange.end} 
                onChange={e => setDateRange(p => ({...p, end: e.target.value}))} 
                icon={Icons.calendar} 
            />
        </div>
        
        {/* Agent Performance Table */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
            <h2 className="text-xl font-semibold mb-4 text-slate-700">Agent Performance</h2>
             <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Agent</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Bookings</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Total Sales</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Total Profit</th>
                    </tr>
                </thead>
                 <tbody className="bg-white divide-y divide-slate-200">
                     {agentPerformanceData.map(agent => (
                         <tr key={agent.name}>
                             <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800">{agent.name}</td>
                             <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{agent.bookings}</td>
                             <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 font-semibold">{formatCurrency(agent.sales)}</td>
                             <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold" style={{color: agent.profit >= 0 ? 'green' : 'red'}}>{formatCurrency(agent.profit)}</td>
                         </tr>
                     ))}
                      {agentPerformanceData.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-4 text-slate-500">No agent data for this period.</td></tr>
                      )}
                 </tbody>
              </table>
            </div>
        </div>

        {/* Dockets List */}
        <div className="bg-white rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4 text-slate-700 p-6">Dockets with Outstanding Balance</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">PAX Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Agent</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Destination</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Dep. Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Gross</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Net</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Profit</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Outstanding</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Docket ID</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {(() => {
                          const rows = filteredDockets.filter(d => {
                            const paid = (d.payments || []).reduce((s,p) => s + (p.amount||0), 0);
                            const { grossBilled } = calculateDocketTotals(d);
                            return grossBilled - paid > 0;
                          });
                          let totalGross = 0; let totalNet = 0; let totalProfit = 0; let totalOutstanding = 0;
                          const rendered = rows.map(docket => {
                            const { grossBilled, netCost } = calculateDocketTotals(docket);
                            const profit = grossBilled - netCost;
                            const mainDestination = docket.itinerary.flights[0]?.arrivalAirport || docket.itinerary.hotels[0]?.name || 'N/A';
                            const departureDate = docket.itinerary.flights[0]?.departureDate || docket.itinerary.hotels[0]?.checkIn || 'N/A';
                            const agentName = docket.agentId ? agents.find(a => a.id === docket.agentId)?.name : 'N/A';
                            const paid = (docket.payments || []).reduce((s,p) => s + (p.amount||0), 0);
                            const outstanding = Math.max(0, grossBilled - paid);
                            totalGross += grossBilled; totalNet += netCost; totalProfit += profit; totalOutstanding += outstanding;
                            
                            return (
                                <tr key={docket.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{docket.client.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{agentName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{mainDestination}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDate(departureDate)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatCurrency(grossBilled)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatCurrency(netCost)}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(profit)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatCurrency(outstanding)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <button onClick={() => handleOpen(docket.id)} className="text-brand-primary underline">
                                            {docket.id}
                                        </button>
                                    </td>
                                </tr>
                            );
                          });
                          // Append totals row
                          rendered.push(
                            <tr key="totals" className="bg-slate-50 font-semibold">
                              <td className="px-6 py-3" colSpan={4}>Totals</td>
                              <td className="px-6 py-3">{formatCurrency(totalGross)}</td>
                              <td className="px-6 py-3">{formatCurrency(totalNet)}</td>
                              <td className="px-6 py-3">{formatCurrency(totalProfit)}</td>
                              <td className="px-6 py-3">{formatCurrency(totalOutstanding)}</td>
                              <td className="px-6 py-3"></td>
                            </tr>
                          );
                          return rendered;
                        })()}
                        {filteredDockets.length === 0 && (
                            <tr><td colSpan={9} className="text-center py-10 text-slate-500">No dockets found for the selected date range.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};