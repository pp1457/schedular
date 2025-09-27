'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
      setOverrides(data);
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
      // Re-schedule
      await fetch('/api/reschedule', { method: 'POST' });
    }
  };

  const updateOverride = async () => {
    if (!selectedDate) return;
    const hours = selectedHours === '' ? null : Math.max(0, parseFloat(selectedHours) || 0);
    const res = await fetch('/api/availability/overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: selectedDate.toISOString().split('T')[0], hours }),
    });
    if (res.ok) {
      fetchOverrides();
      setSelectedDate(null);
      setSelectedHours('');
      // Re-schedule
      await fetch('/api/reschedule', { method: 'POST' });
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
      // Re-schedule
      await fetch('/api/reschedule', { method: 'POST' });
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
    const dateStr = date.toISOString().split('T')[0];
    return overrides.find(o => new Date(o.date).toISOString().split('T')[0] === dateStr);
  };

  const getAvailabilityForDate = (date: Date) => {
    const override = getOverrideForDate(date);
    if (override) return override.hours;
    const dayOfWeek = date.getDay();
    const avail = availability.find(a => a.dayOfWeek === dayOfWeek);
    return avail ? avail.hours : 0;
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
    <main className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-center">Availability Settings</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Default Hours per Day</h2>
        <div className="grid grid-cols-7 gap-4">
          {dayNames.map((day, index) => (
            <div key={day} className="text-center">
              <label htmlFor={`day-${index}`} className="block text-sm font-medium mb-2">{day}</label>
              <Input
                id={`day-${index}`}
                type="number"
                step="0.5"
                min="0"
                value={availability.find(a => a.dayOfWeek === index)?.hours || 0}
                onChange={(e) => {
                  const hours = Math.max(0, parseFloat(e.target.value) || 0);
                  setAvailability(prev => {
                    const existing = prev.find(a => a.dayOfWeek === index);
                    if (existing) {
                      return prev.map(a => a.dayOfWeek === index ? { ...a, hours } : a);
                    } else {
                      return [...prev, { id: '', dayOfWeek: index, hours }];
                    }
                  });
                }}
                className="w-full"
              />
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Button onClick={updateAvailability} className="px-8">Save Defaults</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <Button variant="outline" size="sm" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-xl font-semibold">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-4">
          {dayNames.map(day => (
            <div key={day} className="p-3 text-center font-semibold text-gray-700 bg-gray-50 rounded-md">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((day, index) => (
            <div
              key={index}
              className={`min-h-[80px] border rounded-md p-3 transition-colors ${
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
                  <div className="font-semibold text-lg mb-1">{day.getDate()}</div>
                  <div className="text-sm text-gray-600">
                    {(getAvailabilityForDate(day) || 0)}h
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set availability for {selectedDate?.toLocaleDateString()}</DialogTitle>
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDate(null)}>Cancel</Button>
            <Button onClick={updateOverride}>Save</Button>
            {selectedDate && getOverrideForDate(selectedDate) && (
              <Button variant="destructive" onClick={() => deleteOverride(selectedDate.toISOString().split('T')[0])}>
                Delete Override
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}