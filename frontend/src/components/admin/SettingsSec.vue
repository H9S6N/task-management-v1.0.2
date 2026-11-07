<script setup>
/* الإعدادات — v1.0.2
   + نسخة احتياطية يومية تلقائية إلى تيليجرام + إرسال فوري + استعادة نسخة
   + تحكم بالواجهة الرئيسية: تصفير العدادات / تصفير النقاط / يوم بداية التقييم
   + اسم مستخدم المدير للدخول الموحد + كلمة المرور
   + رقم واتساب خدمة العملاء + إشعارات المتصفح + رقم الإصدار v1.0.2 */
import { computed, ref } from 'vue'
import { useStore } from '../../store.js'
import { getServerUrl, buildInviteLink, downloadFile, apiUploadBackup } from '../../api.js'
import PwaInstall from '../PwaInstall.vue'

const store = useStore()
const s = store.settings

const tgEnabled = ref(s.tgEnabled !== false)
const tgToken = ref('')
const tgAdmins = ref((s.tgAdminChatIds || []).join(','))
const maxActive = ref(Number(s.maxActiveTasks) || 3)

const oldPass = ref(''); const newPass = ref(''); const newPass2 = ref('')
const adminUser = ref(s.adminUsername || 'admin')
const tgStatus = ref('')
const backingUp = ref(false)
const fileEl = ref(null)

/* v1.0.1: النسخ اليومي + الواجهة + واتساب */
const waNumber = ref(s.whatsappNumber || '')
const autoBackupEnabled = ref(s.autoBackupEnabled !== false)
const autoBackupTime = ref(s.autoBackupTime || '23:30')
const statsStartDay = ref(Number(s.statsStartDay) || 1)
const statsStartDate = ref(s.statsStartDate || '')

const defDist = ref(s.defaultDistribution || 'lowest')
const defCount = ref(Number(s.defaultCandidates) || 1)

async function saveDistribution() {
  const v = parseInt(defCount.value, 10)
  if (!v || v < 1 || v > 50) { store.toast('عدد غير صحيح (1 - 50)', 'err'); return }
  await store.saveSettings({ defaultDistribution: defDist.value, defaultCandidates: v })
  store.toast('تم حفظ إعدادات التوزيع ✅', 'ok')
}

const newUrl = ref(getServerUrl())
const linkingBusy = ref(false)
const appUrlInput = ref(s.appUrl || '')
const appUrlBusy = ref(false)
const copied = ref(false)

const inviteLink = computed(() => buildInviteLink(store.settings.appUrl || ''))

async function updateServer() {
  if (!newUrl.value.trim()) { store.toast('اكتب عنوان الربط', 'err'); return }
  linkingBusy.value = true
  try {
    await store.updateServerUrl(newUrl.value)
    store.toast('تم تحديث عنوان الخادم ✅', 'ok')
  } catch (e) { store.toast(e.message, 'err') }
  linkingBusy.value = false
}

async function saveAppUrl() {
  let u = String(appUrlInput.value || '').trim()
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u
  if (u && !/^https?:\/\/[^\s]+$/i.test(u)) { store.toast('رابط التطبيق غير صحيح', 'err'); return }
  appUrlBusy.value = true
  try {
    await store.saveSettings({ appUrl: u })
    appUrlInput.value = u
    store.toast('تم حفظ رابط التطبيق ✅ — روابط الإشعارات راح تفتح الموقع مباشرة', 'ok')
  } catch (e) { store.toast(e.message, 'err') }
  appUrlBusy.value = false
}

async function copyInvite() {
  if (!inviteLink.value) { store.toast('اربط الخادم أولاً', 'err'); return }
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    copied.value = true
    store.toast('تم نسخ رابط الدعوة ✅ — أرسله للموظفين', 'ok')
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    store.toast('انسخ الرابط يدوياً من الحقل', 'err')
  }
}

async function saveTelegram() {
  const admins = tgAdmins.value.split(',').map(x => x.trim()).filter(Boolean)
  await store.saveSettings({ tgEnabled: tgEnabled.value, tgToken: tgToken.value.trim(), tgAdminChatIds: admins })
  tgToken.value = ''
  tgStatus.value = '✅ تم حفظ إعدادات تيليكرام'
}

async function testTelegram() {
  const admins = tgAdmins.value.split(',').map(x => x.trim()).filter(Boolean)
  if (!admins.length) { store.toast('اكتب Chat ID واحد على الأقل', 'err'); return }
  tgStatus.value = '⏳ جاري الإرسال...'
  try {
    await saveTelegram()
    const r = await store.testTelegram()
    tgStatus.value = r.ok ? '✅ وصل الإشعار التجريبي! افتح تيليكرام' : '❌ فشل: ' + r.error
  } catch (e) {
    tgStatus.value = '❌ ' + e.message
  }
}

