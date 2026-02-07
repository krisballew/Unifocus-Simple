/**
 * CSV Export Utilities
 * Functions for converting data to CSV and triggering downloads
 */

/**
 * Convert an array of objects to CSV string
 * @param rows Array of objects with string/number/null/undefined values
 * @returns CSV formatted string
 */
export function toCsv(rows: Record<string, string | number | null | undefined>[]): string {
  if (rows.length === 0) {
    return '';
  }

  // Extract headers from first row
  const headers = Object.keys(rows[0]);

  // Build CSV string
  const headerRow = headers.map(escapeField).join(',');
  const dataRows = rows.map((row) => {
    return headers
      .map((header) => {
        const value = row[header];
        return escapeField(value);
      })
      .join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Escape a field value for CSV format
 * Handles quotes, commas, and newlines
 */
function escapeField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Trigger browser download of CSV content
 * @param filename Name of the file to download
 * @param csv CSV content string
 */
export function downloadCsv(filename: string, csv: string): void {
  // Create blob with UTF-8 BOM for Excel compatibility
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });

  // Create temporary download link and trigger
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
