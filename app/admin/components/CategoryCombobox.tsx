'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from './ui';

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  placeholder?: string;
  error?: string;
  label?: string;
}

export function CategoryCombobox({
  value,
  onChange,
  categories,
  placeholder = '选择或输入...',
  error,
  label,
}: CategoryComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCategories = categories.filter((cat) =>
    cat.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (cat: string) => {
    onChange(cat);
    setInputValue(cat);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setSearchTerm(newValue);
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setSearchTerm(inputValue);
  };

  const handleClear = () => {
    onChange('');
    setInputValue('');
    setSearchTerm('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className={cn(
            'h-10 w-full rounded-md border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-900 outline-none transition-colors',
            'placeholder:text-slate-400',
            'focus:border-slate-400 focus:ring-2 focus:ring-slate-100',
            error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : ''
          )}
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              setSearchTerm(inputValue);
              inputRef.current?.focus();
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-slate-600"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {filteredCategories.length > 0 ? (
            <ul className="max-h-48 overflow-y-auto py-1">
              {filteredCategories.map((cat) => (
                <li key={cat}>
                  <button
                    type="button"
                    onClick={() => handleSelect(cat)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-sm transition-colors',
                      'hover:bg-slate-50',
                      cat === inputValue ? 'bg-slate-100 text-slate-900' : 'text-slate-700'
                    )}
                  >
                    <span>{cat}</span>
                    {cat === inputValue && <Check className="h-4 w-4 text-emerald-600" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : searchTerm ? (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              <Search className="mx-auto mb-2 h-5 w-5 text-slate-400" />
              <p>没有找到匹配的分类</p>
              <p className="mt-1 text-xs text-slate-400">可直接输入创建新分类</p>
            </div>
          ) : null}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-xs text-rose-500">{error}</p>
      )}
    </div>
  );
}