async function saveAutoBackup() {
  await store.saveSettings({ autoBackupEnabled: autoBackupEnabled.value, autoBackupTime: autoBackupTime.value })
  store.toast('تم حفظ إعدادات النسخ اليومي ✅ — يرسل تلقائياً كل يوم بتوقيت بغداد', 'ok')
}

async function sendBackupNow() {
  const r = await store.sendBackupTelegram()
  if (r?.ok) store.toast('تم إرسال النسخة لتيليجرام ✅ — راجع محادثتك', 'ok')
  else if (r?.error) store.toast('فشل الإرسال: ' + r.error, 'err')
}

async function saveWhatsapp() {
  await store.saveSettings({ whatsappNumber: waNumber.value.trim() })
  store.toast('تم حفظ رقم الدعم — زر التواصل ظهر أسفل الإعدادات ✅', 'ok')
}

async function saveGeneral() {
  const v = parseInt(maxActive.value, 10)
  const sd = Math.min(Math.max(parseInt(statsStartDay.value, 10) || 1, 1), 28)
  if (!v || v < 1) { store.toast('قيمة غير صحيحة', 'err'); return }
  await store.saveSettings({ maxActiveTasks: v, statsStartDay: sd })
  store.toast('تم الحفظ ✅', 'ok')
}

async function changePassword() {
  if (newPass.value.length < 6) { store.toast('الجديدة 6 أحرف على الأقل', 'err'); return }
  if (newPass.value !== newPass2.value) { store.toast('التأكيد غير مطابق', 'err'); return }
  try {
    await store.changePassword(oldPass.value, newPass.value)
    oldPass.value = newPass.value = newPass2.value = ''
    store.toast('تم تغيير كلمة المرور ✅', 'ok')
  } catch { /* التوست من store */ }
}

/* v1.0.2: اسم مستخدم المدير — للدخول الموحد (صفحة واحدة للكل) */
async function saveAdminUsername() {
  const u = adminUser.value.trim()
  if (!/^[A-Za-z0-9_.-]{3,40}$/.test(u)) { store.toast('اسم المستخدم: حروف إنكليزية/أرقام 3 على الأقل', 'err'); return }
  await store.saveSettings({ adminUsername: u })
  adminUser.value = u
  store.toast('تم حفظ اسم المستخدم ✅ — ادخل به من صفحة الدخول', 'ok')
}

/* ============ تصفير العدادات والتقييم — v1.0.1 ============ */
async function resetCounters() {
  const ok = await store.confirm('تصفير عدادات لوحة التحكم',
    'كل العدادات والتقييمات بلوحة التحكم راح تبدأ من الآن — بيانات التجربة ما راح تنحسب بعد.\n' +
    'المهام والنقاط تبقى موجودة بدون تغيير. متابعة؟', true)
  if (!ok) return
  const r = await store.resetSettings('counters')
  if (r?.message) store.toast(r.message + ' ✅', 'ok')
}
async function resetPoints() {
  const ok = await store.confirm('تصفير نقاط جميع الموظفين',
    'نقاط وإنجازات ومرفوضات كل الموظفين راح تصير صفر (بيانات التجربة).\n' +
    'المهام تبقى بسجلها، والعملية تنحفظ باللوك. متابعة؟', true)
  if (!ok) return
  const r = await store.resetSettings('points')
  if (r?.message) store.toast(r.message + ' ✅', 'ok')
}
async function undoCounters() {
  const ok = await store.confirm('إلغاء تصفير العدادات', 'رجوع الاحتساب لكل السجل من البداية. متابعة؟')
  if (!ok) return
  await store.resetSettings('stats')
  store.toast('تم الإلغاء — عدادات كامل السجل ✅', 'ok')
}

/* ============ النسخ الاحتياطي والاستعادة ============ */
async function backup() {
  backingUp.value = true
  try {
    await downloadFile('/api/backup', `taskmanager-backup-${new Date().toISOString().slice(0, 10)}.db`)
    store.toast('تم تنزيل النسخة الاحتياطية ✅', 'ok')
  } catch (e) { store.toast(e.message, 'err') }
  backingUp.value = false
}

