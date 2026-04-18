/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ChevronLeft, 
  Share2, 
  Search, 
  Barcode, 
  History, 
  ChevronRight, 
  MapPin, 
  Truck,
  Info,
  X,
  Package,
  CircleDollarSign,
  User,
  Phone,
  Navigation,
  CreditCard,
  ArrowRight,
  AlertTriangle,
  ChevronDown,
  Pencil,
  Clock,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet default icon issues in Vite
// Using CDN URLs for reliable marker display
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const RedIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to auto-fit bounds
const BoundsFitter = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  React.useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, points]);
  return null;
};

interface Billing {
  name: string;
  price: number;
  fee: string;
  status: string;
}

interface TravelEvent {
  date: string;
  time?: string;
  location: string;
  status: string;
  note?: string;
  active?: boolean;
}

interface PaymentMethod {
  id: string;
  vaName: string;
  vaNumber: string;
  img: string;
  status: boolean;
}

interface PackageData {
  nomorResi: string;
  date: string;
  statusPercent: number;
  statusPengiriman: string;
  paket: string;
  weight: number;
  biayaKirim: number;
  pengirim_nama: string;
  pengirim_telepon: string;
  pengirim_alamat: string;
  penerima_nama: string;
  penerima_telepon: string;
  penerima_alamat: string;
  origin_gateway: string;
  origin_coordinate_lat: string;
  origin_coordinate_lng: string;
  destination_gateway: string;
  destination_coordinate_lat: string;
  destination_coordinate_lng: string;
  tagihans: string; // JSON string
  subtotal: number;
  refund_bank: string;
  refund_account_holder: string;
  refund_account_number: number;
  refund_amount: number;
  travelHistory: string; // JSON string
  statusRoling: boolean;
}

