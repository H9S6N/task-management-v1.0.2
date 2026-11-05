/* ============================================================
   طبقة الاتصال بالخادم — عنوان الخادم + التوكن + طلبات REST
   ============================================================ */
const SERVER_KEY = 'tmbw3_server_url'
const TOKEN_KEY = 'tmbw3_token'
const ME_KEY = 'tmbw3_me'

export function getServerUrl() {
  return (localStorage.getItem(SERVER_KEY) || '').replace(/\/+$/, '')
}

export function saveServerUrl(url) {
  let u = String(url || '').trim().replace(/\/+$/, '')
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u
  if (u) localStorage.setItem(SERVER_KEY, u)
  else localStorage.removeItem(SERVER_KEY)
  return u
}

export function hasServerUrl() {
  return !!getServerUrl()
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setAuth(token, me) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ME_KEY, JSON.stringify(me))
}

export function getMe() {
  try { return JSON.parse(localStorage.getItem(ME_KEY)) } catch { return null }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ME_KEY)
}

/* ============================================================
   رابط الدعوة — يوزعه المدير على الموظفين مرة واحدة فقط،
   وعند فتحه يُحفظ عنوان الخادم تلقائياً بجهاز الموظف
   ويُنظف شريط العنوان حتى لا يبقى الربط ظاهراً.
   ============================================================ */
function b64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  s += '='.repeat((4 - (s.length % 4)) % 4)
  return decodeURIComponent(escape(atob(s)))
}

/** يطبق رابط الدعوة من شريط العنوان (#s=...) — يرجع true إذا وجد وطُبق */
export function applyInviteFromHash() {
  const m = location.hash.match(/[#&]s=([A-Za-z0-9\-_]+)/)
  if (!m) return false
  try {
    const url = b64urlDecode(m[1])
    if (/^https?:\/\//i.test(url)) { saveServerUrl(url); return true }
  } catch { /* رابط غير صالح — تجاهل */ }
  return false
}

/** تنظيف شريط العنوان من معامل الدعوة */
export function cleanAppHash() {
  history.replaceState(null, '', location.pathname + location.search)
}

/** توليد رابط دعوة (من لوحة المدير فقط) */
export function buildInviteLink(appUrl) {
  const base = String(appUrl || `${location.origin}${location.pathname}`).replace(/\/+$/, '') + '/'
  const srv = getServerUrl()
  return srv ? base + '#s=' + b64urlEncode(srv) : ''
}

/** طلب REST عام — يرمي Error بالرسالة العربية من الخادم */
export async function api(path, { method = 'GET', body } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = 'Bearer ' + token
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (!hasServerUrl()) {
    throw Object.assign(new Error('النظام غير متوفر حالياً — راجع المدير'), { status: 0 })
  }
  let res
  try {
    res = await fetch(getServerUrl() + path, {
      method, headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw Object.assign(new Error('تعذر الاتصال بالخادم — حاول مرة أخرى'), { status: 0 })
  }
  let data = null
  try { data = await res.json() } catch { /* لا يوجد JSON */ }
  if (!res.ok) {
    const msg = (data && data.detail) ? String(data.detail) : `خطأ من الخادم (${res.status})`
    throw Object.assign(new Error(msg), { status: res.status })
  }
  return data
}

/** رفع صورة (multipart) */
export async function apiUpload(file) {
  const fd = new FormData()
  fd.append('file', file, file.name || 'photo.jpg')
  const res = await fetch(getServerUrl() + '/api/upload', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + getToken() },
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `فشل رفع الصورة (${res.status})`)
  return data
}

/** رفع ملف عام (multipart) — استيراد النسخة الاحتياطية */
export async function apiUploadFile(path, file) {
  const fd = new FormData()
  fd.append('file', file, file.name || 'backup.db')
  const res = await fetch(getServerUrl() + path, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + getToken() },
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `فشل الاستيراد (${res.status})`)
  return data
}

/* ============================================================
   إشعارات المتصفح — Web Push (Service Worker + VAPID)
   تصل حتى لو الموقع مقفل، وعلى الموبايل حتى لو المتصفح مقفل
   ============================================================ */
export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** تفعيل الإشعارات: إذن + اشتراك + إرسال الاشتراك للخادم. يرجع نص الحالة */
export async function enablePushNotifications() {
  if (!pushSupported()) throw new Error('متصفحك لا يدعم إشعارات المتصفح — استخدم Chrome أو Edge أو Firefox')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('لم تُعطَ إذن الإشعارات — فعّله من إعدادات المتصفح للموقع')

  const reg = await navigator.serviceWorker.register('./sw.js')
  await navigator.serviceWorker.ready

  const { publicKey } = await api('/api/push/key')
  if (!publicKey) throw new Error('الخادم غير مهيأ للإشعارات — المفتاح غير موجود')

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }
  await api('/api/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } })
  return 'تم التفعيل ✅ — ستصلك الإشعارات حتى لو الموقع مقفل'
}

/** إلغاء الاشتراك من هذا الجهاز */
export async function disablePushNotifications() {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await api('/api/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {})
      await sub.unsubscribe()
    }
    return 'تم إيقاف إشعارات هذا الجهاز'
  } catch {
    throw new Error('تعذر الإيقاف')
  }
}

export async function testPushNotification() {
  return api('/api/push/test', { method: 'POST', body: {} })
}

/** تحميل صورة محمية بالتوكن وإرجاع رابط محلي للعرض */
const _blobCache = new Map()
export async function loadPhotoUrl(path) {
  if (_blobCache.has(path)) return _blobCache.get(path)
  const res = await fetch(getServerUrl() + '/' + path.replace(/^\/+/, ''), {
    headers: { 'Authorization': 'Bearer ' + getToken() },
  })
  if (!res.ok) throw new Error('تعذر تحميل الصورة')
  const url = URL.createObjectURL(await res.blob())
  _blobCache.set(path, url)
  return url
}

/** اختبار اتصال بخادم معين — رسالة خطأ عامة بدون أي تفاصيل تقنية */
export async function testServer(url) {
  let res
  try {
    res = await fetch(String(url).replace(/\/+$/, '') + '/api/health', { cache: 'no-store' })
  } catch {
    throw new Error('العنوان غير صحيح أو غير متوفر')
  }
  let j = null
  try { j = await res.json() } catch { /* ليس JSON */ }
  if (!res.ok || !j || j.server !== 'task-management') {
    throw new Error('العنوان غير صحيح أو غير متوفر')
  }
  return j
}

/** تنزيل ملف (نسخة احتياطية) بالتوكن */
export async function downloadFile(path, filename) {
  const res = await fetch(getServerUrl() + '/' + path.replace(/^\/+/, ''), {
    headers: { 'Authorization': 'Bearer ' + getToken() },
  })
  if (!res.ok) throw new Error('فشل التنزيل')
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500)
}
