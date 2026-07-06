type CsvCell = string | number | boolean | null | undefined | Date;

const escapeCsvCell = (value: CsvCell) => {
  const text = value instanceof Date ? value.toISOString() : value == null ? '' : String(value);
  const needsQuotes = /[",\r\n]/.test(text);
  const escaped = text.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

export const downloadCsv = (filename: string, headers: string[], rows: CsvCell[][]) => {
  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');
  const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};