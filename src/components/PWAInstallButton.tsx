import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download, Smartphone, X, Check } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'hero' | 'pill';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  className = '',
  variant = 'header'
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'hero') {
      return (
        <button
          type="button"
          onClick={install}
          className={`flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 active:scale-98 transition-all cursor-pointer ${className}`}
        >
          <Download className="w-4 h-4" />
          <span>تثبيت التطبيق على هاتفك</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={install}
        className={`flex items-center gap-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-3 py-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer ${className}`}
        title="تثبيت التطبيق على جهازك"
      >
        <Download className="w-3.5 h-3.5 text-blue-500" />
        <span className="hidden sm:inline">تثبيت التطبيق</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-3 py-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer ${className}`}
          title="تثبيت التطبيق على iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-blue-500" />
          <span className="hidden sm:inline">تثبيت التطبيق</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4" dir="rtl">
            <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 text-white shadow-2xl text-right animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-blue-400">
                  <Smartphone className="w-5 h-5" />
                  <h3 className="font-bold text-base text-white">تثبيت VAYO على iPhone</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 py-4 text-xs text-slate-300 leading-relaxed">
                <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
                  <span className="w-6 h-6 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                  <p>اضغط على زر <strong>المشاركة (Share)</strong> في شريط Safari بالأسفل (المربع بسهم لأعلى).</p>
                </div>

                <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
                  <span className="w-6 h-6 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                  <p>مرر للأسفل واختر <strong>"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)</strong>.</p>
                </div>

                <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
                  <span className="w-6 h-6 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">3</span>
                  <p>اضغط على <strong>إضافة (Add)</strong> بالأعلى ليظهر تطبيق VAYO على شاشتك فوراً.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                فهمت ذلك
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
