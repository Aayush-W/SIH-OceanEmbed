import React, { useEffect } from 'react';
import { Play, Pause, RotateCcw, Compass } from 'lucide-react';
import { SurfaceLayer } from '../types';

interface TimelineScrubberProps {
  currentDate: string;
  onDateChange: (newDate: string) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  activeLayer: SurfaceLayer;
  onChangeLayer: (layer: SurfaceLayer) => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
}

const MONTHS = [
  { name: 'JAN', dayOfYear: 15, date: '2024-01-15', season: 'WINTER' },
  { name: 'FEB', dayOfYear: 45, date: '2024-02-15', season: 'WINTER' },
  { name: 'MAR', dayOfYear: 74, date: '2024-03-15', season: 'PRE-MONSOON' },
  { name: 'APR', dayOfYear: 105, date: '2024-04-15', season: 'PRE-MONSOON' },
  { name: 'MAY', dayOfYear: 135, date: '2024-05-15', season: 'PEAK WARMTH' },
  { name: 'JUN', dayOfYear: 166, date: '2024-06-15', season: 'SW MONSOON' },
  { name: 'JUL', dayOfYear: 196, date: '2024-07-15', season: 'SW MONSOON' },
  { name: 'AUG', dayOfYear: 227, date: '2024-08-15', season: 'SW MONSOON' },
  { name: 'SEP', dayOfYear: 258, date: '2024-09-15', season: 'RETREATING' },
  { name: 'OCT', dayOfYear: 288, date: '2024-10-15', season: 'POST-MONSOON' },
  { name: 'NOV', dayOfYear: 319, date: '2024-11-15', season: 'NE MONSOON' },
  { name: 'DEC', dayOfYear: 349, date: '2024-12-15', season: 'WINTER' },
];

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  currentDate,
  onDateChange,
  isPlaying,
  onTogglePlay,
  activeLayer,
  onChangeLayer,
  autoRotate,
  onToggleAutoRotate,
}) => {
  // Today's real live ISO date (e.g. today in 2026 or real current calendar)
  const todayStr = new Date().toISOString().split('T')[0];
  const isLiveNow = currentDate === todayStr || currentDate === '2026-08-30';

  // Convert currentDate to dayOfYear (0 to 365)
  const getDayOfYear = (dStr: string) => {
    const d = new Date(dStr);
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const currentDay = getDayOfYear(currentDate);

  // Convert dayOfYear back to YYYY-MM-DD
  const dayToDateStr = (day: number) => {
    const d = new Date(2024, 0);
    d.setDate(day);
    return d.toISOString().split('T')[0];
  };

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const nextDay = (getDayOfYear(currentDate) + 2) % 365 || 1;
      onDateChange(dayToDateStr(nextDay));
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, currentDate, onDateChange]);

  // Current season indicator
  const currentMonthIdx = Math.min(11, Math.floor(currentDay / 30.5));
  const currentSeason = MONTHS[currentMonthIdx]?.season || 'SW MONSOON';

  return (
    <div
      id="bottom-timeline-bar"
      className="fixed bottom-0 left-0 right-0 h-16 bg-[#05080D]/95 border-t border-[#1C2A33] z-30 px-6 flex items-center justify-between backdrop-blur-md select-none gap-4"
    >
      {/* Left: Playback & Date Readout & LIVE NOW Button */}
      <div className="flex items-center gap-3 min-w-[280px]">
        <button
          id="timeline-play-btn"
          onClick={onTogglePlay}
          className={`p-2 border transition-all ${
            isPlaying
              ? 'bg-[#3FE0C7] text-[#05080D] border-[#3FE0C7]'
              : 'bg-[#0A1119] text-[#E8EDF0] border-[#1C2A33] hover:border-[#3FE0C7]'
          }`}
          title={isPlaying ? 'Pause Timeline' : 'Play Seasonal Cycle'}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
        </button>

        {/* LIVE NOW Real-Time Switch */}
        <button
          onClick={() => onDateChange(todayStr)}
          className={`px-2.5 py-1.5 font-space font-bold text-[10px] tracking-wider uppercase border transition-all flex items-center gap-1.5 ${
            isLiveNow
              ? 'bg-[#3FE0C7] text-[#05080D] border-[#3FE0C7] shadow-lg animate-pulse'
              : 'bg-[#0A1119] text-[#6E8391] border-[#1C2A33] hover:text-[#E8EDF0] hover:border-[#3FE0C7]'
          }`}
          title="Switch to Real-Time Satellite Feed (Live Now)"
        >
          <span className={`w-2 h-2 rounded-full ${isLiveNow ? 'bg-[#05080D]' : 'bg-[#3FE0C7] animate-ping'}`} />
          <span>LIVE NOW</span>
        </button>

        <div className="font-data">
          <div className="text-xs font-bold text-[#E8EDF0] tracking-wider flex items-center gap-2">
            <span>{currentDate}</span>
            <span className="text-[10px] text-[#3FE0C7] border border-[#1C2A33] px-1.5 py-0.2">
              {currentSeason}
            </span>
          </div>
          <div className="text-[10px] text-[#6E8391] mt-0.5">
            {isLiveNow ? 'LIVE TELEMETRY STREAM' : `SEASONAL CYCLE (DAY ${currentDay}/365)`}
          </div>
        </div>
      </div>

      {/* Center: Draggable Scrubber Timeline */}
      <div className="flex-1 max-w-2xl flex flex-col justify-center px-4">
        {/* Month ticks */}
        <div className="flex justify-between font-data text-[9px] text-[#6E8391] mb-1.5">
          {MONTHS.map((m) => (
            <button
              key={m.name}
              onClick={() => onDateChange(m.date)}
              className={`hover:text-[#3FE0C7] transition-colors ${
                Math.abs(getDayOfYear(m.date) - currentDay) < 18 ? 'text-[#3FE0C7] font-bold' : ''
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* Custom Range Slider */}
        <div className="relative flex items-center">
          <input
            id="timeline-slider"
            type="range"
            min="1"
            max="365"
            value={currentDay}
            onChange={(e) => onDateChange(dayToDateStr(Number(e.target.value)))}
            className="w-full h-1.5 bg-[#1C2A33] appearance-none cursor-pointer accent-[#3FE0C7] focus:outline-none"
            style={{
              background: `linear-gradient(to right, #3FE0C7 ${(currentDay / 365) * 100}%, #1C2A33 ${(currentDay / 365) * 100}%)`,
            }}
          />
        </div>
      </div>

      {/* Right: Quick Tools & Auto Rotate */}
      <div className="flex items-center gap-3 min-w-[200px] justify-end">
        {/* Auto Rotate Globe Toggle */}
        <button
          id="toggle-autorotate-btn"
          onClick={onToggleAutoRotate}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 font-data text-[11px] border transition-colors ${
            autoRotate
              ? 'bg-[#0A1119] text-[#3FE0C7] border-[#3FE0C7]'
              : 'bg-[#0A1119] text-[#6E8391] border-[#1C2A33] hover:text-[#E8EDF0]'
          }`}
          title="Toggle Globe Slow Rotation"
        >
          <Compass className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '10s' }} />
          <span className="hidden sm:inline">AUTO-ROTATE</span>
        </button>

        {/* Reset date to peak summer monsoon */}
        <button
          id="reset-date-btn"
          onClick={() => onDateChange('2024-08-15')}
          className="p-1.5 text-[#6E8391] hover:text-[#E8EDF0] hover:bg-[#0A1119] border border-[#1C2A33]"
          title="Reset to Peak Monsoon (Aug 15)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
