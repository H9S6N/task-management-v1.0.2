<script setup>
/* إعدادات الموظف — تغيير الرمز واسم المستخدم (الاسم في النظام ثابت) + إشعارات المتصفح + دعم */
import { ref, computed, onMounted } from 'vue'
import { useStore } from '../../store.js'
import { APP_VERSION } from '../../utils.js'
import { enablePushNotifications, disablePushNotifications, testPushNotification, pushSupported } from '../../api.js'

const store = useStore()
const me = computed(() => store.me)

/* ===== تغيير الرمز السري ===== */
const oldPin = ref(''); const newPin = ref(''); const newPin2 = ref('')
async function changePin() {
  if (!oldPin.value) { store.toast('اكتب الرمز الحالي', 'err'); return }
  if (newPin.value.length < 6) { store.toast('الرمز الجديد 6 أحرف على الأقل', 'err'); return }
  if (newPin.value !== newPin2.value) { store.toast('التأكيد غير مطابق', 'err'); return }
  try {
    await store.updateMyCredentials(oldPin.value, newPin.value, undefined)
    oldPin.value = newPin.value = newPin2.value = ''
    store.toast('تم تغيير رمزك السري ✅ — استخدمه بالدخول القادم', 'ok')
  } catch { /* التوست من store */ }
}

/* ===== اسم المستخدم ===== */
const username = ref(me.value?.username || '')
async function saveUsername() {
  const u = username.value.trim()
  if (u === (me.value?.username || '')) { store.toast('ما تغير شيء', 'err'); return }
  try {
    const r = await store.updateMyCredentials('', undefined, u)
    store.me = r.me
    store.toast('تم تحديث اسم المستخدم ✅', 'ok')
  } catch { /* التوست من store */ }
}

/* ===== إشعارات المتصفح ===== */
const pushState = ref('')
const pushBusy = ref(false)
const supported = pushSupported()

async function refreshPushState() {
  if (!supported) { pushState.value = 'unsupported'; return }
  pushState.value = Notification.permission === 'granted' ? 'granted' : Notification.permission
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) pushState.value = 'subscribed'
  } catch { /* */ }
}
onMounted(refreshPushState)

async function enablePush() {
  pushBusy.value = true
  try {
    const msg = await enablePushNotifications()
    store.toast(msg, 'ok')
    await refreshPushState()
  } catch (e) { store.toast(e.message, 'err') }
  pushBusy.value = false
}
async function disablePush() {
  pushBusy.value = true
  try {
    await disablePushNotifications()
    store.toast('تم إيقاف إشعارات هذا الجهاز', 'ok')
    await refreshPushState()
  } catch (e) { store.toast(e.message, 'err') }
  pushBusy.value = false
}
async function testPush() {
  pushBusy.value = true
  try {
    const r = await testPushNotification()
    store.toast(r.ok ? 'وصل الإشعار التجريبي؟ 👀' : 'فشل: ' + (r.error || 'جرّب تفعيل الإشعارات من جديد'), r.ok ? 'ok' : 'err')
  } catch (e) { store.toast(e.message, 'err') }
  pushBusy.value = false
}

/* ===== دعم واتساب ===== */
const waNumber = computed(() => (store.serverSettings?.supportWhatsapp || '').replace(/\D/g, ''))
const waLink = computed(() => waNumber.value ? `https://wa.me/${waNumber.value}?text=${encodeURIComponent('مرحبا، عندي استفسار عن نظام إدارة المهام')}` : '')
</script>

<template>
  <section>
    <h2 class="sec-title">⚙️ إعداداتي</h2>

    <div class="card">
      <h3>👤 معلومات حسابك</h3>
      <p class="muted" style="margin-bottom:8px">
        👷 اسمك في النظام: <b>{{ me?.fullName }}</b> <span class="st st-active">ثابت — يتغير من المدير فقط</span>
      </p>
      <p class="muted" v-if="me?.telegramUsername || me?.telegramChatId">
        📬 تيليكرام: {{ me?.telegramUsername ? '@' + me.telegramUsername : '' }} {{ me?.telegramChatId ? '(' + me.telegramChatId + ')' : '' }}
      </p>
      <label>اسم المستخدم (تدخل به مع الرمز السري)</label>
      <div class="btn-row" style="margin-top:2px">
        <input v-model="username" maxlength="40" dir="ltr" placeholder="مثال: ali_92" style="flex:1">
        <button class="btn btn-outline" @click="saveUsername">💾 حفظ</button>
      </div>
    </div>

    <div class="card">
      <h3>🔑 تغيير الرمز السري</h3>
      <label>الرمز الحالي</label>
      <input v-model="oldPin" type="password" autocomplete="off">
      <label>الرمز الجديد (6 أحرف على الأقل)</label>
      <input v-model="newPin" type="password" autocomplete="off">
      <label>تأكيد الرمز الجديد</label>
      <input v-model="newPin2" type="password" autocomplete="off">
      <div class="btn-row"><button class="btn btn-primary" @click="changePin">تغيير الرمز</button></div>
    </div>

    <div class="card">
      <h3>🔔 إشعارات المتصفح</h3>
      <p class="muted">اعطِ الإذن مرة واحدة وستصلك إشعارات المهام الجديدة حتى لو الموقع مقفل — وعلى الموبايل حتى لو المتصفح مقفل كلياً.</p>

      <div v-if="!supported" class="mode-banner">متصفحك ما يدعم إشعارات المتصفح — استخدم Chrome أو Edge أو Firefox أو Safari الحديث</div>
      <template v-else>
        <p class="push-status">
          الحالة:
          <b v-if="pushState === 'subscribed'" class="plus">✅ مفعّلة على هذا الجهاز</b>
          <b v-else-if="pushState === 'granted'" class="minus">⚠️ الإذن معطى لكن الاشتراك ناقص — اضغط تفعيل من جديد</b>
          <b v-else-if="pushState === 'denied'" class="minus">⛔ مرفوضة — فعّلها من إعدادات المتصفح (أيقونة القفل بجانب الرابط)</b>
          <b v-else class="muted">غير مفعّلة بعد</b>
        </p>
        <div class="btn-row">
          <button v-if="pushState !== 'subscribed'" class="btn btn-primary" :disabled="pushBusy" @click="enablePush">🔔 تفعيل الإشعارات (يعطيني الإذن)</button>
          <template v-else>
            <button class="btn btn-outline" :disabled="pushBusy" @click="testPush">🧪 إشعار تجريبي</button>
            <button class="btn btn-ghost" :disabled="pushBusy" @click="disablePush">🔕 إيقاف إشعارات هذا الجهاز</button>
          </template>
        </div>
      </template>
    </div>

    <div v-if="waLink" class="card">
      <h3>💬 الدعم والمساندة</h3>
      <p class="muted">أي مشكلة أو استفسار عن النظام؟ راسل فريق الدعم واتساب</p>
      <a class="btn btn-primary btn-block wa-btn" :href="waLink" target="_blank" rel="noopener">
        📱 تواصل مع الدعم عبر واتساب
      </a>
    </div>

    <p class="muted" style="text-align:center;margin-top:18px">نظام إدارة المهام — الإصدار v{{ APP_VERSION }}</p>
  </section>
</template>
