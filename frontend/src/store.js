/* ============================================================
   المتجر المركزي (Pinia) — كل بيانات النظام من الخادم + تحديث حي
   v1.0.1: صلاحية مدير المهام، إشعارات المتصفح، رابط عميق للمهام،
   معالجة أفضل لانقطاع الاتصال (بدون صفحات صيانة مربكة)
   ============================================================ */
import { defineStore } from 'pinia'
import {
  api, getServerUrl, hasServerUrl, getToken, getMe, setAuth, clearAuth,
  testServer, saveServerUrl, applyInviteFromHash, cleanAppHash,
} from './api.js'
import { isOnLeaveNow, taskInPeriod } from './utils.js'

export const useStore = defineStore('app', {
  state: () => ({
    booted: false,
    view: 'login',            // login | setup | app
    serverInfo: null,
    setupError: '',

    auth: null,               // {role, name, id}
    conn: 'ok',               // ok | off
    lastSync: null,           // آخر مزامنة ناجحة (تُعرض عند الانقطاع)

    /* بيانات الإدارة (مدير عام + مدير مهام) */
    settings: {},
    employees: [],
    managers: [],
    taskTypes: [],
    tasks: [],
    ledger: [],
    audit: [],

    /* بيانات الموظف */
    me: null,
    leaderboard: [],
    myLedger: [],
    serverSettings: {},

    appVersion: '',           // من الخادم
    deepTaskId: null,         // مهمة مطلوبة من إشعار (#task=...)
    pendingOpenTask: null,    // تُفتح بعد الدخول مباشرة (من الإشعار)

    section: 'dashboard',
    _sig: '',
    _timer: null,

    /* واجهة */
    toasts: [],
    lightbox: null,
    confirmBox: null,
    pushState: 'unknown',     // unknown | unsupported | denied | granted | off

    /* v1.0.1+: تثبيت التطبيق كتطبيق هاتف (PWA) */
    pwaPromptEvent: null,     // حدث beforeinstallprompt (أندرويد/كروم/ديسكتوب)
    pwaInstalled: false,
  }),

  getters: {
    isAdmin: s => s.auth?.role === 'admin',
    isManager: s => s.auth?.role === 'manager',
    isEmployee: s => s.auth?.role === 'employee',
    isManagement: s => s.auth?.role === 'admin' || s.auth?.role === 'manager',

    pendingTasks: s => s.tasks.filter(t => t.status === 'pending_approval' && !t.archived && !t.deleted),
    scheduledTasks: s => s.tasks.filter(t => t.status === 'scheduled' && !t.deleted),
    archivedTasks: s => s.tasks.filter(t => t.archived && !t.deleted),
    deletedTasks: s => s.tasks.filter(t => t.deleted),

    /* المهام المعروضة على هذا الموظف (المرفوضة حذفت من قائمته نهائياً) */
    myAvailableTasks(s) {
      if (!this.isEmployee || !s.me) return []
      const exc = s.me.exceptions || []
      return s.tasks.filter(t =>
        t.status === 'available' &&
        (!t.offeredTo || !t.offeredTo.length || t.offeredTo.includes(s.me.id)) &&
        !exc.includes(t.taskTypeId)
      )
    },
    myTasks(s) {
      if (!this.isEmployee || !s.me) return []
      return s.tasks.filter(t => t.assignedToId === s.me.id)
    },
    activeEmployees: s => s.employees.filter(e => e.status !== 'disabled' && !e.deleted),
    whatsappUrl: s => s.serverSettings?.whatsappNumber
      ? 'https://wa.me/' + String(s.serverSettings.whatsappNumber).replace(/[^0-9]/g, '')
      : '',

    /* v1.0.1+: حالة تثبيت التطبيق */
    isStandalone() {
      return window.matchMedia?.('(display-mode: standalone)').matches
        || window.navigator.standalone === true
        || this.pwaInstalled
    },
    canInstallPwa: s => !!s.pwaPromptEvent,
  },

  actions: {
    /* ============ الإقلاع ============ */
    async boot() {
      if (applyInviteFromHash()) cleanAppHash()

      // مهمة مطلوبة من إشعار المتصفح (#task=...)
      const m = location.hash.match(/[#&]task=([A-Za-z0-9_-]+)/)
      if (m) { this.deepTaskId = m[1]; history.replaceState(null, '', location.pathname + location.search) }

      // v1.0.1+: التقاط حدث التثبيت — زر "تثبيت التطبيق" بالإعدادات
      window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault()
        this.pwaPromptEvent = e
      })
      window.addEventListener('appinstalled', () => {
        this.pwaPromptEvent = null
        this.pwaInstalled = true
        this.toast('تم تثبيت التطبيق على جهازك ✅ — تلقاه بأيقونة الشاشة الرئيسية', 'ok')
      })

      if (!hasServerUrl()) { this.view = 'login'; this.booted = true; return }
      try {
        this.serverInfo = await testServer(getServerUrl())
        this.setupError = ''
      } catch {
        this.view = 'login'
        this.setupError = 'الخادم غير متصل حالياً — تأكد أن الخادم والنفق شغالين، أو راجع المدير'
        this.booted = true
        return
      }
      const saved = getToken() ? getMe() : null
      if (saved && saved.role) {
        try {
          await api('/api/me')
          this.auth = saved
          this.view = 'app'
          await this.refresh(true)
          this._startPolling()
          this.section = saved.role === 'employee' ? 'avail' : 'dashboard'
          this._afterEnter()
        } catch (e) {
          if (e.status === 401 || e.status === 403) clearAuth()
          this.view = 'login'
        }
      } else {
        this.view = 'login'
      }
      this.booted = true
    },

    /* رابط عميق لمهمة (من إشعار) — يفتح بعد الدخول مباشرة */
    _afterEnter() {
      if (this.deepTaskId) {
        const id = this.deepTaskId
        this.deepTaskId = null
        setTimeout(() => { this.pendingOpenTask = id }, 300)
      }
      this.setupPush()
    },

    /* ============ الربط — للمدير فقط ============ */
    requestLinking(adminPass) {
      this.pendingAdminPass = adminPass
      this.setupError = ''
      this.view = 'setup'
    },

    async connectServer(url) {
      const saved = saveServerUrl(url)
      if (!saved) throw new Error('اكتب عنوان الربط')
      this.serverInfo = await testServer(saved)
      this.setupError = ''
      const pass = this.pendingAdminPass
      this.pendingAdminPass = ''
      if (pass) {
        try {
          await this.login({ role: 'admin', password: pass })
          return
        } catch {
          this.view = 'login'
          throw new Error('تم الربط — سجّل دخولك بكلمة المرور')
        }
      }
      this.view = 'login'
    },

    async updateServerUrl(url) {
      const saved = saveServerUrl(url)
      if (!saved) throw new Error('اكتب عنوان الربط')
      this.serverInfo = await testServer(saved)
    },

    /* ============ الدخول والخروج ============ */
    async login(payload) {
      const r = await api('/api/login', { method: 'POST', body: payload })
      setAuth(r.token, r.me)
      this.auth = r.me
      this.view = 'app'
      this.section = r.me.role === 'employee' ? 'avail' : 'dashboard'
      await this.refresh(true)
      this._startPolling()
      this._afterEnter()
      return r.me
    },

    logout() {
      clearAuth()
      this.auth = null
      this.me = null
      this.view = 'login'
      this._stopPolling()
      this._sig = ''
    },

    /* ============ التحديث الحي ============ */
    async refresh(force = false) {
      const d = await api('/api/state')
      const sig = JSON.stringify(d)
      if (force || sig !== this._sig) {
        this._sig = sig
        this.appVersion = d.appVersion || this.appVersion
        if (d.role === 'admin') {
          this.settings = d.settings || {}
          this.employees = d.employees || []
          this.managers = d.managers || []
          this.taskTypes = d.taskTypes || []
          this.tasks = d.tasks || []
          this.ledger = d.ledger || []
          this.audit = d.audit || []
        } else if (d.role === 'manager') {
          this.me = d.me || null
          this.employees = d.employees || []
          this.taskTypes = d.taskTypes || []
          this.tasks = d.tasks || []
          this.serverSettings = d.serverSettings || {}
        } else {
          this.me = d.me || null
          this.taskTypes = d.taskTypes || []
          this.tasks = d.tasks || []
          this.leaderboard = d.leaderboard || []
          this.myLedger = d.myLedger || []
          this.serverSettings = d.serverSettings || {}
        }
      }
      this.conn = 'ok'
      this.lastSync = new Date()
    },

    _startPolling() {
      this._stopPolling()
      this._timer = setInterval(async () => {
        if (document.visibilityState !== 'visible') return
        try {
          await this.refresh()
          if (this.auth && this.auth.role === 'employee' && this.me?.status === 'disabled') {
            this.toast('حسابك تم إيقافه من المدير', 'err')
            this.logout()
          }
        } catch (e) {
          this.conn = 'off'
          if (e.status === 401) { this.logout() }
        }
      }, 4000)
    },
    _stopPolling() { if (this._timer) { clearInterval(this._timer); this._timer = null } },

    /* ============ إشعارات المتصفح — v1.0.1 ============ */
    async setupPush() {
      if (!this.isEmployee) return
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          this.pushState = 'unsupported'; return
        }
        if (Notification.permission === 'denied') { this.pushState = 'denied'; return }
        const reg = await navigator.serviceWorker.register('./sw.js')
        this.pushState = 'granted'
        // اشترك تلقائياً إذا الإذن ممنوح — بدون أي ضغطة زر إضافية
        const key = await api('/api/push/key')
        if (!key.publicKey) return
        let sub = await reg.pushManager.getSubscription()
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this._b64(key.publicKey),
          })
        }
        const j = sub.toJSON()
        await api('/api/push/subscribe', { method: 'POST', body: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth } })
      } catch {
        this.pushState = Notification.permission === 'granted' ? 'granted' : 'off'
      }
    },

    /* v1.0.1+: تثبيت التطبيق (أندرويد/كروم — بضغطة واحدة) */
    async installPwa() {
      const ev = this.pwaPromptEvent
      if (!ev) return false
      ev.prompt()
      try {
        const { outcome } = await ev.userChoice
        if (outcome === 'accepted') { this.pwaPromptEvent = null; return true }
      } catch { /* تجاهل */ }
      return false
    },

    async enablePush() {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          this.toast('متصفحك ما يدعم إشعارات المتصفح', 'err'); return
        }
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') { this.pushState = 'denied'; this.toast('الإشعارات مرفوضة من إعدادات المتصفح', 'err'); return }
        this.pushState = 'granted'
        const reg = await navigator.serviceWorker.register('./sw.js')
        const key = await api('/api/push/key')
        if (!key.publicKey) { this.toast('الخادم ما جهز مفاتيح الإشعارات بعد', 'err'); return }
        let sub = await reg.pushManager.getSubscription()
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this._b64(key.publicKey),
          })
        }
        const j = sub.toJSON()
        await api('/api/push/subscribe', { method: 'POST', body: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth } })
        this.toast('تم تفعيل إشعارات المتصفح ✅', 'ok')
      } catch (e) {
        this.toast(e.message || 'تعذر تفعيل الإشعارات', 'err')
      }
    },

    async testPush() {
      try { return await api('/api/push/test', { method: 'POST', body: {} }) } catch (e) { return { ok: false, error: e.message } }
    },

    _b64(s) {
      const padding = '='.repeat((4 - (s.length % 4)) % 4)
      const base64 = (s + padding).replace(/-/g, '+').replace(/_/g, '/')
      const raw = atob(base64)
      const arr = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
      return arr
    },

    /* ============ أدوات واجهة ============ */
    toast(msg, type = '') {
      const id = Date.now() + Math.random()
      this.toasts.push({ id, msg, type })
      setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id) }, 3200)
    },

    showLightbox(url) { this.lightbox = url },

    confirm(title, text, danger = false) {
      return new Promise(resolve => {
        this.confirmBox = { title, text, danger, resolve }
      })
    },
    _resolveConfirm(v) {
      this.confirmBox?.resolve(v)
      this.confirmBox = null
    },

    setSection(name) { this.section = name },

    /* ============ مساعدات الإدارة ============ */
    listEmployees(includeDisabled) {
      return this.employees
        .filter(e => !e.deleted && (includeDisabled || e.status !== 'disabled'))
        .sort((a, b) => (Number(b.totalPoints) || 0) - (Number(a.totalPoints) || 0))
    },
    deletedEmployees() {
      return this.employees.filter(e => e.deleted)
    },
    getEmployee(id) { return this.employees.find(e => e.id === id) || null },
    getTask(id) { return this.tasks.find(t => t.id === id) || null },
    getTaskType(id) { return this.taskTypes.find(t => t.id === id) || null },
    getManager(id) { return this.managers.find(m => m.id === id) || null },
    listTaskTypes(activeOnly) {
      const arr = this.taskTypes.filter(t => !t.deleted).slice()
      arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'))
      return activeOnly ? arr.filter(t => t.isActive !== false) : arr
    },
    getEligibleEmployees(taskTypeId) {
      return this.listEmployees(false).filter(e =>
        e.status === 'active' && !isOnLeaveNow(e) && !(e.exceptions || []).includes(taskTypeId)
      )
    },
    tasksInPeriod(period) {
      return this.tasks.filter(t => !t.deleted && taskInPeriod(t, period))
    },

    /* ============ عمليات API موحدة ============ */
    async act(fn, okMsg) {
      try {
        const r = await fn()
        if (okMsg) this.toast(okMsg, 'ok')
        await this.refresh(true).catch(() => {})
        return r
      } catch (e) {
        this.toast(e.message, 'err')
        if (e.status === 401) this.logout()
        throw e
      }
    },

    /* الإدارة */
    saveSettings(patch) { return this.act(() => api('/api/settings', { method: 'PUT', body: patch })) },
    addEmployee(data) { return this.act(() => api('/api/employees', { method: 'POST', body: data })) },
    updateEmployee(id, patch) { return this.act(() => api('/api/employees/' + encodeURIComponent(id), { method: 'PATCH', body: patch })) },
    toggleLeave(id, onLeave, opts = {}) { return this.act(() => api('/api/employees/' + encodeURIComponent(id) + '/leave', { method: 'POST', body: { onLeave, ...opts } })) },
    addManager(data) { return this.act(() => api('/api/managers', { method: 'POST', body: data })) },
    updateManager(id, patch) { return this.act(() => api('/api/managers/' + encodeURIComponent(id), { method: 'PATCH', body: patch })) },
    addTaskType(data) { return this.act(() => api('/api/task-types', { method: 'POST', body: data })) },
    updateTaskType(id, patch) { return this.act(() => api('/api/task-types/' + encodeURIComponent(id), { method: 'PATCH', body: patch })) },
    createTask(data) { return this.act(() => api('/api/tasks', { method: 'POST', body: data })) },
    updateTask(id, patch) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id), { method: 'PATCH', body: patch })) },
    approveTask(id) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id) + '/approve', { method: 'POST' })) },
    rejectTask(id, reason) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id) + '/reject', { method: 'POST', body: { reason } })) },
    cancelTask(id) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id) + '/cancel', { method: 'POST' })) },
    unassignTask(id) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id) + '/unassign', { method: 'POST' })) },
    archiveTask(id) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id) + '/archive', { method: 'POST' }), 'تم أرشفة المهمة 📦') },
    unarchiveTask(id) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id) + '/unarchive', { method: 'POST' }), 'تم استعادة المهمة من الأرشيف ✅') },
    deleteTask(id) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id), { method: 'DELETE' }), 'تم حذف المهمة — تكدر تستعيدها من سلة المحذوفات') },
    restoreTask(id) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id) + '/restore', { method: 'POST' }), 'تم استعادة المهمة ✅') },
    /* v1.0.1+: عمليات المهمة الجماعية — على كل النسخ مرة واحدة */
    archiveTaskGroup(id) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id) + '/archive?group=1', { method: 'POST' }), 'تم أرشفة كل نسخ المهمة الجماعية 📦') },
    unarchiveTaskGroup(id) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id) + '/unarchive?group=1', { method: 'POST' }), 'تم استعادة المجموعة من الأرشيف ✅') },
    deleteTaskGroup(id) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id) + '?group=1', { method: 'DELETE' }), 'تم حذف كل نسخ المهمة الجماعية — قابلة للاستعادة من سلة المحذوفات') },
    restoreTaskGroup(id) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id) + '/restore?group=1', { method: 'POST' }), 'تم استعادة كل نسخ المجموعة ✅') },
    adjustPoints(employeeId, amount, reason) {
      return this.act(() => api('/api/points/adjust', { method: 'POST', body: { employeeId, amount, reason } }))
    },
    resetSettings(mode) { return this.act(() => api('/api/settings/reset', { method: 'POST', body: { mode, confirm: true } })) },
    sendBackupTelegram() { return this.act(() => api('/api/backup/send-telegram', { method: 'POST', body: {} })) },
    changePassword(oldPassword, newPassword) {
      return this.act(() => api('/api/settings/password', { method: 'POST', body: { oldPassword, newPassword } }))
    },
    changeMyCredentials(body) { return this.act(() => api('/api/me/credentials', { method: 'POST', body })) },
    testTelegram() { return api('/api/notify/test', { method: 'POST', body: {} }) },

    /* الموظف */
    acceptTask(taskId) {
      return this.act(() => api('/api/tasks/' + encodeURIComponent(taskId) + '/accept', { method: 'POST', body: {} }))
    },
    declineTask(taskId) {
      return this.act(() => api('/api/tasks/' + encodeURIComponent(taskId) + '/decline', { method: 'POST', body: {} }))
    },
    viewTask(taskId) {
      return api('/api/tasks/' + encodeURIComponent(taskId) + '/view', { method: 'POST', body: {} }).catch(() => {})
    },
    startTask(taskId) {
      return this.act(() => api('/api/tasks/' + encodeURIComponent(taskId) + '/start', { method: 'POST', body: {} }))
    },
    submitReport(taskId, reportText, photoIds) {
      return this.act(() => api('/api/tasks/' + encodeURIComponent(taskId) + '/submit', { method: 'POST', body: { reportText, photoIds } }))
    },
    getSubmissions(taskId) { return api('/api/tasks/' + encodeURIComponent(taskId) + '/submissions') },
  },
})
