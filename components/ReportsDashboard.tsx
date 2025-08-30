
import React, { useState, useMemo } from 'react';
import { Docket, Agent, AuthUser } from '../types';
import { formatCurrency, formatDate } from '../services';
import { FormInput, Icons } from './common';
import { useAuth } from '../hooks';
import InvoiceReportPage from './InvoiceReportPage';
import { exportToExcel, exportToPDF, formatCurrencyForExport, formatDateForExport, ExportData } from '../services/exportService';

interface ReportsDashboardProps {
  dockets: Docket[];
  agents: Agent[];
  onOpenDocket: (id: string) => void;
}

const calculateDocketTotals = (docket: Docket) => {
    // Calculate total billed amount from itinerary items (without GST)
    const allPayableItems = [
        ...docket.itinerary.flights.flatMap(f => f.passengerDetails),
        ...docket.itinerary.hotels,
        ...docket.itinerary.excursions,
        ...docket.itinerary.transfers,
    ];

    const grossBilled = allPayableItems.reduce((acc, item) => acc + (item.grossBilled || 0), 0);
    const netCost = allPayableItems.reduce((acc, item) => acc + (item.netCost || 0), 0);

    return { grossBilled, netCost };
};

export const ReportsDashboard: React.FC<ReportsDashboardProps> = ({ dockets, agents, onOpenDocket }) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'dockets' | 'invoices'>('dockets');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [filterType, setFilterType] = useState<'creation' | 'departure'>('departure');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [destinationFilter, setDestinationFilter] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'outstanding'>('all');
  const [isExporting, setIsExporting] = useState(false);

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

  const docketsByAgent = useMemo(() => {
    return filteredDockets.filter(d => agentFilter === 'all' ? true : d.agentId === agentFilter);
  }, [filteredDockets, agentFilter]);

  const destinationOptions = useMemo(() => {
    const set = new Set<string>();
    docketsByAgent.forEach(d => {
      const dest = d.itinerary.flights[0]?.arrivalAirport || d.itinerary.hotels[0]?.name || 'N/A';
      if (dest) set.add(dest);
    });
    return Array.from(set);
  }, [docketsByAgent]);

  const docketsByAgentDest = useMemo(() => {
    return docketsByAgent.filter(d => {
      // Destination filter
      if (destinationFilter !== 'all') {
        const dest = d.itinerary.flights[0]?.arrivalAirport || d.itinerary.hotels[0]?.name || 'N/A';
        if (dest !== destinationFilter) return false;
      }
      
      // Balance filter
      if (balanceFilter === 'outstanding') {
        const { grossBilled } = calculateDocketTotals(d);
        const paid = (d.payments || []).reduce((s,p) => s + (p.amount||0), 0);
        const balance = Math.max(0, grossBilled - paid);
        if (balance === 0) return false;
      }
      
      return true;
    });
  }, [docketsByAgent, destinationFilter, balanceFilter]);

  const handleOpen = (id: string) => onOpenDocket(id);

  const prepareExportData = (): ExportData => {
    const headers = [
      'Docket Date',
      'Docket No',
      'Client Name',
      'Agent',
      'Destination',
      'Departure Date',
      'Total Billed',
      'Amount Paid',
      'Profit',
      'Balance Due'
    ];

    const rows = docketsByAgentDest.map(d => {
      const { grossBilled, netCost } = calculateDocketTotals(d);
      const paid = (d.payments || []).reduce((s,p) => s + (p.amount||0), 0);
      const profit = (grossBilled - netCost);
      const balance = Math.max(0, grossBilled - paid);
      const departureDate = d.itinerary.flights[0]?.departureDate || d.itinerary.hotels[0]?.checkIn || 'N/A';
      const created = d.createdAt ? (()=>{ const dd=new Date(d.createdAt); const pad=(n:number)=>String(n).padStart(2,'0'); return `${pad(dd.getDate())}/${pad(dd.getMonth()+1)}/${dd.getFullYear()}`; })() : 'N/A';
      const mainDestination = d.itinerary.flights[0]?.arrivalAirport || d.itinerary.hotels[0]?.name || 'N/A';
      const agentName = d.agentId ? agents.find(a => a.id === d.agentId)?.name : 'N/A';

      return [
        created,
        d.docketNo || d.id,
        d.client.name,
        agentName,
        mainDestination,
        formatDateForExport(departureDate),
        formatCurrencyForExport(grossBilled),
        formatCurrencyForExport(paid),
        formatCurrencyForExport(profit),
        formatCurrencyForExport(balance)
      ];
    });

    // Add totals row
    const totals = docketsByAgentDest.reduce((acc, d) => {
      const { grossBilled, netCost } = calculateDocketTotals(d);
      const paid = (d.payments || []).reduce((s,p) => s + (p.amount||0), 0);
      const profit = (grossBilled - netCost);
      const balance = Math.max(0, grossBilled - paid);
      
      return {
        grossBilled: acc.grossBilled + grossBilled,
        paid: acc.paid + paid,
        profit: acc.profit + profit,
        balance: acc.balance + balance
      };
    }, { grossBilled: 0, paid: 0, profit: 0, balance: 0 });

    rows.push([
      'TOTALS',
      '',
      '',
      '',
      '',
      '',
      formatCurrencyForExport(totals.grossBilled),
      formatCurrencyForExport(totals.paid),
      formatCurrencyForExport(totals.profit),
      formatCurrencyForExport(totals.balance)
    ]);

    const filters = [
      agentFilter !== 'all' ? `Agent: ${agents.find(a => a.id === agentFilter)?.name}` : null,
      destinationFilter !== 'all' ? `Destination: ${destinationFilter}` : null,
      balanceFilter === 'outstanding' ? 'Outstanding Balance Only' : null
    ].filter(Boolean).join(', ');

    return {
      headers,
      rows,
      title: 'Dockets Report',
      dateRange: `${formatDateForExport(dateRange.start)} to ${formatDateForExport(dateRange.end)} (${filterType})`,
      filters: filters || 'All filters'
    };
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const exportData = prepareExportData();
      const result = exportToExcel(exportData);
      if (result.success) {
        alert(`Excel file exported successfully: ${result.filename}`);
      } else {
        alert(`Export failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `Dockets_Report_${timestamp}.pdf`;
      const result = await exportToPDF('dockets-report-table', filename);
      if (result.success) {
        alert(`PDF file exported successfully: ${result.filename}`);
      } else {
        alert(`Export failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-slate-100 min-h-full">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-6">Reports Dashboard</h1>
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-white p-1 rounded-lg shadow-sm mb-6">
          <button
            onClick={() => setActiveTab('dockets')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'dockets'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Docket Reports
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'invoices'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Invoice Reports
          </button>
        </div>

        {activeTab === 'invoices' ? (
          <InvoiceReportPage onOpenDocket={onOpenDocket} />
        ) : (
          <>
        
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
        
        {/* Comprehensive Dockets Report */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-700">Dockets Report</h2>
            <div className="flex items-center gap-3">
              {/* Export Buttons */}
              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isExporting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                )}
                Export Excel
              </button>
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isExporting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                  </svg>
                )}
                Export PDF
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-4">
               <label className="text-sm text-slate-600">Agent:</label>
               <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)} className="text-sm border rounded-md px-2 py-1">
                 <option value="all">All</option>
                 {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
               </select>
               <label className="text-sm text-slate-600 ml-4">Destination:</label>
               <select value={destinationFilter} onChange={e => setDestinationFilter(e.target.value)} className="text-sm border rounded-md px-2 py-1">
                 <option value="all">All</option>
                 {destinationOptions.map(d => <option key={d} value={d}>{d}</option>)}
               </select>
               <label className="text-sm text-slate-600 ml-4">Balance:</label>
               <select value={balanceFilter} onChange={e => setBalanceFilter(e.target.value as 'all' | 'outstanding')} className="text-sm border rounded-md px-2 py-1">
                 <option value="all">All Dockets</option>
                 <option value="outstanding">Outstanding Balance</option>
               </select>
             </div>
          <div id="dockets-report-table" className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Docket Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Docket No</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Client Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Agent</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Destination</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Departure Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Total Billed</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Amount Paid</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Profit</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Balance Due</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {(() => {
                  let sumBilled = 0; let sumPaid = 0; let sumBalance = 0; let sumProfit = 0;
                  const rows = docketsByAgentDest.map(d => {
                    const { grossBilled, netCost } = calculateDocketTotals(d);
                    const paid = (d.payments || []).reduce((s,p) => s + (p.amount||0), 0);
                    const profit = (grossBilled - netCost);
                    const balance = Math.max(0, grossBilled - paid);
                    sumBilled += grossBilled; sumPaid += paid; sumBalance += balance;
                    sumProfit += profit;
                    const departureDate = d.itinerary.flights[0]?.departureDate || d.itinerary.hotels[0]?.checkIn || 'N/A';
                    const created = d.createdAt ? (()=>{ const dd=new Date(d.createdAt); const pad=(n:number)=>String(n).padStart(2,'0'); return `${pad(dd.getDate())}/${pad(dd.getMonth()+1)}/${dd.getFullYear()}`; })() : 'N/A';
                    const mainDestination = d.itinerary.flights[0]?.arrivalAirport || d.itinerary.hotels[0]?.name || 'N/A';
                    const agentName = d.agentId ? agents.find(a => a.id === d.agentId)?.name : 'N/A';
                    const rowBg = balance === 0 ? '#d4edda' : '#f8d7da';
                    return (
                      <tr key={d.id} style={{ backgroundColor: rowBg }}>
                        <td className="px-4 py-3 text-sm text-slate-600">{created}</td>
                        <td className="px-4 py-3 text-sm"><button onClick={() => onOpenDocket(d.id)} className="text-brand-primary underline">{d.docketNo || d.id}</button></td>
                        <td className="px-4 py-3 text-sm text-slate-800">{d.client.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{agentName}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{mainDestination}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(departureDate)}</td>
                        <td className="px-4 py-3 text-sm text-slate-800">{formatCurrency(grossBilled)}</td>
                        <td className="px-4 py-3 text-sm text-slate-800">{formatCurrency(paid)}</td>
                        <td className="px-4 py-3 text-sm text-slate-800">{formatCurrency(profit)}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(balance)}</td>
                      </tr>
                    );
                  });
                  rows.push(
                    <tr key="agent-totals" className="bg-slate-50 font-semibold">
                      <td className="px-4 py-3" colSpan={6}>Totals</td>
                      <td className="px-4 py-3">{formatCurrency(sumBilled)}</td>
                      <td className="px-4 py-3">{formatCurrency(sumPaid)}</td>
                      <td className="px-4 py-3">{formatCurrency(sumProfit)}</td>
                      <td className="px-4 py-3">{formatCurrency(sumBalance)}</td>
                    </tr>
                  );
                  return rows;
                })()}
                {docketsByAgentDest.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-4 text-slate-500">No dockets for this selection.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
};