const TrackingApp = () => {
  const [currentPage, setCurrentPage] = useState<'input' | 'tracking' | 'payment'>('input');
  const [resiNumber, setResiNumber] = useState('JO123');
  const [activeTab, setActiveTab] = useState<'rincian' | 'peta'>('rincian');
  const [showDetails, setShowDetails] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [hasConfirmedInsurance, setHasConfirmedInsurance] = useState(() => {
    return localStorage.getItem('jnt_insurance_confirmed') === 'true';
  });
  const [showInsurancePopup, setShowInsurancePopup] = useState(false);
  const [insuranceAgreed, setInsuranceAgreed] = useState(false);
  const [bankType, setBankType] = useState<'BANK' | 'EWALLET'>('BANK');
  const [refundData, setRefundData] = useState({
    bank: '',
    accountNumber: '',
    accountHolder: ''
  });

  const INDONESIAN_BANKS = [
    "BCA", "MANDIRI", "BNI", "BRI", "BTN", "BSI (BANK SYARIAH INDONESIA)", 
    "CIMB NIAGA", "PERMATA BANK", "DANAMON", "BANK MEGA", "BANK SINARMAS", 
    "BANK DKI", "BANK BJB", "BANK JATENG", "BANK JATIM", "DIGIBANK BY DBS", 
    "JENIUS (BTPN)", "SEABANK", "BANK NEO COMMERCE (BNC)", "BLU BY BCA DIGITAL", 
    "ALLO BANK", "BANK ALADIN"
  ];

  const EWALLET_OPTIONS = [
    "DANA", "OVO", "GOPAY", "SHOPEEPAY", "LINKAJA", "I.SAKU", "ASTRAPAY"
  ];

  const cleanAccountNumber = (val: string, type: 'BANK' | 'EWALLET') => {
    let cleaned = val.replace(/\D/g, '');
    if (type === 'EWALLET') {
      if (cleaned.startsWith('62')) cleaned = cleaned.substring(2);
      else if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    }
    return cleaned;
  };

  const [packageData, setPackageData] = useState<PackageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [currentLocationName, setCurrentLocationName] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [isFetchingPayments, setIsFetchingPayments] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [activeAccordion, setActiveAccordion] = useState<string | null>('ATM');
  const [copied, setCopied] = useState(false);

  // Payment Countdown Timer
  React.useEffect(() => {
    if (currentPage !== 'payment') {
      setTimeLeft(600);
      return;
    }

    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [currentPage, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchTrackingData = async (resi: string) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await fetch(`/api/tracking/${resi}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Nomor resi tidak ditemukan');
        }
        throw new Error('Gagal memuat data dari Airtable');
      }
      const data = await response.json();
      setPackageData(data as PackageData);
      
      // Reset refund form states for new searches
      setRefundData({
        bank: '',
        accountNumber: '',
        accountHolder: ''
      });
      setInsuranceAgreed(false);
      setBankType('BANK');
      
      setCurrentPage('tracking');
    } catch (err: any) {
      console.error('Fetch Error:', err);
      setFetchError(err.message || 'Terjadi kesalahan saat mengambil data');
      setCurrentPage('input');
      // Clear hash if error so user can try again
      window.location.hash = '';
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    setIsFetchingPayments(true);
    try {
      const response = await fetch('/api/payment-methods');
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data);
      }
    } catch (error) {
      console.error('Failed to fetch payment methods:', error);
    } finally {
      setIsFetchingPayments(false);
    }
  };

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const cleanHash = hash.replace(/^#\/?/, '#'); // Normalize to #pattern

      if (cleanHash.startsWith('#tracking/')) {
        const resi = cleanHash.replace('#tracking/', '');
        if (resi) {
          setResiNumber(resi);
          fetchTrackingData(resi);
        }
      } else if (cleanHash.startsWith('#tracking:')) {
        const resi = cleanHash.replace('#tracking:', '');
        if (resi) {
          setResiNumber(resi);
          fetchTrackingData(resi);
        }
      } else if (cleanHash === '#payment') {
        setCurrentPage('payment');
      } else {
        // Only reset if hash is truly empty or unrecognized
        if (!cleanHash || cleanHash === '#') {
          setCurrentPage('input');
          setActiveTab('rincian');
          setShowDetails(false);
          setPackageData(null);
          setFetchError(null);
          setSelectedMethod(null);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Initial check

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [packageData, selectedMethod]);

  // Reverse geocoding to get "real" location names from coordinates
  React.useEffect(() => {
    if (routeCoordinates.length > 0 && packageData) {
      const fetchLocationName = async () => {
        try {
          const index = Math.floor((routeCoordinates.length - 1) * (packageData.statusPercent / 100));
          const [lat, lng] = routeCoordinates[index];
          
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&addressdetails=1`);
          const data = await response.json();
          
          // Try to get a meaningful but concise place name
          const addr = data.address || {};
          const name = addr.city || addr.town || addr.village || addr.municipality || addr.county || addr.state_district || 'TRANSIT';
          
          setCurrentLocationName(name.toUpperCase());
        } catch (error) {
          console.error('Error reverse geocoding:', error);
        }
      };

      fetchLocationName();
    } else {
      setCurrentLocationName('');
    }
  }, [routeCoordinates, packageData?.statusPercent]);

  // Simple heuristic for fallback: realistic location names along the JKT-BDG route
  const getCurrentLocationName = (percent: number) => {
    if (currentLocationName) return currentLocationName;
    if (!packageData) return 'Pusat Transit';
    if (percent <= 5) return packageData.origin_gateway;
    if (percent <= 20) return "BEKASI / CIKARANG";
    if (percent <= 40) return "CIKAMPEK HUB";
    if (percent <= 65) return "PURWAKARTA REGION";
    if (percent <= 85) return "PADALARANG / CIMAHI";
    return packageData.destination_gateway;
  };

  React.useEffect(() => {
    if (activeTab === 'peta' && packageData) {
      const fetchRoute = async () => {
        try {
          const params = new URLSearchParams({
            lng1: packageData.origin_coordinate_lng,
            lat1: packageData.origin_coordinate_lat,
            lng2: packageData.destination_coordinate_lng,
            lat2: packageData.destination_coordinate_lat
          });
          
          const response = await fetch(`/api/route?${params.toString()}`);
          
          if (!response.ok) {
            throw new Error(`Proxy responded with ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.routes && data.routes.length > 0) {
            // OSRM returns [lng, lat], Leaflet needs [lat, lng]
            const coords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
            setRouteCoordinates(coords);
          } else {
            // Fallback to straight line if OSRM fails
            setRouteCoordinates([
              [parseFloat(packageData.origin_coordinate_lat), parseFloat(packageData.origin_coordinate_lng)],
              [parseFloat(packageData.destination_coordinate_lat), parseFloat(packageData.destination_coordinate_lng)]
            ]);
          }
        } catch (error) {
          console.error('Error fetching OSRM route through proxy:', error);
          // Fallback to straight line
          if (packageData) {
            setRouteCoordinates([
              [parseFloat(packageData.origin_coordinate_lat), parseFloat(packageData.origin_coordinate_lng)],
              [parseFloat(packageData.destination_coordinate_lat), parseFloat(packageData.destination_coordinate_lng)]
            ]);
          }
        }
      };
      
      fetchRoute();
    }
  }, [activeTab, packageData]);

  const parsedHistory: TravelEvent[] = packageData ? JSON.parse(packageData.travelHistory).map((h: any, idx: number) => ({
    ...h,
    active: idx === 0, // Assume latest is active/newest
    time: h.date.split(' ')[1],
    date: h.date.split(' ')[0].replace(/-/g, '/')
  })) : [];

  const parsedBilling: Billing[] = packageData ? JSON.parse(packageData.tagihans) : [];

  const recentSearches = [
    { id: 'JO123', status: 'Transit' },
    { id: 'REG992811002', status: 'Terkirim' },
  ];

  const handleTrack = () => {
    if (resiNumber.trim()) {
      if (window.location.hash === `#tracking/${resiNumber.trim()}`) {
        // If hash is same, manually trigger change if needed or just handle it
        const resi = resiNumber.trim();
        setResiNumber(resi);
        setCurrentPage('tracking');
      } else {
        window.location.hash = `#tracking/${resiNumber.trim()}`;
      }
    }
  };

  const handleBack = () => {
    window.location.hash = '';
  };

  return (
    <div className="flex justify-center bg-gray-50 h-screen w-full overflow-hidden">
      <div className="w-full max-w-[500px] h-full bg-white shadow-xl flex flex-col font-sans overflow-hidden relative">
        <AnimatePresence mode="wait">
          {currentPage === 'input' ? (
            <motion.div 
              key="input-page"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="flex flex-col h-full w-full"
            >
              {/* Hero Header */}
              <div className="bg-red-600 p-8 pt-12 rounded-b-[40px] shadow-lg relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="relative z-10">
                  <img 
                    src="https://uploads.onecompiler.io/43y3uz32c/44ff9byh3/1519.HK.D-b6fbf909.png" 
                    alt="J&T Express Logo" 
                    className="h-12 w-auto object-contain mb-4"
                    referrerPolicy="no-referrer"
                  />
                  <p className="text-white/80 text-sm font-medium">Lacak paket Anda dengan cepat dan akurat.</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pt-8 space-y-8">
                {/* Input Form */}
                <div className="space-y-4">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Masukkan Nomor Resi</label>
                  <div className="relative group">
                    <input 
                      type="text" 
                      value={resiNumber}
                      onChange={(e) => setResiNumber(e.target.value)}
                      placeholder="Contoh: JD0055897798"
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl py-5 px-6 text-gray-900 font-bold focus:border-red-500 focus:bg-white transition-all outline-none pr-14"
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400">
                      <Barcode size={24} />
                    </div>
                  </div>
                  {fetchError && (
                    <p className="text-red-500 text-xs font-bold px-1">{fetchError}</p>
                  )}
                  <button 
                    onClick={handleTrack}
                    disabled={!resiNumber || isLoading}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-200 text-white py-5 rounded-2xl font-bold text-base shadow-xl shadow-red-100 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Search size={20} strokeWidth={3} />
                    )}
                    {isLoading ? 'Mencari...' : 'Lacak Sekarang'}
                  </button>
                </div>

                {/* Riwayat Pencarian */}
                <div className="space-y-4 pb-10">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                      <History size={16} className="text-red-500" />
                      Terakhir Dicari
                    </h3>
                    <button className="text-[10px] font-bold text-red-500 uppercase">Hapus</button>
                  </div>
                  
                  <div className="space-y-3">
                    {recentSearches.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => { window.location.hash = `#tracking/${item.id}`; }}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 hover:border-red-200 cursor-pointer transition-all hover:shadow-md"
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-gray-50 p-2.5 rounded-xl text-gray-400">
                            <Truck size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-gray-900 leading-none">{item.id}</p>
                            <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wider">{item.status}</p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-gray-300" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : currentPage === 'payment' ? (
            <motion.div
              key="payment-page"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="flex flex-col h-full w-full bg-[#f8f9fa]"
            >
              {packageData && selectedMethod ? (
                <>
                  {/* Payment Header */}
                  <div className="bg-red-600 text-white p-5 flex-shrink-0 flex items-center shadow-lg z-20">
                    <button onClick={() => window.location.hash = `#tracking/${packageData.nomorResi}`} className="p-2 hover:bg-white/10 rounded-full transition-colors mr-3">
                      <ChevronLeft size={22} />
                    </button>
                    <h2 className="text-sm font-black uppercase tracking-widest">Pembayaran</h2>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar border-x-8 border-transparent">
                    {/* Countdown Timer - Repositioned above VA Card */}
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
                          <Clock size={16} className="animate-pulse" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Batas Waktu Pembayaran</p>
                          <p className="text-sm font-black text-slate-900 tracking-tight tabular-nums">Selesaikan dalam <span className="text-red-600">{formatTime(timeLeft)}</span></p>
                        </div>
                      </div>
                    </div>

                    {/* VA Card - Professional Clean Style */}
                    <div className="bg-white p-0 rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden relative">
                       <div className="p-6 space-y-6">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gray-50 rounded-xl p-2.5 flex items-center justify-center border border-gray-100">
                                <img src={selectedMethod.img} alt={selectedMethod.vaName} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                              </div>
                              <div>
                                 <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Metode Pembayaran</p>
                                 <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{selectedMethod.vaName}</h3>
                              </div>
                            </div>
                            <div className="w-1 h-8 bg-red-600/20 rounded-full"></div>
                         </div>

                         <div className="bg-gray-50/80 p-6 rounded-3xl border border-gray-100 space-y-4">
                            <div className="flex justify-between items-center text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">
                               <span>Nomor Virtual Account</span>
                            </div>
                            <div className="flex flex-col items-center gap-4">
                               <p className="text-xl sm:text-3xl font-black text-slate-900 tabular-nums tracking-widest break-all overflow-hidden leading-none text-center w-full">{selectedMethod.vaNumber}</p>
                               <button 
                                 onClick={() => handleCopy(selectedMethod.vaNumber)}
                                 className={`w-full py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest ${
                                   copied ? 'bg-green-500 text-white shadow-lg shadow-green-500/10' : 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                                 }`}
                               >
                                 {copied ? (
                                   <>
                                     <Check size={16} strokeWidth={3} />
                                     <span>Tersalin</span>
                                   </>
                                 ) : (
                                   <>
                                     <Copy size={16} strokeWidth={3} />
                                     <span>Salin Nomor</span>
                                   </>
                                 )}
                               </button>
                            </div>
                         </div>
                       </div>
                       
                       <div className="bg-[#292929] px-6 py-3 border-t border-zinc-800 flex items-center justify-between">
                          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest italic">Verifikasi Otomatis oleh J&T Express</p>
                          <Check size={12} className="text-red-500" />
                       </div>
                    </div>

                    {/* Amount Card - Repositioned below VA Card */}
                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Total yang harus dibayar</p>
                        <p className="text-2xl font-black text-slate-900 tracking-tighter tabular-nums">
                          <span className="text-base font-bold text-[#323232] mr-1.5 uppercase italic">Rp</span>
                          {packageData.subtotal.toLocaleString()}
                        </p>
                      </div>
                      <div className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
                        <CircleDollarSign size={20} />
                      </div>
                    </div>

                    {/* Instruction Accordion */}
                    <div className="space-y-3">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 mb-1">Instruksi Pembayaran</p>
                       
                       {[
                         { 
                           id: 'ATM', 
                           title: "ATM " + selectedMethod.vaName, 
                           steps: ["Pilih Menu Lainnya", "Pilih Transfer", "Pilih Ke Rek Virtual Account", "Masukkan nomor VA", "Konfirmasi pembayaran"] 
                         },
                         { 
                           id: 'MOBILE', 
                           title: "Mobile Banking", 
                           steps: ["Login ke Aplikasi", "Pilih Menu Transfer / Pembayaran", "Pilih Virtual Account", "Masukkan nomor VA", "Selesaikan transaksi"] 
                         },
                         { 
                           id: 'INTERNET', 
                           title: "Internet Banking", 
                           steps: ["Login ke website Banking", "Pilih Menu Pembayaran", "Pilih Biller Virtual Account", "Masukkan kode VA J&T", "Konfirmasi dengan Token"] 
                         }
                       ].map((type) => (
                         <div key={type.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all shadow-sm">
                           <button 
                             onClick={() => setActiveAccordion(activeAccordion === type.id ? null : type.id)}
                             className="w-full p-4 flex items-center justify-between font-bold text-xs text-slate-700"
                           >
                              <span className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${activeAccordion === type.id ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                  {type.id[0]}
                                </div>
                                {type.title}
                              </span>
                              <ChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${activeAccordion === type.id ? 'rotate-180' : ''}`} />
                           </button>
                           
                           <AnimatePresence>
                             {activeAccordion === type.id && (
                               <motion.div
                                 initial={{ height: 0, opacity: 0 }}
                                 animate={{ height: 'auto', opacity: 1 }}
                                 exit={{ height: 0, opacity: 0 }}
                                 transition={{ duration: 0.3, ease: 'easeInOut' }}
                               >
                                  <div className="px-4 pb-5 pt-1 space-y-3 border-t border-gray-50">
                                     {type.steps.map((step, sidx) => (
                                       <div key={sidx} className="flex gap-4 items-start group">
                                         <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0 transition-all group-hover:scale-125"></div>
                                         <p className="text-[11px] font-bold text-slate-600 leading-snug">{step}</p>
                                       </div>
                                     ))}
                                  </div>
                               </motion.div>
                             )}
                           </AnimatePresence>
                         </div>
                       ))}
                    </div>

                    <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100 flex gap-4 items-start shadow-sm shadow-amber-500/5">
                      <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-amber-800 uppercase tracking-widest">Peringatan Keamanan</p>
                        <p className="text-[10px] font-bold text-amber-700 leading-relaxed italic opacity-80 decoration-amber-200/50 underline-offset-2">Jangan bagikan bukti transfer atau nomor VA ini kepada siapapun selain layanan resmi J&T Express.</p>
                      </div>
                    </div>
                    
                    <div className="h-10"></div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                    <AlertTriangle size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Data Tidak Ditemukan</h3>
                    <p className="text-xs text-gray-500 font-bold mt-2">Silakan kembali ke halaman sebelumnya dan pilih metode pembayaran lagi.</p>
                  </div>
                  <button 
                    onClick={() => window.location.hash = ''}
                    className="bg-red-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest"
                  >
                    Kembali ke Beranda
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="tracking-page"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="flex flex-col h-full w-full"
            >
              {/* Header Seksi */}
              <div className="bg-red-600 text-white pt-4 flex-shrink-0 z-20">
                <div className="flex items-center px-4 mb-4">
                  <ChevronLeft size={24} className="cursor-pointer" onClick={handleBack} />
                  <h1 className="flex-1 text-center font-bold text-lg tracking-wide uppercase">{resiNumber}</h1>
                  <Share2 size={20} className="cursor-pointer" />
                </div>

                <div className="flex text-sm font-medium relative">
                  <div 
                    className={`flex-1 text-center py-3 cursor-pointer transition-opacity ${activeTab === 'rincian' ? 'opacity-100' : 'opacity-60'}`}
                    onClick={() => setActiveTab('rincian')}
                  >
                    Rincian Status
                  </div>
                  <div 
                    className={`flex-1 text-center py-3 cursor-pointer transition-opacity ${activeTab === 'peta' ? 'opacity-100' : 'opacity-60'}`}
                    onClick={() => setActiveTab('peta')}
                  >
                    Peta
                  </div>
                  <div 
                    className={`absolute bottom-0 h-1 bg-white transition-all duration-300 ease-in-out`}
                    style={{ width: '50%', left: activeTab === 'rincian' ? '0%' : '50%' }}
                  ></div>
                </div>
              </div>

              {/* Konten Utama */}
              <div className="flex-1 relative overflow-hidden flex flex-col pb-24">
                
                {activeTab === 'rincian' && packageData && (
                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="bg-gradient-to-b from-red-600 to-red-700 pb-12 flex-shrink-0 flex justify-center pt-6">
                      <div className="w-1/2 aspect-square my-6 rounded-full border-4 border-white/30 flex items-center justify-center relative bg-white/10 backdrop-blur-md shadow-2xl">
                        <div className="absolute inset-0 rounded-full border-4 border-white/40 border-t-white animate-spin [animation-duration:4s]"></div>
                        <div className="bg-white rounded-full w-[90%] aspect-square flex flex-col items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.1)] px-4">
                          <span className="text-red-500 font-bold text-sm">- {packageData.statusPercent}% -</span>
                          <div className="w-[60%] aspect-[3/2] mb-1 flex items-center justify-center">
                            <img 
                              src="https://assets.bwbx.io/images/users/iqjWHBFdfxIU/ij9raO9DL4OI/v0/-999x-999.gif" 
                              alt="Truck Animation" 
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <span className="text-red-600 font-semibold text-xs text-center leading-tight">{packageData.statusPengiriman}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 bg-white -mt-6 rounded-t-[30px] z-10 flex flex-col overflow-hidden shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
                      <div className="flex justify-center py-2 flex-shrink-0">
                        <div className="h-1.5 w-12 bg-gray-200 rounded-full"></div>
                      </div>
                      
                      <div className="flex items-center justify-between px-6 mb-4">
                        <div className="text-red-600 font-bold text-xs uppercase tracking-[0.2em]">Detail Perjalanan</div>
                        <button className="flex items-center gap-1.5 bg-gray-50 text-gray-600 px-3 py-1.5 rounded-full text-[10px] font-black hover:bg-gray-100 transition-colors">
                          <span className="flex items-center gap-1">
                              <Info size={12} />
                              INFO LENGKAP
                          </span>
                        </button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto px-6 pb-10 custom-scrollbar">
                        <div className="relative pt-4">
                          <div className="absolute left-[95px] top-6 bottom-0 w-[2px] bg-gray-100"></div>
                          <div className="space-y-12">
                            {parsedHistory.map((item, index) => (
                              <div key={index} className={`flex text-[13px] ${item.active ? 'text-gray-900' : 'text-gray-400'}`}>
                                <div className="w-[85px] text-right pr-4 pt-1 flex-shrink-0 font-bold">
                                  <div>{item.date}</div>
                                  <div className="text-[11px] opacity-80">{item.time}</div>
                                </div>
                                <div className="relative z-10 flex flex-col items-center">
                                  <div className={`w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${item.active ? 'border-cyan-400' : 'border-gray-200'}`}>
                                    {item.active && <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>}
                                  </div>
                                </div>
                                <div className="flex-1 pl-6">
                                  <div className={`font-bold uppercase leading-tight ${item.active ? 'text-gray-900' : 'text-gray-500'}`}>{item.location}</div>
                                  <div className="mt-1.5 leading-relaxed font-medium">{item.status}</div>
                                  {item.note && <div className="mt-1 text-[11px] italic text-gray-400">Note: {item.note}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'peta' && packageData && (
                  <div className="flex-1 relative bg-gray-100 overflow-hidden flex flex-col z-0">
                    <div className="absolute inset-0 z-0 h-full w-full">
                      {/* Top Panel (Atas, Kiri, Kanan) */}
                      <div className="absolute top-0 left-0 right-0 z-[500] bg-white/90 backdrop-blur-lg border-b border-gray-100 py-3 px-6 shadow-md transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Origin</span>
                            <span className="font-bold text-sm text-gray-900 leading-tight">{packageData.origin_gateway}</span>
                          </div>
                          
                          <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1.5 mb-1 px-3 py-1 bg-gray-50 border border-gray-100 rounded-full shadow-sm">
                              <Navigation size={10} className="text-red-500 fill-red-500" />
                              <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">OSRM ROUTE</span>
                            </div>
                            <div className="h-[1px] w-12 bg-gray-100"></div>
                          </div>

                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Destination</span>
                            <span className="font-bold text-sm text-gray-900 leading-tight text-right">{packageData.destination_gateway}</span>
                          </div>
                        </div>
                      </div>

                      <MapContainer 
                        center={[
                          (parseFloat(packageData.origin_coordinate_lat) + parseFloat(packageData.destination_coordinate_lat)) / 2,
                          (parseFloat(packageData.origin_coordinate_lng) + parseFloat(packageData.destination_coordinate_lng)) / 2
                        ]} 
                        zoom={8} 
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                        dragging={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        touchZoom={false}
                        boxZoom={false}
                        keyboard={false}
                      >
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        />
                        
                        {/* Origin Marker */}
                        <Marker 
                          position={[parseFloat(packageData.origin_coordinate_lat), parseFloat(packageData.origin_coordinate_lng)]} 
                          icon={DefaultIcon}
                        >
                          <Popup>
                            <div className="text-xs font-bold leading-none">PENGIRIM</div>
                            <div className="text-[10px] text-gray-500 mt-1">{packageData.pengirim_alamat}</div>
                          </Popup>
                        </Marker>

                        {/* Destination Marker */}
                        <Marker 
                          position={[parseFloat(packageData.destination_coordinate_lat), parseFloat(packageData.destination_coordinate_lng)]} 
                          icon={RedIcon}
                        >
                          <Popup>
                            <div className="text-xs font-bold leading-none">PENERIMA</div>
                            <div className="text-[10px] text-gray-500 mt-1">{packageData.penerima_alamat.split(',')[0]}</div>
                          </Popup>
                        </Marker>

                        {/* Connection Line (Road Path) */}
                        <Polyline 
                          positions={routeCoordinates.length > 0 ? routeCoordinates : [
                            [parseFloat(packageData.origin_coordinate_lat), parseFloat(packageData.origin_coordinate_lng)],
                            [parseFloat(packageData.destination_coordinate_lat), parseFloat(packageData.destination_coordinate_lng)]
                          ]} 
                          color="#dc2626"
                          weight={5}
                          opacity={0.3}
                        />

                        {/* Travelled Path */}
                        {routeCoordinates.length > 0 && (
                          <Polyline 
                            positions={routeCoordinates.slice(0, Math.floor((routeCoordinates.length - 1) * (packageData.statusPercent / 100)) + 1)} 
                            color="#dc2626"
                            weight={5}
                            opacity={1}
                          />
                        )}

                        {/* Package Position Marker */}
                        {routeCoordinates.length > 0 && (
                          <Marker 
                            position={routeCoordinates[Math.floor((routeCoordinates.length - 1) * (packageData.statusPercent / 100))]} 
                            icon={L.divIcon({
                              className: 'custom-package-ping',
                              html: `<div class="relative">
                                       <div class="absolute -inset-4 bg-red-500/20 rounded-full animate-ping"></div>
                                       <div class="bg-red-600 p-1.5 rounded-full border-2 border-white shadow-xl flex items-center justify-center">
                                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><circle cx="7" cy="18" r="2"/><path d="M15 18H9"/><path d="M16 8h4.5a2.5 2.5 0 0 1 2.5 2.5V17a1 1 0 0 1-1 1h-2"/><circle cx="17" cy="18" r="2"/></svg>
                                       </div>
                                       <div class="absolute -bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                         <div class="bg-gray-900 text-white px-2 py-0.5 rounded text-[10px] font-black whitespace-nowrap shadow-md uppercase tracking-tighter border border-white/20">
                                           ${getCurrentLocationName(packageData.statusPercent)}
                                         </div>
                                         <div class="bg-red-600 text-[8px] text-white px-1 font-bold rounded mt-0.5 shadow-sm">
                                           ${packageData.statusPercent}%
                                         </div>
                                       </div>
                                     </div>`,
                              iconSize: [24, 24],
                              iconAnchor: [12, 12],
                            })}
                          />
                        )}

                        <BoundsFitter points={routeCoordinates.length > 0 ? routeCoordinates : [
                          [parseFloat(packageData.origin_coordinate_lat), parseFloat(packageData.origin_coordinate_lng)],
                          [parseFloat(packageData.destination_coordinate_lat), parseFloat(packageData.destination_coordinate_lng)]
                        ]} />
                      </MapContainer>

                      {/* Bottom Panel (Bawah, Kiri, Kanan) */}
                      <div className="absolute bottom-0 left-0 right-0 z-[500] bg-white/95 backdrop-blur-md border-t border-gray-100 py-4 px-6 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Live Status</span>
                            <span className="font-bold text-sm text-red-600">{packageData.statusPengiriman}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Progress</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-gray-900">{packageData.statusPercent}%</span>
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-red-600 rounded-full" 
                                  style={{ width: `${packageData.statusPercent}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
                
                {/* Tombol Aksi Bawah */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/95 backdrop-blur-md border-t border-gray-100 flex gap-3 z-30">
                    <button 
                      onClick={() => {
                        if (hasConfirmedInsurance) {
                          setShowDetails(true);
                        } else {
                          setShowInsurancePopup(true);
                        }
                      }}
                      className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-red-100 active:scale-95 transition-all"
                    >
                        Detail Paket
                    </button>
                </div>
              </motion.div>
            )}
        </AnimatePresence>

        {/* Detail Sheet Modal */}
        <AnimatePresence>
          {showDetails && packageData && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowDetails(false)}
                className="absolute inset-0 bg-black/40 z-[60] backdrop-blur-[2px]"
              />
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute left-0 right-0 bottom-0 max-h-[100%] bg-gray-50 border-t border-gray-200 z-[70] shadow-2xl flex flex-col overflow-hidden"
              >
                <div className="w-full bg-white px-6 pt-6 pb-2 shrink-0 border-b border-gray-50 flex flex-col items-center">
                  <div className="flex items-center justify-between w-full mb-4">
                    <div className="flex flex-col">
                      <h2 className="text-xl font-black text-gray-900 italic leading-none">RINCIAN <span className="text-red-600">PAKET</span></h2>
                      <p className="text-[10px] font-black text-gray-400 mt-1 uppercase tracking-widest">{packageData.nomorResi}</p>
                    </div>
                    <button 
                      onClick={() => setShowDetails(false)}
                      className="bg-gray-100 p-2 rounded-full text-gray-400 hover:text-gray-900 transition-colors"
                    >
                      <X size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 custom-scrollbar pb-12">
                  {/* Item Details - Moved to top per user request */}
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-5">
                    <div className="flex items-center gap-3 mb-2">
                       <Package size={20} className="text-red-600" />
                       <h3 className="text-sm font-black text-gray-900 uppercase">Informasi Barang</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-y-4">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nama Barang</p>
                        <p className="font-bold text-gray-900 text-sm">{packageData.paket}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Berat</p>
                        <p className="font-bold text-gray-900 text-sm">{packageData.weight} KG</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Layanan</p>
                        <p className="font-bold text-gray-900 text-sm">EZ (Reguler)</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Biaya kirim</p>
                        <p className="font-bold text-gray-900 text-sm underline decoration-red-200 underline-offset-4">Rp {packageData.biayaKirim.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sender & Receiver */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                      <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
                        <div className="bg-red-50 p-2 rounded-xl text-red-600">
                          <User size={18} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">PENGIRIM</p>
                          <p className="font-bold text-gray-900">{packageData.pengirim_nama}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Phone size={14} className="text-gray-400 mt-1 shrink-0" />
                        <p className="text-xs font-semibold text-gray-600">{packageData.pengirim_telepon}</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <Navigation size={14} className="text-gray-400 mt-1 shrink-0" />
                        <p className="text-xs font-semibold text-gray-600 leading-relaxed">{packageData.pengirim_alamat}</p>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                      <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
                        <div className="bg-red-50 p-2 rounded-xl text-red-600">
                          <User size={18} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">PENERIMA</p>
                          <p className="font-bold text-gray-900">{packageData.penerima_nama}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Phone size={14} className="text-gray-400 mt-1 shrink-0" />
                        <p className="text-xs font-semibold text-gray-600">{packageData.penerima_telepon}</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <Navigation size={14} className="text-gray-400 mt-1 shrink-0" />
                        <p className="text-xs font-semibold text-gray-600 leading-relaxed">{packageData.penerima_alamat}</p>
                      </div>
                    </div>
                  </div>

                  {/* Costs */}
                  {packageData.statusRoling && (
                    <div className="bg-slate-50/80 p-6 rounded-[2.5rem] border border-slate-200/60 shadow-inner space-y-5">
                      <div className="flex items-center justify-between pb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="bg-slate-900 p-1.5 rounded-lg">
                            <CircleDollarSign size={16} className="text-white" />
                          </div>
                          <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.15em]">Rincian Transaksi</h3>
                        </div>
                        <div className="h-px bg-slate-200 flex-1 ml-4"></div>
                      </div>
                      
                      <div className="space-y-4">
                        {parsedBilling.map((bill, i) => (
                          <div key={i} className="group relative">
                            <div className="flex justify-between items-end mb-1">
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">{bill.name}</span>
                              <div className="h-px flex-1 mx-3 border-b border-dotted border-slate-300 mb-1.5"></div>
                              <span className="text-sm font-black text-slate-900 tabular-nums">Rp {bill.price.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">Ref: {bill.fee}</span>
                              <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg tracking-tighter uppercase transition-colors ${
                                (bill.status === 'LUNAS' || bill.status === 'PAID' || bill.status === 'SUCCESS' || bill.status === 'SUKSES')
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                  : (bill.status === 'PENDING' || bill.status === 'WAITING')
                                    ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                    : 'bg-rose-50 text-rose-600 border border-rose-100'
                              }`}>
                                {bill.status}
                              </span>
                            </div>
                          </div>
                        ))}
                        <div className="pt-4 mt-2 border-t border-slate-200 flex justify-between items-center">
                          <span className="text-slate-400 font-extrabold uppercase text-[10px] tracking-[0.2em] italic">Gran Total</span>
                          <span className="text-slate-900 font-black text-xl tabular-nums tracking-tighter">Rp {packageData.subtotal.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Refund Info */}
                  {packageData.statusRoling && (
                    <div className="bg-[#121214] p-6 rounded-[2.5rem] border border-zinc-800 shadow-2xl space-y-6 relative overflow-hidden group">
                      {/* Decorative gradient flare */}
                      <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/10 blur-[80px] pointer-events-none group-hover:bg-red-600/20 transition-colors duration-700"></div>
                      
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-3">
                          <div className="bg-zinc-800 p-2 rounded-xl border border-zinc-700">
                            <CreditCard size={18} className="text-red-500" />
                          </div>
                          <div>
                            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Data Penarikan</h3>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider">Refund Information</h4>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            const currentBank = packageData.refund_bank;
                            const isEwallet = EWALLET_OPTIONS.includes(currentBank);
                            setBankType(isEwallet ? 'EWALLET' : 'BANK');
                            
                            setRefundData({
                              bank: currentBank || '',
                              accountNumber: cleanAccountNumber(packageData.refund_account_number?.toString() || '', isEwallet ? 'EWALLET' : 'BANK'),
                              accountHolder: packageData.refund_account_holder || ''
                            });
                            setInsuranceAgreed(true);
                            setShowInsurancePopup(true);
                          }}
                          className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-red-500 shadow-lg border border-zinc-700 active:scale-90 transition-all flex items-center justify-center group/btn"
                        >
                          <Pencil size={16} strokeWidth={2.5} className="group-hover/btn:rotate-12 transition-transform" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-y-6 relative z-10">
                        <div className="flex justify-between items-start border-b border-zinc-800/50 pb-4">
                          <div>
                            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.25em] mb-1.5 flex items-center gap-1.5">
                              <span className="w-1 h-3 bg-red-600 rounded-full"></span>
                              Institution & ID
                            </p>
                            <p className="font-bold text-zinc-100 text-sm tracking-tight">{packageData.refund_bank} — <span className="text-zinc-400 font-medium">{packageData.refund_account_number}</span></p>
                          </div>
                        </div>

                        <div className="flex justify-between items-start border-b border-zinc-800/50 pb-4">
                          <div>
                            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.25em] mb-1.5 flex items-center gap-1.5">
                              <span className="w-1 h-3 bg-red-600 rounded-full"></span>
                              Account Holder
                            </p>
                            <p className="font-bold text-zinc-100 text-sm italic uppercase tracking-wide">{packageData.refund_account_holder}</p>
                          </div>
                        </div>
                        
                        <div className="bg-zinc-800/40 p-4 rounded-2xl border border-zinc-800/80">
                          <p className="text-[9px] font-black text-red-500/80 uppercase tracking-[0.3em] mb-1 text-center">Settlement Amount</p>
                          <p className="font-black text-white text-2xl text-center tabular-nums shadow-red-500/10 drop-shadow-lg">
                            <span className="text-xs text-red-500 mr-1.5 opacity-50 uppercase tracking-tighter">RP</span>
                            {packageData.refund_amount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Subtotal Action Button - Updated per user request */}
                {packageData.statusRoling && (
                  <div className="p-6 bg-white border-t border-gray-100 shrink-0 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
                    <div className="flex justify-between items-center mb-4 px-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total Pembayaran</span>
                      <span className="text-xl font-black text-red-600 italic">Rp {packageData.subtotal.toLocaleString()}</span>
                    </div>
                    <button 
                      disabled={isProcessingPayment}
                      onClick={() => {
                        if (selectedMethod) {
                          setIsProcessingPayment(true);
                          setTimeout(() => {
                            setIsProcessingPayment(false);
                            setShowDetails(false);
                            window.location.hash = '#payment';
                          }, 3000);
                        } else {
                          setShowPaymentDrawer(true);
                          fetchPaymentMethods();
                        }
                      }}
                      className="w-full bg-red-600 disabled:bg-red-400 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-red-100 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase italic tracking-widest group"
                    >
                      {isProcessingPayment ? (
                         <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <span>{selectedMethod ? 'Bayar Sekarang' : 'Pilih Metode'}</span>
                          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Payment Methods Bottom Drawer */}
        <AnimatePresence>
          {showPaymentDrawer && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPaymentDrawer(false)}
                className="absolute inset-0 bg-black/60 z-[120] backdrop-blur-[2px]"
              />
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-[121] shadow-2xl flex flex-col max-h-[85vh]"
              >
                <div className="p-4 flex flex-col items-center">
                  <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-6"></div>
                  <div className="w-full flex justify-between items-center px-2 mb-6">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Pilih Metode Pembayaran</h3>
                    <button 
                      onClick={() => setShowPaymentDrawer(false)}
                      className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="w-full overflow-y-auto px-2 custom-scrollbar pb-8 space-y-3">
                    {isFetchingPayments ? (
                      <div className="py-20 flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-4 border-red-100 border-t-red-600 rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Memuat Metode...</p>
                      </div>
                    ) : (
                      paymentMethods.map((method) => (
                      <button 
                        key={method.id}
                        onClick={() => {
                          setSelectedMethod(method);
                          setShowPaymentDrawer(false);
                        }}
                        className={`w-full bg-white border-2 py-2 px-1 mb-2 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-all ${
                          selectedMethod?.id === method.id 
                            ? 'border-red-500 bg-red-50/20' 
                            : 'border-gray-50 hover:border-red-100'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-xl border-0 flex items-center justify-center p-2 overflow-hidden shrink-0">
                            <img src={method.img} alt={method.vaName} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          </div>
                          <div className="text-left">
                            <p className="text-[12px] font-bold text-slate-700 tracking-tight leading-none">{method.vaName}</p>
                          </div>
                        </div>
                        <div className="pr-3">
                          {selectedMethod?.id === method.id ? (
                             <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/20 rotate-0">
                               <Check size={14} strokeWidth={3} />
                             </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-50 group-hover:bg-red-50 flex items-center justify-center text-gray-300 group-hover:text-red-500 transition-colors">
                              <ChevronRight size={14} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                      </button>
                    ))
                    )}

                    {!isFetchingPayments && paymentMethods.length === 0 && (
                      <div className="py-20 flex flex-col items-center text-center px-10">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                           <CreditCard size={24} className="text-gray-300" />
                        </div>
                        <p className="text-xs font-bold text-gray-400">Tidak ada metode pembayaran aktif saat ini.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Insurance Confirmation Popup */}
        <AnimatePresence>
          {showInsurancePopup && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 z-[100] backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="absolute left-6 right-6 top-1/2 -translate-y-1/2 bg-white rounded-[32px] z-[101] shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
              >
                <div className="bg-red-600 p-6 flex flex-col items-center text-center shrink-0">
                   <div className="bg-white/20 p-3 rounded-2xl mb-3">
                     <AlertTriangle size={32} className="text-white" />
                   </div>
                   <h2 className="text-white font-black text-lg leading-tight uppercase italic tracking-tighter">Konfirmasi <br/> Pembayaran Asuransi</h2>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                  <div className="space-y-3">
                    <p className="text-xs text-gray-600 leading-relaxed font-medium">Asuransi ini bersifat sementara sebagai bagian dari proses administrasi.</p>
                    <p className="text-xs text-red-600 leading-relaxed font-bold">Biaya asuransi akan dikembalikan (refund) secara otomatis setelah pembayaran Anda berhasil diverifikasi.</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                       <History size={14} className="text-red-600" />
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data Rekening Refund</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Tipe Pembayaran</label>
                        <div className="relative">
                          <select 
                            value={bankType}
                            onChange={(e) => {
                              const type = e.target.value as 'BANK' | 'EWALLET';
                              setBankType(type);
                              setRefundData({...refundData, bank: ''});
                            }}
                            className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-4 text-xs font-bold focus:border-red-500 outline-none appearance-none cursor-pointer pr-10"
                          >
                            <option value="BANK">🏢 BANK TRANSFER</option>
                            <option value="EWALLET">📱 E-WALLET (DANA/OVO/DLL)</option>
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Nama {bankType === 'BANK' ? 'Bank' : 'E-Wallet'}</label>
                        <div className="relative">
                          <select 
                            value={refundData.bank}
                            onChange={(e) => setRefundData({...refundData, bank: e.target.value})}
                            className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-4 text-xs font-bold focus:border-red-500 outline-none appearance-none cursor-pointer pr-10"
                          >
                            <option value="">-- PILIH {bankType} --</option>
                            {(bankType === 'BANK' ? INDONESIAN_BANKS : EWALLET_OPTIONS).map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Nomor {bankType === 'BANK' ? 'Rekening' : 'HP E-Wallet'}</label>
                        <div className="relative">
                          {bankType === 'EWALLET' && (
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-900 border-r border-gray-200 pr-2 mr-2">
                              +62
                            </div>
                          )}
                          <input 
                            type="text"
                            inputMode="numeric"
                            placeholder={bankType === 'BANK' ? "Masukkan nomor rekening" : "812XXXXXX"}
                            value={refundData.accountNumber}
                            onChange={(e) => setRefundData({...refundData, accountNumber: cleanAccountNumber(e.target.value, bankType)})}
                            className={`w-full bg-white border border-gray-200 rounded-xl py-2.5 px-4 text-xs font-bold focus:border-red-500 outline-none ${bankType === 'EWALLET' ? 'pl-14' : 'pl-4'}`}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Nama Pemilik {bankType === 'BANK' ? 'Rekening' : 'Akun'}</label>
                        <input 
                          type="text" 
                          placeholder={bankType === 'BANK' ? "Masukkan nama sesuai akun" : "Masukkan nama terdaftar"}
                          value={refundData.accountHolder}
                          onChange={(e) => setRefundData({...refundData, accountHolder: e.target.value})}
                          className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-4 text-xs font-bold focus:border-red-500 outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-400 italic leading-snug">Pastikan data yang diisi sudah benar. Kesalahan pengisian dapat menyebabkan proses refund tertunda atau gagal.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-px bg-gray-100 flex-1"></div>
                      <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Ketentuan Refund</span>
                      <div className="h-px bg-gray-100 flex-1"></div>
                    </div>
                    
                    <ul className="space-y-2">
                       {[
                         "Refund diproses setelah pembayaran terverifikasi",
                         "Dana akan dikirim ke rekening yang Anda input",
                         "Proses dimulai setelah verifikasi selesai (biasanya beberapa menit)",
                         "Waktu maksimal penerimaan dana adalah 30 menit setelah verifikasi"
                       ].map((text, i) => (
                         <li key={i} className="flex gap-2 items-start text-[10px] text-gray-500 leading-snug">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 shrink-0"></span>
                            {text}
                         </li>
                       ))}
                    </ul>
                  </div>

                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                    <p className="text-[10px] text-red-600 font-black mb-1 uppercase tracking-tight">Biaya Administrasi</p>
                    <p className="text-xs text-red-800 font-extrabold italic">Dikenakan biaya admin sebesar Rp6.500 (tidak dapat dikembalikan).</p>
                  </div>

                  <p className="text-[9px] text-gray-400 leading-relaxed italic text-center">Jika dana belum diterima setelah 30 menit, silakan hubungi layanan bantuan dengan menyertakan bukti transaksi.</p>

                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl cursor-pointer group hover:bg-red-50 transition-colors border border-transparent hover:border-red-100">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                      checked={insuranceAgreed}
                      onChange={(e) => setInsuranceAgreed(e.target.checked)}
                    />
                    <span className="text-[10px] font-bold text-gray-600 group-hover:text-red-700 transition-colors leading-tight">Saya menyetujui syarat dan ketentuan yang berlaku.</span>
                  </label>
                </div>
                
                <div className="p-6 pt-2 bg-gray-50 flex gap-3 shrink-0">
                  <button 
                    onClick={() => setShowInsurancePopup(false)}
                    className="flex-1 bg-white border-2 border-gray-100 text-gray-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-sm"
                  >
                    Batal
                  </button>
                  <button 
                    disabled={isUpdating || !insuranceAgreed || !refundData.bank || !refundData.accountNumber || !refundData.accountHolder}
                    onClick={async () => {
                        setIsUpdating(true);
                        try {
                          // 1. Save to Airtable first
                          const response = await fetch(`/api/tracking/${packageData?.nomorResi}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              refund_bank: refundData.bank,
                              refund_account_number: bankType === 'EWALLET' ? `62${refundData.accountNumber}` : refundData.accountNumber,
                              refund_account_holder: refundData.accountHolder
                            })
                          });

                          if (!response.ok) {
                            throw new Error('Gagal menyimpan data ke Airtable');
                          }

                          // 2. If server update successful, update local state
                          localStorage.setItem('jnt_insurance_confirmed', 'true');
                          setHasConfirmedInsurance(true);
                          
                          if (packageData) {
                            setPackageData({
                              ...packageData,
                              refund_bank: refundData.bank,
                              refund_account_number: parseInt(bankType === 'EWALLET' ? `62${refundData.accountNumber}` : refundData.accountNumber) || 0,
                              refund_account_holder: refundData.accountHolder
                            });
                          }

                          setShowInsurancePopup(false);
                          setShowDetails(true);
                        } catch (err) {
                          console.error('Update Error:', err);
                          alert('Gagal menyimpan data. Silakan coba lagi.');
                        } finally {
                          setIsUpdating(false);
                        }
                    }}
                    className="flex-1 bg-red-600 disabled:bg-gray-200 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isUpdating ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : 'Konfirmasi'}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        .leaflet-control-attribution {
          font-size: 10px;
          opacity: 0.1;
          background: transparent !important;
          color: #fff;
          padding: 2px 6px;
        }
        .leaflet-control-attribution a {
          color: #fff;
          text-decoration: none;
        }
      `}</style>
    </div>
  );
};

export default TrackingApp;
