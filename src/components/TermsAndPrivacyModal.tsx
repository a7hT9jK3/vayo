import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, ShieldCheck, Scale, Check } from 'lucide-react';

interface TermsAndPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TermsAndPrivacyModal({ isOpen, onClose }: TermsAndPrivacyModalProps) {
  const [activeSection, setActiveSection] = useState<'all' | 'cgu' | 'privacy'>('all');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        id="terms-privacy-modal-overlay" 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          id="terms-privacy-modal-card"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-right font-sans"
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">الشروط وسياسة الخصوصية</h2>
                <p className="text-xs text-slate-400">الوثيقة الموحدة: الشروط العامة للاستخدام وحماية المعطيات</p>
              </div>
            </div>
            <button
              id="close-terms-privacy-btn"
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 px-6 py-3 bg-slate-950/60 border-b border-slate-800/80">
            <button
              type="button"
              onClick={() => setActiveSection('all')}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all ${
                activeSection === 'all'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              كامل الوثيقة
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('cgu')}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                activeSection === 'cgu'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              الشروط العامة للاستخدام (CGU)
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('privacy')}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                activeSection === 'privacy'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              سياسة الخصوصية (Privacy Policy)
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 text-slate-300 text-sm leading-relaxed scrollbar-thin scrollbar-thumb-slate-700">
            
            {/* Title Header */}
            <div className="bg-gradient-to-r from-blue-900/30 via-slate-800/40 to-blue-900/30 p-5 rounded-2xl border border-blue-500/20 text-center">
              <h1 className="text-base sm:text-lg font-black text-blue-300 mb-1">
                الوثيقة الموحدة: الشروط العامة للاستخدام وسياسة الخصوصية
              </h1>
              <p className="text-xs text-slate-400 font-semibold">
                منصة الوساطة والربط الرقمي بين زبائن كراء السيارات وشركات التأجير
              </p>
            </div>

            {/* Section 1: CGU */}
            {(activeSection === 'all' || activeSection === 'cgu') && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-black text-white">القسم الأول: الشروط العامة للاستخدام (CGU)</h3>
                </div>

                {/* Article 1 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-blue-400 text-sm">البند الأول: طبيعة ودور المنصة ونفي علاقة التوظيف</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li><strong className="text-white">وسيط تقني بحت:</strong> تُقر وتوافق الأطراف (الزبون وشركات تأجير السيارات) على أن دور المنصة يقتصر حصرياً على توفير أداة تقنية وبرمجية لربط العرض بالطلب استناداً إلى الموقع الجغرافي عبر الخريطة الرقمية. المنصة ليست شركة تأجير سيارات، وليست طرفاً في عقد الكراء النهائي، ولا تملك أو تشرف أو تراقب السيارات المعروضة من طرف الشركات.</li>
                    <li><strong className="text-white">انتفاء علاقة الشغل أو التوظيف:</strong> يُقر أصحاب وممثلو شركات تأجير السيارات بأن علاقتهم بالمنصة هي علاقة مستخدمين مستقلين لأداة تقنية فقط. لا توجد أي علاقة تبعية، أو عقد شغل، أو وساطة تشغيل، أو علاقة توظيف بين المنصة وموظفي أو أصحاب شركات التأجير. وتعمل كل شركة تحت مسؤوليتها القانونية والجبائية المستقلة تماماً.</li>
                    <li><strong className="text-white">عدم الضمان والمسؤولية:</strong> لا تتحمل المنصة أي مسؤولية قانونية، مدنية، أو جزائية عن مدى جدية أو التزام شركات تأجير السيارات أو الزبائن بعد إتمام عملية التواصل والتوافق.</li>
                  </ul>
                </div>

                {/* Article 2 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-blue-400 text-sm">البند الثاني: طريقة إنشاء الحساب، التسجيل، وتسجيل الدخول عبر جوجل (Google Sign-In)</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li><strong className="text-white">طرق التسجيل:</strong> تتيح المنصة للمستخدمين إمكانية فتح حساب جديد بالطريقة التقليدية أو عبر ربط الحساب المباشر باستخدام خدمة تسجيل الدخول بواسطة جوجل (Google Sign-In).</li>
                    <li><strong className="text-white">البيانات المسترجعة:</strong> عند التسجيل عبر جوجل، توافق على قيام المنصة بجمع الحد الأدنى من البيانات الأساسية (الاسم، البريد الإلكتروني) لإنشاء الحساب.</li>
                    <li><strong className="text-white">أمان الحساب:</strong> يتحمل المستخدم المسؤولية الكاملة في الحفاظ على أمان وسرية حسابه الخارجي المرتبط.</li>
                  </ul>
                </div>

                {/* Article 3 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-blue-400 text-sm">البند الثالث: شروط أهلية وسلوك الزبون</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li><strong className="text-white">الأهلية القانونية:</strong> يجب أن يكون الزبون بالغاً للسن القانونية المطلوبة لسياقة وكراء السيارات في تونس (عادة 21 سنة فما فوق)، وحاملاً لرخصة سياقة سارية المفعول ومطابقة لصنف السيارة المطلوبة.</li>
                    <li><strong className="text-white">الجدية:</strong> يتعهد الزبون بتقديم معلومات صحيحة عند إنشاء الطلب وعدم إرسال طلبات وهمية أو عبثية.</li>
                  </ul>
                </div>

                {/* Article 4 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-blue-400 text-sm">البند الرابع: الرسوم المالية (عدم الاسترداد)</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li><strong className="text-white">طبيعة الرسم المالي:</strong> يُدفع المبلغ الثابت المحدد من طرف المنصة كـ "رسوم خدمة ربط رقمي ومعالجة طلب" نظير إشعار وتوجيه الطلب للشركات عبر الخريطة.</li>
                    <li><strong className="text-white">طرق الدفع المعتمدة:</strong> يتم استخلاص رسوم الطلب حصرياً عبر وسائل الدفع الإلكتروني الآمنة والمرخص لها في تونس.</li>
                    <li><strong className="text-white">عدم الاسترجاع:</strong> يُعد هذا الرسم نهائياً وغير قابل للإرجاع تحت أي ظرف، سواء ردّت الشركات أم لم ترد، أو تم الاتفاق أم لا.</li>
                  </ul>
                </div>

                {/* Article 5 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-blue-400 text-sm">البند الخامس: شروط تسجيل شركات تأجير السيارات وتوثيق الحسابات</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li><strong className="text-white">الوثائق القانونية:</strong> يشترط لفتح حساب مهني وتوثيقه قيام الشركة بتقديم ورفع نسخ أصلية للوثائق التالية: السجل التجاري، البطاقة الجبائية (Matricule Fiscal)، بطاقة استغلال أو ترخيص قانوني من وزارة النقل، وهوية الممثل القانوني.</li>
                    <li><strong className="text-white">معايير الموثوقية:</strong> لا يُمنح وسم الحساب الموثق إلا بعد استكمال التثبت الإداري، وهو لا يعني ضمان أداء الشركة ميدانياً.</li>
                  </ul>
                </div>

                {/* Article 6 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-blue-400 text-sm">البند السادس: قواعد استخدام الخريطة، الـ GPS، وآلية استقبال الطلبات</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li><strong className="text-white">إرسال الطلب:</strong> يحدد الزبون مكانه عبر الخريطة ويُدرج ميزانيته والسيارة المطلوبة.</li>
                    <li><strong className="text-white">الـ GPS وزر متصل:</strong> لا تصل الطلبات إلى شركات تأجير السيارات إلا إذا قام الممثل بتفعيل "زر متصل" (Online)، حيث يتم تحديد موقعه الجغرافي الفوري عبر تقنية الـ GPS وتوجيه الطلبات المحيطة به في ذلك النطاق.</li>
                    <li><strong className="text-white">عروض الأسعار:</strong> يحق للشركات المتصلة قبول الطلب أو تقديم عرض معدل للسعر وملزم لأصحابه داخل المنصة.</li>
                  </ul>
                </div>

                {/* Article 7 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-blue-400 text-sm">البند السابع: تداول البيانات والموافقة على مشاركة رقم الهاتف</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li><strong className="text-white">إدخال البيانات:</strong> يوافق المستخدمون صراحة على إدخال بياناتهم الصحيحة (الاسم ورقم الهاتف والموقع).</li>
                    <li><strong className="text-white">فتح الاتصال:</strong> تتم مشاركة رقم الهاتف ووسائل الاتصال بين الزبون والشركة فقط بعد حدوث التوافق والاتفاق المبدئي داخل المنصة لإتمام الترتيبات ميدانياً.</li>
                  </ul>
                </div>

                {/* Article 8 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-blue-400 text-sm">البند الثامن: الإشعارات وسجل العمليات (Historique & Notifications)</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li><strong className="text-white">الإشعارات:</strong> ترسل المنصة إشعارات فورية للأطراف بكل مستجد (طلب جديد، عرض جديد، تعديل سعر).</li>
                    <li><strong className="text-white">سجل الطلبات:</strong> توفر المنصة سجلاً رقمياً ومحدثاً لكافة الطلبات السابقة والعروض وحالات القبول لكل مستخدم كمرجع تقني.</li>
                  </ul>
                </div>

                {/* Article 9 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-blue-400 text-sm">البند التاسع: حق حذف الحساب والبيانات الشخصية (Right to Erasure)</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li><strong className="text-white">زر حذف الحساب:</strong> تتيح المنصة للمستخدمين خاصية زر "حذف الحساب" (Supprimer mon compte) في الإعدادات لإزالة بياناتهم النشطة.</li>
                    <li><strong className="text-white">الاستثناءات:</strong> تحتفظ المنصة بالحد الأدنى من السجلات التقنية أو المالية التي تفرضها القوانين الجبائية التونسية حصراً.</li>
                  </ul>
                </div>

                {/* Article 10 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-blue-400 text-sm">البند العاشر: حظر الاستخدام وإلغاء الحسابات</h4>
                  <p className="text-xs text-slate-300">
                    يحق للمنصة تعليق أو إلغاء حساب أي مستخدم فوراً في حال ثبوت مخالفة شروط الاستخدام أو محاولة التحيل.
                  </p>
                </div>

                {/* Article 11 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-blue-400 text-sm">البند الحادي عشر: إثبات الموافقة الرقمية على الشروط العامة (Acceptation des CGU)</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li><strong className="text-white">القبول الإلزامي:</strong> تتم الموافقة عبر النقر الإيجابي على خانة تأكيد (Checkbox) قبل إرسال الطلب.</li>
                    <li><strong className="text-white">الحجية القانونية:</strong> يُعتبر النقر توقيعاً إلكترونياً، وتحتفظ المنصة بسجل تقني آمني (Logs) يتضمن عنوان بروتوكول الإنترنت (IP) والتوقيت (Timestamp) كحجة قانونية.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Section 2: Privacy Policy */}
            {(activeSection === 'all' || activeSection === 'privacy') && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-black text-white">القسم الثاني: سياسة الخصوصية وحماية المعطيات الشخصية (Privacy Policy)</h3>
                </div>

                {/* Privacy 1 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-emerald-400 text-sm">1. الهوية ومسؤول معالجة البيانات</h4>
                  <p className="text-xs text-slate-300">
                    تلتزم المنصة بحماية خصوصية ومعطيات كافة المستخدمين طبقاً للتشريعات الجاري بها العمل في الجمهورية التونسية، ولا سيما قانون حماية المعطيات الشخصية الصادر عن الهيئة الوطنية لحماية المعطيات الشخصية (INPDP).
                  </p>
                </div>

                {/* Privacy 2 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-emerald-400 text-sm">2. البيانات التي نقوم بجمعها</h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li><strong className="text-white">بيانات التسجيل:</strong> الاسم، البريد الإلكتروني، والهاتف (سواء يدوياً أو عبر Google Sign-In).</li>
                    <li><strong className="text-white">بيانات الموقع الجغرافي:</strong> إحداثيات GPS للزبون والشركات عند تفعيل وضع الاتصال.</li>
                    <li><strong className="text-white">بيانات الطلبات والدفع:</strong> تفاصيل الميزانية ومؤشرات الدفع الإلكتروني الآمن لرسوم الخدمة.</li>
                  </ul>
                </div>

                {/* Privacy 3 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-emerald-400 text-sm">3. غرض استخدام البيانات</h4>
                  <p className="text-xs text-slate-300">
                    تشغيل المنصة، المطابقة الجغرافية للطلبات، إرسال الإشعارات، وتسهيل التواصل بعد التوافق المبدئي فقط.
                  </p>
                </div>

                {/* Privacy 4 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-emerald-400 text-sm">4. مشاركة البيانات</h4>
                  <p className="text-xs text-slate-300">
                    لا يتم بيع البيانات لأي طرف تجاري. تشارك بيانات الاتصال حصرياً بين الزبون والشركة عند حدوث الاتفاق.
                  </p>
                </div>

                {/* Privacy 5 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-emerald-400 text-sm">5. أمن وحماية البيانات</h4>
                  <p className="text-xs text-slate-300">
                    تُطبّق أعلى التدابير التقنية والتنظيمية لحماية قواعد البيانات من الاختراق أو التسريب.
                  </p>
                </div>

                {/* Privacy 6 */}
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                  <h4 className="font-black text-emerald-400 text-sm">6. سياسة ملفات تعريف الارتباط (Cookies) وتقنيات التتبع</h4>
                  <p className="text-xs text-slate-300">
                    لا يستخدم تطبيقنا ملفات تعريف الارتباط (Cookies) بشكل مباشر لأغراض التتبع أو الإعلانات. ويستخدم التطبيق خدمات Firebase وGoogle لتوفير وظائف المصادقة وتسجيل الدخول وإدارة حسابات المستخدمين. وقد تستخدم هذه الخدمات تقنيات تخزين أو تعريف ضرورية لتقديم خدماتها، وفقًا لسياسات الخصوصية الخاصة بها.
                  </p>
                  <p className="text-xs text-slate-300 pt-2 border-t border-slate-700/40">
                    <strong className="text-white">حقوق المستخدم والتواصل:</strong> يمكن للمستخدم طلب الوصول إلى بياناته أو تصحيحها أو حذفها، أو الاستفسار عن طريقة معالجة بياناته، من خلال التواصل معنا عبر البريد الإلكتروني المخصص للدعم والخصوصية.
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
            <button
              id="confirm-terms-privacy-btn"
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>إغلاق</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
