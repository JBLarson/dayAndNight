// src/Analyze.jsx
import { useEffect, useRef, useState } from 'react';

const Analyze = () => {
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const [sunCalc, setSunCalc] = useState(null);

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
  const [analysisMetrics, setAnalysisMetrics] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('mean'); // mean, variance, extremes

  // Expanded color palette for 10 locations
  const colorPalette = [
    '#FFD700', // Gold
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#95E1D3', // Mint
    '#F38181', // Pink
    '#AA96DA', // Purple
    '#FCBAD3', // Light Pink
    '#A8D8EA', // Sky Blue
    '#FFE66D', // Yellow
    '#C7CEEA'  // Lavender
  ];

  // Load SunCalc
  useEffect(() => {
    if (window.SunCalc) {
      setSunCalc(window.SunCalc);
      return;
    }
    
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/suncalc@1.9.0/suncalc.min.js";
    script.async = true;
    script.onload = () => {
      if(window.SunCalc) {
        setSunCalc(window.SunCalc);
      }
    };
    document.body.appendChild(script);
  }, []);

  // Calculate daylight data for all locations
  useEffect(() => {
    if (!sunCalc) return;

    const newDataMap = {};
    const daysInYear = 365;

    locations.forEach(location => {
      const data = [];

      for (let day = 0; day < daysInYear; day++) {
        const date = new Date(year, 0, 1);
        date.setDate(date.getDate() + day);

        const times = sunCalc.getTimes(date, location.lat, location.lng);
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
  }, [locations, year, sunCalc]);

  // Calculate comprehensive analysis metrics
  useEffect(() => {
    if (!sunCalc || Object.keys(daylightDataMap).length === 0) return;

    const metrics = locations.map(location => {
      const data = daylightDataMap[location.id];
      if (!data) return null;

      const hours = data.map(d => d.daylightHours);
      
      // Basic statistics
      const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
      const min = Math.min(...hours);
      const max = Math.max(...hours);
      const range = max - min;
      
      // Variance and standard deviation
      const variance = hours.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / hours.length;
      const stdDev = Math.sqrt(variance);
      
      // Find days of extremes
      const minDay = data.find(d => d.daylightHours === min);
      const maxDay = data.find(d => d.daylightHours === max);
      
      // Seasonal analysis (split into quarters)
      const q1 = hours.slice(0, 91).reduce((a, b) => a + b, 0) / 91;
      const q2 = hours.slice(91, 182).reduce((a, b) => a + b, 0) / 91;
      const q3 = hours.slice(182, 273).reduce((a, b) => a + b, 0) / 91;
      const q4 = hours.slice(273, 365).reduce((a, b) => a + b, 0) / 92;
      
      // Hemisphere detection (based on which half has more daylight)
      const firstHalf = hours.slice(0, 182).reduce((a, b) => a + b, 0);
      const secondHalf = hours.slice(182, 365).reduce((a, b) => a + b, 0);
      const hemisphere = firstHalf < secondHalf ? 'Northern' : 'Southern';
      
      // Stability score (inverse of variance, normalized 0-100)
      const maxPossibleVariance = Math.pow(12, 2); // Theoretical max
      const stability = Math.max(0, 100 - (variance / maxPossibleVariance * 100));
      
      return {
        locationId: location.id,
        name: location.name,
        color: location.color,
        mean: mean.toFixed(2),
        min: min.toFixed(2),
        max: max.toFixed(2),
        range: range.toFixed(2),
        variance: variance.toFixed(2),
        stdDev: stdDev.toFixed(2),
        minDay: minDay.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        maxDay: maxDay.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        q1: q1.toFixed(2),
        q2: q2.toFixed(2),
        q3: q3.toFixed(2),
        q4: q4.toFixed(2),
        hemisphere,
        stability: stability.toFixed(1)
      };
    }).filter(Boolean);

    // Comparative rankings
    const rankedByMean = [...metrics].sort((a, b) => b.mean - a.mean);
    const rankedByStability = [...metrics].sort((a, b) => b.stability - a.stability);
    const rankedByRange = [...metrics].sort((a, b) => b.range - a.range);

    setAnalysisMetrics({
      individual: metrics,
      rankings: {
        byMean: rankedByMean,
        byStability: rankedByStability,
        byRange: rankedByRange
      },
      global: {
        avgMean: (metrics.reduce((acc, m) => acc + parseFloat(m.mean), 0) / metrics.length).toFixed(2),
        avgStability: (metrics.reduce((acc, m) => acc + parseFloat(m.stability), 0) / metrics.length).toFixed(1)
      }
    });

  }, [daylightDataMap, locations, sunCalc]);

  // Debounced geocoding search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsSearching(true);
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(
        `${API_URL}/api/geocode?q=${encodeURIComponent(searchQuery)}`
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
    if (locations.length >= 10) {
      alert('Maximum 10 locations allowed');
      return;
    }

    const usedColors = locations.map(loc => loc.color);
    const availableColor = colorPalette.find(color => !usedColors.includes(color));
    
    const newColor = availableColor || colorPalette[locations.length % colorPalette.length];

    const newLocation = {
      id: Date.now(),
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
      name: suggestion.display_name.split(',').slice(0, 2).join(','),
      color: newColor
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
    if (!sunCalc || !canvasRef.current || Object.keys(daylightDataMap).length === 0) return;

    const canvas = canvasRef.current;
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
    locations.forEach((location) => {
      const daylightData = daylightDataMap[location.id];
      if (!daylightData) return;

      // Draw filled area with reduced opacity for many locations
      const fillOpacity = locations.length <= 3 ? 0.2 : 0.1;
      ctx.globalAlpha = fillOpacity;
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

      // Draw border line (thinner for many locations)
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
      ctx.lineWidth = locations.length <= 5 ? 2 : 1.5;
      ctx.stroke();
    });

  }, [daylightDataMap, locations, sunCalc]);

  // Draw hover indicator on overlay canvas
  useEffect(() => {
    if (!sunCalc || !overlayCanvasRef.current || Object.keys(daylightDataMap).length === 0) return;

    const canvas = overlayCanvasRef.current;
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
        if (daylightDataMap[location.id] && daylightDataMap[location.id][hoveredDay]) {
          const dayData = daylightDataMap[location.id][hoveredDay];
          const y = height - padding - ((dayData.daylightHours - globalMin) / (globalMax - globalMin)) * graphHeight;

          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = location.color;
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    }
  }, [hoveredDay, daylightDataMap, locations, sunCalc]);

  const handleMouseMove = (e) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padding = 60;
    const graphWidth = canvas.width - (padding * 2);

    if (x >= padding && x <= canvas.width - padding) {
      const day = Math.floor(((x - padding) / graphWidth) * 365);
      setHoveredDay(Math.min(Math.max(day, 0), 364));
    } else {
      setHoveredDay(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  const getHoveredDayInfo = () => {
    if (!sunCalc || hoveredDay === null || Object.keys(daylightDataMap).length === 0 || !locations[0]) return null;

    const firstLocation = locations[0];
    const firstLocationData = daylightDataMap[firstLocation.id];

    if (!firstLocationData || hoveredDay >= firstLocationData.length || hoveredDay < 0) return null;

    const dayData = firstLocationData[hoveredDay];

    return {
      date: dayData.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
      locationData: locations.map(loc => {
        if (!daylightDataMap[loc.id] || !daylightDataMap[loc.id][hoveredDay]) {
          return { name: loc.name, color: loc.color, sunrise: 'N/A', sunset: 'N/A', daylight: 'N/A' };
        }
        
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

  if (!sunCalc) {
    return (
      <div className="daylight-viz" style={{ textAlign: 'center', padding: '5rem' }}>
        <div className="header">
          <h1>Comprehensive Daylight Analysis</h1>
          <p className="subtitle" style={{color: '#ffd700'}}>Loading SunCalc Library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="daylight-viz">
      <div className="header">
        <h1>Comprehensive Daylight Analysis</h1>
        <p className="subtitle">Compare up to 10 locations with advanced metrics</p>
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
        {locations.map((location) => (
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

      {/* COMPREHENSIVE ANALYSIS SECTION */}
      {analysisMetrics && (
        <div className="analysis-section" style={{ marginTop: '2rem' }}>
          <div className="header" style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Statistical Analysis</h2>
            <p className="subtitle">Comparative metrics across all locations</p>
          </div>

          {/* Metric Selector */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
            <button
              onClick={() => setSelectedMetric('mean')}
              className={`metric-btn ${selectedMetric === 'mean' ? 'active' : ''}`}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '2px solid',
                borderColor: selectedMetric === 'mean' ? '#FFD700' : '#2a2a3e',
                background: selectedMetric === 'mean' ? '#FFD700' : '#1a1a2e',
                color: selectedMetric === 'mean' ? '#000' : '#e0e0e0',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Average Daylight
            </button>
            <button
              onClick={() => setSelectedMetric('stability')}
              className={`metric-btn ${selectedMetric === 'stability' ? 'active' : ''}`}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '2px solid',
                borderColor: selectedMetric === 'stability' ? '#4ECDC4' : '#2a2a3e',
                background: selectedMetric === 'stability' ? '#4ECDC4' : '#1a1a2e',
                color: selectedMetric === 'stability' ? '#000' : '#e0e0e0',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Stability
            </button>
            <button
              onClick={() => setSelectedMetric('extremes')}
              className={`metric-btn ${selectedMetric === 'extremes' ? 'active' : ''}`}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '2px solid',
                borderColor: selectedMetric === 'extremes' ? '#FF6B6B' : '#2a2a3e',
                background: selectedMetric === 'extremes' ? '#FF6B6B' : '#1a1a2e',
                color: selectedMetric === 'extremes' ? '#000' : '#e0e0e0',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Extremes
            </button>
          </div>

          {/* Detailed Metrics Table */}
          <div className="info-panel" style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>
              {selectedMetric === 'mean' && 'Average Annual Daylight Rankings'}
              {selectedMetric === 'stability' && 'Daylight Consistency Rankings'}
              {selectedMetric === 'extremes' && 'Seasonal Variation Analysis'}
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #2a2a3e' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Rank</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Location</th>
                    {selectedMetric === 'mean' && (
                      <>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Avg Daylight</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Hemisphere</th>
                      </>
                    )}
                    {selectedMetric === 'stability' && (
                      <>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Stability Score</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Std Dev</th>
                      </>
                    )}
                    {selectedMetric === 'extremes' && (
                      <>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Min</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Max</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Range</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {selectedMetric === 'mean' && analysisMetrics.rankings.byMean.map((metric, idx) => (
                    <tr key={metric.locationId} style={{ borderBottom: '1px solid #2a2a3e' }}>
                      <td style={{ padding: '0.75rem' }}>#{idx + 1}</td>
                      <td style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: metric.color }}></div>
                        {metric.name}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '500' }}>{metric.mean}h</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#888' }}>{metric.hemisphere}</td>
                    </tr>
                  ))}
                  
                  {selectedMetric === 'stability' && analysisMetrics.rankings.byStability.map((metric, idx) => (
                    <tr key={metric.locationId} style={{ borderBottom: '1px solid #2a2a3e' }}>
                      <td style={{ padding: '0.75rem' }}>#{idx + 1}</td>
                      <td style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: metric.color }}></div>
                        {metric.name}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '500' }}>{metric.stability}/100</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#888' }}>{metric.stdDev}h</td>
                    </tr>
                  ))}
                  
                  {selectedMetric === 'extremes' && analysisMetrics.rankings.byRange.map((metric, idx) => (
                    <tr key={metric.locationId} style={{ borderBottom: '1px solid #2a2a3e' }}>
                      <td style={{ padding: '0.75rem' }}>#{idx + 1}</td>
                      <td style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: metric.color }}></div>
                        {metric.name}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{metric.min}h</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{metric.max}h</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '500' }}>{metric.range}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Individual Location Deep Dive */}
          <div className="info-panel">
            <h3 style={{ marginBottom: '1rem' }}>Detailed Location Metrics</h3>
            <div className="location-data-grid">
              {analysisMetrics.individual.map((metric) => (
                <div key={metric.locationId} className="location-data-card" style={{ borderLeft: `4px solid ${metric.color}` }}>
                  <div className="location-data-name">{metric.name}</div>
                  <div className="location-data-details">
                    <div className="data-row">
                      <span className="label">Hemisphere</span>
                      <span className="value">{metric.hemisphere}</span>
                    </div>
                    <div className="data-row">
                      <span className="label">Avg Annual</span>
                      <span className="value">{metric.mean}h</span>
                    </div>
                    <div className="data-row">
                      <span className="label">Range</span>
                      <span className="value">{metric.min}h - {metric.max}h</span>
                    </div>
                    <div className="data-row">
                      <span className="label">Shortest Day</span>
                      <span className="value">{metric.minDay}</span>
                    </div>
                    <div className="data-row">
                      <span className="label">Longest Day</span>
                      <span className="value">{metric.maxDay}</span>
                    </div>
                    <div className="data-row">
                      <span className="label">Stability</span>
                      <span className="value">{metric.stability}/100</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Global Summary */}
          <div className="info-panel" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1rem' }}>Global Summary</h3>
            <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', fontSize: '1.1rem' }}>
              <div>
                <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Average Mean Daylight
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FFD700' }}>
                  {analysisMetrics.global.avgMean}h
                </div>
              </div>
              <div>
                <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Average Stability Score
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4ECDC4' }}>
                  {analysisMetrics.global.avgStability}/100
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analyze;