
import React, { useState, useMemo } from 'react';
import { Docket, Agent, AuthUser } from '../types';
import { formatCurrency, formatDate } from '../services';
import { FormInput, Icons } from './common';
import { useAuth } from '../hooks';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';

interface ReportsDashboardProps {
  dockets: Docket[];
  agents: Agent[];
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

const startOfWeek = (d: Date) => { const dt = new Date(d); const day = dt.getDay(); const diff = dt.getDate() - day + (day === 0 ? -6 : 1); return new Date(dt.setDate(diff)); };
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfQuarter = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth()/3)*3, 1);
const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);
const startOfFY = (d: Date) => new Date(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, 3, 1);

export const ReportsDashboard: React.FC<ReportsDashboardProps> = ({ dockets, agents }) => {
  const { currentUser } = useAuth();
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [expandedDocketId, setExpandedDocketId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'creation' | 'departure'>('departure');

  const applyQuickRange = (key: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'fy') => {
    const now = new Date();
    let start = new Date();
    if (key === 'today') start = now;
    if (key === 'week') start = startOfWeek(now);
    if (key === 'month') start = startOfMonth(now);
    if (key === 'quarter') start = startOfQuarter(now);
    if (key === 'year') start = startOfYear(now);
    if (key === 'fy') start = startOfFY(now);
    setDateRange({ start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] });
  };

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

  const totalSales = useMemo(() => filteredDockets.reduce((s,d) => s + calculateDocketTotals(d).grossBilled, 0), [filteredDockets]);
  const totalNet = useMemo(() => filteredDockets.reduce((s,d) => s + calculateDocketTotals(d).netCost, 0), [filteredDockets]);
  const totalProfit = totalSales - totalNet;

  // Simple previous period change (same span ending before start)
  const prevRangeProfit = useMemo(() => {
    const start = new Date(`${dateRange.start}T00:00:00`);
    const end = new Date(`${dateRange.end}T23:59:59`);
    const spanMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - spanMs - 1);
    const prevEnd = new Date(start.getTime() - 1);
    const list = docketsForReporting.filter(d => {
      const dateStr = filterType === 'creation' ? d.createdAt : (d.itinerary.flights[0]?.departureDate || d.itinerary.hotels[0]?.checkIn);
      if (!dateStr) return false;
      const dt = filterType === 'creation' ? new Date(dateStr) : new Date(`${dateStr}T00:00:00`);
      return dt >= prevStart && dt <= prevEnd;
    });
    const sales = list.reduce((s,d) => s + calculateDocketTotals(d).grossBilled, 0);
    const net = list.reduce((s,d) => s + calculateDocketTotals(d).netCost, 0);
    return sales - net;
  }, [docketsForReporting, dateRange, filterType]);

  const profitChangePct = prevRangeProfit === 0 ? 0 : ((totalProfit - prevRangeProfit) / Math.abs(prevRangeProfit)) * 100;

  const handleToggleDocket = (id: string) => {
    setExpandedDocketId(prevId => (prevId === id ? null : id));
  };

  // Bulk export stubs
  const exportSelectedInvoices = async (mode: 'merged' | 'zip') => {
    const preview = document.getElementById('reports-root');
    if (!preview) return;
    const canvas = await html2canvas(preview, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    if (mode === 'merged') {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('Invoices-Bulk.pdf');
    } else {
      const zip = new JSZip();
      zip.file('preview.png', imgData.split(',')[1], { base64: true });
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'Invoices.zip';
      link.click();
    }
  };

  return (
    <div id="reports-root" className="p-4 sm:p-6 md:p-8 bg-slate-100 min-h-full">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-6">Docket Reports</h1>
        
        {/* Filters */}
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
            <div className="flex items-center gap-2 ml-auto">
              {[
                {k:'today',l:'Today'},{k:'week',l:'This Week'},{k:'month',l:'This Month'},{k:'quarter',l:'This Quarter'},{k:'year',l:'This Year'},{k:'fy',l:'This FY'}
              ].map(btn => (
                <button key={btn.k} onClick={() => applyQuickRange(btn.k as any)} className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-md">
                  {btn.l}
                </button>
              ))}
            </div>
        </div>

        {/* Primary metric: Profit */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-emerald-500">
            <p className="text-sm text-slate-500">Profit</p>
            <p className="text-3xl font-bold text-slate-900">{formatCurrency(totalProfit)}</p>
            <p className={`text-xs mt-1 ${profitChangePct>=0?'text-emerald-600':'text-red-600'}`}>{profitChangePct>=0?'+':''}{profitChangePct.toFixed(1)}% vs prev period</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-slate-500">Gross Sales</p>
            <p className="text-2xl font-semibold text-slate-900">{formatCurrency(totalSales)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-slate-500">Net Cost</p>
            <p className="text-2xl font-semibold text-slate-900">{formatCurrency(totalNet)}</p>
          </div>
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
                             <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${agent.profit>=0?'text-green-600':'text-red-600'}`}>{formatCurrency(agent.profit)}</td>
                         </tr>
                     ))}
                      {agentPerformanceData.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-4 text-slate-500">No agent data for this period.</td></tr>
                      )}
                 </tbody>
              </table>
            </div>
        </div>

        {/* Outstanding Invoices (placeholder list based on dueDate in invoices saved within dockets) */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-slate-700">Outstanding Invoices</h2>
            <div className="flex gap-2">
              <button onClick={() => exportSelectedInvoices('merged')} className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md">Export Merged PDF</button>
              <button onClick={() => exportSelectedInvoices('zip')} className="px-3 py-1 text-sm bg-slate-200 rounded-md">Export ZIP</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Invoice #</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Client</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Due Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Outstanding</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {/* This demo reads invoices from dockets if any exist; your existing invoice data source remains unchanged */}
                {filteredDockets.flatMap(d => (d.invoices||[])).map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{inv.billedTo?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">{formatCurrency(inv.grandTotal)}</td>
                  </tr>
                ))}
                {filteredDockets.flatMap(d => (d.invoices||[])).length === 0 && (
                  <tr><td colSpan={4} className="text-center py-4 text-slate-500">No invoices in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dockets List */}
        <div className="bg-white rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4 text-slate-700 p-6">Bookings in Period</h2>
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Details</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {filteredDockets.map(docket => {
                            const { grossBilled, netCost } = calculateDocketTotals(docket);
                            const profit = grossBilled - netCost;
                            const mainDestination = docket.itinerary.flights[0]?.arrivalAirport || docket.itinerary.hotels[0]?.name || 'N/A';
                            const departureDate = docket.itinerary.flights[0]?.departureDate || docket.itinerary.hotels[0]?.checkIn || 'N/A';
                            const agentName = docket.agentId ? agents.find(a => a.id === docket.agentId)?.name : 'N/A';
                            
                            return (
                                <React.Fragment key={docket.id}>
                                    <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => handleToggleDocket(docket.id)}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{docket.client.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{agentName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{mainDestination}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDate(departureDate)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatCurrency(grossBilled)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatCurrency(netCost)}</td>
                                        <td className={`${profit >= 0 ? 'text-green-600' : 'text-red-600'} px-6 py-4 whitespace-nowrap text-sm font-bold`}>{formatCurrency(profit)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`transform transition-transform duration-200 inline-block ${expandedDocketId === docket.id ? 'rotate-180' : ''}`}>
                                                {React.cloneElement(Icons.chevronDown, { className: 'h-5 w-5' })}
                                            </span>
                                        </td>
                                    </tr>
                                    {expandedDocketId === docket.id && (
                                        <tr>
                                            <td colSpan={8} className="p-4 bg-slate-100">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                                                    <div>
                                                        <h4 className="font-semibold text-slate-700 mb-2">Destinations</h4>
                                                        <ul className="list-disc list-inside text-sm text-slate-600">
                                                          {docket.itinerary.hotels.map(h => <li key={h.id}>{h.name} ({formatDate(h.checkIn)} - {formatDate(h.checkOut)})</li>)}
                                                          {docket.itinerary.flights.map(f => <li key={f.id}>{f.arrivalAirport} ({formatDate(f.departureDate)})</li>)}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-slate-700 mb-2">Supplier Breakdown (Net Cost)</h4>
                                                        <div className="text-sm text-slate-600 space-y-1">
                                                            <p><strong>Flights:</strong> {formatCurrency(docket.itinerary.flights.reduce((sum, f) => sum + f.passengerDetails.reduce((paxSum, pd) => paxSum + pd.netCost, 0), 0))}</p>
                                                            <p><strong>Hotels:</strong> {formatCurrency(docket.itinerary.hotels.reduce((sum, h) => sum + h.netCost, 0))}</p>
                                                            <p><strong>Excursions:</strong> {formatCurrency(docket.itinerary.excursions.reduce((sum, e) => sum + e.netCost, 0))}</p>
                                                            <p><strong>Transfers:</strong> {formatCurrency(docket.itinerary.transfers.reduce((sum, t) => sum + t.netCost, 0))}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {filteredDockets.length === 0 && (
                            <tr><td colSpan={8} className="text-center py-10 text-slate-500">No dockets found for the selected date range.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};