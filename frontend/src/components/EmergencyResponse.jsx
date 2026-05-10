import { useState, useEffect } from 'react';

export default function EmergencyResponse({ confidence, onBack }) {
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState({ lat: 12.9716, lng: 77.5946 }); 
  const [locationError, setLocationError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [realHospitals, setRealHospitals] = useState([]);

  // Haversine formula to calculate distance
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  };

  const fetchNearbyHospitals = async (lat, lng) => {
    try {
      const query = `[out:json];node["amenity"="hospital"](around:5000,${lat},${lng});out;`;
      const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      const hospitals = data.elements.map(el => ({
        id: el.id,
        name: el.tags.name || "Unnamed Medical Center",
        distance: `${calculateDistance(lat, lng, el.lat, el.lon)} km`,
        status: Math.random() > 0.3 ? "Available" : "Busy", // Simulation of live status
        phone: el.tags['contact:phone'] || el.tags.phone || "108",
        type: el.tags.speciality ? `Specialist (${el.tags.speciality})` : "General Hospital",
        lat: el.lat,
        lon: el.lon
      })).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

      setRealHospitals(hospitals.slice(0, 5)); // Show top 5
    } catch (err) {
      console.error("Failed to fetch hospitals:", err);
      // Fallback to minimal info if API fails
      setRealHospitals([
        { id: 'f1', name: "Nearby Medical Emergency", distance: "Unknown", status: "Available", phone: "108", type: "General" }
      ]);
    }
  };

  const getRealLocation = () => {
    setIsRetrying(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(newCoords);
          setLocationError(false);
          fetchNearbyHospitals(newCoords.lat, newCoords.lng).then(() => {
            setLoading(false);
            setIsRetrying(false);
          });
        },
        (err) => {
          console.error("Location error:", err);
          setLocationError(true);
          setLoading(false);
          setIsRetrying(false);
          fetchNearbyHospitals(coords.lat, coords.lng); // Use default
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLoading(false);
      setIsRetrying(false);
      fetchNearbyHospitals(coords.lat, coords.lng);
    }
  };

  useEffect(() => {
    getRealLocation();
  }, []);

  if (loading) {
    return (
      <div className="emergency-loader">
        <div className="heart-rate">
          <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="200px" height="100px" viewBox="0 0 200 100">
            <polyline className="back" points="0,50 35,50 45,10 55,90 65,50 100,50" />
            <polyline className="front" points="0,50 35,50 45,10 55,90 65,50 100,50" />
          </svg>
        </div>
        <h3>Scanning Local Health Network...</h3>
        <p>Identifying nearest emergency facilities based on your GPS.</p>
      </div>
    );
  }

  const embedUrl = `https://maps.google.com/maps?q=hospital+near+${coords.lat},${coords.lng}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="emergency-view-wrapper">
      <div className="emergency-sidebar">
        <div className="sidebar-header">
          <button className="back-btn-minimal" onClick={onBack}>
            <i className="ph ph-caret-left"></i> Exit Emergency View
          </button>
          <div className="critical-tag">
            <span className="dot-blink"></span>
            CRITICAL DETECTION
          </div>
        </div>

        <div className="alert-hero-card">
          <div className="alert-hero-icon">
            <i className="ph ph-warning-octagon"></i>
          </div>
          <h1>Malaria Detected</h1>
          <div className="alert-confidence">{confidence}% Confidence</div>
          <p>
            Real-time scan complete. The following facilities are currently closest to your GPS coordinates.
          </p>
        </div>

        {locationError && (
          <div className="location-warning-box">
            <i className="ph ph-warning"></i>
            <div>
              <p>GPS link failed. Using default region hospitals.</p>
              <button onClick={getRealLocation} disabled={isRetrying}>
                {isRetrying ? 'Connecting...' : 'Retry GPS Link'}
              </button>
            </div>
          </div>
        )}

        <div className="hospitals-scroller">
          <div className="scroller-header">
            <h3><i className="ph ph-buildings"></i> Live Hospital List</h3>
            <button className="refresh-loc-btn" onClick={getRealLocation} title="Refresh Live Data">
              <i className={`ph ph-arrows-clockwise ${isRetrying ? 'spin' : ''}`}></i>
            </button>
          </div>
          
          {realHospitals.map(h => (
            <div key={h.id} className="hosp-card-new">
              <div className="hosp-card-main">
                <div className="hosp-icon"><i className="ph ph-first-aid"></i></div>
                <div className="hosp-details">
                  <h4>{h.name}</h4>
                  <p>{h.type} • {h.distance}</p>
                </div>
                <div className={`hosp-status ${h.status.toLowerCase()}`}>{h.status}</div>
              </div>
              <div className="hosp-card-footer">
                <a href={`tel:${h.phone}`} className="hosp-call-btn">
                  <i className="ph ph-phone"></i> Contact
                </a>
                <button className="hosp-dir-btn" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lon}&origin=${coords.lat},${coords.lng}`, '_blank')}>
                  <i className="ph ph-navigation-arrow"></i> Route
                </button>
              </div>
            </div>
          ))}

          {realHospitals.length === 0 && (
            <p className="empty-history">No hospitals found within 5km of your location.</p>
          )}
        </div>

        <div className="emergency-footer-actions">
          <button className="ambulance-btn-red" onClick={() => window.open('tel:108')}>
            <i className="ph ph-ambulance"></i> Dispatch Emergency Ambulance (108)
          </button>
        </div>
      </div>

      <div className="emergency-map-main">
        <div className="map-overlay-info">
          <i className="ph ph-crosshair"></i> {locationError ? 'Region View' : 'Live GPS Sync Active'}
        </div>
        <iframe
          title="Google Maps"
          width="100%"
          height="100%"
          frameBorder="0"
          style={{ border: 0 }}
          src={embedUrl}
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
}

