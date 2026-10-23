import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div 
      className="fixed bottom-4 left-4 z-[9999] flex items-center gap-2 rounded-2xl bg-slate-900/95 text-amber-300 border border-amber-500/40 px-3.5 py-2 text-xs font-bold shadow-2xl backdrop-blur-md animate-bounce"
      dir="rtl"
    >
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <span>وضع عدم الاتصال — التطبيق يعمل بالذاكرة المؤقتة.</span>
    </div>
  );
};
