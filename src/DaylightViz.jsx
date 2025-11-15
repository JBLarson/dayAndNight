import { useEffect, useRef, useState } from 'react';
import SunCalc from 'suncalc';

const DaylightViz = () => {
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  
  const [locations, setLocations] = useState([
    {
      id: 1,
      lat: 33.7879,
      lng: -117.8531,
      name: 'Orange, CA',
      color: '#FFD700'
    }
  ]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hoveredDay, setHoveredDay] = useState(null);
  const [year] = useState(2025);
  const [daylightDataMap, setDaylightDataMap] = useState({});
  
  // Color palette for up to 5 locations
  const colorPalette = ['#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181'];
  
  // Calculate daylight data for all locations
  useEffect(() => {
    const newDataMap = {};
    const daysInYear = 365;
    
    locations.forEach(location => {
      const data = [];
      
      for (let day = 0; day < daysInYear; day++) {
        const date = new Date(year, 0, 1);
        date.setDate(date.getDate() + day);
        
        const times = SunCalc.getTimes(date, location.lat, location.lng);
        const sunrise = times.sunrise;
        const sunset = times.sunset;
        
        const daylightMs = sunset - sunrise;
        const daylightHours = daylightMs / (1000 * 60 * 60);
        
        data.push({
          day,
          date,
          daylightHours,
          sunrise,
          sunset
        });
      }
      
      newDataMap[location.id] = data;
    });
    
    setDaylightDataMap(newDataMap);
  }, [locations, year]);
  
  // Debounced geocoding search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      try {
        setIsSearching(true);
        // Hit our backend instead of Nominatim directly
        const response = await fetch(
          `http://localhost:3001/api/geocode?q=${encodeURIComponent(searchQuery)}`
        );
        const data = await response.json();
        setSuggestions(data);
      } catch (error) {
        console.error('Geocoding error:', error);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);
  
  const addLocation = (suggestion) => {
    if (locations.length >= 5) {
      alert('Maximum 5 locations allowed');
      return;
    }
    
    const newLocation = {
      id: Date.now(),
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
      name: suggestion.display_name.split(',').slice(0, 2).join(','),
      color: colorPalette[locations.length]
    };
    
    setLocations([...locations, newLocation]);
    setSearchQuery('');
    setSuggestions([]);
  };
  
  const removeLocation = (id) => {
    if (locations.length === 1) {
      alert('At least one location required');
      return;
    }
    setLocations(locations.filter(loc => loc.id !== id));
  };
  
  // Draw static visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || Object.keys(daylightDataMap).length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 60;
    const graphWidth = width - (padding * 2);
    const graphHeight = height - (padding * 2);
    const daysInYear = 365;

    // Get global min/max across all locations
    let globalMin = Infinity;
    let globalMax = -Infinity;
    
    Object.values(daylightDataMap).forEach(data => {
      const min = Math.min(...data.map(d => d.daylightHours));
      const max = Math.max(...data.map(d => d.daylightHours));
      globalMin = Math.min(globalMin, min);
      globalMax = Math.max(globalMax, max);
    });

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

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
    for (let hours = Math.ceil(globalMin); hours <= Math.floor(globalMax); hours += 2) {
      const y = height - padding - ((hours - globalMin) / (globalMax - globalMin)) * graphHeight;
      
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      
      ctx.textAlign = 'right';
      ctx.fillText(`${hours}h`, padding - 10, y + 4);
    }

    // Draw each location's curve
    locations.forEach((location, idx) => {
      const daylightData = daylightDataMap[location.id];
      if (!daylightData) return;

      // Draw filled area
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(padding, height - padding);

      daylightData.forEach((d, i) => {
        const x = padding + (i / daysInYear) * graphWidth;
        const y = height - padding - ((d.daylightHours - globalMin) / (globalMax - globalMin)) * graphHeight;
        ctx.lineTo(x, y);
      });

      ctx.lineTo(width - padding, height - padding);
      ctx.closePath();
      ctx.fillStyle = location.color;
      ctx.fill();

      // Draw border line
      ctx.globalAlpha = 1;
      ctx.beginPath();
      daylightData.forEach((d, i) => {
        const x = padding + (i / daysInYear) * graphWidth;
        const y = height - padding - ((d.daylightHours - globalMin) / (globalMax - globalMin)) * graphHeight;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.strokeStyle = location.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Mark solstices and equinoxes for first location only
    const markerDates = [
      { day: 79, name: 'Spring Equinox', color: '#7FFF00' },
      { day: 171, name: 'Summer Solstice', color: '#FFD700' },
      { day: 265, name: 'Fall Equinox', color: '#FFA500' },
      { day: 355, name: 'Winter Solstice', color: '#4169E1' }
    ];

    const firstLocationData = daylightDataMap[locations[0].id];
    if (firstLocationData) {
      markerDates.forEach(marker => {
        const x = padding + (marker.day / daysInYear) * graphWidth;
        const dayData = firstLocationData[marker.day];
        const y = height - padding - ((dayData.daylightHours - globalMin) / (globalMax - globalMin)) * graphHeight;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = marker.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

  }, [daylightDataMap, locations]);

  // Draw hover indicator on overlay canvas
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || Object.keys(daylightDataMap).length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 60;
    const graphWidth = width - (padding * 2);
    const graphHeight = height - (padding * 2);
    const daysInYear = 365;

    // Get global min/max
    let globalMin = Infinity;
    let globalMax = -Infinity;
    
    Object.values(daylightDataMap).forEach(data => {
      const min = Math.min(...data.map(d => d.daylightHours));
      const max = Math.max(...data.map(d => d.daylightHours));
      globalMin = Math.min(globalMin, min);
      globalMax = Math.max(globalMax, max);
    });

    // Clear overlay
    ctx.clearRect(0, 0, width, height);

    if (hoveredDay !== null) {
      const x = padding + (hoveredDay / daysInYear) * graphWidth;

      // Vertical line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight points for each location
      locations.forEach(location => {
        const dayData = daylightDataMap[location.id][hoveredDay];
        const y = height - padding - ((dayData.daylightHours - globalMin) / (globalMax - globalMin)) * graphHeight;

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = location.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }
  }, [hoveredDay, daylightDataMap, locations]);

  const handleMouseMove = (e) => {
    const canvas = overlayCanvasRef.current;
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
    if (hoveredDay === null || Object.keys(daylightDataMap).length === 0) return null;
    
    const firstLocation = locations[0];
    const firstLocationData = daylightDataMap[firstLocation.id];
    
    // Bounds check - ensure hoveredDay is within array bounds
    if (!firstLocationData || hoveredDay >= firstLocationData.length || hoveredDay < 0) return null;
    
    const dayData = firstLocationData[hoveredDay];
    
    return {
      date: dayData.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
      locationData: locations.map(loc => {
        const data = daylightDataMap[loc.id][hoveredDay];
        const daylightMs = data.sunset - data.sunrise;
        const daylightHours = Math.floor(daylightMs / (1000 * 60 * 60));
        const daylightMinutes = Math.floor((daylightMs % (1000 * 60 * 60)) / (1000 * 60));
        
        return {
          name: loc.name,
          color: loc.color,
          sunrise: data.sunrise.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          sunset: data.sunset.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          daylight: `${daylightHours}h ${daylightMinutes}m`
        };
      })
    };
  };

  const hoveredInfo = getHoveredDayInfo();

  return (
    <div className="daylight-viz">
      <div className="header">
        <h1>Annual Daylight Visualization</h1>
        <p className="subtitle">Compare daylight patterns across multiple locations</p>
      </div>

      <div className="search-section">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search for a city or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {isSearching && <span className="search-loading">Searching...</span>}
          {suggestions.length > 0 && (
            <div className="suggestions-dropdown">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className="suggestion-item"
                  onClick={() => addLocation(suggestion)}
                >
                  {suggestion.display_name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="locations-list">
        {locations.map((location, idx) => (
          <div key={location.id} className="location-chip" style={{ borderLeft: `4px solid ${location.color}` }}>
            <div className="location-info">
              <div className="location-name">{location.name}</div>
              <div className="location-coords">
                {location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°
              </div>
            </div>
            {locations.length > 1 && (
              <button
                className="remove-btn"
                onClick={() => removeLocation(location.id)}
                aria-label="Remove location"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="canvas-container">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <canvas
            ref={canvasRef}
            width={1200}
            height={500}
          />
          <canvas
            ref={overlayCanvasRef}
            width={1200}
            height={500}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              cursor: 'crosshair',
              pointerEvents: 'all'
            }}
          />
        </div>
      </div>

      {hoveredInfo && (
        <div className="info-panel">
          <h3>{hoveredInfo.date}</h3>
          <div className="location-data-grid">
            {hoveredInfo.locationData.map((data, idx) => (
              <div key={idx} className="location-data-card" style={{ borderLeft: `4px solid ${data.color}` }}>
                <div className="location-data-name">{data.name}</div>
                <div className="location-data-details">
                  <div className="data-row">
                    <span className="label">Sunrise</span>
                    <span className="value">{data.sunrise}</span>
                  </div>
                  <div className="data-row">
                    <span className="label">Sunset</span>
                    <span className="value">{data.sunset}</span>
                  </div>
                  <div className="data-row">
                    <span className="label">Daylight</span>
                    <span className="value">{data.daylight}</span>
                  </div>
                </div>
              </div>
            ))}
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