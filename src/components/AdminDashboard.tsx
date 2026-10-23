import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, limit, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { UserProfile, VerificationStatus } from '../types';
import { Users, Car, User as UserIcon, Search, ShieldCheck, ShieldAlert, Check, X, Clock, Play, Pause, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';
import { useToast } from './Toast';

export default function AdminDashboard() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');

  const verifyDriver = async (uid: string, status: VerificationStatus) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isVerified: status === 'approved',
        verificationStatus: status,
        verificationDate: serverTimestamp(),
        isSuspended: false // Auto-unsuspend if verifying/re-verifying
      });
      // Refresh local state
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, isVerified: status === 'approved', verificationStatus: status, isSuspended: false } : u));
      showToast(status === 'approved' ? 'تم توثيق الحساب بنجاح' : status === 'rejected' ? 'تم رفض الحساب' : 'تمت إعادة الحساب للمراجعة', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const migrateLegacyDrivers = async () => {
    setMigrating(true);
    try {
      let count = 0;
      for (const u of users) {
        if (u.role === 'driver') {
          await updateDoc(doc(db, 'users', u.uid), {
            vehicleType: 'delivery_car',
            isVerified: false,
            verificationStatus: 'pending'
          });
          count++;
        }
      }
      await refreshData();
      showToast(`تمت إعادة ضبط وتعيين ${count} حساب شركة كراء إلى قيد المراجعة بنجاح!`, 'success');
    } catch (error) {
      console.error('Error migrating users:', error);
      showToast('حدث خطأ أثناء إعادة تعيين الحسابات', 'error');
    } finally {
      setMigrating(false);
    }
  };

  const toggleSuspension = async (uid: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isSuspended: !currentStatus
      });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, isSuspended: !currentStatus } : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const refreshData = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), limit(50));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
      setUsers(usersData);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for auth to be ready before fetching users
    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        refreshData();
      } else {
        setLoading(false);
      }
    });

    return () => authUnsubscribe();
  }, []);

  const drivers = users.filter(u => u.role === 'driver');
  const passengers = users.filter(u => u.role === 'passenger');
  const pendingDrivers = drivers.filter(d => d.verificationStatus === 'pending');
  
  const filteredUsers = (activeTab === 'pending' ? pendingDrivers : users).filter(u => {
    if (!u) return false;
    const name = String(u.displayName || '').toLowerCase();
    const email = String(u.email || '').toLowerCase();
    const phone = String(u.phoneNumber || '');
    const search = String(searchTerm || '').toLowerCase();
    
    return name.includes(search) || email.includes(search) || phone.includes(search);
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-500 font-bold">جاري تحميل بيانات المستخدمين...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-20">
      {/* Search Bar - Top Priority */}
      <div className="bg-blue-600 p-6 rounded-[2rem] shadow-xl shadow-blue-100">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-white">
            <h1 className="text-2xl font-black tracking-tight">إدارة النظام</h1>
            <p className="text-blue-100 text-sm">ابحث عن شركات الكراء والزبائن</p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
            <input 
              type="text"
              placeholder="بحث بالاسم، البريد، أو الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/10 border-2 border-white/20 rounded-2xl py-4 pr-12 pl-4 text-white placeholder:text-blue-200 focus:outline-none focus:bg-white focus:text-gray-900 focus:border-white transition-all text-right"
              dir="rtl"
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-5 h-5" /></div>
            <span className="text-sm text-gray-500 font-bold">الإجمالي</span>
          </div>
          <div className="text-3xl font-black text-gray-800">{users.length}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Car className="w-5 h-5" /></div>
            <span className="text-sm text-gray-500 font-bold">شركات الكراء</span>
          </div>
          <div className="text-3xl font-black text-gray-800">{drivers.length}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><UserIcon className="w-5 h-5" /></div>
            <span className="text-sm text-gray-500 font-bold">الزبائن</span>
          </div>
          <div className="text-3xl font-black text-gray-800">{passengers.length}</div>
        </div>
        <button 
          onClick={() => setActiveTab('pending')}
          className={`p-6 rounded-3xl border transition-all text-right ${
            activeTab === 'pending' ? 'bg-amber-50 border-amber-200 shadow-md' : 'bg-white border-gray-100 shadow-sm hover:border-amber-200'
          }`}
        >
          <div className="flex items-center gap-4 mb-2">
            <div className={`p-2 rounded-lg ${activeTab === 'pending' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="text-sm text-gray-500 font-bold">بانتظار التوثيق</span>
          </div>
          <div className="text-3xl font-black text-amber-600">{pendingDrivers.length}</div>
        </button>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800">
              {activeTab === 'pending' ? 'طلبات التوثيق المعلقة' : 'قائمة المستخدمين'} ({filteredUsers.length})
            </h2>
            {activeTab === 'pending' && (
              <button 
                onClick={() => setActiveTab('all')}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                عرض الكل
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              id="migrate-legacy-drivers-btn"
              type="button"
              onClick={migrateLegacyDrivers}
              disabled={migrating}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
              title="إعادة تعيين جميع السائقين وشركات الكراء القديمة كحسابات قيد المراجعة"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${migrating ? 'animate-spin' : ''}`} />
              <span>{migrating ? 'جاري إعادة التعيين...' : 'إعادة تعيين القدامى كشركات غير موثقة'}</span>
            </button>
            <button onClick={refreshData} className="text-blue-600 text-sm font-bold hover:underline">تحديث</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-xs uppercase tracking-widest">
                <th className="px-6 py-4 font-bold">المستخدم</th>
                <th className="px-6 py-4 font-bold">الدور / الحالة</th>
                <th className="px-6 py-4 font-bold">التواصل</th>
                <th className="px-6 py-4 font-bold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.map((u) => (
                <tr key={u.uid} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 justify-end">
                      <div className="text-right">
                        <div className="font-bold text-gray-800">{u.displayName || 'مستخدم جديد'}</div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                      </div>
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-blue-100">
                        {(u.displayName?.[0] || 'U').toUpperCase()}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-end">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        u.role === 'driver' ? 'bg-green-100 text-green-700' : 
                        u.role === 'admin' ? 'bg-red-100 text-red-700' : 
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {u.role === 'driver' ? 'شركة كراء' : u.role === 'admin' ? 'مدير' : 'زبون'}
                      </span>
                      {u.deletionScheduledAt && (
                        <span className="px-2 py-0.5 bg-red-600 text-white rounded text-[8px] font-black mt-1">انتظار الحذف</span>
                      )}
                      {u.role === 'driver' && (
                        <span className={`text-[9px] font-bold flex items-center gap-1 ${
                          u.isSuspended ? 'text-red-600' : u.isVerified ? 'text-blue-600' : u.verificationStatus === 'rejected' ? 'text-red-500' : 'text-amber-500'
                        }`}>
                          {u.isSuspended ? <Pause className="w-3 h-3" /> : u.isVerified ? <ShieldCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {u.isSuspended ? 'حساب معلق' : u.isVerified ? 'موثق' : u.verificationStatus === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-gray-700">{u.phoneNumber || '---'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      {u.role === 'driver' && !u.isVerified && u.verificationStatus !== 'rejected' && (
                        <>
                          <button 
                            onClick={() => verifyDriver(u.uid, 'approved')}
                            className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all"
                            title="قبول وتوثيق"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => verifyDriver(u.uid, 'rejected')}
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all"
                            title="رفض"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {u.role === 'driver' && (u.isVerified || u.verificationStatus === 'rejected') && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => toggleSuspension(u.uid, !!u.isSuspended)}
                            className={`p-2 rounded-lg transition-all ${
                              u.isSuspended ? 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white' : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'
                            }`}
                            title={u.isSuspended ? 'إعادة تفعيل' : 'تعليق الحساب'}
                          >
                            {u.isSuspended ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => verifyDriver(u.uid, 'pending')}
                            className="text-[10px] font-bold text-gray-400 hover:text-blue-600"
                          >
                            إعادة ضبط الحالة
                          </button>
                        </div>
                      )}
                      {u.role !== 'driver' && <span className="text-gray-300 text-xs">---</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="text-gray-300 mb-2 font-bold text-lg">لا توجد نتائج</div>
                    <p className="text-gray-400 text-sm">جرب البحث بكلمة أخرى أو اضغط تحديث</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Debug Footer */}
      <div className="pt-10 border-t border-gray-100">
        <button 
          onClick={() => setDebugMode(!debugMode)}
          className="text-[10px] text-gray-300 hover:text-gray-600 transition-colors"
        >
          {debugMode ? 'إخفاء بيانات التصحيح' : 'إظهار بيانات التصحيح'}
        </button>
        {debugMode && (
          <div className="mt-4 p-4 bg-gray-900 rounded-xl text-green-400 font-mono text-[10px] overflow-x-auto">
            <pre>{JSON.stringify({ userCount: users.length, filteredCount: filteredUsers.length, searchTerm }, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
