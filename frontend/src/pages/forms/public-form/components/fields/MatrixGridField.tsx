import { FormField } from '../../../../../types';

interface MatrixGridFieldProps {
  field: FormField;
  value: any;
  primaryColor: string;
  onChange: (value: any) => void;
}

/** Renders both "multiple_choice_grid" (single-select per row) and "checkbox_grid" (multi-select per row). */
export default function MatrixGridField({ field, value, primaryColor, onChange }: MatrixGridFieldProps) {
  const rows = field.rows || [];
  const columns = field.columns || [];
  const isMultiSelect = field.type === 'checkbox_grid';
  const rowValues: Record<string, any> = value || {};

  const setSingle = (row: string, col: string) => {
    onChange({ ...rowValues, [row]: col });
  };

  const toggleMulti = (row: string, col: string, checked: boolean) => {
    const current: string[] = rowValues[row] || [];
    onChange({ ...rowValues, [row]: checked ? [...current, col] : current.filter((v) => v !== col) });
  };

  return (
    <div className="overflow-x-auto mt-1 border border-gray-100 rounded-xl">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-3 text-left" />
            {columns.map((col) => (
              <th key={col} className="p-3 text-center text-xs font-semibold text-gray-500">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row} className="border-t border-gray-100 hover:bg-gray-50/60">
              <td className="p-3 text-sm text-gray-700 pr-4 font-medium whitespace-nowrap">{row}</td>
              {columns.map((col) => {
                const checked = isMultiSelect ? (rowValues[row] || []).includes(col) : rowValues[row] === col;
                return (
                  <td key={col} className="p-3 text-center">
                    <input
                      type={isMultiSelect ? 'checkbox' : 'radio'}
                      name={isMultiSelect ? undefined : `${field.name}_${row}`}
                      checked={checked}
                      onChange={(e) => (isMultiSelect ? toggleMulti(row, col, e.target.checked) : setSingle(row, col))}
                      className={isMultiSelect ? 'w-4 h-4 rounded' : 'w-4 h-4'}
                      style={{ accentColor: primaryColor }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
