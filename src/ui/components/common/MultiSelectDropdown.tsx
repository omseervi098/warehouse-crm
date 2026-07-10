import React, { useRef, useState, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';

type MultiSelectDropdownProps = {
  options: { _id: string; name: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
};

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({ options, selected, onChange, placeholder }) => {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleToggle = () => setOpen(o => !o);
  const handleSelect = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const selectedLabels = options.filter(opt => selected.includes(opt._id)).map(opt => opt.name);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`w-full border ${theme.border.primary} rounded-md ${theme.bg.input} px-3 py-2 text-left cursor-pointer flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-accent`}
        onClick={handleToggle}
      >
        <span className={`truncate ${selectedLabels.length === 0 ? theme.text.muted : theme.text.primary}`}>
          {selectedLabels.length > 0 ? selectedLabels.join(', ') : (placeholder || 'Select...')}
        </span>
        <svg className={`ml-2 h-5 w-5 ${theme.text.muted} transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className={`absolute left-0 mt-2 w-full max-h-48 overflow-y-auto border ${theme.border.primary} ${theme.bg.card} rounded-md shadow-lg z-50`}>
          {options.length === 0 ? (
            <div className={`p-2 text-sm ${theme.text.muted}`}>No locations available</div>
          ) : (
            options.map(opt => (
              <label key={opt._id} className={`flex items-center space-x-2 p-2 hover:${theme.bg.hover} rounded cursor-pointer`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 text-accent focus:ring-accent border-gray-300 rounded"
                  checked={selected.includes(opt._id)}
                  onChange={() => handleSelect(opt._id)}
                />
                <span className={`text-sm ${theme.text.primary}`}>{opt.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
