import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ExportData {
  headers: string[];
  rows: any[][];
  title: string;
  dateRange?: string;
  filters?: string;
}

export const exportToExcel = (data: ExportData) => {
  try {
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      [data.title],
      [''],
      ['Generated on:', new Date().toLocaleString()],
      data.dateRange ? ['Date Range:', data.dateRange] : [],
      data.filters ? ['Filters:', data.filters] : [],
      [''],
      data.headers,
      ...data.rows
    ]);

    // Set column widths
    const colWidths = data.headers.map(header => ({ wch: Math.max(header.length, 15) }));
    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${data.title.replace(/\s+/g, '_')}_${timestamp}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, filename);
    
    return { success: true, filename };
  } catch (error) {
    console.error('Excel export error:', error);
    return { success: false, error: error.message };
  }
};

export const exportToPDF = async (elementId: string, filename: string) => {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error('Element not found');
    }

    // Create canvas from element
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });

    // Create PDF
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    
    const imgWidth = 297; // A4 width in mm
    const pageHeight = 210; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    let position = 0;

    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Save PDF
    pdf.save(filename);
    
    return { success: true, filename };
  } catch (error) {
    console.error('PDF export error:', error);
    return { success: false, error: error.message };
  }
};

export const formatCurrencyForExport = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatDateForExport = (dateString: string): string => {
  if (!dateString || dateString === 'N/A') return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  } catch {
    return dateString;
  }
};
