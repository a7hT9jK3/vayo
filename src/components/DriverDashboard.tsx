import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, serverTimestamp, limit, orderBy, getDocs } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import MapView from './Map';
import { MapPin, Navigation, Car, Loader2, Check, X, Star, User as UserIcon, Phone, Power, ShieldAlert, Clock, ShieldCheck, MessageCircle, Truck, Box } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, RideRequest, RideStatus, VehicleCategory } from '../types';
import { useToast } from './Toast';

interface DriverDashboardProps {
  user: UserProfile;
}

const calculateDistance = (lat1?: number, lon1?: number, lat2?: number, lon2?: number) => {
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || typeof lat2 !== 'number' || typeof lon2 !== 'number' || lat1 === 0 || lat2 === 0) return null;
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

const getBestCoords = (ride: RideRequest) => {
  // Rely strictly on the exact pickup point selected on the map by the passenger
  if (ride.pickup && typeof ride.pickup.lat === 'number' && ride.pickup.lat !== 0) {
    return ride.pickup;
  }
  return null;
};

export default function DriverDashboard({ user }: DriverDashboardProps) {
  const { showToast } = useToast();
  const prevPendingCountRef = useRef<number | null>(null);
  const prevActiveRideRef = useRef<boolean>(false);
  const [isOnline, setIsOnline] = useState(user.isOnline || false);
  const [pendingRides, setPendingRides] = useState<RideRequest[]>([]);
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [passenger, setPassenger] = useState<UserProfile | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(user.currentLocation || null);
  const [prevRidesCount, setPrevRidesCount] = useState(0);
  const [viewMode, setViewMode] = useState<'requests' | 'map'>('requests');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [completedRides, setCompletedRides] = useState<RideRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);

  // Track page visibility to suspend heavy background listeners
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
      where('driverId', '==', user.uid),
      where('status', '==', 'completed'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    getDocs(q).then((snapshot) => {
      const rides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RideRequest));
      setCompletedRides(rides);
    }).catch(error => {
      console.error("Error fetching driver history:", error);
    }).finally(() => {
      setHistoryLoading(false);
    });
  }, [showHistory, user.uid]);

  useEffect(() => {
    if (isOnline && pendingRides.length > prevRidesCount) {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3');
      audio.volume = 1.0;
      audio.play().catch(e => console.log('Audio play failed:', e));
    }
    setPrevRidesCount(pendingRides.length);
  }, [pendingRides.length, isOnline]);

  useEffect(() => {
    // Try to get location immediately on mount if not available
    if (typeof window !== 'undefined' && navigator.geolocation && !currentLocation && isOnline && auth.currentUser && user.uid === auth.currentUser.uid) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos?.coords) {
            const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setCurrentLocation(coords);
            updateDoc(doc(db, 'users', user.uid), { currentLocation: coords }).catch(() => {});
          }
        },
        (err) => {
          console.warn('Initial driver GPS notice:', err?.message || 'position unavailable');
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
      );
    }
  }, [isOnline, user.uid]);

  // GPS Tracking and Online Status Update - HIGHLY OPTIMIZED (Distance-checked + Time-throttled to approach 0 writes)
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation || !isOnline || !auth.currentUser || user.uid !== auth.currentUser.uid) {
      return;
    }

    let lastUpdateTime = 0;
    let lastLoggedCoords: { lat: number, lng: number } | null = null;
    const UPDATE_INTERVAL = 40000; // Update Firestore every 40 seconds at most if moving
    const GPS_HEARTBEAT_MAX = 90000; // Force update as heartbeat once every 90 seconds if stopped
    const DISTANCE_THRESHOLD = 0.0006; // Roughly 60-70 meters in degrees difference
    let watchId: number | null = null;

    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!pos?.coords) return;
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(coords);
          setGpsError(null);
          
          const now = Date.now();
          let shouldUpdate = false;

          if (!lastLoggedCoords) {
            shouldUpdate = true;
          } else {
            const latDiff = Math.abs(coords.lat - lastLoggedCoords.lat);
            const lngDiff = Math.abs(coords.lng - lastLoggedCoords.lng);
            const hasMovedSignificantly = latDiff > DISTANCE_THRESHOLD || lngDiff > DISTANCE_THRESHOLD;
            const isTimeElapsed = now - lastUpdateTime > UPDATE_INTERVAL;

            if (now - lastUpdateTime > GPS_HEARTBEAT_MAX) {
              // Heartbeat fallback
              shouldUpdate = true;
            } else if (isTimeElapsed && hasMovedSignificantly) {
              // Moved enough and minimum update interval passed
              shouldUpdate = true;
            }
          }

          if (shouldUpdate) {
            lastUpdateTime = now;
            lastLoggedCoords = coords;
            updateDoc(doc(db, 'users', user.uid), { 
              currentLocation: coords,
              lastLocationUpdate: serverTimestamp()
            }).catch(err => {
              console.warn('Silent Firestore location update failure:', err.message);
            });
          }
        },
        (err) => {
          console.warn('Driver geolocation notice:', err?.message || 'position unavailable');
          
          // If high accuracy failed, try falling back to low accuracy
          if (err?.code === 3 || err?.code === 2) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (pos?.coords) {
                  const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                  setCurrentLocation(coords);
                  setGpsError(null);
                }
              },
              () => {}, // Silent failure on fallback
              { enableHighAccuracy: false, timeout: 6000 }
            );
          }

          let errorMsg = 'حدث خطأ في تحديد الموقع.';
          if (err?.code === 1) {
            errorMsg = 'يرجى تفعيل صلاحية الوصول للموقع (GPS) من إعدادات المتصفح.';
          } else if (err?.code === 3) {
            errorMsg = 'تأخر الرد من نظام تحديد المواقع. يرجى التأكد من تشغيل GPS.';
          } else {
            errorMsg = 'يرجى تفعيل نظام تتبع الموقع لاستقبال الطلبات.';
          }
          setGpsError(errorMsg);
        },
        { 
          enableHighAccuracy: false, 
          timeout: 20000, 
          maximumAge: 15000 
        }
      );
    } catch (e) {
      console.warn('Driver watchPosition initialization notice:', e);
    }

    return () => {
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {}
      }
    };
  }, [user.uid, isOnline]);

  // Listen for pending rides - SUSPENDS when driver is Offline or Tab is Passive to save active reads
  useEffect(() => {
    if (!auth.currentUser || !isOnline || !isTabVisible) {
      setPendingRides([]);
      setIsInitialLoading(false);
      return;
    }

    const pendingQuery = query(
      collection(db, 'rides'),
      where('status', '==', 'pending'),
      where('vehicleType', '==', user.vehicleType || 'delivery_car'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    console.log('Driver sub for:', user.vehicleType || 'delivery_car');

    const unsubscribePending = onSnapshot(pendingQuery, (snapshot) => {
      console.log('Pending rides snapshot size:', snapshot.size);
      const rides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RideRequest));
      setPendingRides(rides);
      setIsInitialLoading(false);

      const prevCount = prevPendingCountRef.current;
      if (prevCount !== null && rides.length > prevCount) {
        showToast('هناك طلب رحلة جديد متوافق مع مركبتك!', 'info');
      }
      prevPendingCountRef.current = rides.length;
    }, (error) => {
      console.error('Pending rides query error:', error);
      handleFirestoreError(error, OperationType.GET, 'rides');
      setIsInitialLoading(false);
    });

    return () => unsubscribePending();
  }, [user.vehicleType, isOnline, isTabVisible]);

  // Listen for active ride
  useEffect(() => {
    if (!auth.currentUser) return;

    const activeQuery = query(
      collection(db, 'rides'),
      where('driverId', '==', user.uid),
      where('status', '==', 'accepted')
    );

    const unsubscribeActive = onSnapshot(activeQuery, (snapshot) => {
      if (!snapshot.empty) {
        const rideData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as RideRequest;
        setActiveRide(rideData);
        prevActiveRideRef.current = true;
        
        // Use denormalized passenger info if available
        if (rideData.passengerName) {
          setPassenger({
            uid: rideData.passengerId,
            displayName: rideData.passengerName,
            phoneNumber: rideData.passengerPhone,
            role: 'passenger',
            email: '' // Not needed for UI
          } as UserProfile);
        } else {
          // Fallback to fetch if not denormalized yet
          getDoc(doc(db, 'users', rideData.passengerId)).then((docSnap) => {
            if (docSnap.exists()) {
              setPassenger(docSnap.data() as UserProfile);
            }
          }).catch(() => {
            // Silently fail if permissions are missing
          });
        }
      } else {
        if (prevActiveRideRef.current) {
          showToast('تم إنهاء الرحلة النشطة أو إلغاؤها من قِبل الراكب.', 'warning');
          prevActiveRideRef.current = false;
        }
        setActiveRide(null);
        setPassenger(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'rides');
    });

    return () => unsubscribeActive();
  }, [user.uid]);

  const toggleOnline = async () => {
    if (!auth.currentUser || user.uid !== auth.currentUser.uid) return;
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    try {
      await updateDoc(doc(db, 'users', user.uid), { isOnline: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const acceptRide = async (rideId: string) => {
    try {
      const updateData: any = {
        status: 'accepted',
        driverId: user.uid,
        driverName: user.displayName || user.companyName || 'شركة كراء سيارات',
        driverPhone: user.phoneNumber || '',
        driverRating: typeof user.rating === 'number' ? user.rating : 5,
        driverPositiveRatings: typeof user.positiveRatings === 'number' ? user.positiveRatings : 0,
        driverNegativeRatings: typeof user.negativeRatings === 'number' ? user.negativeRatings : 0,
      };

      await updateDoc(doc(db, 'rides', rideId), updateData);
      showToast('تم قبول الطلب بنجاح!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rides/${rideId}`);
      console.error('Error accepting ride:', error);
    }
  };

  const completeRide = async () => {
    if (!activeRide) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), { status: 'completed' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rides/${activeRide.id}`);
      console.error('Error completing ride:', error);
    }
  };

  const rejectRide = async () => {
    if (!activeRide) return;
    try {
      await updateDoc(doc(db, 'rides', activeRide.id), { 
        status: 'pending',
        driverId: null 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rides/${activeRide.id}`);
      console.error('Error rejecting ride:', error);
    }
  };

  const sortedRides = [...pendingRides].sort((a, b) => {
    if (!currentLocation) return 0;
    
    const pickupA = getBestCoords(a);
    const pickupB = getBestCoords(b);
    
    if (!pickupA || !pickupB) return 0;

    const distA = calculateDistance(currentLocation.lat, currentLocation.lng, pickupA.lat, pickupA.lng) || 9999;
    const distB = calculateDistance(currentLocation.lat, currentLocation.lng, pickupB.lat, pickupB.lng) || 9999;
    return distA - distB;
  });

  if (user.isSuspended) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[40px] shadow-2xl max-w-md w-full text-center border-2 border-red-50"
        >
          <div className="mb-6 relative inline-block">
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center">
              <ShieldAlert className="w-12 h-12 text-red-500" />
            </div>
          </div>

          <h2 className="text-2xl font-black text-gray-800 mb-4 tracking-tighter">الحساب معلق</h2>
          <p className="text-gray-500 mb-8 leading-relaxed font-medium">
            تم تعليق حسابك من قبل الإدارة. يرجى مراجعة الدعم الفني أو الإدارة لإعادة تفعيل الحساب.
          </p>

          <div className="space-y-3">
            <a 
              href="https://wa.me/21626071643"
              target="_blank"
              rel="noreferrer"
              className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-100 hover:bg-green-600 transition-all active:scale-95"
            >
              <MessageCircle className="w-5 h-5" />
              تواصل مع الإدارة عبر واتساب
            </a>

            <button 
              onClick={() => auth.signOut()}
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-colors"
            >
              تسجيل الخروج
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user.isVerified) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[40px] shadow-2xl max-w-md w-full text-center border-2 border-blue-50"
        >
          <div className="mb-6 relative inline-block">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center">
              {user.verificationStatus === 'rejected' ? (
                <ShieldAlert className="w-12 h-12 text-red-500" />
              ) : (
                <Clock className="w-12 h-12 text-blue-500 animate-pulse" />
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-lg">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          <h2 className="text-2xl font-black text-gray-800 mb-4 tracking-tighter">
            {user.verificationStatus === 'rejected' ? 'تم رفض الحساب' : 'حساب شركتك قيد المراجعة'}
          </h2>
          
          <p className="text-gray-500 mb-8 leading-relaxed font-medium">
            {user.verificationStatus === 'rejected' 
              ? 'نعتذر، لم يتم قبول حساب شركة الكراء في VAYO. يرجى التواصل مع الإدارة لمزيد من التفاصيل.' 
              : 'أهلاً بك في VAYO! نقوم حالياً بمراجعة وثائق وبيانات شركة كراء السيارات الخاصة بك لضمان أمان وموثوقية المنصة. سيتم مراجعة وتفعيل الحساب من قِبل الإدارة.'}
          </p>

          <div className="space-y-3">
            <div className="bg-blue-50 p-4 rounded-2xl text-blue-700 text-sm font-bold flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>حالة الحساب: {user.verificationStatus === 'rejected' ? 'مرفوض' : 'بانتظار التوثيق'}</span>
            </div>

            <a 
              href="https://wa.me/21626071643"
              target="_blank"
              rel="noreferrer"
              className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-100 hover:bg-green-600 transition-all active:scale-95"
            >
              <MessageCircle className="w-5 h-5" />
              تواصل مع الإدارة عبر واتساب
            </a>
            
            <button 
              onClick={() => auth.signOut()}
              className="w-full py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors"
            >
              تسجيل الخروج
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-gray-50">
      {/* Top Status Bar */}
      <div className="p-4 flex items-center justify-between bg-white shadow-sm z-[1100]">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="font-bold text-gray-800">{isOnline ? 'متصل' : 'غير متصل'}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowHistory(true)}
            className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all active:scale-95"
            title="سجل الطلبات"
          >
            <Clock className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setViewMode(viewMode === 'map' ? 'requests' : 'map')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${viewMode === 'map' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {viewMode === 'map' ? 'عرض الطلبات' : 'عرض الخريطة'}
          </button>
          <button 
            onClick={toggleOnline}
            className={`p-3 rounded-xl transition-all active:scale-95 ${isOnline ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
          >
            <Power className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Live Customers Indicator Bar */}
      <div className="bg-emerald-50/90 border-b border-emerald-100 py-2.5 px-4 flex items-center justify-center shadow-xs z-[1050]" dir="rtl">
        <div 
          id="live-customers-indicator"
          className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-white border border-emerald-200/90 text-emerald-800 rounded-full shadow-xs"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-black tracking-wide">
            يوجد زبائن متصلين في منطقتك
          </span>
        </div>
      </div>

      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {viewMode === 'map' ? (
            <motion.div 
              key="map-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-0"
            >
              <MapView 
                center={currentLocation || undefined}
                markers={[
                  ...(currentLocation ? [{ id: 'driver', position: currentLocation, title: 'You', icon: 'car' as const }] : []),
                  ...(activeRide && activeRide.pickup && typeof activeRide.pickup.lat === 'number' && activeRide.pickup.lat !== 0
                    ? [{ id: 'pickup', position: { lat: activeRide.pickup.lat, lng: activeRide.pickup.lng }, title: 'مكان استلام السيارة' }]
                    : [])
                ]}
              />
            </motion.div>
          ) : (
            <motion.div 
              key="requests-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0 overflow-y-auto p-6 space-y-6"
            >
              {!isOnline ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                    <Power className="w-10 h-10 text-gray-300" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">أنت غير متصل</h3>
                    <p className="text-gray-500">قم بتفعيل وضع الاتصال لاستقبال الطلبات</p>
                  </div>
                  <button 
                    onClick={toggleOnline}
                    className="bg-green-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-green-100"
                  >
                    تفعيل الآن
                  </button>
                </div>
              ) : activeRide ? (
                <div className="space-y-6">
                  <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-xl shadow-blue-100">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                          <UserIcon className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{passenger?.displayName || 'راكب'}</h3>
                          <div className="flex items-center gap-1 text-yellow-300">
                            <Star className="w-4 h-4 fill-current" />
                            <span className="text-sm font-bold">4.9</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a 
                          href={`https://wa.me/${(() => {
                            let cleaned = passenger?.phoneNumber?.replace(/\D/g, '').replace(/^0+/, '') || '';
                            // If it's an 8-digit Tunisian number, prepend 216
                            if (cleaned.length === 8) cleaned = '216' + cleaned;
                            return cleaned;
                          })()}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="p-4 bg-white/20 rounded-2xl backdrop-blur-md"
                        >
                          <MessageCircle className="w-6 h-6 text-white" />
                        </a>
                        <a href={`tel:${passenger?.phoneNumber}`} className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                          <Phone className="w-6 h-6 text-white" />
                        </a>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                        <p className="text-xs text-blue-100 mb-1">المسافة</p>
                        <p className="font-bold text-lg">
                          {(() => {
                            const targetCoords = activeRide ? getBestCoords(activeRide) : null;
                            const distance = (currentLocation && targetCoords)
                              ? calculateDistance(currentLocation.lat, currentLocation.lng, targetCoords.lat, targetCoords.lng)
                              : null;
                            
                            if (distance !== null) {
                              return distance < 1 ? `${(distance * 1000).toFixed(0)} متر` : `${distance.toFixed(1)} كم`;
                            }
                            return !currentLocation ? 'GPS معطل' : 'موقع غير معروف';
                          })()}
                        </p>
                      </div>
                      <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                        <p className="text-xs text-blue-100 mb-1">الحالة</p>
                        <p className="font-bold text-lg">رحلة نشطة</p>
                      </div>
                    </div>
                  </div>

                  {activeRide.vehicleType === 'delivery_car' && activeRide.cargoDetails && (
                    <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                      <div className="flex items-center gap-2 mb-2 text-amber-800">
                        <div className="flex items-center gap-1">
                          <Clock className="w-5 h-5" />
                          <Car className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold">تفاصيل كراء السيارة:</h4>
                      </div>
                      <p className="text-gray-700 font-medium text-right" dir="rtl">
                        {activeRide.cargoDetails}
                      </p>
                    </div>
                  )}

                  {activeRide.vehicleType === 'delivery_truck_large' && activeRide.cargoDetails && (
                    <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100">
                      <div className="flex items-center gap-2 mb-2 text-purple-800">
                        <div className="flex items-center gap-1">
                          <Car className="w-5 h-5" />
                          <UserIcon className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold">تفاصيل كراء السيارة والسائق:</h4>
                      </div>
                      <p className="text-gray-700 font-medium text-right" dir="rtl">
                        {activeRide.cargoDetails}
                      </p>
                    </div>
                  )}

                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">موقع الانطلاق</p>
                        <p className="font-bold text-gray-800">{activeRide.pickup?.address || '---'}</p>
                      </div>
                    </div>
                    {activeRide.destination?.address && !activeRide.destination.address.includes('لا توجد وجهة') && activeRide.destination.address.trim() !== '' && activeRide.destination.address !== '---' && (
                      <div className="flex items-start gap-3">
                        <div className="mt-1 p-2 bg-red-50 text-red-600 rounded-lg">
                          <Navigation className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">الوجهة</p>
                          <p className="font-bold text-gray-800">{activeRide.destination.address}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={rejectRide}
                      className="flex-1 bg-red-50 text-red-600 py-4 rounded-2xl font-bold hover:bg-red-100 transition-colors"
                    >
                      إلغاء
                    </button>
                    <button 
                      onClick={completeRide}
                      className="flex-[2] bg-green-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-green-700 transition-colors"
                    >
                      إتمام الرحلة
                    </button>
                  </div>
                </div>
              ) : sortedRides.length > 0 ? (
                <div className="space-y-4 pb-20">
                  <h3 className="text-lg font-bold text-gray-800 px-2">الطلبات المتاحة ({sortedRides.length})</h3>
                  {sortedRides.map((ride) => {
                    const targetCoords = getBestCoords(ride);
                    
                    const distance = (currentLocation && targetCoords)
                      ? calculateDistance(currentLocation.lat, currentLocation.lng, targetCoords.lat, targetCoords.lng)
                      : null;

                    return (
                      <motion.div 
                        key={ride.id}
                        layout
                        className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex gap-2">
                            <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-bold">
                              موقع محدد على الخريطة
                            </span>
                            <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                              {ride.vehicleType === 'delivery_truck_large' ? 'كراء سيارة + سائق' : 'كراء سيارات'}
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1.5 text-blue-600 font-black">
                              <Navigation className="w-3.5 h-3.5 rotate-45" />
                              <span className="text-sm">
                                {distance !== null 
                                  ? (distance < 1 ? `${(distance * 1000).toFixed(0)} م` : `${distance.toFixed(1)} كم`)
                                  : (!currentLocation ? 'GPS معطل' : 'موقع غير معروف')}
                              </span>
                            </div>
                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">عن موقعك الآن</span>
                          </div>
                        </div>
                        <div className="space-y-4 mb-6">
                          <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-blue-500 mt-0.5" />
                            <span className="text-sm font-bold text-gray-700">{ride.pickup?.address || '---'}</span>
                          </div>
                          {ride.destination?.address && !ride.destination.address.includes('لا توجد وجهة') && ride.destination.address.trim() !== '' && ride.destination.address !== '---' && (
                            <div className="flex items-start gap-3">
                              <Navigation className="w-5 h-5 text-red-500 mt-0.5" />
                              <span className="text-sm font-bold text-gray-700">{ride.destination.address}</span>
                            </div>
                          )}

                          {ride.vehicleType === 'delivery_car' && ride.cargoDetails && (
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                              <p className="text-[10px] text-gray-400 mb-1 font-bold">تفاصيل كراء السيارة</p>
                              <p className="text-xs text-gray-700 font-medium line-clamp-2" dir="rtl">{ride.cargoDetails}</p>
                            </div>
                          )}

                          {ride.vehicleType === 'delivery_truck_large' && ride.cargoDetails && (
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                              <p className="text-[10px] text-purple-600 mb-1 font-bold">تفاصيل كراء السيارة والسائق</p>
                              <p className="text-xs text-gray-700 font-medium line-clamp-2" dir="rtl">{ride.cargoDetails}</p>
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => acceptRide(ride.id)}
                          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                        >
                          قبول الطلب
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              ) : gpsError ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
                    <MapPin className="w-10 h-10 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">مشكلة في الموقع</h3>
                    <p className="text-gray-500">{gpsError}</p>
                  </div>
                </div>
              ) : isInitialLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-blue-200 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">جاري البحث عن طلبات...</h3>
                    <p className="text-gray-500">ستظهر الطلبات الجديدة هنا فور توفرها</p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                    <Car className="w-10 h-10 text-gray-300" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">لا توجد طلبات حالياً</h3>
                    <p className="text-gray-500">أنت متصل وجاهز لاستقبال الطلبات الجديدة</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
              className="bg-white w-full max-w-lg h-[80vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden"
              dir="rtl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black">سجل المهام المكتملة</h3>
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
                    <p className="font-bold text-gray-500">جاري جلب السجل...</p>
                  </div>
                ) : completedRides.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                      <Check className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="font-bold text-gray-500">لا توجد مهام مكتملة بعد</p>
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
                            <p className="text-xs text-gray-400 font-bold mb-0.5">الراكب</p>
                            <p className="font-black text-gray-800">{ride.passengerName || 'عميل VAYO'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <a 
                             href={`https://wa.me/${(() => {
                               let cleaned = ride.passengerPhone?.replace(/\D/g, '').replace(/^0+/, '') || '';
                               if (cleaned.length === 8) cleaned = '216' + cleaned;
                               return cleaned;
                             })()}`}
                             target="_blank"
                             rel="noreferrer"
                             className="p-3 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 transition-colors"
                          >
                            <MessageCircle className="w-5 h-5" />
                          </a>
                          <a href={`tel:${ride.passengerPhone}`} className="p-3 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-colors">
                            <Phone className="w-5 h-5" />
                          </a>
                        </div>
                      </div>

                      <div className="space-y-3 bg-white p-4 rounded-2xl border border-gray-50">
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-blue-500 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-gray-400 font-bold">نقطة الانطلاق:</p>
                            <p className="text-sm font-bold text-gray-700 leading-tight">{ride.pickup.address}</p>
                          </div>
                        </div>
                        {ride.destination?.address && !ride.destination.address.includes('لا توجد وجهة') && ride.destination.address.trim() !== '' && (
                          <div className="flex items-start gap-3">
                            <Navigation className="w-5 h-5 text-red-500 mt-0.5" />
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold">الوجهة:</p>
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
                          <span className="text-[10px] font-black text-green-600 uppercase tracking-tighter">مهمة ناجحة</span>
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
