import React, { useState, useEffect, useMemo } from 'react';
import { useDockets } from '../hooks';
import { Invoice } from '../types';
import { formatCurrency, formatDate } from '../services';
import { exportToExcel, exportToPDF, formatCurrencyForExport, formatDateForExport, ExportData } from '../services/exportService';

interface InvoiceReportPageProps {
  onOpenDocket: (id: string) => void;
}

const InvoiceReportPage: React.FC<InvoiceReportPageProps> = ({ onOpenDocket }) => {
  const { dockets } = useDockets();
  const [filterType, setFilterType] = useState<'all' | 'date' | 'monthly' | 'quarterly' | 'yearly'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [searchQuery, setSearchQuery] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'outstanding'>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Get all invoices from all dockets
  const allInvoices = useMemo(() => {
    const invoices: Array<Invoice & { docketId: string; docketNumber: string; paxName: string }> = [];
    
    dockets.forEach(docket => {
      if (docket.invoices && docket.invoices.length > 0) {
        docket.invoices.forEach(invoice => {
          invoices.push({
            ...invoice,
            docketId: docket.id,
            docketNumber: docket.docketNo || docket.id,
            paxName: invoice.billedTo?.name || 'Unknown'
          });
        });
      }
    });
    
    return invoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dockets]);

  // Filter invoices based on selected criteria
  const filteredInvoices = useMemo(() => {
    let filtered = allInvoices;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(invoice => 
        invoice.invoiceNumber.toLowerCase().includes(query) ||
        invoice.paxName.toLowerCase().includes(query) ||
        invoice.docketNumber.toLowerCase().includes(query) ||
        invoice.billedTo?.email?.toLowerCase().includes(query) ||
        invoice.billedTo?.phone?.toLowerCase().includes(query)
      );
    }

    // Apply date filters
    switch (filterType) {
      case 'date':
        if (startDate && endDate) {
          filtered = filtered.filter(invoice => {
            const invoiceDate = new Date(invoice.date);
            const start = new Date(startDate);
            const end = new Date(endDate);
            return invoiceDate >= start && invoiceDate <= end;
          });
        }
        break;
      
      case 'monthly':
        if (selectedMonth) {
          const [year, month] = selectedMonth.split('-');
          filtered = filtered.filter(invoice => {
            const invoiceDate = new Date(invoice.date);
            return invoiceDate.getFullYear() === parseInt(year) && 
                   invoiceDate.getMonth() === parseInt(month) - 1;
          });
        }
        break;
      
      case 'quarterly':
        if (selectedQuarter && selectedYear) {
          const year = parseInt(selectedYear);
          const quarter = parseInt(selectedQuarter);
          const startMonth = (quarter - 1) * 3;
          const endMonth = startMonth + 2;
          
          filtered = filtered.filter(invoice => {
            const invoiceDate = new Date(invoice.date);
            const month = invoiceDate.getMonth();
            return invoiceDate.getFullYear() === year && 
                   month >= startMonth && month <= endMonth;
          });
        }
        break;
      
      case 'yearly':
        if (selectedYear) {
          const year = parseInt(selectedYear);
          filtered = filtered.filter(invoice => {
            const invoiceDate = new Date(invoice.date);
            return invoiceDate.getFullYear() === year;
          });
        }
        break;
    }

    // Apply balance filter
    if (balanceFilter === 'outstanding') {
      filtered = filtered.filter(invoice => {
        // For invoices, we'll consider them outstanding if they have a balance due
        // This would typically be based on payment status, but for now we'll show all invoices
        // You can modify this logic based on your payment tracking system
        return true; // Show all invoices for now
      });
    }

    return filtered;
  }, [allInvoices, filterType, startDate, endDate, selectedMonth, selectedQuarter, selectedYear, searchQuery, balanceFilter]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalAmount = filteredInvoices.reduce((sum, invoice) => sum + invoice.grandTotal, 0);
    const totalInvoices = filteredInvoices.length;
    const avgAmount = totalInvoices > 0 ? totalAmount / totalInvoices : 0;
    
    return {
      totalAmount,
      totalInvoices,
      avgAmount
    };
  }, [filteredInvoices]);

  // Generate month options for the last 2 years
  const monthOptions = useMemo(() => {
    const options = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    for (let year = currentYear; year >= currentYear - 2; year--) {
      for (let month = 1; month <= 12; month++) {
        const date = new Date(year, month - 1, 1);
        options.push({
          value: `${year}-${month.toString().padStart(2, '0')}`,
          label: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
        });
      }
    }
    return options;
  }, []);

  // Generate year options for the last 5 years
  const yearOptions = useMemo(() => {
    const options = [];
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= currentYear - 5; year--) {
      options.push(year.toString());
    }
    return options;
  }, []);

  const handleDocketClick = (docketId: string) => {
    onOpenDocket(docketId);
  };

  const prepareExportData = (): ExportData => {
    const headers = [
      'Date',
      'Invoice Number',
      'Passenger Name',
      'GST Number',
      'Amount',
      'Docket Number',
      'Email',
      'Phone'
    ];

    const rows = filteredInvoices.map(invoice => [
      formatDateForExport(invoice.date),
      invoice.invoiceNumber,
      invoice.paxName,
      invoice.billedTo?.gstin || 'N/A',
      formatCurrencyForExport(invoice.grandTotal),
      invoice.docketNumber,
      invoice.billedTo?.email || 'N/A',
      invoice.billedTo?.phone || 'N/A'
    ]);

    // Add totals row
    rows.push([
      'TOTALS',
      '',
      '',
      '',
      formatCurrencyForExport(summaryStats.totalAmount),
      '',
      '',
      ''
    ]);

    const filters = [
      filterType !== 'all' ? `Filter: ${filterType}` : null,
      filterType === 'date' && startDate && endDate ? `Date Range: ${formatDateForExport(startDate)} to ${formatDateForExport(endDate)}` : null,
      filterType === 'monthly' && selectedMonth ? `Month: ${selectedMonth}` : null,
      filterType === 'quarterly' && selectedQuarter && selectedYear ? `Quarter: Q${selectedQuarter} ${selectedYear}` : null,
      filterType === 'yearly' && selectedYear ? `Year: ${selectedYear}` : null,
      balanceFilter === 'outstanding' ? 'Outstanding Balance Only' : null,
      searchQuery ? `Search: ${searchQuery}` : null
    ].filter(Boolean).join(', ');

    return {
      headers,
      rows,
      title: 'Invoice Report',
      dateRange: filterType === 'date' && startDate && endDate ? `${formatDateForExport(startDate)} to ${formatDateForExport(endDate)}` : undefined,
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
      const filename = `Invoice_Report_${timestamp}.pdf`;
      const result = await exportToPDF('invoice-report-table', filename);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Invoice Report</h1>
        <p className="text-gray-600">Comprehensive view of all generated invoices with filtering and search capabilities</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Invoices</p>
              <p className="text-2xl font-semibold text-gray-900">{summaryStats.totalInvoices}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Amount</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(summaryStats.totalAmount)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Average Amount</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(summaryStats.avgAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Filter Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Invoices</option>
              <option value="date">Date Range</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {/* Date Range */}
          {filterType === 'date' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* Monthly Filter */}
          {filterType === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Month</option>
                {monthOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Quarterly Filter */}
          {filterType === 'quarterly' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quarter</label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Quarter</option>
                  <option value="1">Q1 (Jan-Mar)</option>
                  <option value="2">Q2 (Apr-Jun)</option>
                  <option value="3">Q3 (Jul-Sep)</option>
                  <option value="4">Q4 (Oct-Dec)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {yearOptions.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Yearly Filter */}
          {filterType === 'yearly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          )}
        </div>

                 {/* Search and Balance Filter */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
             <input
               type="text"
               placeholder="Search by invoice number, passenger name, docket number, email, or phone..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
             />
           </div>
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Balance Filter</label>
             <select
               value={balanceFilter}
               onChange={(e) => setBalanceFilter(e.target.value as 'all' | 'outstanding')}
               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
             >
               <option value="all">All Invoices</option>
               <option value="outstanding">Outstanding Balance</option>
             </select>
           </div>
         </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Invoice Results ({filteredInvoices.length})
          </h3>
        </div>
        
        {filteredInvoices.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No invoices found matching your criteria.
          </div>
        ) : (
          <div id="invoice-report-table" className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Passenger Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Docket Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact Info
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(invoice.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{invoice.paxName}</div>
                        {invoice.billedTo?.gstin && (
                          <div className="text-xs text-gray-500">GST: {invoice.billedTo.gstin}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCurrency(invoice.grandTotal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <button
                        onClick={() => handleDocketClick(invoice.docketId)}
                        className="text-blue-600 hover:text-blue-900 font-medium underline"
                      >
                        {invoice.docketNumber}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>
                        {invoice.billedTo?.email && (
                          <div>{invoice.billedTo.email}</div>
                        )}
                        {invoice.billedTo?.phone && (
                          <div>{invoice.billedTo.phone}</div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceReportPage;
