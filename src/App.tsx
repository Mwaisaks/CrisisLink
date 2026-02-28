import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { 
  AlertTriangle, 
  Map as MapIcon, 
  Shield, 
  Settings, 
  Plus, 
  Info, 
  CheckCircle, 
  Clock,
  Navigation,
  Phone,
  Heart,
  LayoutDashboard,
  Users,
  ClipboardList,
  XCircle,
  ExternalLink,
  Eye,
  Filter,
  Search,
  ChevronRight,
  X,
  Flag,
  Loader2,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import { cn, CRISIS_TYPES } from './constants';
import { classifyCrisis, moderateComment, searchNearbyOrgs } from './services/geminiService';
import { Alert, SeverityTier } from './types';

const DEFAULT_LAT = -1.2921;
const DEFAULT_LNG = 36.8219;

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const getMarkerIcon = (severity: string) => {
  const color = severity.includes('Tier 1') ? '#ef4444' : 
                severity.includes('Tier 2') ? '#f59e0b' : '#10b981';
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// --- Components ---

const Button = ({ className, variant = 'primary', ...props }: any) => {
  const variants: any = {
    primary: 'bg-black text-white hover:bg-zinc-800',
    secondary: 'bg-zinc-100 text-black hover:bg-zinc-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-zinc-200 hover:bg-zinc-50'
  };
  return (
    <button 
      className={cn('px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50', variants[variant], className)} 
      {...props} 
    />
  );
};

const Card = ({ children, className }: any) => (
  <div className={cn('bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden', className)}>
    {children}
  </div>
);

// --- Pages ---

const LandingPage = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/alerts')
      .then(res => res.json())
      .then(data => {
        setAlerts(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-8">
      <section className="text-center py-12 space-y-4">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900">
          Community <span className="text-red-600">Crisis</span> Alert
        </h1>
        <p className="text-xl text-zinc-500 max-w-2xl mx-auto">
          Real-time reporting and coordination for community emergencies. 
          Every second counts.
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <Link to="/report">
            <Button className="px-8 py-4 text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Report a Crisis
            </Button>
          </Link>
          <Link to="/map">
            <Button variant="secondary" className="px-8 py-4 text-lg flex items-center gap-2">
              <MapIcon className="w-5 h-5" />
              View Alert Map
            </Button>
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 space-y-2">
          <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg">AI Triage</h3>
          <p className="text-zinc-500 text-sm">Immediate severity classification and safety guidance for reporters.</p>
        </Card>
        <Card className="p-6 space-y-2">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
            <Navigation className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg">Proximity Dispatch</h3>
          <p className="text-zinc-500 text-sm">Automatic notification of the nearest relevant emergency responders.</p>
        </Card>
        <Card className="p-6 space-y-2">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
            <Heart className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg">Community Support</h3>
          <p className="text-zinc-500 text-sm">Direct links to verified donation and contribution channels for active crises.</p>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Recent Alerts</h2>
          <Link to="/map" className="text-sm text-zinc-500 hover:text-black">View all</Link>
        </div>
        {loading ? (
          <div className="h-40 flex items-center justify-center text-zinc-400">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="h-40 border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center text-zinc-400">
            No active crises reported in your area.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.slice(0, 4).map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const AlertCard = ({ alert }: any) => {
  const severityColors: any = {
    'Tier 1 — Critical': 'bg-red-50 text-red-700 border-red-100',
    'Tier 2 — High': 'bg-orange-50 text-orange-700 border-orange-100',
    'Tier 3 — Moderate': 'bg-blue-50 text-blue-700 border-blue-100',
  };

  return (
    <Card className="p-4 flex gap-4">
      <div className={cn("w-2 self-stretch rounded-full", 
        alert.severity === 'Tier 1 — Critical' ? 'bg-red-500' : 
        alert.severity === 'Tier 2 — High' ? 'bg-orange-500' : 'bg-blue-500'
      )} />
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border", severityColors[alert.severity])}>
              {alert.severity}
            </span>
            <h4 className="font-bold text-lg mt-1">{alert.type}</h4>
          </div>
          <span className="text-xs text-zinc-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-sm text-zinc-600 line-clamp-2">{alert.description}</p>
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            {alert.verified ? (
              <span className="text-[10px] flex items-center gap-1 text-emerald-600 font-bold uppercase">
                <CheckCircle className="w-3 h-3" /> Verified
              </span>
            ) : (
              <span className="text-[10px] text-zinc-400 font-bold uppercase">Unverified</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/alert/${alert.id}`}>
              <Button variant="outline" className="text-xs py-1 h-8">View Details</Button>
            </Link>
            <Link to={`/donate?alertId=${alert.id}`}>
              <Button variant="primary" className="text-xs py-1 h-8 flex items-center gap-1">
                <Heart className="w-3 h-3" /> Donate
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
};

const ReporterDetailsForm = ({ alertId }: { alertId: string }) => {
  const [formData, setFormData] = useState({ name: '', phone: '', notes: '' });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetch(`/api/alerts/${alertId}/reporter-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      setIsSubmitted(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="p-6 bg-emerald-50 border-emerald-100 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-600" />
        <p className="text-sm font-medium text-emerald-800">Your details have been shared with responding organisations.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-xl font-bold">Share your contact details (optional)</h3>
        <p className="text-sm text-zinc-500">This helps responders reach you directly. You are not required to provide this.</p>
      </div>
      <Card className="p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Your name"
              className="w-full p-3 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-black outline-none text-sm"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
            <input
              type="tel"
              placeholder="Your phone number"
              className="w-full p-3 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-black outline-none text-sm"
              value={formData.phone}
              onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            />
          </div>
          <textarea
            placeholder="Any other details that might help responders — e.g. I am at the blue gate, second house on the left"
            rows={3}
            className="w-full p-3 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-black outline-none text-sm"
            value={formData.notes}
            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Sending...' : 'Send details to responders'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

const NearbyOrganisations = ({ alertId }: { alertId: string }) => {
  const [dispatchedOrgs, setDispatchedOrgs] = useState<any[]>([]);
  const [overpassPlaces, setOverpassPlaces] = useState<any[]>([]);
  const [webOrgs, setWebOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<Alert | null>(null);

  const NATIONAL_CONTACTS = [
    { name: 'National Emergency Response', type: 'Emergency Line', phone: '999', website: '', email: '' },
    { name: 'Red Cross Society', type: 'NGO', phone: '+254 703 037000', website: 'https://www.redcross.or.ke', email: 'info@redcross.or.ke' },
    { name: 'St. John Ambulance', type: 'Emergency Service', phone: '+254 721 225285', website: 'https://www.stjohnkenya.org', email: 'info@stjohnkenya.org' }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Alert Details
        const alertRes = await fetch(`/api/admin/alerts/${alertId}/details`);
        const alertData = await alertRes.json();
        setAlert(alertData);

        // 2. Fetch Dispatched Orgs (Subsection A)
        const dispatchedRes = await fetch(`/api/alerts/${alertId}/dispatched-orgs`);
        const dispatchedData = await dispatchedRes.json();
        setDispatchedOrgs(dispatchedData);

        // 3. Fetch Overpass Places (Subsection B)
        const fetchOverpass = async () => {
          const { latitude, longitude, type } = alertData;
          let amenityQuery = '';
          
          if (type.includes('Medical')) {
            amenityQuery = 'node["amenity"="hospital"](around:5000,${lat},${lng});node["amenity"="clinic"](around:5000,${lat},${lng});node["amenity"="pharmacy"](around:5000,${lat},${lng});';
          } else if (type.includes('Fire')) {
            amenityQuery = 'node["amenity"="fire_station"](around:5000,${lat},${lng});';
          } else if (type.includes('Flood') || type.includes('Disaster') || type.includes('Drought')) {
            amenityQuery = 'node["office"="ngo"](around:5000,${lat},${lng});node["office"="government"](around:5000,${lat},${lng});node["amenity"="social_facility"](around:5000,${lat},${lng});node[name~"Red Cross",i](around:5000,${lat},${lng});';
          } else if (type.includes('Violence') || type.includes('Missing')) {
            amenityQuery = 'node["amenity"="police"](around:5000,${lat},${lng});';
          } else if (type.includes('Wildfire')) {
            amenityQuery = 'node["amenity"="fire_station"](around:5000,${lat},${lng});node["office"="government"](around:5000,${lat},${lng});';
          } else if (type.includes('Infrastructure')) {
            amenityQuery = 'node["office"="government"](around:5000,${lat},${lng});node["amenity"="townhall"](around:5000,${lat},${lng});';
          } else {
            amenityQuery = 'node["amenity"~"hospital|police|fire_station"](around:5000,${lat},${lng});';
          }

          const query = `
            [out:json][timeout:8];
            (
              ${amenityQuery.replace(/\${lat}/g, latitude.toString()).replace(/\${lng}/g, longitude.toString())}
            );
            out body;
          `;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          try {
            const response = await fetch('https://overpass-api.de/api/interpreter', {
              method: 'POST',
              body: query,
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = await response.json();
            const places = data.elements.map((el: any) => ({
              name: el.tags.name || 'Unnamed Facility',
              type: el.tags.amenity || el.tags.office || 'Service',
              phone: el.tags.phone || el.tags['contact:phone'],
              email: el.tags.email || el.tags['contact:email'],
              website: el.tags.website || el.tags['contact:website'],
              lat: el.lat,
              lng: el.lon,
              distance: haversineDistance(latitude, longitude, el.lat, el.lon)
            })).sort((a: any, b: any) => a.distance - b.distance);
            setOverpassPlaces(places);
          } catch (e) {
            console.warn('Overpass timeout or error:', e);
          }
        };

        // 4. Fetch Web Search Results (Subsection C)
        const fetchWebSearch = async () => {
          try {
            const results = await searchNearbyOrgs(alertData.type, alertData.address_area || alertData.address_city || 'nearby');
            setWebOrgs(results);
          } catch (e) {
            console.warn('Web search failed:', e);
          }
        };

        await Promise.allSettled([fetchOverpass(), fetchWebSearch()]);

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [alertId]);

  const hasAnyResults = dispatchedOrgs.length > 0 || overpassPlaces.length > 0 || webOrgs.length > 0;

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center gap-4 text-zinc-400">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-black rounded-full animate-spin" />
        <p className="text-sm font-medium">Coordinating nearby response...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Subsection A: Notified Responders */}
      {dispatchedOrgs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Notified Responders</h3>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Dispatched
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {dispatchedOrgs.map((org, i) => (
              <Card key={i} className="p-4 border-emerald-100 bg-emerald-50/30">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold">{org.name}</h4>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{org.type}</p>
                  </div>
                  <span className="text-xs font-bold text-zinc-900">~{org.distance_km.toFixed(1)} km away</span>
                </div>
                <div className="flex gap-2">
                  <a href={`tel:${org.contact_phone}`} className="flex-1 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-zinc-50">
                    <Phone className="w-3 h-3" /> Call
                  </a>
                  <a href={`mailto:${org.contact_email}`} className="flex-1 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-zinc-50">
                    <ExternalLink className="w-3 h-3" /> Email
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Subsection B: Nearby Services Found (Overpass) */}
      {overpassPlaces.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Nearby Services Found</h3>
          <div className="grid grid-cols-1 gap-3">
            {overpassPlaces.map((place, i) => (
              <Card key={i} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold">{place.name}</h4>
                    <p className="text-[10px] text-zinc-400 italic">Nearby service — not yet notified</p>
                  </div>
                  <span className="text-xs font-bold text-zinc-500">~{place.distance.toFixed(1)} km away</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {place.phone && (
                    <a href={`tel:${place.phone}`} className="px-3 py-1.5 bg-zinc-100 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-zinc-200">
                      <Phone className="w-3 h-3" /> {place.phone}
                    </a>
                  )}
                  {place.website && (
                    <a href={place.website} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-zinc-100 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-zinc-200">
                      <ExternalLink className="w-3 h-3" /> Website
                    </a>
                  )}
                  {alert && (
                    <a 
                      href={`https://www.openstreetmap.org/directions?from=${alert.latitude},${alert.longitude}&to=${place.lat},${place.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-black text-white rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-zinc-800"
                    >
                      <MapIcon className="w-3 h-3" /> Get Directions
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Subsection C: Web Search Results */}
      {webOrgs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Additional organisations found via web search</h3>
          <div className="grid grid-cols-1 gap-3">
            {webOrgs.map((org, i) => (
              <Card key={i} className="p-4 border-dashed">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold">{org.name}</h4>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{org.type}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  {org.phone && (
                    <a href={`tel:${org.phone}`} className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {org.phone}
                    </a>
                  )}
                  {org.website && (
                    <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Website
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Fallback: National Contacts */}
      {!hasAnyResults && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-sm text-amber-800 font-medium">No specific nearby responders found. Please use these national emergency contacts:</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {NATIONAL_CONTACTS.map((contact, i) => (
              <Card key={i} className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold">{contact.name}</h4>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{contact.type}</p>
                  </div>
                  <a href={`tel:${contact.phone}`} className="p-3 bg-black text-white rounded-full hover:bg-zinc-800 transition-colors">
                    <Phone className="w-4 h-4" />
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DonatePage = () => {
  const [searchParams] = useSearchParams();
  const alertId = searchParams.get('alertId');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [alertsRes, orgsRes] = await Promise.all([
          fetch('/api/alerts'),
          fetch('/api/admin/organisations') // Using this to get all orgs, assuming admin endpoint is fine for public donate page too
        ]);
        const alertsData = await alertsRes.json();
        const orgsData = await orgsRes.json();
        
        setAlerts(alertsData);
        setOrgs(orgsData.filter((o: any) => o.status === 'active'));
        
        if (alertId) {
          const found = alertsData.find((a: any) => a.id === alertId);
          if (found) setSelectedAlert(found);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [alertId]);

  const filteredOrgs = orgs.filter(org => {
    if (filter === 'Money Donations') return org.needs_money;
    if (filter === 'Material Goods') return org.needs_food || org.needs_clothing || org.needs_medical;
    return true;
  });

  if (loading) return <div className="py-20 text-center text-zinc-400">Loading donation opportunities...</div>;

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-12">
      {!selectedAlert ? (
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Choose a crisis to help with</h1>
            <p className="text-zinc-500">Your support can make a direct impact on those affected.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {alerts.map(alert => (
              <Card key={alert.id} className="p-6 flex flex-col gap-4 hover:border-zinc-400 transition-colors">
                <div className="flex items-start justify-between">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    alert.severity.includes('Tier 1') ? 'bg-red-100 text-red-600' : 
                    alert.severity.includes('Tier 2') ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                  )}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded border",
                    alert.severity.includes('Tier 1') ? 'bg-red-50 text-red-700 border-red-100' : 
                    alert.severity.includes('Tier 2') ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                  )}>
                    {alert.severity.split(' — ')[0]}
                  </span>
                </div>
                
                <div className="space-y-1">
                  <h3 className="font-bold text-lg">{alert.type}</h3>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><Navigation className="w-3 h-3" /> {alert.address_area ? `${alert.address_area}, ${alert.address_city}` : alert.address_city || alert.locationName || 'Unknown'}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(alert.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <p className="text-sm text-zinc-600 italic line-clamp-2">
                  {alert.ai_summary || alert.description}
                </p>

                <Button 
                  className="w-full mt-2" 
                  onClick={() => setSelectedAlert(alert)}
                >
                  Help with this crisis
                </Button>
              </Card>
            ))}
            {alerts.length === 0 && (
              <div className="col-span-full py-20 text-center text-zinc-400">No active crises at the moment.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <button 
                onClick={() => {
                  setSelectedAlert(null);
                  navigate('/donate');
                }}
                className="text-sm font-medium text-zinc-500 hover:text-black flex items-center gap-1 transition-colors"
              >
                <ChevronRight className="w-4 h-4 rotate-180" /> Back to crisis list
              </button>
              <h1 className="text-4xl font-bold tracking-tight">Organisations working on this crisis</h1>
              <p className="text-xl text-zinc-500">Supporting: <span className="text-black font-semibold">{selectedAlert.type} in {selectedAlert.address_area ? `${selectedAlert.address_area}, ${selectedAlert.address_city}` : selectedAlert.address_city || selectedAlert.locationName}</span></p>
            </div>
            
            <div className="flex bg-zinc-100 p-1 rounded-lg self-start md:self-auto">
              {['All Organisations', 'Money Donations', 'Material Goods'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                    filter === f ? "bg-white shadow-sm text-black" : "text-zinc-500 hover:text-black"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {filteredOrgs.map(org => (
              <Card key={org.id} className="p-8 flex flex-col md:flex-row gap-8">
                <div className="w-20 h-20 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400 flex-shrink-0">
                  <Heart className="w-10 h-10" />
                </div>
                
                <div className="flex-1 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-bold">{org.name}</h3>
                      <p className="text-sm text-zinc-500 font-medium uppercase tracking-wider">{org.type}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {org.needs_money === 1 && <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-100 uppercase">Money</span>}
                      {org.needs_food === 1 && <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-100 uppercase">Food</span>}
                      {org.needs_clothing === 1 && <span className="px-2 py-1 bg-orange-50 text-orange-700 text-[10px] font-bold rounded border border-orange-100 uppercase">Clothing</span>}
                      {org.needs_medical === 1 && <span className="px-2 py-1 bg-red-50 text-red-700 text-[10px] font-bold rounded border border-red-100 uppercase">Medical</span>}
                    </div>
                  </div>

                  <p className="text-zinc-600 leading-relaxed">
                    {org.description || "This organisation provides essential services and relief efforts in crisis-affected areas."}
                  </p>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {org.needs_money === 1 && (
                      <div className="space-y-3">
                        <a 
                          href={org.donation_url || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <Button className="w-full py-6 text-lg bg-emerald-600 hover:bg-emerald-700">
                            Donate Now
                          </Button>
                        </a>
                        <p className="text-[10px] text-zinc-400 text-center">
                          You will be redirected to {org.name}'s own website. This platform does not process payments.
                        </p>
                      </div>
                    )}

                    {(org.needs_food === 1 || org.needs_clothing === 1 || org.needs_medical === 1) && (
                      <details className="group border border-zinc-200 rounded-xl overflow-hidden">
                        <summary className="p-4 bg-zinc-50 cursor-pointer font-bold text-sm flex items-center justify-between list-none">
                          How to contribute material goods
                          <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                        </summary>
                        <div className="p-4 space-y-4 text-sm border-t border-zinc-200">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-zinc-400">Drop-off Location</label>
                            <p className="font-medium">{org.drop_off_location || "Contact organisation for details"}</p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-zinc-400">Accepted Items</label>
                            <p className="font-medium">
                              {[
                                org.needs_food === 1 ? 'Non-perishable food' : null,
                                org.needs_clothing === 1 ? 'Clean clothing' : null,
                                org.needs_medical === 1 ? 'First aid & medical supplies' : null
                              ].filter(Boolean).join(', ')}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-zinc-400">Coordination Number</label>
                            <p className="font-medium">{org.contact_phone}</p>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>

                  <div className="flex items-center gap-6 pt-4 border-t border-zinc-100">
                    <a 
                      href={org.website_url || '#'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-zinc-400 hover:text-black flex items-center gap-1 transition-colors"
                    >
                      Visit their website <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </Card>
            ))}
            {filteredOrgs.length === 0 && (
              <div className="py-20 text-center text-zinc-400">No organisations matching this filter are currently active.</div>
            )}
          </div>
        </div>
      )}

      <div className="pt-12 border-t border-zinc-200 space-y-4">
        <p className="text-[10px] text-zinc-400 text-center max-w-2xl mx-auto leading-relaxed">
          This platform does not collect or hold donations. All contributions go directly to the selected organisation. 
          Please review the organisation's own terms before donating.
        </p>
      </div>
    </div>
  );
};

const MapUpdater = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

const ReportPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    type: '',
    description: '',
    latitude: DEFAULT_LAT,
    longitude: DEFAULT_LNG,
    locationName: '',
    address_full: '',
    address_area: '',
    address_city: '',
    location_method: 'auto_detected' as 'auto_detected' | 'manual_search' | 'pin_adjusted',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [locationStatus, setLocationStatus] = useState<'detecting' | 'detected' | 'failed' | 'idle'>('idle');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const reverseGeocode = async (lat: number, lng: number, method: 'auto_detected' | 'pin_adjusted' | 'manual_search') => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
        headers: { 'User-Agent': 'CrisisAlertSystem/1.0' }
      });
      const data = await response.json();
      
      if (data) {
        const area = data.address.suburb || data.address.neighbourhood || data.address.village || '';
        const city = data.address.city || data.address.town || data.address.municipality || '';

        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          locationName: data.display_name,
          address_full: data.display_name,
          address_area: area,
          address_city: city,
          location_method: method
        }));
        setLocationStatus('detected');
      }
    } catch (error) {
      console.error('Geocoding failed:', error);
      setLocationStatus('failed');
      setShowAutocomplete(true);
    }
  };

  useEffect(() => {
    if (step === 2 && locationStatus === 'idle') {
      setLocationStatus('detecting');
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            reverseGeocode(pos.coords.latitude, pos.coords.longitude, 'auto_detected');
          },
          (error) => {
            console.error('Geolocation failed:', error);
            setLocationStatus('failed');
            setShowAutocomplete(true);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      } else {
        setLocationStatus('failed');
        setShowAutocomplete(true);
      }
    }
  }, [step, locationStatus]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5`, {
        headers: { 'User-Agent': 'CrisisAlertSystem/1.0' }
      });
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const onSelectResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    reverseGeocode(lat, lng, 'manual_search');
    setShowAutocomplete(false);
    setSearchResults([]);
    setSearchQuery('');
  };

  const onMarkerDragEnd = (e: any) => {
    const { lat, lng } = e.target.getLatLng();
    reverseGeocode(lat, lng, 'pin_adjusted');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const aiResponse = await classifyCrisis(formData.type, formData.description);
      const alertId = crypto.randomUUID();
      const referenceId = `CL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const alertData = {
        id: alertId,
        ...formData,
        severity: aiResponse.severity,
        ai_guidance: JSON.stringify(aiResponse.guidance),
        ai_summary: aiResponse.summary,
        vulnerable_detected: aiResponse.vulnerablePersonDetected,
        reassurance: aiResponse.reassurance,
        reference_id: referenceId,
        status: 'active',
      };

      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData),
      });

      setResult(alertData);
      setStep(3);
    } catch (error) {
      console.error(error);
      alert("Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">What is the emergency?</h2>
              <p className="text-zinc-500">Select the type of crisis you are reporting.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {CRISIS_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, type: type.label }));
                    setStep(2);
                  }}
                  className="p-4 border border-zinc-200 rounded-xl hover:border-black hover:bg-zinc-50 transition-all text-left space-y-1"
                >
                  <div className="font-bold">{type.label}</div>
                  <div className="text-xs text-zinc-500">{type.description}</div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-2 text-zinc-500">
              <button onClick={() => setStep(1)} className="hover:text-black">Crisis Type</button>
              <span>/</span>
              <span className="text-black font-medium">Details</span>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Location Banners */}
              {locationStatus === 'detecting' && (
                <div className="p-3 bg-zinc-100 rounded-xl flex items-center gap-2 text-sm text-zinc-600 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Detecting your location...
                </div>
              )}
              {locationStatus === 'detected' && (
                <div className="p-3 bg-emerald-50 rounded-xl flex items-center gap-2 text-sm text-emerald-700 border border-emerald-100">
                  <CheckCircle className="w-4 h-4" />
                  Location detected: {formData.address_area ? `${formData.address_area}, ${formData.address_city}` : formData.address_city || 'Your area'}
                </div>
              )}
              {locationStatus === 'failed' && (
                <div className="p-3 bg-amber-50 rounded-xl flex items-center gap-2 text-sm text-amber-700 border border-amber-100">
                  <AlertTriangle className="w-4 h-4" />
                  Could not detect location automatically
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-zinc-500">Description</label>
                <textarea
                  required
                  rows={4}
                  className="w-full p-4 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-black outline-none"
                  placeholder="Describe what is happening. Include details like number of people involved, immediate dangers, etc."
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-zinc-500">Location</label>
                
                {showAutocomplete ? (
                  <div className="space-y-2 relative">
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full p-4 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-black outline-none"
                        placeholder="Search for a location..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                      />
                      {searchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden">
                          {searchResults.map((res, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => onSelectResult(res)}
                              className="w-full text-left p-3 text-sm hover:bg-zinc-50 border-b border-zinc-100 last:border-none"
                            >
                              {res.display_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setShowAutocomplete(false)}
                      className="text-xs text-zinc-400 hover:text-black transition-colors"
                    >
                      Back to map view
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        className="flex-1 p-4 border border-zinc-200 rounded-xl bg-zinc-50 text-zinc-500 outline-none cursor-default"
                        placeholder="Detecting location..."
                        value={formData.locationName}
                      />
                    </div>
                    
                    {formData.latitude !== 0 && (
                      <div className="space-y-2">
                        <div className="h-48 rounded-xl border border-zinc-200 overflow-hidden z-0">
                          <MapContainer
                            center={[formData.latitude, formData.longitude]}
                            zoom={15}
                            style={{ width: '100%', height: '100%' }}
                            zoomControl={false}
                          >
                            <TileLayer
                              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            />
                            <Marker
                              position={[formData.latitude, formData.longitude]}
                              draggable={true}
                              eventHandlers={{
                                dragend: onMarkerDragEnd
                              }}
                            />
                            <MapUpdater center={[formData.latitude, formData.longitude]} />
                          </MapContainer>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setShowAutocomplete(true)}
                          className="text-xs text-zinc-400 hover:text-black transition-colors flex items-center gap-1"
                        >
                          <Search className="w-3 h-3" /> Not your location? Search manually
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button 
                type="submit" 
                className="w-full py-4 text-lg" 
                disabled={isSubmitting || (formData.latitude === 0 && !showAutocomplete)}
              >
                {isSubmitting ? 'Analyzing Report...' : 'Submit Emergency Report'}
              </Button>
            </form>
          </motion.div>
        )}

        {step === 3 && result && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8 pb-20"
          >
            {/* SECTION 1 — ALERT CONFIRMATION BANNER */}
            <div className={cn(
              "p-6 rounded-2xl text-white shadow-lg",
              result.severity.includes('Tier 1') ? 'bg-red-600' : 
              result.severity.includes('Tier 2') ? 'bg-amber-500' : 'bg-emerald-600'
            )}>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-bold">Your alert has been received</span>
                </div>
                <div className="text-3xl font-mono font-bold tracking-tighter my-2">
                  {result.reference_id}
                </div>
                <p className="text-sm opacity-90">Emergency organisations near you have been notified</p>
                <div className="mt-2 px-3 py-1 bg-white/20 rounded-lg text-xs font-bold uppercase tracking-widest inline-block w-fit">
                  {result.severity.includes('Tier 1') ? 'CRITICAL — Immediate Response Triggered' : 
                   result.severity.includes('Tier 2') ? 'HIGH — Priority Response Dispatched' : 'MODERATE — Response Coordinated'}
                </div>
              </div>
            </div>

            {/* SECTION 2 — IMMEDIATE STEPS */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-600" />
                What to do right now
              </h3>
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="divide-y divide-zinc-100">
                  {JSON.parse(result.ai_guidance).map((step: string, i: number) => (
                    <div key={i} className="flex gap-4 p-4 items-start">
                      <div className="w-6 h-6 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-sm text-zinc-700 leading-relaxed font-medium">{step}</p>
                    </div>
                  ))}
                </div>
                {result.vulnerable_detected && (
                  <div className="p-4 bg-red-50 border-t border-red-100 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <p className="text-xs font-bold text-red-700 uppercase">Vulnerable person detected — Responders have been flagged</p>
                  </div>
                )}
              </div>
              <p className="text-center text-zinc-500 font-medium italic py-2">
                "{result.reassurance}"
              </p>
            </div>

            {/* SECTION 3 — YOUR DETAILS (Optional) */}
            <ReporterDetailsForm alertId={result.id} />

            {/* SECTION 4 — NEARBY ORGANISATIONS */}
            <NearbyOrganisations alertId={result.id} />

            <div className="flex flex-col gap-3 pt-4">
              <Button onClick={() => navigate('/map')} variant="primary" className="w-full py-4">
                View Alert on Map
              </Button>
              <Button onClick={() => setStep(1)} variant="secondary" className="w-full">
                Report Another Incident
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MarkerClusterGroup = ({ alerts }: { alerts: Alert[] }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const clusterGroup = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      iconCreateFunction: (cluster: any) => {
        const markers = cluster.getAllChildMarkers();
        let maxSeverity = 3;
        markers.forEach((m: any) => {
          const severity = m.options.severity;
          if (severity.includes('Tier 1')) maxSeverity = Math.min(maxSeverity, 1);
          else if (severity.includes('Tier 2')) maxSeverity = Math.min(maxSeverity, 2);
        });

        const color = maxSeverity === 1 ? '#ef4444' : maxSeverity === 2 ? '#f59e0b' : '#10b981';
        return L.divIcon({
          html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; color: white; display: flex; items-center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${markers.length}</div>`,
          className: 'marker-cluster-custom',
          iconSize: L.point(30, 30)
        });
      }
    });

    alerts.forEach(alert => {
      const marker = L.marker([alert.latitude, alert.longitude], { 
        icon: getMarkerIcon(alert.severity),
        severity: alert.severity 
      } as any);
      
      const popupContent = document.createElement('div');
      popupContent.className = 'p-2 space-y-2 min-w-[200px]';
      popupContent.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <h4 class="font-bold text-sm">${alert.type}</h4>
          <span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
            alert.severity.includes('Tier 1') ? 'bg-red-100 text-red-700' : 
            alert.severity.includes('Tier 2') ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
          }">${alert.severity.split(' — ')[0]}</span>
        </div>
        <div class="flex items-center gap-2 text-[10px] text-zinc-500">
          <span class="flex items-center gap-1">🕒 ${new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          ${alert.verified ? '<span class="text-emerald-600 font-bold">✓ Verified</span>' : '<span class="text-zinc-400">Unverified</span>'}
        </div>
        <a href="/alert/${alert.id}" class="block w-full text-center py-1.5 bg-black text-white text-[10px] font-bold rounded hover:bg-zinc-800 transition-colors mt-2">View Full Alert</a>
      `;

      marker.bindPopup(popupContent);
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map, alerts]);

  return null;
};

const MapPage = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([DEFAULT_LAT, DEFAULT_LNG]);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    fetch('/api/alerts')
      .then(res => res.json())
      .then(data => {
        setAlerts(data);
        setLoading(false);
      });
  }, []);

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'All') return true;
    return a.severity.includes(filter);
  });

  const handleNearMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setMapCenter([pos.coords.latitude, pos.coords.longitude]);
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Public Alert Map</h1>
        <div className="flex gap-2">
          <div className="flex bg-zinc-100 p-1 rounded-lg">
            {['All', 'Tier 1', 'Tier 2', 'Tier 3'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  filter === f ? "bg-white shadow-sm text-black" : "text-zinc-500 hover:text-black"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <Button variant="secondary" className="text-xs flex items-center gap-2" onClick={handleNearMe}>
            <Navigation className="w-3 h-3" /> Near Me
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="aspect-video bg-zinc-100 rounded-2xl border border-zinc-200 relative overflow-hidden z-0">
            <MapContainer
              center={mapCenter}
              zoom={13}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <MarkerClusterGroup alerts={filteredAlerts} />
              <MapUpdater center={mapCenter} />
            </MapContainer>
            
            {/* Legend Overlay */}
            <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-zinc-200 shadow-lg space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Legend</h4>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-[10px] font-medium">Critical (Tier 1)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span className="text-[10px] font-medium">High (Tier 2)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-medium">Moderate (Tier 3)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="font-bold text-lg">Legend</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm font-medium">Tier 1 — Critical</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-sm font-medium">Tier 2 — High</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm font-medium">Tier 3 — Moderate</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4 bg-zinc-900 text-white border-none">
            <h3 className="font-bold text-lg">Emergency Contacts</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-red-400" />
                  <span className="text-sm">Police</span>
                </div>
                <span className="font-mono font-bold">999</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-red-400" />
                  <span className="text-sm">Ambulance</span>
                </div>
                <span className="font-mono font-bold">997</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-red-400" />
                  <span className="text-sm">Fire</span>
                </div>
                <span className="font-mono font-bold">998</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

const TermsOfServicePage = () => {
  return (
    <div className="max-w-3xl mx-auto py-12 space-y-8">
      <div className="space-y-4 border-b border-zinc-200 pb-8">
        <h1 className="text-4xl font-bold tracking-tight">Terms and Conditions of Use</h1>
        <p className="text-zinc-500">Effective Date: February 25, 2026</p>
      </div>

      <div className="prose prose-zinc max-w-none space-y-8 text-zinc-700 leading-relaxed">
        <section className="bg-red-50 p-6 rounded-xl border border-red-100">
          <h2 className="text-red-900 font-bold uppercase text-sm tracking-widest mb-2">Important — Please Read Carefully</h2>
          <p className="text-red-800 text-sm">
            By accessing or using the CrisisLink Africa platform, whether as a member of the public, a registered organisation, or a system administrator, you agree to be bound by these Terms and Conditions. If you do not agree to these Terms, you must not use the Platform.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-zinc-900">1. About the Platform</h2>
          <p>
            CrisisLink Africa is a reporting and routing tool only — it does not replace official emergency services, professional medical advice, or government disaster response authorities. The Platform uses artificial intelligence to analyse reported crises, estimate severity, and provide guidance. These AI outputs are automated and are not a substitute for professional emergency response.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-zinc-900">2. Who Can Use the Platform</h2>
          <h3 className="font-bold text-lg">2.1 General Public (Unregistered Users)</h3>
          <p>You do not need to register or log in to report a crisis or view public alerts. By submitting a report without registering, you still agree to these Terms.</p>
          <h3 className="font-bold text-lg">2.2 Registered Organisations</h3>
          <p>Emergency response organisations must provide accurate information and respond to alerts in good faith within their operational capacity.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-zinc-900">3. Crisis Reporting</h2>
          <p>When you submit a crisis report, you agree to provide accurate and truthful information. False, misleading, or malicious reports can divert emergency resources from people who genuinely need help and may violate applicable laws.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-zinc-900">4. AI-Generated Guidance</h2>
          <p>The Platform provides automated safety guidance. You acknowledge that AI guidance is general in nature and you should always follow instructions from official emergency services and trained responders over AI-generated advice.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-zinc-900">5. Limitation of Liability</h2>
          <p>To the fullest extent permitted by law, CrisisLink Africa and its officers shall not be liable for any failure to dispatch, delay in dispatching, or harm arising from actions taken based on AI guidance. The Platform is provided as a supplementary tool — not a replacement for official emergency services.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-zinc-900">6. Data and Privacy</h2>
          <p>By using this Platform, you consent to the collection and use of the information you provide, including crisis reports and location data, for the purpose of coordinating emergency responses.</p>
        </section>
      </div>

      <div className="pt-12 border-t border-zinc-200">
        <Link to="/">
          <Button variant="secondary">Back to Home</Button>
        </Link>
      </div>
    </div>
  );
};

const TermsModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('crisislink_terms_accepted');
    if (!accepted) {
      setIsOpen(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('crisislink_terms_accepted', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-zinc-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Terms of Service</h2>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">CrisisLink Africa</p>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-4 text-zinc-600 text-sm leading-relaxed">
          <p className="font-bold text-zinc-900">Important: Please read carefully before using the platform.</p>
          <p>
            CrisisLink Africa is an AI-powered coordination tool. It is <strong>not</strong> a replacement for official emergency services (Police, Fire, Ambulance).
          </p>
          <p>
            By clicking "I Accept", you acknowledge that:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>AI guidance is general and may not account for all variables.</li>
            <li>You will always prioritize instructions from official responders.</li>
            <li>You consent to sharing location data for emergency dispatch purposes.</li>
            <li>Submitting false reports is prohibited and may be illegal.</li>
          </ul>
          <p>
            The platform bears no liability for outcomes resulting from actions taken based on AI-generated guidance or dispatch delays.
          </p>
        </div>

        <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex flex-col gap-3">
          <Button onClick={handleAccept} className="w-full py-4 text-lg">
            I Accept and Understand
          </Button>
          <p className="text-[10px] text-center text-zinc-400">
            You must accept these terms to use the CrisisLink Africa platform.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <TermsModal />
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-bottom border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">CrisisLink Africa</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link to="/map" className="text-sm font-medium text-zinc-500 hover:text-black transition-colors">Alert Map</Link>
            <Link to="/donate" className="text-sm font-medium text-zinc-500 hover:text-black transition-colors">Help with a crisis</Link>
            <Link to="/organisations" className="text-sm font-medium text-zinc-500 hover:text-black transition-colors">For Organisations</Link>
            <Link to="/admin" className="text-sm font-medium text-zinc-500 hover:text-black transition-colors">Admin</Link>
          </div>
          <Link to="/report">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Report Crisis
            </Button>
          </Link>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-zinc-200 bg-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center text-white">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="font-bold text-lg">CrisisLink Africa</span>
            </div>
            <p className="text-sm text-zinc-500">
              Bridging the gap between communities and emergency responders through AI-driven coordination.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><Link to="/map">Public Map</Link></li>
              <li><Link to="/report">Report Incident</Link></li>
              <li><Link to="/organisations">Organisation Portal</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><Link to="/terms" className="hover:text-black">Terms of Service</Link></li>
              <li>Privacy Policy</li>
              <li>Data Minimization</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li>support@crisislink.africa</li>
              <li>Emergency: 999</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pt-12 mt-12 border-t border-zinc-100 text-center text-xs text-zinc-400">
          © {new Date().getFullYear()} CrisisLink Africa. Built for community resilience.
        </div>
      </footer>
    </div>
  );
};

const OrganisationPortal = () => {
  const [step, setStep] = useState(1);
  const [orgId, setOrgId] = useState('');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    type: 'Hospital',
    contact_email: '',
    contact_phone: '',
    latitude: 0,
    longitude: 0,
    service_radius: 50,
    donation_url: '',
    description: '',
    needs_money: false,
    needs_food: false,
    needs_clothing: false,
    needs_medical: false,
    drop_off_location: '',
    website_url: ''
  });

  const handleRegister = async (e: any) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    await fetch('/api/organisations/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, id }),
    });
    alert("Registration submitted. Waiting for admin approval.");
    setStep(1);
  };

  const loadAlerts = async () => {
    const res = await fetch(`/api/organisations/${orgId}/alerts`);
    const data = await res.json();
    setAlerts(data);
    setStep(3);
  };

  const acknowledge = async (alertId: string) => {
    await fetch(`/api/organisations/${orgId}/alerts/${alertId}/acknowledge`, { method: 'POST' });
    loadAlerts();
  };

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="p-8 space-y-4">
            <h2 className="text-2xl font-bold">Organisation Login</h2>
            <p className="text-zinc-500 text-sm">Enter your Organisation ID to view dispatched alerts.</p>
            <input 
              className="w-full p-3 border border-zinc-200 rounded-lg" 
              placeholder="Organisation ID"
              value={orgId}
              onChange={e => setOrgId(e.target.value)}
            />
            <Button className="w-full" onClick={loadAlerts}>Login to Dashboard</Button>
          </Card>
          <Card className="p-8 space-y-4">
            <h2 className="text-2xl font-bold">Register New</h2>
            <p className="text-zinc-500 text-sm">Join the network to receive real-time crisis alerts.</p>
            <Button variant="secondary" className="w-full" onClick={() => setStep(2)}>Start Registration</Button>
          </Card>
        </div>
      )}

      {step === 2 && (
        <Card className="p-8 max-w-xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold">Organisation Registration</h2>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-zinc-500">Organisation Name</label>
              <input required className="w-full p-3 border border-zinc-200 rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-zinc-500">Type</label>
              <select className="w-full p-3 border border-zinc-200 rounded-lg" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option>Hospital</option>
                <option>Fire Service</option>
                <option>NGO / Relief</option>
                <option>Police</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-zinc-500">Contact Email</label>
              <input required type="email" className="w-full p-3 border border-zinc-200 rounded-lg" value={formData.contact_email} onChange={e => setFormData({...formData, contact_email: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-zinc-500">Contact Phone</label>
              <input required type="tel" className="w-full p-3 border border-zinc-200 rounded-lg" value={formData.contact_phone} onChange={e => setFormData({...formData, contact_phone: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-zinc-500">Organisation Description</label>
              <textarea className="w-full p-3 border border-zinc-200 rounded-lg" rows={3} placeholder="What does your organisation do?" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-500">What help do you need?</label>
              <div className="grid grid-cols-2 gap-2">
                {['money', 'food', 'clothing', 'medical'].map(need => (
                  <label key={need} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={(formData as any)[`needs_${need}`]} onChange={e => setFormData({...formData, [`needs_${need}`]: e.target.checked})} />
                    {need.charAt(0).toUpperCase() + need.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-zinc-500">Donation URL (External)</label>
              <input type="url" className="w-full p-3 border border-zinc-200 rounded-lg" placeholder="https://your-org.com/donate" value={formData.donation_url} onChange={e => setFormData({...formData, donation_url: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-zinc-500">Website URL</label>
              <input type="url" className="w-full p-3 border border-zinc-200 rounded-lg" placeholder="https://your-org.com" value={formData.website_url} onChange={e => setFormData({...formData, website_url: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-zinc-500">Drop-off Location</label>
              <input className="w-full p-3 border border-zinc-200 rounded-lg" placeholder="Address for material donations" value={formData.drop_off_location} onChange={e => setFormData({...formData, drop_off_location: e.target.value})} />
            </div>
            <Button type="submit" className="w-full py-4">Submit for Approval</Button>
            <Button type="button" variant="secondary" className="w-full" onClick={() => setStep(1)}>Cancel</Button>
          </form>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold">Dispatched Alerts</h2>
            <Button variant="secondary" onClick={() => setStep(1)}>Logout</Button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {alerts.map(alert => (
              <Card key={alert.id} className="p-6 flex justify-between items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase px-2 py-0.5 bg-zinc-100 rounded">{alert.severity}</span>
                    <h4 className="font-bold">{alert.type}</h4>
                  </div>
                  <p className="text-sm text-zinc-500">{alert.description}</p>
                  <p className="text-[10px] text-zinc-400">Dispatched: {new Date(alert.dispatched_at).toLocaleString()}</p>
                </div>
                <div>
                  {alert.acknowledged_at ? (
                    <span className="text-emerald-600 text-sm font-bold flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Acknowledged
                    </span>
                  ) : (
                    <Button onClick={() => acknowledge(alert.id)}>Acknowledge Receipt</Button>
                  )}
                </div>
              </Card>
            ))}
            {alerts.length === 0 && <div className="text-center py-20 text-zinc-400">No alerts dispatched to your organisation yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
};

const AdminDashboard = () => {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [dispatchLogs, setDispatchLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [tab, setTab] = useState('active-alerts');
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [filter, setFilter] = useState('All');

  const fetchData = async () => {
    try {
      const [orgsRes, alertsRes, logsRes, statsRes] = await Promise.all([
        fetch('/api/admin/organisations'),
        fetch('/api/alerts'),
        fetch('/api/admin/dispatch-logs'),
        fetch('/api/admin/stats')
      ]);
      
      if (!orgsRes.ok || !alertsRes.ok || !logsRes.ok || !statsRes.ok) {
        throw new Error('One or more requests failed');
      }

      setOrgs(await orgsRes.json());
      setAlerts(await alertsRes.json());
      setDispatchLogs(await logsRes.json());
      setStats(await statsRes.json());
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateOrgStatus = async (id: string, status: string, rejection_reason?: string) => {
    await fetch(`/api/admin/organisations/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejection_reason }),
    });
    fetchData();
  };

  const verifyAlert = async (id: string, verified: boolean) => {
    await fetch(`/api/admin/alerts/${id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified }),
    });
    fetchData();
    if (selectedAlert?.id === id) {
      const detailsRes = await fetch(`/api/admin/alerts/${id}/details`);
      setSelectedAlert(await detailsRes.json());
    }
  };

  const handleAlertClick = async (alert: any) => {
    const res = await fetch(`/api/admin/alerts/${alert.id}/details`);
    const details = await res.json();
    setSelectedAlert(details);
  };

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'All') return true;
    if (filter === 'Tier 1') return a.severity === 'Tier 1 — Critical';
    if (filter === 'Tier 2') return a.severity === 'Tier 2 — High';
    if (filter === 'Tier 3') return a.severity === 'Tier 3 — Moderate';
    if (filter === 'Verified') return a.verified === 1;
    if (filter === 'Unverified') return a.verified === 0;
    return true;
  });

  const sidebarLinks = [
    { id: 'active-alerts', label: 'Active Alerts', icon: AlertTriangle },
    { id: 'org-approvals', label: 'Org Approvals', icon: CheckCircle },
    { id: 'dispatch-log', label: 'Dispatch Log', icon: ClipboardList },
    { id: 'organisations', label: 'Organisations', icon: Users },
  ];

  return (
    <div className="flex min-h-[calc(100vh-12rem)] bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-100 bg-zinc-50/50 p-4 flex flex-col gap-2">
        <div className="px-3 py-4 mb-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Admin Console</h2>
        </div>
        {sidebarLinks.map(link => (
          <button
            key={link.id}
            onClick={() => setTab(link.id)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              tab === link.id ? "bg-black text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-black"
            )}
          >
            <link.icon className="w-4 h-4" />
            {link.label}
          </button>
        ))}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-white relative">
        {/* Header Stats */}
        <div className="p-6 border-b border-zinc-100 bg-white sticky top-0 z-10">
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4 bg-zinc-50 border-none shadow-none flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Active Alerts</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{stats?.activeAlerts || 0}</span>
                {stats?.hasTier1 && (
                  <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded animate-pulse">CRITICAL</span>
                )}
              </div>
            </Card>
            <Card className="p-4 bg-zinc-50 border-none shadow-none flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Pending Verification</span>
              <span className="text-2xl font-bold">{stats?.pendingVerification || 0}</span>
            </Card>
            <Card className="p-4 bg-zinc-50 border-none shadow-none flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Active Orgs</span>
              <span className="text-2xl font-bold">{stats?.activeOrgs || 0}</span>
            </Card>
            <Card className="p-4 bg-zinc-50 border-none shadow-none flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Pending Approvals</span>
              <span className="text-2xl font-bold">{stats?.pendingOrgs || 0}</span>
            </Card>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {tab === 'active-alerts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Active Alerts</h3>
                <div className="flex bg-zinc-100 p-1 rounded-lg">
                  {['All', 'Tier 1', 'Tier 2', 'Tier 3', 'Verified', 'Unverified'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                        filter === f ? "bg-white shadow-sm text-black" : "text-zinc-500 hover:text-black"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {filteredAlerts.map(alert => (
                  <Card 
                    key={alert.id} 
                    className={cn(
                      "p-4 flex items-center justify-between cursor-pointer hover:border-zinc-400 transition-colors",
                      selectedAlert?.id === alert.id && "border-black ring-1 ring-black"
                    )}
                    onClick={() => handleAlertClick(alert)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        alert.severity === 'Tier 1 — Critical' ? 'bg-red-100 text-red-600' : 
                        alert.severity === 'Tier 2 — High' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                      )}>
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-zinc-400">{alert.reference_id}</span>
                          <h4 className="font-bold truncate">{alert.type}</h4>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                          <span className="flex items-center gap-1"><Navigation className="w-3 h-3" /> {alert.address_area ? `${alert.address_area}, ${alert.address_city}` : alert.address_city || alert.locationName || 'Unknown'}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(alert.created_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {alert.verified ? (
                          <span className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1 justify-end">
                            <CheckCircle className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">Unverified</span>
                        )}
                        <div className="text-[10px] text-zinc-400 mt-0.5">Dispatched</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-300" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {tab === 'org-approvals' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold">Organisation Approvals</h3>
              <Card className="overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="p-4 font-bold">Organisation</th>
                      <th className="p-4 font-bold">Type</th>
                      <th className="p-4 font-bold">Location</th>
                      <th className="p-4 font-bold">Applied</th>
                      <th className="p-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {orgs.filter(o => o.status === 'pending').map(org => (
                      <tr key={org.id} className="hover:bg-zinc-50/50">
                        <td className="p-4">
                          <div className="font-bold">{org.name}</div>
                          <div className="text-xs text-zinc-500">{org.contact_email}</div>
                        </td>
                        <td className="p-4 text-zinc-600">{org.type}</td>
                        <td className="p-4 text-zinc-600">{org.latitude.toFixed(2)}, {org.longitude.toFixed(2)}</td>
                        <td className="p-4 text-zinc-500">{new Date(org.created_at).toLocaleDateString()}</td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <Button variant="primary" className="bg-emerald-600 hover:bg-emerald-700 text-xs py-1" onClick={() => updateOrgStatus(org.id, 'active')}>Approve</Button>
                            <Button variant="danger" className="text-xs py-1" onClick={() => {
                              const reason = prompt("Enter rejection reason:");
                              if (reason) updateOrgStatus(org.id, 'rejected', reason);
                            }}>Reject</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {orgs.filter(o => o.status === 'pending').length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-zinc-400">No pending organisation approvals.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {tab === 'dispatch-log' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold">Dispatch Log</h3>
              <Card className="overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="p-4 font-bold">Alert ID</th>
                      <th className="p-4 font-bold">Crisis Type</th>
                      <th className="p-4 font-bold">Organisation</th>
                      <th className="p-4 font-bold">Dispatch Time</th>
                      <th className="p-4 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {dispatchLogs.map(log => (
                      <tr key={log.id} className="hover:bg-zinc-50/50">
                        <td className="p-4 font-mono text-xs font-bold">{log.reference_id}</td>
                        <td className="p-4 text-zinc-600">{log.crisis_type}</td>
                        <td className="p-4 text-zinc-600">{log.organisation_name}</td>
                        <td className="p-4 text-zinc-500">{new Date(log.dispatched_at).toLocaleString()}</td>
                        <td className="p-4">
                          {log.acknowledged_at ? (
                            <span className="text-emerald-600 font-bold text-[10px] uppercase flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Acknowledged
                            </span>
                          ) : (
                            <span className="text-zinc-400 font-bold text-[10px] uppercase">Sent</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {tab === 'organisations' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold">Registered Organisations</h3>
              <Card className="overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="p-4 font-bold">Organisation</th>
                      <th className="p-4 font-bold">Type</th>
                      <th className="p-4 font-bold">Status</th>
                      <th className="p-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {orgs.filter(o => o.status !== 'pending').map(org => (
                      <tr key={org.id} className="hover:bg-zinc-50/50">
                        <td className="p-4">
                          <div className="font-bold">{org.name}</div>
                          <div className="text-xs text-zinc-500">{org.contact_email}</div>
                        </td>
                        <td className="p-4 text-zinc-600">{org.type}</td>
                        <td className="p-4">
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", 
                            org.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          )}>
                            {org.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            {org.status === 'active' ? (
                              <Button variant="danger" className="text-xs py-1" onClick={() => updateOrgStatus(org.id, 'suspended')}>Suspend</Button>
                            ) : (
                              <Button variant="primary" className="text-xs py-1" onClick={() => updateOrgStatus(org.id, 'active')}>Activate</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <AnimatePresence>
          {selectedAlert && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedAlert(null)}
                className="absolute inset-0 bg-black/20 z-20 backdrop-blur-[1px]"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute top-0 right-0 bottom-0 w-[400px] bg-white shadow-2xl z-30 border-l border-zinc-200 flex flex-col"
              >
                <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{selectedAlert.reference_id}</span>
                    <h3 className="text-xl font-bold">{selectedAlert.type}</h3>
                  </div>
                  <button onClick={() => setSelectedAlert(null)} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Severity Tier</label>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-bold uppercase",
                        selectedAlert.severity === 'Tier 1 — Critical' ? 'bg-red-100 text-red-700' : 
                        selectedAlert.severity === 'Tier 2 — High' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                      )}>
                        {selectedAlert.severity}
                      </span>
                      {selectedAlert.severity === 'Tier 1 — Critical' && (
                        <span className="text-[10px] font-medium text-zinc-500 italic">Auto-dispatched</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Reporter Description</label>
                    <p className="text-sm text-zinc-700 leading-relaxed bg-zinc-50 p-4 rounded-xl border border-zinc-100 italic">
                      "{selectedAlert.description}"
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">AI Classification Reasoning</label>
                    <div className="text-sm text-zinc-600 space-y-2">
                      <p>Model: gemini-3-flash-preview</p>
                      <p>Inputs: Crisis type, description, location context.</p>
                      <p>Result: {selectedAlert.severity}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Dispatch Log</label>
                    <div className="space-y-3">
                      {selectedAlert.dispatches?.map((d: any, i: number) => (
                        <div key={i} className="flex gap-3 text-sm">
                          <div className="w-1 h-full bg-zinc-100 rounded-full" />
                          <div className="flex-1 space-y-1">
                            <div className="font-bold">{d.name}</div>
                            <div className="text-xs text-zinc-500 flex items-center gap-2">
                              <span>Sent: {new Date(d.dispatched_at).toLocaleTimeString()}</span>
                              {d.acknowledged_at && (
                                <span className="text-emerald-600 font-bold">Ack: {new Date(d.acknowledged_at).toLocaleTimeString()}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!selectedAlert.dispatches || selectedAlert.dispatches.length === 0) && (
                        <p className="text-xs text-zinc-400 italic">No organisations dispatched yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-8 border-t border-zinc-100">
                    <CommentsSection alertId={selectedAlert.id} isAdmin={true} />
                  </div>
                </div>

                <div className="p-6 border-t border-zinc-100 bg-zinc-50/50">
                  {selectedAlert.severity === 'Tier 1 — Critical' ? (
                    <div className="text-center py-2 bg-zinc-100 rounded-lg text-xs font-bold text-zinc-500 uppercase tracking-widest border border-zinc-200">
                      View Only — Tier 1 Auto-Dispatched
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      {!selectedAlert.verified ? (
                        <>
                          <Button 
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => verifyAlert(selectedAlert.id, true)}
                          >
                            Verify Alert
                          </Button>
                          <Button variant="danger" className="flex-1" onClick={() => verifyAlert(selectedAlert.id, false)}>Reject</Button>
                        </>
                      ) : (
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => verifyAlert(selectedAlert.id, false)}
                        >
                          Unverify Alert
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

const CommentsSection = ({ alertId, isAdmin = false }: { alertId: string, isAdmin?: boolean }) => {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState('');

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/alerts/${alertId}/comments`);
      const data = await res.json();
      setComments(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [alertId]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setIsSubmitting(true);
    setError('');

    try {
      const moderation = await moderateComment(newComment);
      if (!moderation.approved) {
        setError("Your comment could not be posted. Please ensure it contains helpful, respectful information.");
        setIsSubmitting(false);
        return;
      }

      const id = crypto.randomUUID();
      await fetch(`/api/alerts/${alertId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, text: newComment, author_name: authorName }),
      });

      setNewComment('');
      setAuthorName('');
      fetchComments();
    } catch (err) {
      console.error(err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFlag = async (commentId: string) => {
    try {
      await fetch(`/api/comments/${commentId}/flag`, { method: 'POST' });
      alert("Comment flagged for review.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    try {
      await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      fetchComments();
    } catch (err) {
      console.error(err);
    }
  };

  const visibleComments = showAll ? comments : comments.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="font-bold text-xl">Community Information</h3>
        <p className="text-sm text-zinc-500">Has useful information about this situation? Share it here to help responders and your community.</p>
      </div>

      {!isAdmin && (
        <form onSubmit={handlePostComment} className="space-y-4 bg-zinc-50 p-6 rounded-xl border border-zinc-200">
          <textarea
            required
            className="w-full p-4 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-black outline-none min-h-[100px]"
            placeholder="Share what you know — road conditions, number of people affected, updates from the scene..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
          />
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <input
              className="flex-1 p-3 border border-zinc-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-black"
              placeholder="Your name or leave blank to post anonymously"
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
            />
            <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto px-8">
              {isSubmitting ? 'Moderating...' : 'Post Update'}
            </Button>
          </div>
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </form>
      )}

      <div className="space-y-4">
        {visibleComments.map(comment => (
          <div key={comment.id} className="p-4 bg-white border border-zinc-100 rounded-xl shadow-sm space-y-2 relative group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{comment.author_name}</span>
                <span className="text-[10px] text-zinc-400">• {new Date(comment.created_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                {!isAdmin && (
                  <button 
                    onClick={() => handleFlag(comment.id)}
                    className="p-1.5 text-zinc-300 hover:text-red-500 transition-colors"
                    title="Flag as inappropriate"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                )}
                {isAdmin && (
                  <button 
                    onClick={() => handleDelete(comment.id)}
                    className="p-1.5 text-zinc-300 hover:text-red-600 transition-colors"
                    title="Delete comment"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-zinc-700 leading-relaxed">{comment.text}</p>
            {isAdmin && comment.flagged === 1 && (
              <span className="text-[10px] font-bold text-red-600 uppercase">Flagged by community</span>
            )}
          </div>
        ))}
        {comments.length > 5 && !showAll && (
          <Button variant="secondary" className="w-full" onClick={() => setShowAll(true)}>
            Show more comments ({comments.length - 5})
          </Button>
        )}
        {comments.length === 0 && (
          <p className="text-center py-8 text-zinc-400 text-sm italic">No community updates yet.</p>
        )}
      </div>
    </div>
  );
};

const AlertDetailsPage = () => {
  const { id } = useParams();
  const [alert, setAlert] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/alerts')
      .then(res => res.json())
      .then(data => {
        const found = data.find((a: any) => a.id === id);
        setAlert(found);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="py-20 text-center text-zinc-400">Loading alert details...</div>;
  if (!alert) return <div className="py-20 text-center text-zinc-400">Alert not found.</div>;

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/map">
          <Button variant="outline" className="p-2 rounded-full">
            <Navigation className="w-5 h-5 rotate-270" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{alert.type}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Description</label>
              <p className="text-lg text-zinc-700 leading-relaxed">{alert.description}</p>
            </div>

            <div className="space-y-4 pt-6 border-t border-zinc-100">
              <h3 className="font-bold text-xl flex items-center gap-2">
                <Shield className="w-6 h-6 text-red-600" />
                Emergency Guidance
              </h3>
              <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-200 whitespace-pre-line text-zinc-800 leading-relaxed">
                {alert.ai_guidance}
              </div>
            </div>
          </Card>

          <CommentsSection alertId={alert.id} />
        </div>

        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="font-bold text-lg">Alert Info</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-sm text-zinc-500">Reference</span>
                <span className="font-mono font-bold">{alert.reference_id}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-sm text-zinc-500">Severity</span>
                <span className="text-xs font-bold uppercase px-2 py-0.5 bg-red-100 text-red-700 rounded">{alert.severity}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-sm text-zinc-500">Status</span>
                <span className="text-xs font-bold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">{alert.status}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-zinc-500">Reported</span>
                <span className="text-sm font-medium">{new Date(alert.created_at).toLocaleString()}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4 bg-red-600 text-white border-none">
            <h3 className="font-bold text-lg">Need Help?</h3>
            <p className="text-sm opacity-90">If you are in immediate danger and have access to a phone, call emergency services directly.</p>
            <div className="pt-2">
              <a href="tel:999" className="block w-full text-center py-3 bg-white text-red-600 rounded-lg font-bold text-xl">
                Call 999
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/donate" element={<DonatePage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/alert/:id" element={<AlertDetailsPage />} />
          <Route path="/organisations" element={<OrganisationPortal />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
