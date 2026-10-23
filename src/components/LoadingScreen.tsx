import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, Shield, Zap } from 'lucide-react';
import VayoLogo from './VayoLogo';
import luxuryCar1 from '../assets/images/luxury_car_one_1787438195372.jpg';
import luxuryCar2 from '../assets/images/luxury_car_two_1787438208488.jpg';
import luxuryCar3 from '../assets/images/luxury_car_three_1787438221562.jpg';

const LUXURY_CARS = [
  { id: 1, image: luxuryCar1 },
  { id: 2, image: luxuryCar2 },
  { id: 3, image: luxuryCar3 },
];

export default function LoadingScreen() {
  const [currentCarIndex, setCurrentCarIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentCarIndex((prev) => (prev + 1) % LUXURY_CARS.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const activeCar = LUXURY_CARS[currentCarIndex];

  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-gradient-to-b from-blue-950 via-blue-900 to-[#070b14] text-white p-4 sm:p-8 overflow-hidden select-none" 
      dir="rtl"
    >
      {/* Background ambient lighting effects */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header: Logo & Branding */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md flex flex-col items-center text-center mt-2 sm:mt-4 z-10"
      >
        <div className="relative inline-flex items-end mb-2">
          <VayoLogo size={42} />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-bold tracking-wide">
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span>المنصة الرائدة لكراء السيارات الفاخرة</span>
        </div>
      </motion.div>

      {/* Center: Luxury Cars Showcase */}
      <div className="w-full max-w-lg my-auto py-4 z-10">
        <div className="relative rounded-3xl overflow-hidden bg-slate-900/80 border border-blue-500/30 shadow-2xl shadow-blue-950/80 backdrop-blur-md">
          {/* Image Container with smooth AnimatePresence */}
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeCar.id}
                src={activeCar.image}
                alt="Luxury Car"
                referrerPolicy="no-referrer"
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="w-full h-full object-cover object-center"
              />
            </AnimatePresence>
          </div>

          {/* Indicators bar */}
          <div className="flex items-center justify-center gap-2 py-3 bg-slate-900/90 border-t border-white/5">
            {LUXURY_CARS.map((car, idx) => (
              <button
                key={car.id}
                type="button"
                onClick={() => setCurrentCarIndex(idx)}
                aria-label={`Car ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-500 cursor-pointer ${
                  idx === currentCarIndex 
                    ? 'w-8 bg-gradient-to-r from-blue-400 to-cyan-300 shadow-xs shadow-cyan-400/50' 
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Quick Highlights Bar */}
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="p-2 rounded-xl bg-blue-900/30 border border-blue-500/20 backdrop-blur-xs">
            <Shield className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
            <span className="text-[10px] text-slate-300 font-bold block">ضمان وجودة</span>
          </div>
          <div className="p-2 rounded-xl bg-blue-900/30 border border-blue-500/20 backdrop-blur-xs">
            <Crown className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <span className="text-[10px] text-slate-300 font-bold block">أفخم السيارات</span>
          </div>
          <div className="p-2 rounded-xl bg-blue-900/30 border border-blue-500/20 backdrop-blur-xs">
            <Zap className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <span className="text-[10px] text-slate-300 font-bold block">حجز فوري</span>
          </div>
        </div>
      </div>

      {/* Bottom: Loading Progress Bar & Status */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="w-full max-w-sm flex flex-col items-center text-center mb-4 z-10"
      >
        <div className="flex items-center gap-2 mb-2 text-sm font-black text-blue-100">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
          </span>
          <span>جاري تحميل التطبيق...</span>
        </div>

        {/* Animated Loading Bar */}
        <div className="w-full h-2 bg-blue-950/80 rounded-full overflow-hidden border border-blue-500/30 p-0.5 shadow-inner">
          <motion.div 
            className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-400 rounded-full"
            animate={{ 
              x: ['-100%', '100%']
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 1.6, 
              ease: 'easeInOut' 
            }}
            style={{ width: '60%' }}
          />
        </div>

        <p className="text-[11px] text-blue-300/60 font-medium mt-2">
          يتم تجهيز أسطول السيارات الفاخرة والعروض المتاحة
        </p>
      </motion.div>
    </div>
  );
}
