import { useEffect, useRef, useState } from 'react';
import SunCalc from 'suncalc';

const DaylightViz = () => {
  const canvasRef = useRef(null);
  const [location, setLocation] = useState({
    lat: 33.7879,  // Orange, CA
    lng: -117.8531,
    name: 'Orange, CA'
  });
  const [hoveredDay, setHoveredDay] = useState(null);
  const [year] = useState(2025);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate daylight data for entire year
    const daylightData = [];
    const daysInYear = 365;
    
    for (let day = 0; day < daysInYear; day++) {
      const date = new Date(year, 0, 1);
      date.setDate(date.getDate() + day);
      
      const times = SunCalc.getTimes(date, location.lat, location.lng);
      const sunrise = times.sunrise;
      const sunset = times.sunset;
      
      // Calculate daylight duration in hours
      const daylightMs = sunset - sunrise;
      const daylightHours = daylightMs / (1000 * 60 * 60);
      
      daylightData.push({
        day,
        date,
        daylightHours,
        sunrise,
        sunset
      });
    }

    // Find min and max for scaling
    const maxDaylight = Math.max(...daylightData.map(d => d.daylightHours));
    const minDaylight = Math.min(...daylightData.map(d => d.daylightHours));

    // Draw visualization
    const padding = 60;
    const graphWidth = width - (padding * 2);
    const graphHeight = height - (padding * 2);

    // Draw background gradient
    const bgGradient = ctx.createLinearGradient(0, padding, 0, height - padding);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(1, '#0f0f1e');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines and labels
    ctx.strokeStyle = '#333344';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#888899';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    // Vertical grid (months)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.forEach((month, i) => {
      const x = padding + (graphWidth / 12) * (i + 0.5);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
      
      ctx.fillText(month, x, height - padding + 20);
    });

    // Horizontal grid (hours)
    for (let hours = 8; hours <= 16; hours += 2) {
      const y = height - padding - ((hours - minDaylight) / (maxDaylight - minDaylight)) * graphHeight;
      
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      
      ctx.textAlign = 'right';
      ctx.fillText(`${hours}h`, padding - 10, y + 4);
    }

    // Draw daylight curve with gradient
    const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(0.5, '#FFA500');
    gradient.addColorStop(1, '#FF6B35');

    ctx.beginPath();
    ctx.moveTo(padding, height - padding);

    // Draw filled area
    daylightData.forEach((d, i) => {
      const x = padding + (i / daysInYear) * graphWidth;
      const y = height - padding - ((d.daylightHours - minDaylight) / (maxDaylight - minDaylight)) * graphHeight;
      
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.lineTo(width - padding, height - padding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.6;
    ctx.fill();

    // Draw border line
    ctx.globalAlpha = 1;
    ctx.beginPath();
    daylightData.forEach((d, i) => {
      const x = padding + (i / daysInYear) * graphWidth;
      const y = height - padding - ((d.daylightHours - minDaylight) / (maxDaylight - minDaylight)) * graphHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Mark solstices and equinoxes
    const markerDates = [
      { day: 79, name: 'Spring Equinox', color: '#7FFF00' },
      { day: 171, name: 'Summer Solstice', color: '#FFD700' },
      { day: 265, name: 'Fall Equinox', color: '#FFA500' },
      { day: 355, name: 'Winter Solstice', color: '#4169E1' }
    ];

    markerDates.forEach(marker => {
      const x = padding + (marker.day / daysInYear) * graphWidth;
      const dayData = daylightData[marker.day];
      const y = height - padding - ((dayData.daylightHours - minDaylight) / (maxDaylight - minDaylight)) * graphHeight;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = marker.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw hovered day indicator
    if (hoveredDay !== null) {
      const x = padding + (hoveredDay / daysInYear) * graphWidth;
      const dayData = daylightData[hoveredDay];
      const y = height - padding - ((dayData.daylightHours - minDaylight) / (maxDaylight - minDaylight)) * graphHeight;

      // Vertical line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight point
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }

  }, [location, hoveredDay, year]);

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padding = 60;
    const graphWidth = canvas.width - (padding * 2);
    
    if (x >= padding && x <= canvas.width - padding) {
      const day = Math.floor(((x - padding) / graphWidth) * 365);
      setHoveredDay(day);
    } else {
      setHoveredDay(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  const getHoveredDayInfo = () => {
    if (hoveredDay === null) return null;
    
    const date = new Date(year, 0, 1);
    date.setDate(date.getDate() + hoveredDay);
    
    const times = SunCalc.getTimes(date, location.lat, location.lng);
    const sunrise = times.sunrise;
    const sunset = times.sunset;
    const daylightMs = sunset - sunrise;
    const daylightHours = Math.floor(daylightMs / (1000 * 60 * 60));
    const daylightMinutes = Math.floor((daylightMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
      date: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
      sunrise: sunrise.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      sunset: sunset.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      daylight: `${daylightHours}h ${daylightMinutes}m`
    };
  };

  const hoveredInfo = getHoveredDayInfo();

  return (
    <div className="daylight-viz">
      <div className="header">
        <h1>Annual Daylight Visualization</h1>
        <div className="location-info">
          <span>{location.name}</span>
          <span className="coords">
            {location.lat.toFixed(4)}°N, {Math.abs(location.lng).toFixed(4)}°W
          </span>
        </div>
      </div>

      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          width={1200}
          height={500}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {hoveredInfo && (
        <div className="info-panel">
          <h3>{hoveredInfo.date}</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Sunrise</span>
              <span className="value">{hoveredInfo.sunrise}</span>
            </div>
            <div className="info-item">
              <span className="label">Sunset</span>
              <span className="value">{hoveredInfo.sunset}</span>
            </div>
            <div className="info-item">
              <span className="label">Daylight</span>
              <span className="value">{hoveredInfo.daylight}</span>
            </div>
          </div>
        </div>
      )}

      <div className="legend">
        <div className="legend-item">
          <div className="marker" style={{ backgroundColor: '#7FFF00' }}></div>
          <span>Spring Equinox</span>
        </div>
        <div className="legend-item">
          <div className="marker" style={{ backgroundColor: '#FFD700' }}></div>
          <span>Summer Solstice</span>
        </div>
        <div className="legend-item">
          <div className="marker" style={{ backgroundColor: '#FFA500' }}></div>
          <span>Fall Equinox</span>
        </div>
        <div className="legend-item">
          <div className="marker" style={{ backgroundColor: '#4169E1' }}></div>
          <span>Winter Solstice</span>
        </div>
      </div>
    </div>
  );
};

export default DaylightViz;
