import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, serverTimestamp, getDocs, getDoc, limit, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import MapView from './Map';
import { MapPin, Navigation, Car, Loader2, X, Star, Phone, User as UserIcon, MessageCircle, Truck, Box, Clock, Zap, Info, ArrowRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, RideRequest, RideStatus, VehicleCategory } from '../types';
import { useToast } from './Toast';

// Real Car Icon mappings completed using Lucide icons

interface PassengerDashboardProps {
  user: UserProfile;
}

export default function PassengerDashboard({ user }: PassengerDashboardProps) {
  const { showToast } = useToast();
  const [pickup, setPickup] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [destination, setDestination] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [selecting, setSelecting] = useState<'pickup' | 'destination' | null>(null);
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [driver, setDriver] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const requestingRef = useRef(false);
  const prevRideStatusRef = useRef<string | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<Array<{ id: string; position: { lat: number; lng: number } }>>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [manualPickup, setManualPickup] = useState('');
  const [manualDestination, setManualDestination] = useState('');
  const [cargoDetails, setCargoDetails] = useState('');
  const [rentalPrice, setRentalPrice] = useState('');
  const [rentalCarType, setRentalCarType] = useState<'economy' | 'medium' | 'luxury'>('economy');
  const [viewMode, setViewMode] = useState<'manual' | 'map'>('manual');
  const [currentGPS, setCurrentGPS] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleCategory>('delivery_car');
  const [showRating, setShowRating] = useState(false);
  const [lastRide, setLastRide] = useState<RideRequest | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [completedRides, setCompletedRides] = useState<RideRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [nearbyDriversLoading, setNearbyDriversLoading] = useState(false);
  const [lastDriversFetchTime, setLastDriversFetchTime] = useState(0);
  const [isTabVisible, setIsTabVisible] = useState(true);

  // Track page visibility to suspend active listeners while tab is in the background
  useEffect(() => {
    const handleVisibility = () => {
      setIsTabVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Fetch completed rides for history
  useEffect(() => {
    if (!showHistory || !user.uid) return;
    
    setHistoryLoading(true);
    const q = query(
      collection(db, 'rides'),
      where('passengerId', '==', user.uid),
      where('status', '==', 'completed'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    getDocs(q).then((snapshot) => {
      const rides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RideRequest));
      setCompletedRides(rides);
    }).catch(error => {
      console.error("Error fetching history:", error);
    }).finally(() => {
      setHistoryLoading(false);
    });
  }, [showHistory, user.uid]);

  const vehicleOptions = [
    { id: 'delivery_car', name: 'كراء سيارات', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'delivery_truck_large', name: 'كراء سيارة + سائق', icon: UserIcon, color: 'text-purple-500', bg: 'bg-purple-50' }
  ];

  const getAddress = async (lat: number, lng: number) => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return '';
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const parts = data.display_name?.split(',') || [];
      const shortAddress = parts.slice(0, 3).join(',').trim();
      
      return shortAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
      console.warn('Geocoding notice: Falling back to coordinates.');
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  };

  const searchAddress = async (query: string, type: 'pickup' | 'destination') => {
    if (!query.trim()) return null;
    setAddressLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&accept-language=ar&limit=1`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      if (data && data.length > 0 && data[0].display_name) {
        const result = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          address: String(data[0].display_name).split(',').slice(0, 3).join(',').trim()
        };
        if (type === 'pickup') {
          setPickup(result);
          setManualPickup(result.address);
        } else {
          setDestination(result);
          setManualDestination(result.address);
        }
        return result;
      }
      return null;
    } catch (error) {
      console.error('Search error:', error);
      return null;
    } finally {
      setAddressLoading(false);
    }
  };

  useEffect(() => {
    if (pickup?.address) setManualPickup(pickup.address);
    if (destination?.address) setManualDestination(destination.address);
  }, [pickup, destination]);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Listen for active ride
    const q = query(
      collection(db, 'rides'),
      where('passengerId', '==', user.uid),
      where('status', 'in', ['pending', 'accepted', 'completed']),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const rideData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as RideRequest;
        
        // Notify on status transition
        const prevStatus = prevRideStatusRef.current;
        if (prevStatus !== null && prevStatus !== rideData.status) {
          if (rideData.status === 'accepted') {
            showToast(`تم قبول طلبك بواسطة السائق ${rideData.driverName || ''}!`, 'success');
          } else if (rideData.status === 'completed') {
            showToast('تمت الرحلة بنجاح! شكراً لاستخدامك تطبيقنا.', 'success');
          } else if (rideData.status === 'cancelled') {
            showToast('تم إلغاء الطلب.', 'info');
          }
        }
        prevRideStatusRef.current = rideData.status;

        // Reset requesting state when a ride is detected
        setIsRequesting(false);
        requestingRef.current = false;
        
        if (rideData.status === 'completed') {
          // If it just completed and wasn't treated as lastRide yet
          // Only show rating for rides completed in the last 24 hours
          const createdAt = rideData.createdAt?.seconds ? rideData.createdAt.seconds * 1000 : 0;
          const isRecent = Date.now() - createdAt < 24 * 60 * 60 * 1000;

          if (!rideData.rated && isRecent) {
            setLastRide(rideData);
            setShowRating(true);
            setActiveRide(null);
          } else {
            setActiveRide(null);
            setShowRating(false);
          }
        } else {
          setActiveRide(rideData);
          setShowRating(false);
        }
        
        // Use denormalized driver info if available
        if (rideData.driverId && rideData.driverName) {
          setDriver({
            uid: rideData.driverId,
            displayName: rideData.driverName,
            phoneNumber: rideData.driverPhone,
            role: 'driver',
            email: '' // Not needed for UI
          } as UserProfile);
        } else if (rideData.driverId) {
          // Fallback to fetch if not denormalized yet (for old rides)
          getDoc(doc(db, 'users', rideData.driverId)).then((docSnap) => {
            if (docSnap.exists()) {
              setDriver(docSnap.data() as UserProfile);
            }
          }).catch(() => {
            // Silently fail if permissions are missing, we'll rely on denormalization
          });
        } else {
          setDriver(null);
        }
      } else {
        const prevStatus = prevRideStatusRef.current;
        if (prevStatus === 'pending' || prevStatus === 'accepted') {
          showToast('تم إلغاء الطلب أو انتهاؤه.', 'info');
        }
        prevRideStatusRef.current = null;
        setActiveRide(null);
        setDriver(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'rides');
    });

    return () => unsubscribe();
  }, [user.uid]);

  // Track passenger GPS
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return;
    }

    let watchId: number | null = null;
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (pos?.coords) {
            const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setCurrentGPS(coords);
          }
        },
        (err) => {
          console.warn('Passenger Geolocation notice:', err?.message || 'position unavailable');
        },
        { 
          enableHighAccuracy: false, 
          timeout: 10000, 
          maximumAge: 30000 
        }
      );

      // Initial check
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos?.coords) {
            setCurrentGPS({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        },
        (err) => {
          console.warn('Initial passenger GPS notice:', err?.message || 'not available');
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }
      );
    } catch (e) {
      console.warn('Geolocation initialization notice:', e);
    }

    return () => {
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {}
      }
    };
  }, []);

  // Optimized: Retrieve nearby online drivers via on-demand / throttled polling to preserve reads and cost €0
  const fetchNearbyDrivers = async (force = false) => {
    if (!auth.currentUser || activeRide || !isTabVisible) {
      return;
    }

    const now = Date.now();
    // Only automatic fetch once every 45 seconds unless manually forced
    if (!force && now - lastDriversFetchTime < 45000 && nearbyDrivers.length > 0) {
      return;
    }

    setNearbyDriversLoading(true);
    try {
      const driversQuery = query(
        collection(db, 'users'),
        where('role', '==', 'driver'),
        where('isOnline', '==', true),
        where('isVerified', '==', true),
        where('isSuspended', '==', false),
        where('vehicleType', '==', selectedVehicle),
        limit(20)
      );

      const snapshot = await getDocs(driversQuery);
      const drivers = snapshot.docs.map(doc => ({
        id: doc.id,
        position: doc.data().currentLocation || { lat: 0, lng: 0 }
      })).filter(d => d.position && typeof d.position.lat === 'number' && d.position.lat !== 0);

      setNearbyDrivers(drivers);
      setLastDriversFetchTime(now);
    } catch (e) {
      console.warn("Silent failure loading drivers to ensure smooth experience:", e);
    } finally {
      setNearbyDriversLoading(false);
    }
  };

  useEffect(() => {
    // Sync nearby drivers on vehicle selection or when active ride changes
    fetchNearbyDrivers(true);
  }, [selectedVehicle, activeRide, isTabVisible]);

  // Periodic slow refresh tab fallback (checks every 50 seconds to avoid excessive reads)
  useEffect(() => {
    if (activeRide || !isTabVisible) return;
    const interval = setInterval(() => {
      fetchNearbyDrivers(false);
    }, 50000);
    return () => clearInterval(interval);
  }, [selectedVehicle, activeRide, isTabVisible, lastDriversFetchTime]);

  const handleMapClick = async (latLng: { lat: number; lng: number }) => {
    if (!selecting) return;
    setAddressLoading(true);
    const address = await getAddress(latLng.lat, latLng.lng);
    if (selecting === 'pickup') {
      setPickup({ ...latLng, address });
      setManualPickup(address);
    } else {
      setDestination({ ...latLng, address });
      setManualDestination(address);
    }
    setSelecting(null);
    setAddressLoading(false);
  };

  const requestRide = async () => {
    if (loading || isRequesting || requestingRef.current || activeRide) return;
    
    requestingRef.current = true;
    setIsRequesting(true);
    setLoading(true);

    try {
      let finalPickup = pickup;
      let finalDestination = destination;
      
      // Force get fresh GPS location at high accuracy when button is pressed
      let locToUse = currentGPS;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { 
            enableHighAccuracy: true, 
            timeout: 7000,
            maximumAge: 0 // Force fresh location
          });
        });
        locToUse = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentGPS(locToUse);
        // Also update user profile one last time
        updateDoc(doc(db, 'users', user.uid), { currentLocation: locToUse }).catch(() => {});
      } catch (e) {
        console.warn('Could not get fresh GPS, falling back to state:', e);
        locToUse = locToUse || user.currentLocation;
      }

      const isCarRental = selectedVehicle === 'delivery_car';

      // Determine pickup
      if (pickup && typeof pickup.lat === 'number' && pickup.lat !== 0) {
        finalPickup = pickup;
      } else if (manualPickup.trim().length >= 3) {
        finalPickup = {
          lat: locToUse?.lat || 0,
          lng: locToUse?.lng || 0,
          address: manualPickup.trim()
        };
      } else {
        showToast('يرجى تحديد مكان استلام السيارة عبر الخريطة', 'warning');
        setLoading(false);
        setIsRequesting(false);
        requestingRef.current = false;
        return;
      }

      // Determine destination
      if (isCarRental) {
        finalDestination = {
          lat: 0,
          lng: 0,
          address: ''
        };
      } else {
        if (destination && typeof destination.lat === 'number' && destination.lat !== 0) {
          finalDestination = destination;
        } else if (manualDestination.trim().length >= 3) {
          finalDestination = {
            lat: 0,
            lng: 0,
            address: manualDestination.trim()
          };
        } else {
          showToast('يرجى تحديد الوجهة عبر الخريطة', 'warning');
          setLoading(false);
          setIsRequesting(false);
          requestingRef.current = false;
          return;
        }
      }

      if (selectedVehicle === 'delivery_car' && !rentalPrice.trim()) {
        showToast('يرجى كتابة السعر الذي تريده لكراء السيارة', 'warning');
        setLoading(false);
        setIsRequesting(false);
        requestingRef.current = false;
        return;
      }

      const rideData: any = {
        passengerId: user.uid,
        passengerName: user.displayName || '',
        passengerPhone: user.phoneNumber || '',
        status: 'pending',
        vehicleType: selectedVehicle,
        isManual: viewMode === 'manual',
        pickup: finalPickup,
        destination: finalDestination,
        cargoDetails: selectedVehicle === 'delivery_car'
          ? `[السعر المقترح: ${rentalPrice} د.ت] ${cargoDetails}`
          : cargoDetails,
        createdAt: serverTimestamp(),
      };

      if (locToUse) {
        rideData.passengerGPS = locToUse;
      }

      await addDoc(collection(db, 'rides'), rideData);
      // We wait for the listener to set activeRide and reset isRequesting
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'rides');
      console.error('Error requesting ride:', error);
      setIsRequesting(false);
      requestingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1?: number, lon1?: number, lat2?: number, lon2?: number) => {
    if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || typeof lat2 !== 'number' || typeof lon2 !== 'number') return 0;
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const cancelRide = async () => {
    if (!activeRide) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), { status: 'cancelled' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rides/${activeRide.id}`);
      console.error('Error cancelling ride:', error);
    }
  };

  const submitRating = async (rating: number) => {
    if (!lastRide || !lastRide.driverId) return;
    try {
      const driverRef = doc(db, 'users', lastRide.driverId);
      const driverSnap = await getDoc(driverRef);
      
      if (driverSnap.exists()) {
        const driverData = driverSnap.data();
        const currentTotal = driverData.totalRatings || 0;
        const currentRating = driverData.rating || 5;
        const positiveCount = driverData.positiveRatings || 0;
        const negativeCount = driverData.negativeRatings || 0;
        
        const newTotal = currentTotal + 1;
        const newRating = ((currentRating * currentTotal) + rating) / newTotal;
        
        const updates: any = {
          rating: Number(newRating.toFixed(1)),
          totalRatings: newTotal
        };

        if (rating === 5) {
          updates.positiveRatings = positiveCount + 1;
        } else if (rating === 1) {
          updates.negativeRatings = negativeCount + 1;
        }
        
        await updateDoc(driverRef, updates);
      }
      
      await updateDoc(doc(db, 'rides', lastRide.id), { rated: true });
      setShowRating(false);
      setLastRide(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${lastRide.driverId}`);
      console.error('Error submitting rating:', error);
    }
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-gray-50">
      {/* Header with Profile Button */}
      <div className="absolute top-4 right-4 z-[1002] flex items-center gap-3">
        <button 
          onClick={() => setShowHistory(true)}
          className="bg-white p-3 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-2 hover:bg-gray-50 transition-all active:scale-95 group"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100 group-hover:rotate-12 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
          <span className="font-bold text-gray-700 ml-1">سجل الطلبات</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'map' ? (
          <motion.div 
            key="map-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 relative h-full"
          >
            <MapView 
              center={currentGPS || undefined}
              onMapClick={handleMapClick}
              markers={[
                ...(pickup && typeof pickup.lat === 'number' ? [{ id: 'pickup', position: { lat: pickup.lat, lng: pickup.lng }, title: 'Pickup' }] : []),
                ...(destination && typeof destination.lat === 'number' ? [{ id: 'destination', position: { lat: destination.lat, lng: destination.lng }, title: 'Destination' }] : []),
                ...nearbyDrivers.filter(d => d.position && typeof d.position.lat === 'number').map(d => ({ id: d.id, position: d.position, title: 'Driver' }))
              ]}
            />
            
            {/* Map Controls */}
            <div className="absolute top-4 left-4 right-4 z-[1000] space-y-2">
              <button 
                onClick={() => setViewMode('manual')}
                className="bg-white p-3 rounded-xl shadow-lg flex items-center gap-2 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                dir="rtl"
              >
                <ArrowRight className="w-5 h-5" /> العودة لتفاصيل الطلب
              </button>
              
              <div className="bg-white p-4 rounded-2xl shadow-xl border border-gray-100 space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${pickup ? 'bg-blue-600' : 'bg-gray-300'}`} />
                  <button 
                    onClick={() => setSelecting('pickup')}
                    className={`flex-1 text-right p-3 rounded-xl text-sm transition-all ${selecting === 'pickup' ? 'bg-blue-50 border-2 border-blue-500 font-bold text-blue-700' : 'bg-gray-50 text-gray-500'}`}
                  >
                    {pickup ? pickup.address : 'اضغط هنا ثم انقر على الخريطة لتحديد مكان استلام السيارة'}
                  </button>
                </div>
                {selectedVehicle !== 'delivery_car' && (
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${destination ? 'bg-red-600' : 'bg-gray-300'}`} />
                    <button 
                      onClick={() => setSelecting('destination')}
                      className={`flex-1 text-right p-3 rounded-xl text-sm transition-all ${selecting === 'destination' ? 'bg-red-50 border-2 border-red-500 font-bold text-red-700' : 'bg-gray-50 text-gray-500'}`}
                    >
                      {destination ? destination.address : 'اضغط هنا ثم انقر على الخريطة لتحديد الوجهة'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom confirmation return button */}
            {pickup?.address && (
              <div className="absolute bottom-6 left-4 right-4 z-[1000]">
                <button
                  type="button"
                  onClick={() => setViewMode('manual')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-base"
                  dir="rtl"
                >
                  <Check className="w-5 h-5 text-white" />
                  <span>تأكيد الموقع والعودة لتفاصيل الطلب</span>
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="manual-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col p-6 pt-12 overflow-y-auto no-scrollbar"
          >
            {/* Live Broadcast Indicator */}
            <div className="flex items-center justify-center mb-5" dir="rtl">
              <div 
                id="live-providers-indicator"
                className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-emerald-50 border border-emerald-200/90 text-emerald-800 rounded-full shadow-sm"
              >
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-black tracking-wide">
                  يوجد مزودين متصلين في منطقتك
                </span>
              </div>
            </div>

            <div className="text-center mb-8">
              <div className="bg-blue-600 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-200">
                <Car className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-black text-gray-800">طلب كراء سيارة</h2>
              <p className="text-gray-500">حدد مكان الاستلام عبر الخريطة وأكمل بيانات طلبك</p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-2xl shadow-gray-200 space-y-6 border border-gray-100">
              {/* Vehicle Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-700 text-right">نوع الفئة</label>
                <div className="grid grid-cols-2 gap-3">
                  {vehicleOptions.map((v) => {
                    const isActive = selectedVehicle === v.id;

                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setSelectedVehicle(v.id as VehicleCategory);
                        }}
                        className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all relative ${
                          isActive 
                            ? 'bg-blue-600 border-blue-600' 
                            : 'bg-white border-gray-100 hover:border-blue-200 shadow-sm'
                        }`}
                      >
                        {v.id === 'delivery_car' ? (
                          <div className="flex items-center gap-1 mb-1">
                            <Clock className={`w-6 h-6 ${isActive ? 'text-white' : v.color}`} />
                            <Car className={`w-6 h-6 ${isActive ? 'text-white' : v.color}`} />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 mb-1">
                            <Car className={`w-6 h-6 ${isActive ? 'text-white' : v.color}`} />
                            <UserIcon className={`w-6 h-6 ${isActive ? 'text-white' : v.color}`} />
                          </div>
                        )}
                        <span className={`text-[10px] font-bold text-center px-1 ${isActive ? 'text-white' : 'text-gray-600'}`}>
                          {v.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                {/* Pickup Location Selection via Map */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700 text-right">مكان استلام السيارة</label>
                  {pickup?.address || manualPickup ? (
                    <div 
                      onClick={() => {
                        setSelecting('pickup');
                        setViewMode('map');
                      }}
                      className="cursor-pointer flex items-center justify-between gap-3 bg-blue-50/80 border-2 border-blue-200 hover:border-blue-500 p-3.5 rounded-2xl transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPickup(null);
                            setManualPickup('');
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          title="إلغاء التحديد"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-bold text-blue-600 bg-white px-2.5 py-1.5 rounded-xl border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          تغيير من الخريطة
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-right flex-1 min-w-0 justify-end">
                        <span className="text-sm font-bold text-gray-800 truncate" dir="rtl">
                          {pickup?.address || manualPickup}
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-200">
                          <MapPin className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => {
                        setSelecting('pickup');
                        setViewMode('map');
                      }}
                      className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-blue-400 bg-blue-50/60 hover:bg-blue-50 hover:border-blue-600 text-blue-700 font-bold transition-all flex items-center justify-center gap-2.5 group shadow-sm active:scale-[0.99]"
                    >
                      <MapPin className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                      <span className="text-sm">حدد نقطة استلام السيارة عبر الخريطة</span>
                    </button>
                  )}
                </div>

                {selectedVehicle !== 'delivery_car' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 text-right">الوجهة</label>
                    {destination?.address || manualDestination ? (
                      <div 
                        onClick={() => {
                          setSelecting('destination');
                          setViewMode('map');
                        }}
                        className="cursor-pointer flex items-center justify-between gap-3 bg-red-50/80 border-2 border-red-200 hover:border-red-500 p-3.5 rounded-2xl transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDestination(null);
                              setManualDestination('');
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                            title="إلغاء التحديد"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <span className="text-xs font-bold text-red-600 bg-white px-2.5 py-1.5 rounded-xl border border-red-100 group-hover:bg-red-600 group-hover:text-white transition-colors">
                            تغيير من الخريطة
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 text-right flex-1 min-w-0 justify-end">
                          <span className="text-sm font-bold text-gray-800 truncate" dir="rtl">
                            {destination?.address || manualDestination}
                          </span>
                          <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-red-200">
                            <Navigation className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => {
                          setSelecting('destination');
                          setViewMode('map');
                        }}
                        className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-red-300 bg-red-50/50 hover:bg-red-50 hover:border-red-500 text-red-700 font-bold transition-all flex items-center justify-center gap-2.5 group shadow-sm active:scale-[0.99]"
                      >
                        <Navigation className="w-5 h-5 text-red-600 group-hover:scale-110 transition-transform" />
                        <span className="text-sm">حدد الوجهة عبر الخريطة</span>
                      </button>
                    )}
                  </div>
                )}

                {selectedVehicle === 'delivery_car' && (
                  <div className="space-y-4">
                    {/* Write the price you want */}
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-700 text-right">اكتب السعر الذي تريده</label>
                      <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-4 py-1 border-2 border-transparent focus-within:border-blue-500 transition-all">
                        <input 
                          type="text"
                          value={rentalPrice}
                          onChange={(e) => setRentalPrice(e.target.value)}
                          placeholder="مثال: 15"
                          className="flex-1 bg-transparent border-none text-sm py-3 focus:outline-none text-right font-bold text-gray-800"
                          dir="rtl"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-700 text-right mb-1">تفاصيل كراء السيارة</label>
                      <div className="bg-gray-50 rounded-2xl px-4 py-3 border-2 border-transparent focus-within:border-blue-500 transition-all">
                        <textarea 
                          value={cargoDetails}
                          onChange={(e) => setCargoDetails(e.target.value)}
                          placeholder="اكتب تفاصيل الكراء هنا (مثال: عدد الساعات المطلوبة، الغرض من الكراء، أو أي متطلبات خاصة...)"
                          className="w-full bg-transparent border-none text-sm focus:outline-none text-right resize-none"
                          rows={3}
                          dir="rtl"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedVehicle === 'delivery_truck_large' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 text-right mb-1">تفاصيل كراء سيارة + سائق</label>
                    <div className="bg-gray-50 rounded-2xl px-4 py-3 border-2 border-transparent focus-within:border-purple-500 transition-all">
                      <textarea 
                        value={cargoDetails}
                        onChange={(e) => setCargoDetails(e.target.value)}
                        placeholder="اكتب تفاصيل كراء السيارة مع السائق هنا (مثال: عدد الساعات أو الأيام المطلوبة، الوجهات المقصودة...)"
                        className="w-full bg-transparent border-none text-sm focus:outline-none text-right resize-none"
                        rows={3}
                        dir="rtl"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Manual Mode Request Button - Inline to avoid covering other elements */}
            <AnimatePresence>
              {!activeRide && (pickup?.address || manualPickup.trim().length > 2) && (selectedVehicle === 'delivery_car' || destination?.address || manualDestination.trim().length > 2) && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="mt-8"
                >
                  <button
                    onClick={requestRide}
                    disabled={loading || isRequesting || addressLoading}
                    className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold text-xl shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {loading || addressLoading ? <Loader2 className="animate-spin w-6 h-6" /> : <Car className="w-6 h-6" />}
                    اطلب الآن
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Ride & Rating Modals */}
      <AnimatePresence>
        {(activeRide || isRequesting) && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="absolute bottom-0 left-0 right-0 bg-white p-6 rounded-t-3xl shadow-2xl z-[1001]"
          >
            {(!activeRide || activeRide.status === 'pending') ? (
              <div className="text-center py-8">
                <div className="relative inline-block mb-4">
                  <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                  <Car className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">جاري البحث عن سائق...</h3>
                <p className="text-gray-500 mb-6">طلبك يظهر الآن للسائقين القريبين منك</p>
                <button 
                  onClick={() => {
                    if (activeRide) {
                      cancelRide();
                    } else {
                      setIsRequesting(false);
                      requestingRef.current = false;
                    }
                  }}
                  className="text-red-500 font-bold flex items-center gap-2 mx-auto"
                >
                  <X className="w-4 h-4" /> إلغاء الطلب
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <UserIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{driver?.displayName || 'سائق'}</h3>
                      <div className="flex items-center gap-2" dir="rtl">
                        <div className="flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-lg border border-green-100">
                          <span className="text-[11px] font-black text-green-600">{activeRide.driverPositiveRatings || driver?.positiveRatings || 0}</span>
                          <span className="text-[10px] font-bold text-green-500">جيد</span>
                        </div>
                        <div className="flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">
                          <span className="text-[11px] font-black text-red-600">{activeRide.driverNegativeRatings || driver?.negativeRatings || 0}</span>
                          <span className="text-[10px] font-bold text-red-500">سيء</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a 
                      href={`https://wa.me/${(() => {
                        let cleaned = driver?.phoneNumber?.replace(/\D/g, '').replace(/^0+/, '') || '';
                        if (cleaned.length === 8) cleaned = '216' + cleaned;
                        return cleaned;
                      })()}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="p-4 bg-green-100 text-green-600 rounded-2xl"
                    >
                      <MessageCircle className="w-6 h-6" />
                    </a>
                    <a href={`tel:${driver?.phoneNumber}`} className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                      <Phone className="w-6 h-6" />
                    </a>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                      <Navigation className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-blue-800">تم قبول طلبك</span>
                  </div>
                </div>

                <button 
                  onClick={cancelRide}
                  className="w-full py-3 text-gray-400 font-semibold hover:text-red-500 transition-colors"
                >
                  إلغاء الطلب
                </button>
              </div>
            )}
          </motion.div>
        )}

        {showRating && lastRide && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[40px] p-8 text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Star className="w-10 h-10 text-yellow-500 fill-current" />
              </div>
              <h3 className="text-2xl font-black text-gray-800 mb-2">كيف كانت رحلتك؟</h3>
              <p className="text-gray-500 mb-8">تقييمك يساعدنا على تحسين جودة الخدمة واختيار أفضل السائقين</p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => submitRating(5)}
                  className="flex flex-col items-center gap-3 p-6 bg-green-50 rounded-3xl border-2 border-green-100 hover:bg-green-100 transition-all active:scale-95 group"
                >
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-100 group-hover:rotate-12 transition-transform">
                    <Star className="w-6 h-6 fill-current" />
                  </div>
                  <span className="font-bold text-green-700">جيد جداً</span>
                </button>
                
                <button 
                  onClick={() => submitRating(1)}
                  className="flex flex-col items-center gap-3 p-6 bg-red-50 rounded-3xl border-2 border-red-100 hover:bg-red-100 transition-all active:scale-95 group"
                >
                  <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-100 group-hover:-rotate-12 transition-transform">
                    <Star className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-red-700">سيء</span>
                </button>
              </div>

              <button 
                 onClick={async () => { 
                   if (lastRide) {
                     try {
                       await updateDoc(doc(db, 'rides', lastRide.id), { rated: true });
                     } catch (error) {
                       console.error('Error skipping rating:', error);
                     }
                   }
                   setShowRating(false); 
                   setLastRide(null); 
                 }}
                 className="mt-8 text-gray-400 font-bold hover:text-gray-600 transition-colors"
              >
                تخطي التقييم
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-lg h-[80vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden"
              dir="rtl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black">سجل الطلبات المكتملة</h3>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {historyLoading ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <p className="font-bold text-gray-500">جاري جلب الطلبات...</p>
                  </div>
                ) : completedRides.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                      <Car className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="font-bold text-gray-500">لا توجد طلبات مكتملة حتى الآن</p>
                  </div>
                ) : (
                  completedRides.map((ride) => (
                    <div key={ride.id} className="bg-gray-50 p-5 rounded-3xl border border-gray-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100">
                            <UserIcon className="w-6 h-6 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-bold mb-0.5">سائق الرحلة</p>
                            <p className="font-black text-gray-800">{ride.driverName || 'سائق VAYO'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <a 
                             href={`https://wa.me/${(() => {
                               let cleaned = ride.driverPhone?.replace(/\D/g, '').replace(/^0+/, '') || '';
                               if (cleaned.length === 8) cleaned = '216' + cleaned;
                               return cleaned;
                             })()}`}
                             target="_blank"
                             rel="noreferrer"
                             className="p-3 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 transition-colors"
                          >
                            <MessageCircle className="w-5 h-5" />
                          </a>
                          <a href={`tel:${ride.driverPhone}`} className="p-3 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-colors">
                            <Phone className="w-5 h-5" />
                          </a>
                        </div>
                      </div>

                      <div className="space-y-3 bg-white p-4 rounded-2xl border border-gray-50">
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-blue-500 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-gray-400 font-bold">من:</p>
                            <p className="text-sm font-bold text-gray-700 leading-tight">{ride.pickup.address}</p>
                          </div>
                        </div>
                        {ride.destination?.address && !ride.destination.address.includes('لا توجد وجهة') && ride.destination.address.trim() !== '' && (
                          <div className="flex items-start gap-3">
                            <Navigation className="w-5 h-5 text-red-500 mt-0.5" />
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold">إلى:</p>
                              <p className="text-sm font-bold text-gray-700 leading-tight">{ride.destination.address}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span className="text-[11px] font-bold">
                            {ride.createdAt?.seconds ? new Date(ride.createdAt.seconds * 1000).toLocaleDateString('ar-TN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}
                          </span>
                        </div>
                        <div className="bg-green-50 px-3 py-1 rounded-lg border border-green-100">
                          <span className="text-[10px] font-black text-green-600 uppercase">مكتملة</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    );
  }