async function onRestoreFile(ev) {
  const f = ev.target.files?.[0]
  ev.target.value = ''
  if (!f) return
  if (!f.name.endsWith('.db') && !f.name.endsWith('.sqlite')) {
    store.toast('اختر ملف نسخة احتياطية (.db)', 'err'); return
  }
  const ok = await store.confirm('استعادة نسخة احتياطية',
    '⚠️ راح تستبدل قاعدة البيانات الحالية كاملة بمحتوى النسخة المرفوعة.\n' +
    'بعد الرفع: سكر الخادم وافتحه من جديد حتى تتطبق النسخة. متابعة؟', true)
  if (!ok) return
  try {
    const r = await apiUploadBackup(f)
    store.toast(r.message || 'تم استلام النسخة — أعد تشغيل الخادم لتطبيقها', 'ok')
  } catch (e) { store.toast(e.message, 'err') }
}
</script>

<template>
  <section>
    <h2 class="sec-title">⚙️ الإعدادات</h2>

    <!-- ربط الخادم -->
    <div class="card">
      <h3>🔗 ربط الخادم</h3>
      <p class="muted">العنوان الحالي المرتبط بهذا الجهاز:</p>
      <p class="hint" dir="ltr" style="word-break:break-all">{{ getServerUrl() || 'غير مرتبط' }}</p>

      <label>تغيير عنوان الخادم</label>
      <input v-model="newUrl" dir="ltr" placeholder="https://..." @keyup.enter="updateServer">
      <div class="btn-row">
        <button class="btn btn-primary" :disabled="linkingBusy" @click="updateServer">🔗 تحديث العنوان</button>
      </div>

      <label style="margin-top:14px">رابط التطبيق (GitHub Pages) — يُضاف لإشعارات تيليكرام ويفتح من إشعارات المتصفح</label>
      <input v-model="appUrlInput" dir="ltr" placeholder="https://username.github.io/repo/" @keyup.enter="saveAppUrl">
      <div class="btn-row">
        <button class="btn btn-primary" :disabled="appUrlBusy" @click="saveAppUrl">💾 حفظ رابط التطبيق</button>
      </div>
      <p class="hint">⚠️ مهم للروابط: احفظ هذا الرابط — كل إشعار متصفح يفتح التطبيق عليه مباشرة</p>

      <label style="margin-top:14px">رابط الدعوة للموظفين — أرسله مرة واحدة لكل موظف، يربط جهازه تلقائياً</label>
      <input :value="inviteLink" dir="ltr" readonly placeholder="اربط الخادم أولاً" style="word-break:break-all">
      <div class="btn-row">
        <button class="btn btn-outline" @click="copyInvite">{{ copied ? '✅ تم النسخ' : '📋 نسخ رابط الدعوة' }}</button>
      </div>
    </div>

    <!-- v1.0.1+: تحميل التطبيق — يعمل كتطبيق هاتف (آيفون + أندرويد) -->
    <PwaInstall />

    <!-- v1.0.1: تحكم الواجهة الرئيسية -->
    <div class="card">
      <h3>🎛️ عدادات الواجهة والتقييم</h3>
      <p class="muted">تحكم ببداية احتساب العدادات والتقييم — حتى بيانات التجربة ما تأثر على التقييم الصحيح.</p>
      <div class="grid-2">
        <div>
          <label>يوم بداية التقييم بالشهر (1-28)</label>
          <input v-model.number="statsStartDay" type="number" min="1" max="28" class="input-sm">
        </div>
        <div>
          <label>أقصى عدد مهام مفتوحة لكل موظف</label>
          <input v-model="maxActive" type="number" min="1" max="20" class="input-sm">
        </div>
      </div>
      <p v-if="statsStartDate" class="hint">
        🕹️ العدادات حالياً تبدأ من: <b dir="ltr">{{ statsStartDate.slice(0, 16).replace('T', ' ') }}</b> (بداية احتساب جديدة)
      </p>
      <p v-else class="hint">العدادات تحسب كل السجل — استخدم التصفير بعد ما تخلص التجربة</p>
      <div class="btn-row">
        <button class="btn btn-primary" @click="saveGeneral">💾 حفظ</button>
        <button class="btn btn-outline" @click="resetCounters">🕹️ تصفير العدادات (بدء من الآن)</button>
        <button v-if="statsStartDate" class="btn btn-ghost" @click="undoCounters">↩️ إلغاء التصفير</button>
        <button class="btn btn-danger" @click="resetPoints">0️⃣ تصفير نقاط جميع الموظفين</button>
      </div>
    </div>

    <!-- v1.0.1: واتساب — إدارة الرقم (زر الدعم نفسه صار أسفل الإعدادات) -->
    <div class="card">
      <h3>💬 رقم واتساب الدعم</h3>
      <p class="muted">هذا الرقم يظهر بزر الدعم أسفل صفحة الإعدادات (وحسابي للموظفين) — بدل الزر العائم السابق.</p>
      <label>الرقم بالصيغة الدولية بدون +</label>
      <input v-model="waNumber" dir="ltr" placeholder="9647701234567" @keyup.enter="saveWhatsapp">
      <div class="btn-row">
        <button class="btn btn-primary" @click="saveWhatsapp">💾 حفظ الرقم</button>
        <a v-if="store.whatsappUrl" class="btn btn-outline" :href="store.whatsappUrl" target="_blank">🧪 تجربة الرابط</a>
      </div>
    </div>

    <!-- تيليكرام -->
    <div class="card">
      <h3>📬 إشعارات تيليكرام</h3>
      <p class="muted">الخادم يرسل الإشعارات تلقائياً عند: مهمة جديدة، قبول، رفض موظف، رفع تقرير، اعتماد أو رفض مع سبب — حتى لو المتصفح مقفل.</p>
      <label class="switch-row"><input type="checkbox" v-model="tgEnabled"> تشغيل الإشعارات</label>
      <label>Bot Token (من @BotFather) {{ s.hasToken ? `— محفوظ (${s.tokenMasked})` : '' }}</label>
      <input v-model="tgToken" dir="ltr" :placeholder="s.hasToken ? 'اتركه فارغاً للإبقاء على التوكن الحالي' : 'مثال: 7123456789:AAH8skfh...'">
      <label>معرفات المديرين Chat ID (مفصولة بفاصلة)</label>
      <input v-model="tgAdmins" dir="ltr" placeholder="مثال: 375486602,123456789">
      <p class="hint">اعرف معرفك من بوت <b>@userinfobot</b> — والموظف لازم يرسل <b>/start</b> للبوت أول مرة</p>
      <div class="btn-row">
        <button class="btn btn-outline" @click="testTelegram">🔔 إشعار تجريبي</button>
        <button class="btn btn-primary" @click="saveTelegram">💾 حفظ</button>
      </div>
      <p class="hint">{{ tgStatus }}</p>
    </div>

    <!-- v1.0.1: النسخ اليومي التلقائي -->
    <div class="card">
      <h3>💾 النسخ الاحتياطي اليومي التلقائي</h3>
      <p class="muted">كل يوم بالوقت المحدد (بتوقيت بغداد) يرسل الخادم نسخة كاملة من قاعدة بياناتك إلى تيليكرام للمدير —
        وإن سكرت النظام قبل الوقت يرسلها لحظة الإغلاق. النسخ المحلية تنحفظ بمجلد <b dir="ltr">backend/data/backups</b> (آخر 30 نسخة).</p>
      <label class="switch-row"><input type="checkbox" v-model="autoBackupEnabled"> تشغيل النسخة اليومية التلقائية</label>
      <div class="grid-2">
        <div>
          <label>وقت الإرسال اليومي</label>
          <input v-model="autoBackupTime" type="time">
        </div>
        <div>
          <label>آخر نسخة انأرسلت</label>
          <input :value="s.lastAutoBackup || '— لم ترسل بعد'" readonly>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" @click="saveAutoBackup">💾 حفظ</button>
        <button class="btn btn-outline" @click="sendBackupNow">📤 إرسال نسخة الآن (اختبار)</button>
        <button class="btn btn-outline" :disabled="backingUp" @click="backup">⬇️ تنزيل نسخة على الجهاز</button>
      </div>
      <div class="detail-sec" style="margin-top:14px">
        <div class="lbl">♻️ استعادة نسخة احتياطية</div>
        <p class="muted" style="margin:6px 0">ارفع ملف نسخة (.db) — تُطبق بعد إعادة تشغيل الخادم.</p>
        <input ref="fileEl" type="file" accept=".db,.sqlite" style="padding:8px" @change="onRestoreFile">
      </div>
    </div>

    <!-- التوزيع -->
    <div class="card">
      <h3>🎲 التوزيع التلقائي — الإعدادات الافتراضية</h3>
      <div class="grid-2">
        <div>
          <label>نمط التوزيع الافتراضي</label>
          <select v-model="defDist">
            <option value="lowest">⬇️ الأقل نقاطاً (وبلا مهام مفتوحة أولاً)</option>
            <option value="random">🎲 عشوائي</option>
            <option value="all">👥 كل المؤهلين</option>
          </select>
        </div>
        <div>
          <label>عدد المعروض عليهم افتراضياً</label>
          <input v-model="defCount" type="number" min="1" max="50" class="input-sm">
        </div>
      </div>
      <div class="btn-row"><button class="btn btn-primary" @click="saveDistribution">💾 حفظ</button></div>
    </div>

    <!-- كلمة المرور واسم المستخدم — v1.0.2 الدخول الموحد -->
    <div class="card">
      <h3>🔑 دخول المدير العام</h3>
      <p class="muted">صفحة الدخول صارت موحدة للكل: اسم المستخدم + كلمة المرور — والنظام يتعرف على الصلاحية تلقائياً.</p>
      <label>اسم المستخدم (3 أحرف على الأقل — حروف إنكليزية/أرقام)</label>
      <input v-model="adminUser" dir="ltr" maxlength="40" autocomplete="off" @keyup.enter="saveAdminUsername">
      <div class="btn-row">
        <button class="btn btn-primary" @click="saveAdminUsername">💾 حفظ اسم المستخدم</button>
      </div>
      <label style="margin-top:14px">كلمة المرور الحالية</label>
      <input v-model="oldPass" type="password" autocomplete="off">
      <label>كلمة المرور الجديدة (6 أحرف على الأقل)</label>
      <input v-model="newPass" type="password" autocomplete="off">
      <label>تأكيد كلمة المرور الجديدة</label>
      <input v-model="newPass2" type="password" autocomplete="off">
      <div class="btn-row"><button class="btn btn-primary" @click="changePassword">تغيير كلمة المرور</button></div>
    </div>

    <!-- معلومات -->
    <div class="card">
      <h3>ℹ️ معلومات النظام</h3>
      <p class="muted">
        📦 الإصدار: <b>v{{ store.appVersion || '1.0.2' }}</b> — التحديث القادم سيكون v1.0.3 (والترقيم يستمر v1.0.4...)<br><br>
        📱 حمّل النظام كتطبيق هاتف من بطاقة «تحميل التطبيق» أعلى هذه الصفحة — آيفون وأندرويد<br><br>
        🔔 إشعارات المتصفح: تشتغل للموظفين تلقائياً بعد فتح الموقع أول مرة (على الآيفون: أضف الموقع للشاشة الرئيسية من زر المشاركة)<br><br>
        🗑️ كل عمليات الحذف بالنظام ناعمة — ما تنمسح نهائياً، وتكدر تستعيد كل شي من الأرشيف وسلة المحذوفات<br><br>
        🗂️ عدد المهام المخزنة: {{ store.tasks.length }} — 👥 الموظفون: {{ store.employees.filter(e => !e.deleted).length }} — 🧑‍💼 مديرو المهام: {{ store.managers.length }}
      </p>
    </div>

    <!-- v1.0.1+: الدعم والتواصل — مكانه الوحيد أسفل الإعدادات -->
    <div class="card">
      <h3>💬 الدعم والتواصل</h3>
      <p class="muted">أي ملاحظة أو مشكلة أو طلب تعديل؟ راسل الدعم مباشرة على واتساب.</p>
      <a v-if="store.whatsappUrl" class="btn btn-wa" :href="store.whatsappUrl" target="_blank" rel="noopener">
        <svg viewBox="0 0 32 32" width="20" height="20" fill="#fff" aria-hidden="true">
          <path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.6.9 5.1 2.4 7.1L4 29l7.3-2.3c1.9 1 4 1.6 6.2 1.6h.5c6.6 0 12-5.3 12-11.9S22.6 3 16 3zm0 21.8c-2 0-3.9-.6-5.5-1.6l-.4-.2-4.3 1.4 1.4-4.1-.3-.4c-1.2-1.7-1.9-3.7-1.9-5.9C5 9.4 9.9 4.6 16 4.6S27 9.4 27 15.9s-4.9 8.9-11 8.9zm6.1-6.6c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.3-.7.1-.3-.2-1.4-.5-2.7-1.7-1-1.2-1.7-2.6-1.9-3-.2-.4 0-.5.2-.7l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.4 0-.6-.1-.2-.8-1.9-1.1-2.6-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.6c.2.2 2.5 3.9 6.1 5.3.9.3 1.5.5 2 .7.9.2 1.7.2 2.3.1.7-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.2-.6-.4z"/>
        </svg>
        مراسلة الدعم على واتساب
      </a>
      <p v-else class="hint">لم يُضف رقم الدعم بعد — أضفه من بطاقة «رقم واتساب الدعم» بالأعلى</p>
    </div>
  </section>
</template>
