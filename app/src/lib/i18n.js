import { Preferences } from "@capacitor/preferences";

const LANG_KEY = "panicswitch.lang";
const SUPPORTED = ["en", "es"];

const STRINGS = {
  en: {
    "nav.home": "Home",
    "nav.contacts": "Contacts",
    "nav.profile": "Profile",

    "route.login.title": "Log In",
    "route.register.title": "Create Account",
    "route.contacts.title": "Emergency Contacts",
    "route.profile.title": "My Profile",

    "errors.generic": "Something went wrong. Please try again.",
    "errors.network": "Can't reach the server. Check your connection.",

    "login.subtitle": "Sign in to keep your emergency contacts one tap away.",
    "login.email": "Email",
    "login.password": "Password",
    "login.submit": "Log In",
    "login.switch": "Don't have an account?",
    "login.switchLink": "Create one",

    "register.subtitle": "A few details, and you're ready to add your emergency contacts.",
    "register.name": "Full name",
    "register.phone": "Phone",
    "register.email": "Email",
    "register.password": "Password",
    "register.confirmPassword": "Confirm password",
    "register.submit": "Create Account",
    "register.switch": "Already have an account?",
    "register.switchLink": "Log in",
    "register.passwordMismatch": "Passwords don't match.",

    "confirmMail.title": "Check your email",
    "confirmMail.subtitle":
      'We sent a confirmation link to<br /><span class="confirm-mail-email">{email}</span>. Open it on this device to activate your account, then come back and log in.',
    "confirmMail.back": "Back to Log In",

    "home.greeting": "Hi, {name}",
    "home.panicAria": "Hold to send a panic alert",
    "home.idle": "Press and hold to alert your contacts",
    "home.holding": "Keep holding to confirm...",
    "home.locating": "Getting your location...",
    "home.sending": "Sending alert...",
    "home.sent": "Alert sent — your contacts are being notified",
    "home.sentToast": "Panic alert sent successfully.",
    "home.errorFallback": "Couldn't send the alert.",
    "home.statusReady": "{count} contact ready to be alerted",
    "home.statusReadyPlural": "{count} contacts ready to be alerted",
    "home.statusNone": "No confirmed contacts yet",

    "contacts.empty":
      "No emergency contacts yet. Tap the + button to add someone who should be notified when you trigger a panic alert.",
    "contacts.loadError": "Couldn't load your contacts. Pull down or reopen this tab to try again.",
    "contacts.loadErrorToast": "Couldn't load contacts.",
    "contacts.confirmed": "Confirmed",
    "contacts.pending": "Pending",
    "contacts.addTitle": "Add Emergency Contact",
    "contacts.pickDevice": "Pick from device contacts",
    "contacts.addManually": "Add manually",
    "contacts.editTitle": "Edit Contact",
    "contacts.name": "Name",
    "contacts.phone": "Phone",
    "contacts.emailOptional": "Email (optional)",
    "contacts.emailHint":
      "If you add an email, we'll send this contact a confirmation link — only confirmed contacts are notified during a panic alert.",
    "contacts.save": "Save Changes",
    "contacts.add": "Add Contact",
    "contacts.delete": "Delete Contact",
    "contacts.updated": "Contact updated.",
    "contacts.addedWithEmail": "Contact added — confirmation email sent.",
    "contacts.added": "Contact added.",
    "contacts.removed": "Contact removed.",
    "contacts.removeError": "Couldn't remove contact.",
    "contacts.removeConfirm": "Remove {name} from your emergency contacts?",
    "contacts.pickError": "Couldn't access your contacts.",

    "contacts.telegramLinked": "Telegram linked",
    "contacts.telegramConnect": "Connect Telegram",
    "contacts.telegramDisconnect": "Disconnect Telegram",
    "contacts.telegramEmailSent": "Telegram link sent to their email.",
    "contacts.telegramLinkReady": "Telegram link ready — copied, share it with your contact.",
    "contacts.telegramDisconnected": "Telegram disconnected.",
    "contacts.telegramEnableError": "Couldn't start the Telegram link.",
    "contacts.telegramDisableError": "Couldn't disconnect Telegram.",

    "profile.name": "Name",
    "profile.phone": "Phone",
    "profile.email": "Email",
    "profile.newPassword": "New password (optional)",
    "profile.newPasswordPlaceholder": "Leave blank to keep current password",
    "profile.save": "Save Changes",
    "profile.logout": "Log Out",
    "profile.noChanges": "No changes to save.",
    "profile.updated": "Profile updated.",
    "profile.language": "Language",
    "profile.color": "App color",
    "profile.colorCustom": "Custom",
  },
  es: {
    "nav.home": "Inicio",
    "nav.contacts": "Contactos",
    "nav.profile": "Perfil",

    "route.login.title": "Iniciar Sesión",
    "route.register.title": "Crear Cuenta",
    "route.contacts.title": "Contactos de Emergencia",
    "route.profile.title": "Mi Perfil",

    "errors.generic": "Algo salió mal. Inténtalo de nuevo.",
    "errors.network": "No se pudo conectar con el servidor. Revisa tu conexión.",

    "login.subtitle": "Inicia sesión para tener a tus contactos de emergencia a un toque de distancia.",
    "login.email": "Correo electrónico",
    "login.password": "Contraseña",
    "login.submit": "Iniciar Sesión",
    "login.switch": "¿No tienes una cuenta?",
    "login.switchLink": "Crea una",

    "register.subtitle": "Unos pocos datos y estarás listo para agregar tus contactos de emergencia.",
    "register.name": "Nombre completo",
    "register.phone": "Teléfono",
    "register.email": "Correo electrónico",
    "register.password": "Contraseña",
    "register.confirmPassword": "Confirmar contraseña",
    "register.submit": "Crear Cuenta",
    "register.switch": "¿Ya tienes una cuenta?",
    "register.switchLink": "Inicia sesión",
    "register.passwordMismatch": "Las contraseñas no coinciden.",

    "confirmMail.title": "Revisa tu correo",
    "confirmMail.subtitle":
      'Enviamos un enlace de confirmación a<br /><span class="confirm-mail-email">{email}</span>. Ábrelo en este dispositivo para activar tu cuenta y luego vuelve a iniciar sesión.',
    "confirmMail.back": "Volver a Iniciar Sesión",

    "home.greeting": "Hola, {name}",
    "home.panicAria": "Mantén presionado para enviar una alerta de pánico",
    "home.idle": "Mantén presionado para alertar a tus contactos",
    "home.holding": "Sigue presionando para confirmar...",
    "home.locating": "Obteniendo tu ubicación...",
    "home.sending": "Enviando alerta...",
    "home.sent": "Alerta enviada — tus contactos están siendo notificados",
    "home.sentToast": "Alerta de pánico enviada con éxito.",
    "home.errorFallback": "No se pudo enviar la alerta.",
    "home.statusReady": "{count} contacto listo para ser alertado",
    "home.statusReadyPlural": "{count} contactos listos para ser alertados",
    "home.statusNone": "Aún no tienes contactos confirmados",

    "contacts.empty":
      "Todavía no tienes contactos de emergencia. Toca el botón + para agregar a alguien que deba ser notificado cuando actives una alerta de pánico.",
    "contacts.loadError": "No se pudieron cargar tus contactos. Vuelve a intentarlo reabriendo esta pestaña.",
    "contacts.loadErrorToast": "No se pudieron cargar los contactos.",
    "contacts.confirmed": "Confirmado",
    "contacts.pending": "Pendiente",
    "contacts.addTitle": "Agregar Contacto de Emergencia",
    "contacts.pickDevice": "Elegir de los contactos del dispositivo",
    "contacts.addManually": "Agregar manualmente",
    "contacts.editTitle": "Editar Contacto",
    "contacts.name": "Nombre",
    "contacts.phone": "Teléfono",
    "contacts.emailOptional": "Correo electrónico (opcional)",
    "contacts.emailHint":
      "Si agregas un correo, le enviaremos a este contacto un enlace de confirmación — solo los contactos confirmados son notificados durante una alerta de pánico.",
    "contacts.save": "Guardar Cambios",
    "contacts.add": "Agregar Contacto",
    "contacts.delete": "Eliminar Contacto",
    "contacts.updated": "Contacto actualizado.",
    "contacts.addedWithEmail": "Contacto agregado — se envió el correo de confirmación.",
    "contacts.added": "Contacto agregado.",
    "contacts.removed": "Contacto eliminado.",
    "contacts.removeError": "No se pudo eliminar el contacto.",
    "contacts.removeConfirm": "¿Quitar a {name} de tus contactos de emergencia?",
    "contacts.pickError": "No se pudo acceder a tus contactos.",

    "contacts.telegramLinked": "Telegram vinculado",
    "contacts.telegramConnect": "Conectar Telegram",
    "contacts.telegramDisconnect": "Desconectar Telegram",
    "contacts.telegramEmailSent": "Enlace de Telegram enviado a su correo.",
    "contacts.telegramLinkReady": "Enlace de Telegram listo — copiado, compártelo con tu contacto.",
    "contacts.telegramDisconnected": "Telegram desconectado.",
    "contacts.telegramEnableError": "No se pudo iniciar la vinculación de Telegram.",
    "contacts.telegramDisableError": "No se pudo desconectar Telegram.",

    "profile.name": "Nombre",
    "profile.phone": "Teléfono",
    "profile.email": "Correo electrónico",
    "profile.newPassword": "Nueva contraseña (opcional)",
    "profile.newPasswordPlaceholder": "Déjalo en blanco para mantener tu contraseña actual",
    "profile.save": "Guardar Cambios",
    "profile.logout": "Cerrar Sesión",
    "profile.noChanges": "No hay cambios que guardar.",
    "profile.updated": "Perfil actualizado.",
    "profile.language": "Idioma",
    "profile.color": "Color de la app",
    "profile.colorCustom": "Personalizado",
  },
};

let currentLang = "en";

function detectLanguage() {
  const nav = typeof navigator !== "undefined" ? navigator.language : "en";
  return nav && nav.toLowerCase().startsWith("es") ? "es" : "en";
}

export async function loadLanguage() {
  const { value } = await Preferences.get({ key: LANG_KEY });
  currentLang = SUPPORTED.includes(value) ? value : detectLanguage();
  return currentLang;
}

export async function setLanguage(lang) {
  if (!SUPPORTED.includes(lang)) return;
  currentLang = lang;
  await Preferences.set({ key: LANG_KEY, value: lang });
}

export function getLanguage() {
  return currentLang;
}

export function t(key, vars) {
  const template = STRINGS[currentLang]?.[key] ?? STRINGS.en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? ""));
}
