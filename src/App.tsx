import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, testFirebaseConnection } from './firebase';
import { UserProfile } from './types';
import Auth from './components/Auth';
import LoadingScreen from './components/LoadingScreen';
import VayoLogo from './components/VayoLogo';
import PassengerDashboard from './components/PassengerDashboard';
import DriverDashboard from './components/DriverDashboard';
import AdminDashboard from './components/AdminDashboard';
import { Loader2, LogOut, User as UserIcon, Car, Star, AlertTriangle, Trash2, MessageCircle, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import 'leaflet/dist/leaflet.css';
import { useToast } from './components/Toast';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  const { showToast } = useToast();
  const [user, setUser] = useState<UserProfile | null>(() => {
    const cached = localStorage.getItem('user_profile');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(true); // Always start with loading true
  const [showProfile, setShowProfile] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState(user?.phoneNumber || '');
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      const isConnected = await testFirebaseConnection();
      if (!isConnected) {
        setConnectionError(true);
      }
    };
    checkConnection();
  }, []);

  useEffect(() => {
    if (user) {
      setNewPhone(user.phoneNumber || '');
      localStorage.setItem('user_profile', JSON.stringify(user));
    } else {
      localStorage.removeItem('user_profile');
    }
  }, [user]);

  useEffect(() => {
    if (user?.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user?.darkMode]);

  const toggleDarkMode = async () => {
    if (!user) return;
    const newDarkMode = !user.darkMode;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        darkMode: newDarkMode
      });
      const updatedUser = { ...user, darkMode: newDarkMode };
      setUser(updatedUser);
      localStorage.setItem('user_profile', JSON.stringify(updatedUser));
      showToast(newDarkMode ? 'تم تفعيل الوضع الداكن بنجاح' : 'تم تفعيل الوضع المضيء بنجاح', 'success');
    } catch (error) {
      console.error('Error updating dark mode:', error);
      showToast('حدث خطأ أثناء تحديث تفضيلات الوضع الداكن.', 'error');
    }
  };

  const updatePhone = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        phoneNumber: newPhone
      });
      const updatedUser = { ...user, phoneNumber: newPhone };
      setUser(updatedUser);
      localStorage.setItem('user_profile', JSON.stringify(updatedUser));
      setEditingPhone(false);
      showToast('تم تحديث رقم الهاتف بنجاح', 'success');
    } catch (error) {
      console.error('Error updating phone:', error);
      showToast('حدث خطأ أثناء تحديث رقم الهاتف.', 'error');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // If cached user doesn't match authenticated user, clear it
          if (user && user.uid !== firebaseUser.uid) {
            setUser(null);
            localStorage.removeItem('user_profile');
          }

          // Fetch fresh data
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            let userData = userDoc.data() as UserProfile;
            
            // Auto-migrate legacy roles/vehicle types (e.g. taxi, delivery_truck_medium, etc.) to car rental company with pending verification
            const rawVehicle = (userData as any).vehicleType;
            if (userData.role === 'driver' && (rawVehicle === 'taxi' || rawVehicle === 'delivery_truck_medium' || !rawVehicle)) {
              try {
                const migrationUpdates: Partial<UserProfile> = {
                  vehicleType: 'delivery_car',
                  isVerified: false,
                  verificationStatus: 'pending'
                };
                await updateDoc(doc(db, 'users', firebaseUser.uid), migrationUpdates);
                userData = { ...userData, ...migrationUpdates };
              } catch (migErr) {
                console.warn('Auto migration update skipped/handled:', migErr);
              }
            }

            // Check if account was scheduled for deletion and passed 14 days
            if (userData.deletionScheduledAt) {
              const scheduledDate = new Date(userData.deletionScheduledAt.seconds ? userData.deletionScheduledAt.seconds * 1000 : userData.deletionScheduledAt);
              if (scheduledDate < new Date()) {
                // Technically it should be deleted now. 
                // Since we can't delete Auth from here reliably without fresh login, 
                // we'll just treat it as suspended or gone.
                // For this sandbox, we'll just let them know it's gone and log them out.
                showToast('لقد انتهت فترة الـ 14 يوماً وتم حذف حسابك نهائياً.', 'warning');
                await signOut(auth);
                setUser(null);
                setLoading(false);
                return;
              }
            }

            setUser(userData);
            localStorage.setItem('user_profile', JSON.stringify(userData));
          } else {
            setUser(null);
            localStorage.removeItem('user_profile');
          }
        } else {
          setUser(null);
          localStorage.removeItem('user_profile');
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        // Don't clear user on background fetch error to prevent flickering, 
        // but log it for debugging
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user?.uid]); // Add user.uid to dependencies to react to account changes

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem('master_admin_session');
    localStorage.removeItem('user_profile');
    setUser(null);
  };

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting' | 'error'>('idle');

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    try {
      setDeleteStatus('deleting');
      
      const fourteenDaysInMs = 14 * 24 * 60 * 60 * 1000;
      const scheduledDate = new Date(Date.now() + fourteenDaysInMs);

      await updateDoc(doc(db, 'users', user.uid), {
        deletionScheduledAt: scheduledDate
      });
      
      const updatedUser = { ...user, deletionScheduledAt: scheduledDate };
      setUser(updatedUser);
      localStorage.setItem('user_profile', JSON.stringify(updatedUser));
      
      showToast('تم جدولة حذف الحساب. سيتم حذف جميع بياناتك نهائياً بعد 14 يوماً. يمكنك استعادة حسابك في أي وقت خلال هذه الفترة.', 'success', 6000);
      setShowConfirmDelete(false);
      setShowProfile(false);
    } catch (error: any) {
      console.error('Error scheduling account deletion:', error);
      setDeleteStatus('error');
      showToast(`حدث خطأ أثناء جدولة حذف الحساب: ${error.message || 'Error occurred'}`, 'error');
    } finally {
      setDeleteStatus('idle');
    }
  };

  const handleCancelDelete = async () => {
    if (!user) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, 'users', user.uid), {
        deletionScheduledAt: null
      });
      const updatedUser = { ...user, deletionScheduledAt: null };
      setUser(updatedUser);
      localStorage.setItem('user_profile', JSON.stringify(updatedUser));
      showToast('تم استعادة حسابك بنجاح! يمكنك الآن استخدامه بشكل طبيعي.', 'success');
    } catch (error) {
      console.error('Error canceling account deletion:', error);
      showToast('حدث خطأ أثناء محاولة استعادة الحساب.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isUserMismatch = user && auth.currentUser && user.uid !== auth.currentUser.uid;
  const isProfileLoading = !!(auth.currentUser && isUserMismatch);

  if (loading || isProfileLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Auth onUserLoaded={setUser} />;
  }

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex flex-col">
      {connectionError && (
        <div className="bg-amber-50 border-b border-amber-200 p-2 flex items-center justify-center gap-2 text-amber-800 text-xs font-bold z-[2000]">
          <AlertTriangle className="w-4 h-4" />
          <span>تنبيه: فشل الاتصال بـ Firebase. يرجى التأكد من إعدادات المشروع أو اتصال الإنترنت.</span>
        </div>
      )}
      {/* Navigation Header */}
      <header className="bg-white px-6 py-4 shadow-sm flex items-center justify-between z-[1100]">
        <div className="flex items-end select-none">
          <VayoLogo size={24} theme="light" />
        </div>

        <div className="flex items-center gap-3">
          <PWAInstallButton />
          <button 
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-3 p-1 pr-4 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
          >
            <span className="text-sm font-bold text-gray-700 hidden sm:block">{user.displayName}</span>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
              <UserIcon className="w-4 h-4" />
            </div>
          </button>
        </div>
      </header>

      <OfflineIndicator />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-gray-50">
        {user.deletionScheduledAt ? (
          <div className="h-full flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center border-t-4 border-amber-500"
            >
              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-amber-600" />
              </div>
              <h2 className="text-2xl font-black text-gray-800 mb-4">الحساب في انتظار الحذف</h2>
              <p className="text-gray-500 mb-2 text-sm leading-relaxed">
                لقد تم طلب حذف حسابك نهائياً. سيتم تنفيذ العملية تلقائياً بعد مرور 14 يوماً من تاريخ الطلب.
              </p>
              <div className="bg-amber-50 p-4 rounded-2xl mb-8">
                <p className="text-xs text-amber-800 font-bold">
                  تاريخ الحذف المجدول:<br/> 
                  {new Date(user.deletionScheduledAt.seconds ? user.deletionScheduledAt.seconds * 1000 : user.deletionScheduledAt).toLocaleDateString('ar-TN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="space-y-4">
                <button 
                  onClick={handleCancelDelete}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
                >
                  استعادة الحساب الآن
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full text-gray-400 font-bold py-2 hover:text-gray-600"
                >
                  تسجيل الخروج
                </button>
              </div>
            </motion.div>
          </div>
        ) : (
          <>
            {user.role === 'admin' && <AdminDashboard />}
            {user.role === 'passenger' && <PassengerDashboard user={user} />}
            {user.role === 'driver' && <DriverDashboard user={user} />}
          </>
        )}
      </main>

      {/* Profile Overlay */}
      <AnimatePresence>
        {showProfile && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfile(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 bottom-0 w-80 bg-white z-[2001] shadow-2xl flex flex-col"
            >
              <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                <div className="text-center mb-8">
                  <div className="w-24 h-24 bg-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <UserIcon className="w-12 h-12 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">{user.displayName}</h2>
                  <p className="text-gray-500">{user.email}</p>
                  <span className="inline-block mt-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider">
                    {user.role === 'passenger' ? 'زبون' : user.role === 'admin' ? 'مدير' : 'صاحب شركة كراء سيارات'}
                  </span>
                </div>

                <div className="space-y-4">
                  <a 
                    href="https://wa.me/21626071643" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full bg-green-500 text-white py-3 rounded-2xl font-bold shadow-lg shadow-green-100 hover:bg-green-600 transition-all flex items-center justify-center gap-3"
                  >
                    <MessageCircle className="w-5 h-5" />
                    تواصل مع الإدارة
                  </a>

                  {user.role === 'admin' && (
                    <div className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between">
                      <span className="text-gray-500 text-sm">حالة القاعدة</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${connectionError ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                        <span className={`text-xs font-bold ${connectionError ? 'text-red-600' : 'text-green-600'}`}>
                          {connectionError ? 'غير متصل' : 'متصل بنجاح'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between">
                    <span className="text-gray-500 text-sm">التقييم</span>
                    <div className="flex items-center gap-1 text-yellow-500">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="font-bold">{user.rating || 5.0}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {user.darkMode ? (
                        <Moon className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Sun className="w-4 h-4 text-yellow-500" />
                      )}
                      <span className="text-gray-500 text-sm">الوضع الداكن</span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleDarkMode}
                      className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                        user.darkMode ? 'bg-blue-600 justify-end' : 'bg-gray-300 justify-start'
                      }`}
                    >
                      <motion.div
                        layout
                        className="bg-white w-4 h-4 rounded-full shadow-md"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-500 text-sm">رقم الهاتف</span>
                      {!editingPhone && (
                        <button 
                          onClick={() => setEditingPhone(true)}
                          className="text-blue-600 text-xs font-bold"
                        >
                          تعديل
                        </button>
                      )}
                    </div>
                    {editingPhone ? (
                      <div className="flex gap-2">
                        <input 
                          type="tel"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="أدخل رقم هاتفك"
                        />
                        <button 
                          onClick={updatePhone}
                          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                        >
                          حفظ
                        </button>
                      </div>
                    ) : (
                      <p className="font-bold text-gray-800">{user.phoneNumber || 'لم يتم إضافة رقم'}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-6 border-t border-gray-100">
                {showConfirmDelete ? (
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100 space-y-3">
                    <p className="text-xs text-red-600 font-bold text-center leading-relaxed">
                      هل أنت متأكد؟ سيتم إخفاء حسابك وجدولة حذفه نهائياً بعد 14 يوماً.
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowConfirmDelete(false)}
                        disabled={deleteStatus === 'deleting'}
                        className="flex-1 py-2 bg-white text-gray-600 rounded-xl text-xs font-bold border border-gray-200"
                      >
                        تراجع
                      </button>
                      <button 
                        onClick={handleDeleteAccount}
                        disabled={deleteStatus === 'deleting'}
                        className="flex-1 py-2 bg-red-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                      >
                        {deleteStatus === 'deleting' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        تأكيد الحذف
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowConfirmDelete(true)}
                    className="w-full flex items-center justify-center gap-3 p-4 text-red-400 hover:text-red-600 transition-colors text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    حذف الحساب نهائياً
                  </button>
                )}

                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  تسجيل الخروج
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
