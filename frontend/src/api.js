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

/* ============================================================
   إشعارات المتصفح (Web Push) — v1.0.1
   تسجيل Service Worker + طلب الإذن + اشتراك عند خدمة الدفع
   ============================================================ */
export function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function swRegistration() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null)
  return navigator.serviceWorker.getRegistration().then(r => r || Promise.resolve(null))
}

/** رفع ملف نسخة احتياطية للاستعادة (multipart) */
export async function apiUploadBackup(file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(getServerUrl() + '/api/backup/upload', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + getToken() },
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'فشل رفع النسخة')
  return data
}
