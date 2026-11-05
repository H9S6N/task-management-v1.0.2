/* ============================================================
   أدوات مساعدة عامة (Vue يتكفل بالتحصين — لا حاجة لـ esc)
   ============================================================ */
export const APP_VERSION = '1.1.0'

export const TASK_STATUSES = ['available', 'accepted', 'in_progress', 'pending_approval', 'completed', 'rejected', 'cancelled']
export const STATUS_LABELS = {
  available: 'متاحة', accepted: 'تم الاستلام', in_progress: 'يتم العمل عليها',
  pending_approval: 'بانتظار الاعتماد', completed: 'مكتملة', rejected: 'مرفوضة', cancelled: 'ملغاة'
}
export const EMP_STATUSES = { active: 'نشط', disabled: 'موقوف', on_leave: 'في إجازة' }

export const CONVERT_LABELS = {
  lowest: 'صاحب الأقل نقاطاً', no_tasks: 'موظف بلا مهام مفتوحة',
  least_open: 'الأقل حمولة', random: 'عشوائي',
}

export const statusLabel = s => STATUS_LABELS[s] || s
export const statusClass = s => 'st st-' + s

/* وصف مدة بالثواني — مثال: 90 → "دقيقة ونصف" */
export function humanizeDelay(seconds) {
  const s = Math.max(1, Math.round(Number(seconds) || 0))
  if (s >= 3600 && s % 3600 === 0) return `${s / 3600} ساعة`
  if (s >= 60 && s % 60 === 0) return `${s / 60} دقيقة`
  if (s >= 3600) return `${(s / 3600).toFixed(1)} ساعة`
  if (s >= 60) return `${(s / 60).toFixed(1)} دقيقة`
  return `${s} ثانية`
}

/* المتبقي حتى موعد ISO — نص قصير مثل: 4 د 30 ث */
export function timeUntil(iso) {
  if (!iso) return ''
  const ms = new Date(iso) - new Date()
  if (ms <= 0) return 'الآن'
  const s = Math.floor(ms / 1000)
  if (s >= 3600) return `${Math.floor(s / 3600)} س ${Math.floor((s % 3600) / 60)} د`
  if (s >= 60) return `${Math.floor(s / 60)} د ${s % 60} ث`
  return `${s} ث`
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
