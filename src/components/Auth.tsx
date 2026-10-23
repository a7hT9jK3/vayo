import React, { useState } from 'react';
import { 
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserRole, UserProfile, VehicleCategory } from '../types';
import { Car, User, Loader2, Building2, Phone, CheckCircle2, ShieldCheck, Scale, FileText, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import VayoLogo from './VayoLogo';
import { useToast } from './Toast';
import TermsAndPrivacyModal from './TermsAndPrivacyModal';
import { PWAInstallButton } from './PWAInstallButton';
import luxuryCar1 from '../assets/images/luxury_car_one_1787438195372.jpg';
import luxuryCar2 from '../assets/images/luxury_car_two_1787438208488.jpg';
import luxuryCar3 from '../assets/images/luxury_car_three_1787438221562.jpg';

interface AuthProps {
  onUserLoaded: (user: UserProfile) => void;
}

export default function Auth({ onUserLoaded }: AuthProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('passenger');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        onUserLoaded(userData);
      } else {
        // If profile doc doesn't exist, open the completion screen
        setDisplayName(user.displayName || '');
        setIsRegistering(true);
      }
    } catch (err: any) {
      console.error('Google login/signup error:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        return;
      }
      if (err?.code === 'auth/unauthorized-domain') {
        setError(`هذا النطاق (${window.location.hostname}) غير مضاف في قائمة النطاقات المصرح بها (Authorized Domains) في Firebase Authentication. يرجى إضافته في إعدادات Firebase.`);
      } else if (err?.code === 'auth/popup-blocked') {
        setError('تم حظر النافذة المنبثقة من قبل المتصفح. يرجى السماح بالنوافذ المنبثقة ثم المحاولة مجدداً.');
      } else {
        setError(`فشل تسجيل الدخول عبر Google (${err?.message || 'خطأ غير معروف'}). يرجى المحاولة مرة أخرى.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const trimmedPhone = phoneNumber.trim();
    if (!trimmedPhone) {
      showToast('يرجى إدخال رقم الهاتف للمتابعة', 'warning');
      return;
    }

    let cleanPhone = trimmedPhone.replace(/\D/g, '').replace(/^0+/, '');
    if (cleanPhone.length < 8) {
      showToast('يرجى إدخال رقم هاتف صحيح (8 أرقام على الأقل)', 'warning');
      return;
    }

    // If it's a Tunisian number (8 digits), ensure it has the country code
    if (cleanPhone.length === 8) {
      cleanPhone = '216' + cleanPhone;
    }

    setLoading(true);
    try {
      const isCompanyOwner = selectedRole === 'driver';
      const finalDisplayName = isCompanyOwner && companyName.trim()
        ? companyName.trim()
        : (displayName.trim() || auth.currentUser.displayName || 'مستخدم');

      const newUser: UserProfile = {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email || '',
        displayName: finalDisplayName,
        role: selectedRole,
        rating: 5,
        totalRatings: 0,
        isOnline: isCompanyOwner,
        phoneNumber: cleanPhone,
        companyName: isCompanyOwner && companyName.trim() ? companyName.trim() : undefined,
        vehicleType: isCompanyOwner ? 'delivery_car' : undefined,
        isVerified: !isCompanyOwner, // Passengers are auto-verified
        verificationStatus: isCompanyOwner ? 'pending' : 'approved',
        isSuspended: false,
      };

      await setDoc(doc(db, 'users', auth.currentUser.uid), newUser);
      showToast('تم إنشاء حسابك بنجاح!', 'success');
      onUserLoaded(newUser);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser?.uid}`);
      console.error('Registration submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isRegistering) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0e1a] p-4 text-right font-sans" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl max-w-lg w-full"
        >
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-white">إكمال إنشاء الحساب</h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">اختر نوع حسابك وأدخل رقم هاتفك للمتابعة</p>
          </div>

          <form onSubmit={handleRegistrationSubmit} className="space-y-6">
            {/* Role Selection - ONLY 2 Options */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2.5">
                نوع الحساب <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Customer (زبون) */}
                <button
                  id="role-option-passenger-btn"
                  type="button"
                  onClick={() => setSelectedRole('passenger')}
                  className={`flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    selectedRole === 'passenger'
                      ? 'border-blue-500 bg-blue-500/15 text-white shadow-lg shadow-blue-500/20'
                      : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  <div className={`p-3 rounded-2xl mb-2 transition-colors ${
                    selectedRole === 'passenger' ? 'bg-blue-600 text-white' : 'bg-slate-700/60 text-slate-400'
                  }`}>
                    <User className="w-7 h-7" />
                  </div>
                  <span className="font-bold text-sm text-white">زبون</span>
                  <span className="text-[11px] text-slate-400 mt-1">طلب وحجز كراء السيارات</span>
                </button>

                {/* Option 2: Car Rental Company Owner (صاحب شركة كراء سيارات) */}
                <button
                  id="role-option-company-btn"
                  type="button"
                  onClick={() => setSelectedRole('driver')}
                  className={`flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    selectedRole === 'driver'
                      ? 'border-emerald-500 bg-emerald-500/15 text-white shadow-lg shadow-emerald-500/20'
                      : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  <div className={`p-3 rounded-2xl mb-2 transition-colors ${
                    selectedRole === 'driver' ? 'bg-emerald-600 text-white' : 'bg-slate-700/60 text-slate-400'
                  }`}>
                    <Building2 className="w-7 h-7" />
                  </div>
                  <span className="font-bold text-sm text-white">صاحب شركة كراء سيارات</span>
                  <span className="text-[11px] text-slate-400 mt-1">تأجير واستقبال طلبات الكراء</span>
                </button>
              </div>
            </div>

            {/* Display Name or Company Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                {selectedRole === 'driver' ? 'اسم الوكالة / الشركة' : 'الاسم الكامل'}
              </label>
              <input
                id="registration-name-input"
                type="text"
                value={selectedRole === 'driver' ? companyName : displayName}
                onChange={(e) => selectedRole === 'driver' ? setCompanyName(e.target.value) : setDisplayName(e.target.value)}
                placeholder={selectedRole === 'driver' ? 'مثال: وكالة الأمان لتأجير السيارات' : 'أدخل اسمك الكامل'}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Phone Number Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                رقم الهاتف <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input 
                  id="registration-phone-input"
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left text-sm"
                  placeholder="مثال: 216XXXXXXXX"
                  dir="ltr"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {selectedRole === 'driver' 
                  ? 'رقم الهاتف الرسمي للتواصل المباشر مع الزبائن وتأكيد الحجوزات'
                  : 'سيتم استخدامه للتواصل والتنسيق مع شركات الكراء بعد تأكيد الطلب'}
              </p>
            </div>

            {/* Submit Button */}
            <button
              id="submit-registration-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>تأكيد وإنشاء الحساب</span>
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0e1a] p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center text-white mb-8"
      >
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="relative inline-flex items-end">
            <VayoLogo size={110} />
          </div>
        </div>
        <p className="text-cyan-100/60 text-sm font-medium mt-1">VAYO - منصتك الذكية للربط المباشر</p>
      </motion.div>

      <motion.div 
        layout
        className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full border border-gray-100 text-center"
      >
        <h2 className="text-2xl font-extrabold mb-3 text-gray-800">
          تسجيل الدخول
        </h2>
        
        <p className="text-gray-500 text-sm leading-relaxed mb-6 font-medium">
          يرجى تسجيل الدخول أو إنشاء حسابك الجديد مباشرة بنقرة واحدة وآمنة عبر حسابك في Google.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-4 rounded-xl mb-6 text-sm font-medium text-center shadow-sm">
            <p className="mb-2">{error}</p>
            <button 
              type="button"
              onClick={() => setError(null)}
              className="bg-white border border-red-200 text-red-500 px-4 py-1.5 rounded-lg text-xs font-black hover:bg-red-50 transition-colors"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-2xl shadow-lg transition-all hover:shadow-xl active:scale-98 disabled:opacity-50 group"
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          ) : (
            <span className="flex items-center justify-center gap-3">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6 bg-white rounded-full p-0.5" alt="Google" />
              <span>الدخول السريع والآمن عبر Google</span>
            </span>
          )}
        </button>

        <div className="mt-6 flex flex-col items-center justify-center gap-3">
          <PWAInstallButton variant="hero" className="w-full" />
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            <span>حماية وتوثيق رسمي عبر منصة Google Cloud</span>
          </div>
        </div>
      </motion.div>

      {/* Luxury Cars Showcase Section */}
      <div className="mt-8 max-w-4xl w-full px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[luxuryCar1, luxuryCar2, luxuryCar3].map((carImg, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * idx }}
              className="group relative overflow-hidden rounded-2xl bg-slate-900 border border-blue-500/30 hover:border-blue-400 shadow-xl shadow-black/50 transition-all"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-slate-950">
                <img 
                  src={carImg} 
                  alt="Luxury Car"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>



      {/* Footer Section: Description */}
      <div className="mt-12 max-w-4xl w-full px-4 text-center">
        <div className="bg-white/5 backdrop-blur-sm p-8 rounded-3xl border border-white/10 space-y-6">
          <section>
            <h3 className="text-xl font-bold text-blue-400 mb-3">عن VAYO</h3>
            <p className="text-gray-400 text-sm leading-relaxed max-w-2xl mx-auto">
              VAYO هو تطبيق مبتكر يهدف إلى تسهيل خدمات كراء سيارات أو كراء سيارة مع سائق. يوفر التطبيق منصة آمنة وموثوقة تربط بين العملاء وأصحاب السيارات، مع توفير واجهة سهلة الاستخدام ومميزات متقدمة لضمان أفضل تجربة للمستخدمين.
            </p>
          </section>

          <div className="pt-2 flex justify-center">
            <button
              id="open-terms-privacy-modal-btn"
              type="button"
              onClick={() => setShowTermsModal(true)}
              className="px-6 py-3 bg-blue-600/90 hover:bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer text-xs sm:text-sm border border-blue-400/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Scale className="w-4 h-4 text-blue-200" />
              <span>الشروط وسياسة الخصوصية</span>
            </button>
          </div>

          <div className="pt-6 border-t border-white/5 text-gray-500 text-[10px]">
            <p>© 2026 VAYO - جميع الحقوق محفوظة</p>
          </div>
        </div>
      </div>

      <TermsAndPrivacyModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />
    </div>
  );
}
