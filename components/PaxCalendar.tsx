
import React, { useState, useMemo } from 'react';
import { Docket, BookingStatus } from '../types';
import { STATUS_COLORS } from '../constants';
import { formatCurrency, toYYYYMMDD } from '../services';

interface PaxCalendarProps {
  dockets: Docket[];
  onSelectDocket: (id: string) => void;
}

export const PaxCalendar: React.FC<PaxCalendarProps> = ({ dockets, onSelectDocket }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday, etc.

  const docketsByDate = useMemo(() => {
    const map = new Map<string, Docket[]>();
    dockets.forEach(docket => {
      const dateStr = (docket.itinerary.flights[0]?.departureDate || docket.itinerary.hotels[0]?.checkIn)?.split('T')[0];
      if (dateStr) {
        if (!map.has(dateStr)) {
          map.set(dateStr, []);
        }
        map.get(dateStr)!.push(docket);
      }
    });
    return map;
  }, [dockets]);

  const changeMonth = (offset: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };
  
  const goToToday = () => {
      setCurrentDate(new Date());
  }

  const renderDays = () => {
    const days = [];
    // Blank days before the start of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`blank-${i}`} className="border-r border-b border-slate-200"></div>);
    }
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateString = toYYYYMMDD(date);
      const todayDockets = docketsByDate.get(dateString) || [];
      const isToday = dateString === toYYYYMMDD(new Date());
      
      days.push(
        <div key={day} className="relative border-r border-b border-slate-200 p-2 min-h-[120px]">
          <span className={`absolute top-2 right-2 text-sm font-semibold ${isToday ? 'bg-brand-primary text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-slate-500'}`}>{day}</span>
          <div className="mt-8 space-y-1">
            {todayDockets.map(docket => {
              const grossBilled = [
                ...docket.itinerary.flights.flatMap(f => f.passengerDetails.map(pd => pd.grossBilled)),
                ...docket.itinerary.hotels.map(h => h.grossBilled),
                ...docket.itinerary.excursions.map(a => a.grossBilled),
                ...docket.itinerary.transfers.map(t => t.grossBilled),
              ].reduce((sum, current) => sum + (current || 0), 0);

              const totalPaid = docket.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
              const balanceDue = grossBilled - totalPaid;
              const hasOutstandingBalance = balanceDue > 0;

              return (
                <div 
                  key={docket.id}
                  onClick={() => onSelectDocket(docket.id)}
                  className={`p-1 rounded text-xs cursor-pointer truncate ${STATUS_COLORS[docket.status].bg} ${STATUS_COLORS[docket.status].text} ${hasOutstandingBalance ? 'border-2 border-red-500' : ''}`}
                  title={hasOutstandingBalance ? `Balance Due: ${formatCurrency(balanceDue)}` : ''}
                >
                  {docket.client.name}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-slate-800">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h1>
          <div className="flex items-center space-x-2">
            <button onClick={goToToday} className="px-4 py-2 text-sm border border-slate-300 rounded-md hover:bg-slate-100">Today</button>
            <button onClick={() => changeMonth(-1)} className="px-3 py-2 border border-slate-300 rounded-md hover:bg-slate-100">&lt;</button>
            <button onClick={() => changeMonth(1)} className="px-3 py-2 border border-slate-300 rounded-md hover:bg-slate-100">&gt;</button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-t border-l border-slate-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center font-semibold text-sm py-2 border-r border-b border-slate-200 bg-slate-50">{day}</div>
          ))}
          {renderDays()}
        </div>
      </div>
    </div>
  );
};