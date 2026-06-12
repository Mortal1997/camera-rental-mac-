'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { type DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateRangePickerProps {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateRangePicker({
  date,
  onDateChange,
  placeholder = '请选择租赁期限...',
  className,
  disabled = false,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const displayValue = React.useMemo(() => {
    if (!date?.from && !date?.to) return placeholder;
    if (date.from && date.to) {
      return `${format(date.from, 'yyyy-MM-dd')} - ${format(date.to, 'yyyy-MM-dd')}`;
    }
    if (date.from) return `${format(date.from, 'yyyy-MM-dd')} 起`;
    return placeholder;
  }, [date, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal hover:bg-accent hover:text-accent-foreground',
            !date && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={cn('truncate', !date && 'text-muted-foreground')}>{displayValue}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={date}
          onSelect={(selected) => {
            onDateChange(selected);
          }}
          numberOfMonths={2}
          locale={zhCN}
          className="rounded-lg border shadow-sm"
        />
      </PopoverContent>
    </Popover>
  );
}
