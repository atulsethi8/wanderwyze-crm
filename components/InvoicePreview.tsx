import React from 'react';
import { Invoice } from '../types';
import { formatCurrency, formatDate, amountToWords } from '../services';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface InvoicePreviewProps {
  invoice: Invoice;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({ invoice }) => {
  
  const handleDownload = async () => {
    const invoiceElement = document.getElementById(`invoice-preview-${invoice.id}`);
    if (!invoiceElement) {
      alert('Could not find invoice element to download.');
      return;
    }
    
    try {
      const canvas = await html2canvas(invoiceElement, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice-${invoice.invoiceNumber}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("An error occurred while generating the PDF.");
    }
  };

  const {
    invoiceNumber, date, billedTo, lineItems, notes, placeOfSupply,
    subtotal, gstAmount, grandTotal, gstType, companySettings, terms, dueDate
  } = invoice;

  return (
    <div className="bg-slate-100 -m-6 p-4 sm:p-8">
        <div className="flex justify-end mb-4 print:hidden">
            <button onClick={handleDownload} className="bg-brand-secondary text-white px-4 py-2 rounded-md text-sm font-semibold">Download PDF</button>
        </div>
        <div id={`invoice-preview-${invoice.id}`} className="bg-white shadow-lg p-10 mx-auto" style={{width: '210mm', minHeight: '297mm', position: 'relative'}}>
            {/* Header */}
            <div className="flex justify-between items-start pb-6 mb-8">
                <div>
                    { companySettings.companyName ? <h1 className="text-3xl font-bold text-slate-800">{companySettings.companyName}</h1> : <div className="w-48 h-8 bg-slate-200 rounded animate-pulse"></div> }
                    <p className="text-slate-500 whitespace-pre-line mt-2">{companySettings.companyAddress}</p>
                    <p className="text-slate-500">{companySettings.companyContact}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-4xl font-bold uppercase text-slate-400">Invoice</h2>
                    <p className="text-slate-600 mt-2"># {invoiceNumber}</p>
                </div>
            </div>
            
            {/* Info section */}
            <div className="flex justify-between mb-8 text-sm">
                <div className="max-w-[50%]">
                    <h4 className="font-semibold text-slate-500 mb-1">Billed To</h4>
                    {billedTo ? (
                        <>
                            <p className="font-bold text-slate-800">{billedTo.name}</p>
                            <p className="text-slate-600 whitespace-pre-line">{billedTo.address}</p>
                            <p className="text-slate-600">{billedTo.email}</p>
                        </>
                    ) : <p className="text-slate-400 italic">No billing details</p>}
                </div>
                <div className="text-right">
                    <p><span className="font-semibold text-slate-500">Invoice Date:</span> {formatDate(date)}</p>
                    <p><span className="font-semibold text-slate-500">Due Date:</span> {formatDate(dueDate)}</p>
                    <p><span className="font-semibold text-slate-500">Place of Supply:</span> {placeOfSupply || 'N/A'}</p>
                    {companySettings.gstNumber && <p className="mt-2"><span className="font-semibold text-slate-500">Agency GSTIN:</span> {companySettings.gstNumber}</p>}
                </div>
            </div>
            
            {/* Items Table */}
            <table className="w-full mb-8 text-sm">
                <thead className="border-b-2 border-slate-700">
                    <tr className="text-slate-600 uppercase">
                        <th className="text-left p-2 font-semibold w-[50%]">Description</th>
                        <th className="text-right p-2 font-semibold">Qty</th>
                        <th className="text-right p-2 font-semibold">Rate</th>
                        <th className="text-right p-2 font-semibold">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {lineItems.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                        <td className="p-2 align-top">{item.description}</td>
                        <td className="text-right p-2 align-top">{item.quantity}</td>
                        <td className="text-right p-2 align-top">{formatCurrency(item.rate)}</td>
                        <td className="text-right p-2 align-top">{formatCurrency(item.quantity * item.rate)}</td>
                    </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-8">
                    <div className="w-full max-w-xs space-y-2 text-sm">
                        <div className="flex justify-between text-slate-800">
                            <span>Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        
                        {gstAmount > 0 && gstType === 'CGST/SGST' && (
                            <>
                                <div className="flex justify-between text-slate-800">
                                    <span>CGST</span>
                                    <span>{formatCurrency(gstAmount / 2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-800">
                                    <span>SGST</span>
                                    <span>{formatCurrency(gstAmount / 2)}</span>
                                </div>
                            </>
                        )}

                        {gstAmount > 0 && gstType === 'IGST' && (
                            <div className="flex justify-between text-slate-800">
                                <span>IGST</span>
                                <span>{formatCurrency(gstAmount)}</span>
                            </div>
                        )}

                        <div className="flex justify-between font-bold text-lg text-slate-900 border-t pt-2 mt-2">
                            <span>Grand Total</span>
                            <span>{formatCurrency(grandTotal)}</span>
                        </div>
                    </div>
            </div>
            <div className="text-xs text-slate-600 mt-4 mb-8">
                    <span className="font-semibold">Amount in Words:</span> {amountToWords(grandTotal)} Only.
            </div>
            
            {/* Footer */}
            <div className="border-t-2 border-slate-200 pt-6 text-xs text-slate-500 absolute bottom-10 left-10 right-10">
                <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-semibold text-slate-600 mb-1">Bank Details for Payment:</h4>
                            <p className="text-slate-700">Bank: {companySettings.bankName}</p>
                            <p className="text-slate-700">A/C No: {companySettings.accountNumber}</p>
                            <p className="text-slate-700">IFSC: {companySettings.ifscCode}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-600 mb-1">Notes & Terms:</h4>
                            <p className="whitespace-pre-line">{notes}</p>
                        </div>
                </div>
            </div>
        </div>
    </div>
  );
};
