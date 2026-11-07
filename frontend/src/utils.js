/* ============================================================
   أدوات مساعدة عامة (Vue يتكفل بالتحصين — لا حاجة لـ esc)
   ============================================================ */
export const TASK_STATUSES = ['scheduled', 'available', 'accepted', 'in_progress', 'pending_approval', 'completed', 'rejected', 'cancelled']
export const STATUS_LABELS = {
  scheduled: 'مجدولة ⏰', available: 'متاحة', accepted: 'مقبولة', in_progress: 'قيد التنفيذ',
  pending_approval: 'بانتظار الاعتماد', completed: 'مكتملة', rejected: 'مرفوضة', cancelled: 'ملغاة'
}
export const EMP_STATUSES = { active: 'نشط', disabled: 'موقوف', on_leave: 'في إجازة' }
export const ASSIGN_LABELS = { auto: 'توزيع تلقائي', direct: 'تكليف مباشر', multi: 'مجموعة موظفين', all: 'لكل الموظفين', group: 'مهمة جماعية' }

export const statusLabel = s => STATUS_LABELS[s] || s
export const statusClass = s => 'st st-' + s

/* ============ فترات القوائم — v1.0.1: الافتراضي "اليوم" ============ */
export const PERIODS = [['today', 'اليوم'], ['week', 'هذا الأسبوع'], ['month', 'هذا الشهر'], ['all', 'الكل']]

function _startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

/** بداية الفترة الزمنية حسب الاسم — يرجع Date أو null (الكل) */
export function periodFrom(period) {
  const now = new Date()
  if (period === 'today') return _startOfDay(now)
  if (period === 'week') { const x = _startOfDay(now); x.setDate(x.getDate() - 6); return x }
  if (period === 'month') { const x = _startOfDay(now); x.setDate(1); return x }
  return null
}

/** هل المهمة ضمن الفترة؟ (حسب تاريخ الإنشاء أو الإرسال المجدول) */
export function taskInPeriod(t, period) {
  if (period === 'all') return true
  const from = periodFrom(period)
  if (!from) return true
  const ref = t.sendAt || t.sentAt || t.createdAt
  if (!ref) return true
  return new Date(ref) >= from
}

/**
 * فترة التقييم الحالية — تبدأ من "يوم بداية التقييم" المحدد بالإعدادات
 * (مثال: statsStartDay=5 → التقييم يبدأ من 5 هاد الشهر) وتحترم تاريخ بداية الاحتساب
 */
export function ratingPeriodFrom(statsStartDay = 1, statsStartDate = '') {
  const now = new Date()
  const day = Math.min(Math.max(parseInt(statsStartDay) || 1, 1), 28)
  let from = new Date(now.getFullYear(), now.getMonth(), day)
  if (from > now) from = new Date(now.getFullYear(), now.getMonth() - 1, day)
  if (statsStartDate) {
    const s = new Date(statsStartDate)
    if (s > from) from = s
  }
  return from
}

/* كل الأرقام بالواجهة إنكليزية (Latn) — حتى مع اللغة العربية */
const _EN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
function _latinDigits(s) {
  return String(s).replace(/[\u0660-\u0669\u06F0-\u06F9]/g,
    d => _EN_DIGITS[d.charCodeAt(0) & 0xF])
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  try {
    return _latinDigits(new Date(iso).toLocaleString('ar-IQ-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }))
  } catch { return iso }
}
export function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return _latinDigits(new Date(iso).toLocaleDateString('ar-IQ-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }))
  } catch { return iso }
}

export function pointsFmt(n) {
  const v = Number(n) || 0
  return _latinDigits((Math.round(v * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }))
}

export function isOnLeaveNow(emp) {
  if (!emp || emp.status !== 'on_leave') return false
  if (!emp.leaveEnd) return true
  return new Date(emp.leaveEnd) > new Date()
}

/* ضغط صورة العميل → Blob جاهز للرفع */
export function compressImage(file, maxDim = 1100, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('الملف ليس صورة')); return }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('فشل قراءة الملف'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('فشل تحميل الصورة'))
      img.onload = () => {
        let { width: w, height: h } = img
        if (w > maxDim || h > maxDim) {
          const r = Math.min(maxDim / w, maxDim / h)
          w = Math.round(w * r); h = Math.round(h * r)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          b => b ? resolve(new File([b], (file.name || 'photo') + '.jpg', { type: 'image/jpeg' })) : reject(new Error('فشل ضغط الصورة')),
          'image/jpeg', quality
        )
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

/* تصدير CSV يفتح بالعربية في Excel */
export function exportCSV(filename, headers, rows) {
  const BOM = '\uFEFF'
  const cell = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`
  const lines = [headers.map(cell).join(','), ...rows.map(r => r.map(cell).join(','))]
  const blob = new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a); a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 400)
}
