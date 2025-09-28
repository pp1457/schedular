'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatLocalDate, formatDisplayDate, formatDBDate } from '@/lib/utils';

interface Availability {
  id: string;
  dayOfWeek: number;
  hours: number;
}

interface Override {
  id: string;
  date: string;
  hours: number | null;
}

export default function Availability() {
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHours, setSelectedHours] = useState<string>('');

  useEffect(() => {
    fetchAvailability();
    fetchOverrides();
  }, []);

  const fetchAvailability = async () => {
    const res = await fetch('/api/availability');
    if (res.ok) {
      const data = await res.json();
      setAvailability(data);
    }
  };

  const fetchOverrides = async () => {
    const res = await fetch('/api/availability/overrides');
    if (res.ok) {
      const data = await res.json();
      // Keep date in canonical DB format (YYYY-MM-DD) for comparisons/keys.
      setOverrides(data.map((o: Override) => ({ ...o, date: formatDBDate(o.date) })));
    }
  };

  const updateAvailability = async () => {
    const data = availability.map(a => ({ dayOfWeek: a.dayOfWeek, hours: a.hours }));
    const res = await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability: data }),
    });
    if (res.ok) {
      alert('Availability updated');
      // Re-schedule from today
      const today = formatLocalDate(new Date());
      await fetch('/api/reschedule', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: today })
      });
    }
  };

  const updateOverride = async () => {
    if (!selectedDate) return;
    const hours = selectedHours === '' ? null : Math.max(0, parseFloat(selectedHours) || 0);
    const res = await fetch('/api/availability/overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: formatDBDate(selectedDate), hours }),
    });
    if (res.ok) {
      fetchOverrides();
      setSelectedDate(null);
      setSelectedHours('');
      // Re-schedule from the modified date
      await fetch('/api/reschedule', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: formatDBDate(selectedDate) })
      });
    }
  };

  const deleteOverride = async (date: string) => {
    const res = await fetch('/api/availability/overrides', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    });
    if (res.ok) {
      fetchOverrides();
      // Re-schedule from the deleted date
      await fetch('/api/reschedule', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: date })
      });
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getOverrideForDate = (date: Date) => {
    const dateStr = formatDBDate(date);
    return overrides.find(o => o.date === dateStr);
  };

  const getAvailabilityForDate = (date: Date) => {
    const override = getOverrideForDate(date);
    if (override) return override.hours;
    const dayOfWeek = date.getDay();
    const avail = availability.find(a => a.dayOfWeek === dayOfWeek);
    return avail ? avail.hours : 8;
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  return (
    <main className="container mx-auto p-4 md:p-6 max-w-2xl md:max-w-4xl">
      <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center">Availability Settings</h1>

      <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6 md:mb-8">
        <h2 className="text-lg md:text-xl font-semibold mb-4">Default Hours per Day</h2>
        <div className="grid grid-cols-7 gap-2 md:gap-4">
          {dayNames.map((day, index) => (
            <div key={day} className="text-center">
              <label htmlFor={`day-${index}`} className="block text-xs md:text-sm font-medium mb-1 md:mb-2">{day}</label>
              <Input
                id={`day-${index}`}
                type="number"
                step="0.5"
                min="0"
                placeholder="8"
                value={availability.find(a => a.dayOfWeek === index)?.hours?.toString() ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setAvailability(prev => prev.filter(a => a.dayOfWeek !== index));
                  } else {
                    const hours = Math.max(0, parseFloat(value) || 0);
                    setAvailability(prev => {
                      const existing = prev.find(a => a.dayOfWeek === index);
                      if (existing) {
                        return prev.map(a => a.dayOfWeek === index ? { ...a, hours } : a);
                      } else {
                        return [...prev, { id: '', dayOfWeek: index, hours }];
                      }
                    });
                  }
                }}
                className="w-full text-sm md:text-base"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 md:mt-6 text-center">
          <Button onClick={updateAvailability} className="px-6 md:px-8 w-full md:w-auto">Save Defaults</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <div className="flex justify-between items-center mb-4 md:mb-6">
          <Button variant="outline" size="sm" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg md:text-xl font-semibold">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 md:gap-2 mb-4">
          {dayNames.map(day => (
            <div key={day} className="p-2 md:p-3 text-center font-semibold text-gray-700 bg-gray-50 rounded-md text-sm md:text-base">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {days.map((day, index) => (
            <div
              key={index}
              className={`min-h-[60px] md:min-h-[80px] border rounded-md p-2 md:p-3 transition-colors text-sm md:text-base ${
                day
                  ? `cursor-pointer hover:shadow-md ${
                      getOverrideForDate(day)
                        ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                        : (getAvailabilityForDate(day) || 0) > 0
                        ? 'bg-green-50 border-green-200 hover:bg-green-100'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`
                  : 'bg-transparent'
              }`}
              onClick={() => day && setSelectedDate(day)}
            >
              {day && (
                <>
                  <div className="font-semibold text-base md:text-lg mb-1">{day.getDate()}</div>
                  <div className="text-xs md:text-sm text-gray-600">
                    {(getAvailabilityForDate(day) || 0)}h
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-[90vw] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Set availability for {selectedDate ? formatDisplayDate(formatLocalDate(selectedDate)) : ''}</DialogTitle>
            <DialogDescription>
              Set custom availability hours for this specific date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="hours" className="block text-sm font-medium mb-1">Hours (leave empty for default)</label>
              <Input
                id="hours"
                type="number"
                step="0.5"
                min="0"
                value={selectedHours}
                onChange={(e) => setSelectedHours(e.target.value)}
                placeholder={`Default: ${selectedDate ? getAvailabilityForDate(selectedDate) : ''}`}
                className="text-base"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setSelectedDate(null)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={updateOverride} className="w-full sm:w-auto">Save</Button>
            {selectedDate && getOverrideForDate(selectedDate) && (
              <Button variant="destructive" onClick={() => deleteOverride(formatDBDate(selectedDate))} className="w-full sm:w-auto">
                Delete Override
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}