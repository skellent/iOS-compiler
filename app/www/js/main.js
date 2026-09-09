import {
  Capacitor,
  __require,
  registerPlugin
} from "./chunk-76h33zks.js";

// node_modules/@capacitor/splash-screen/dist/esm/index.js
var SplashScreen = registerPlugin("SplashScreen", {
  web: () => import("./chunk-qkchk3z5.js").then((m) => new m.SplashScreenWeb)
});

// node_modules/@capacitor/preferences/dist/esm/index.js
var Preferences = registerPlugin("Preferences", {
  web: () => import("./chunk-mh24z979.js").then((m) => new m.PreferencesWeb)
});

// src/lib/session.ts
var TOKEN_KEY = "panicbutton.token";
var cachedUser = null;
async function getToken() {
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  return value;
}
async function setToken(token) {
  await Preferences.set({ key: TOKEN_KEY, value: token });
}
async function clearToken() {
  await Preferences.remove({ key: TOKEN_KEY });
  cachedUser = null;
}
function getUser() {
  return cachedUser;
}
function setUser(user) {
  cachedUser = user;
}

// src/lib/i18n.ts
var LANG_KEY = "panicbutton.lang";
var LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt-BR", label: "Português (Brasil)" }
];
var SUPPORTED = LANGUAGES.map((l) => l.code);
var STRINGS = {
  en: {
    "nav.home": "Home",
    "nav.contacts": "Contacts",
    "nav.profile": "Profile",
    "route.login.title": "Log In",
    "route.register.title": "Create Account",
    "route.contacts.title": "Emergency Contacts",
    "route.profile.title": "My Profile",
    "route.about.title": "About",
    "route.help.title": "Help",
    "errors.generic": "Something went wrong. Please try again.",
    "errors.network": "Can't reach the server. Check your connection.",
    "login.subtitle": "Sign in to keep your emergency contacts one tap away.",
    "login.email": "Email",
    "login.password": "Password",
    "login.submit": "Log In",
    "login.switch": "Don't have an account?",
    "login.switchLink": "Create one",
    "login.forgot": "Forgot your password?",
    "login.forgotNeedEmail": "Enter your email above first.",
    "login.forgotSent": "If that email has an account, we sent a reset link.",
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
    "confirmMail.subtitle": 'We sent a confirmation link to<br /><span class="confirm-mail-email">{email}</span>. Open it on this device to activate your account, then come back and log in.',
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
    "home.noContacts": "No confirmed contacts yet — add and confirm a contact before sending an alert.",
    "home.trackingTitle": "Sharing live location",
    "home.trackingActive": "Your contacts can now follow your live location",
    "home.trackingConnected": "Connected · {minutes} min",
    "home.trackingConnecting": "Reconnecting · {minutes} min",
    "home.trackingStop": "Stop sharing",
    "home.trackingStopping": "Stopping…",
    "home.trackingStopped": "Live location sharing stopped.",
    "home.trackingStopError": "Couldn't stop live location sharing.",
    "home.trackingUnavailable": "Alert sent with the initial location, but live tracking couldn't start.",
    "contacts.empty": "No emergency contacts yet. Tap the + button to add someone who should be notified when you trigger a panic alert.",
    "contacts.loadError": "Couldn't load your contacts. Pull down or reopen this tab to try again.",
    "contacts.loadErrorToast": "Couldn't load contacts.",
    "contacts.limitReached": "You've reached the limit of {max} emergency contacts.",
    "contacts.confirmed": "Confirmed",
    "contacts.pending": "Pending",
    "contacts.addTitle": "Add Emergency Contact",
    "contacts.pickDevice": "Pick from device contacts",
    "contacts.addManually": "Add manually",
    "contacts.editTitle": "Edit Contact",
    "contacts.name": "Name",
    "contacts.phone": "Phone",
    "contacts.email": "Email",
    "contacts.emailRequired": "Please enter an email for this contact.",
    "contacts.emailHint": "We'll send this contact a confirmation link by email — only confirmed contacts are notified during a panic alert.",
    "contacts.save": "Save Changes",
    "contacts.add": "Add Contact",
    "contacts.delete": "Delete Contact",
    "contacts.updated": "Contact updated.",
    "contacts.addedWithEmail": "Contact added — confirmation email sent.",
    "contacts.removed": "Contact removed.",
    "contacts.removeError": "Couldn't remove contact.",
    "contacts.removeConfirm": "Remove {name} from your emergency contacts?",
    "contacts.pickError": "Couldn't access your contacts.",
    "contacts.telegramLinked": "Telegram linked",
    "contacts.telegramNotLinked": "Telegram not linked",
    "contacts.resendConfirmation": "Resend confirmation email",
    "contacts.resendConfirmationSent": "Confirmation email sent again.",
    "contacts.telegramConnect": "Connect Telegram",
    "contacts.telegramDisconnect": "Disconnect Telegram",
    "contacts.telegramEmailSent": "Telegram link sent to their email.",
    "contacts.telegramLinkReady": "Telegram link ready — share it with your contact.",
    "contacts.telegramShareText": "Link me on Telegram to receive my Panic Button alerts:",
    "contacts.whatsappShareText": "Message me on WhatsApp to receive my Panic Button alerts:",
    "contacts.telegramDisconnected": "Telegram disconnected.",
    "contacts.telegramEnableError": "Couldn't start the Telegram link.",
    "contacts.telegramDisableError": "Couldn't disconnect Telegram.",
    "contacts.whatsappLinked": "WhatsApp linked",
    "contacts.whatsappNotLinked": "WhatsApp not linked",
    "contacts.whatsappConnect": "Connect WhatsApp",
    "contacts.whatsappDisconnect": "Disconnect WhatsApp",
    "contacts.whatsappLinkReady": "WhatsApp link ready — copied, share it with your contact so they can opt in.",
    "contacts.whatsappEnabled": "WhatsApp enabled.",
    "contacts.whatsappDisconnected": "WhatsApp disconnected.",
    "contacts.whatsappEnableError": "Couldn't enable WhatsApp.",
    "contacts.whatsappDisableError": "Couldn't disable WhatsApp.",
    "contacts.smsEnabled": "SMS enabled",
    "contacts.smsDisabled": "SMS not enabled",
    "contacts.smsEnable": "Enable SMS",
    "contacts.smsDisable": "Disable SMS",
    "contacts.smsEnabledToast": "SMS alerts enabled for this contact.",
    "contacts.smsDisabledToast": "SMS alerts disabled.",
    "contacts.smsEnableError": "Couldn't enable SMS.",
    "contacts.smsDisableError": "Couldn't disable SMS.",
    "profile.name": "Name",
    "profile.phone": "Phone",
    "profile.email": "Email",
    "profile.newPassword": "New password (optional)",
    "profile.newPasswordPlaceholder": "Leave blank to keep current password",
    "profile.currentPassword": "Current password",
    "profile.currentPasswordPlaceholder": "Enter to change email or password",
    "profile.currentPasswordHint": "Required only when changing your email or password.",
    "profile.currentPasswordRequired": "Enter your current password to change your email or password.",
    "profile.save": "Save Changes",
    "profile.logout": "Log Out",
    "profile.noChanges": "No changes to save.",
    "profile.updated": "Profile updated.",
    "profile.language": "Language",
    "profile.theme": "Theme",
    "profile.themeAuto": "Auto",
    "profile.themeLight": "Light",
    "profile.themeDark": "Dark",
    "profile.color": "App color",
    "profile.colorCustom": "Custom",
    "profile.help": "Help",
    "profile.about": "About",
    "info.back": "Back",
    "help.intro": "Everything you need to know to get the most out of Panic Button.",
    "help.section.account.title": "Creating your account",
    "help.section.account.body": "Register with your name, phone, email and a password. We'll send a confirmation link to your email — open it on this device to activate your account, then come back and log in.",
    "help.section.panic.title": "Sending a panic alert",
    "help.section.panic.body": "On the Home screen, press and hold the SOS button for about a second and a half — a ring fills around it as you hold, and releasing early cancels it. Once the hold completes, the app gets your current location and notifies every confirmed emergency contact by email and, for contacts who've linked it, Telegram.",
    "help.section.contacts.title": "Managing emergency contacts",
    "help.section.contacts.body": "On the Contacts tab, tap the + button to add someone, either by picking them from your phone's address book or entering their details manually. Tap any existing contact to edit their details, connect or disconnect Telegram, or remove them.",
    "help.section.channels.title": "Confirmed vs. pending contacts",
    "help.section.channels.body": "Adding a contact doesn't notify them automatically — each contact shows a mail icon and, where available, a Telegram icon; a lit icon means that channel is confirmed and will receive alerts, a dim one means it isn't yet. Email is confirmed by the contact clicking the link we send them; Telegram is confirmed the moment they open the link and press Start in the chat with our bot.",
    "help.section.profile.title": "Your profile",
    "help.section.profile.body": "Update your name, phone, email or password from the Profile tab. You can also change the app's language and accent color from there — both are saved only on this device.",
    "about.description": "Panic Button is a personal safety app: press and hold one button to share your location and alert your trusted emergency contacts by email and Telegram, the moment you need them most.",
    "about.developedBy": "Developed by Skellent",
    "about.rights": "© Keycodelogics. All rights reserved.",
    "about.version": "Version BETA"
  },
  es: {
    "nav.home": "Inicio",
    "nav.contacts": "Contactos",
    "nav.profile": "Perfil",
    "route.login.title": "Iniciar Sesión",
    "route.register.title": "Crear Cuenta",
    "route.contacts.title": "Contactos de Emergencia",
    "route.profile.title": "Mi Perfil",
    "route.about.title": "Acerca de",
    "route.help.title": "Ayuda",
    "errors.generic": "Algo salió mal. Inténtalo de nuevo.",
    "errors.network": "No se pudo conectar con el servidor. Revisa tu conexión.",
    "login.subtitle": "Inicia sesión para tener a tus contactos de emergencia a un toque de distancia.",
    "login.email": "Correo electrónico",
    "login.password": "Contraseña",
    "login.submit": "Iniciar Sesión",
    "login.switch": "¿No tienes una cuenta?",
    "login.switchLink": "Crea una",
    "login.forgot": "¿Olvidaste tu contraseña?",
    "login.forgotNeedEmail": "Escribe tu correo arriba primero.",
    "login.forgotSent": "Si ese correo tiene una cuenta, enviamos un enlace para restablecerla.",
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
    "confirmMail.subtitle": 'Enviamos un enlace de confirmación a<br /><span class="confirm-mail-email">{email}</span>. Ábrelo en este dispositivo para activar tu cuenta y luego vuelve a iniciar sesión.',
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
    "home.noContacts": "Aún no tienes contactos confirmados — agrega y confirma un contacto antes de enviar una alerta.",
    "home.trackingTitle": "Compartiendo ubicación en vivo",
    "home.trackingActive": "Tus contactos ahora pueden seguir tu ubicación en vivo",
    "home.trackingConnected": "Conectado · {minutes} min",
    "home.trackingConnecting": "Reconectando · {minutes} min",
    "home.trackingStop": "Dejar de compartir",
    "home.trackingStopping": "Deteniendo…",
    "home.trackingStopped": "Se dejó de compartir la ubicación en vivo.",
    "home.trackingStopError": "No se pudo detener la ubicación en vivo.",
    "home.trackingUnavailable": "La alerta se envió con la ubicación inicial, pero no se pudo iniciar el seguimiento en vivo.",
    "contacts.empty": "Todavía no tienes contactos de emergencia. Toca el botón + para agregar a alguien que deba ser notificado cuando actives una alerta de pánico.",
    "contacts.loadError": "No se pudieron cargar tus contactos. Vuelve a intentarlo reabriendo esta pestaña.",
    "contacts.loadErrorToast": "No se pudieron cargar los contactos.",
    "contacts.limitReached": "Ya alcanzaste el límite de {max} contactos de emergencia.",
    "contacts.confirmed": "Confirmado",
    "contacts.pending": "Pendiente",
    "contacts.addTitle": "Agregar Contacto de Emergencia",
    "contacts.pickDevice": "Elegir de los contactos del dispositivo",
    "contacts.addManually": "Agregar manualmente",
    "contacts.editTitle": "Editar Contacto",
    "contacts.name": "Nombre",
    "contacts.phone": "Teléfono",
    "contacts.email": "Correo electrónico",
    "contacts.emailRequired": "Ingresá un correo electrónico para este contacto.",
    "contacts.emailHint": "Le enviaremos a este contacto un enlace de confirmación por correo — solo los contactos confirmados son notificados durante una alerta de pánico.",
    "contacts.save": "Guardar Cambios",
    "contacts.add": "Agregar Contacto",
    "contacts.delete": "Eliminar Contacto",
    "contacts.updated": "Contacto actualizado.",
    "contacts.addedWithEmail": "Contacto agregado — se envió el correo de confirmación.",
    "contacts.removed": "Contacto eliminado.",
    "contacts.removeError": "No se pudo eliminar el contacto.",
    "contacts.removeConfirm": "¿Quitar a {name} de tus contactos de emergencia?",
    "contacts.pickError": "No se pudo acceder a tus contactos.",
    "contacts.telegramLinked": "Telegram vinculado",
    "contacts.telegramNotLinked": "Telegram no vinculado",
    "contacts.resendConfirmation": "Reenviar correo de confirmación",
    "contacts.resendConfirmationSent": "Correo de confirmación reenviado.",
    "contacts.telegramConnect": "Conectar Telegram",
    "contacts.telegramDisconnect": "Desconectar Telegram",
    "contacts.telegramEmailSent": "Enlace de Telegram enviado a su correo.",
    "contacts.telegramLinkReady": "Enlace de Telegram listo — compártelo con tu contacto.",
    "contacts.telegramShareText": "Vincúlame en Telegram para recibir mis alertas de Panic Button:",
    "contacts.whatsappShareText": "Escríbeme por WhatsApp para recibir mis alertas de Panic Button:",
    "contacts.telegramDisconnected": "Telegram desconectado.",
    "contacts.telegramEnableError": "No se pudo iniciar la vinculación de Telegram.",
    "contacts.telegramDisableError": "No se pudo desconectar Telegram.",
    "contacts.whatsappLinked": "WhatsApp vinculado",
    "contacts.whatsappNotLinked": "WhatsApp no vinculado",
    "contacts.whatsappConnect": "Conectar WhatsApp",
    "contacts.whatsappDisconnect": "Desconectar WhatsApp",
    "contacts.whatsappLinkReady": "Enlace de WhatsApp listo — copiado, compártelo con tu contacto para que se una.",
    "contacts.whatsappEnabled": "WhatsApp activado.",
    "contacts.whatsappDisconnected": "WhatsApp desconectado.",
    "contacts.whatsappEnableError": "No se pudo activar WhatsApp.",
    "contacts.whatsappDisableError": "No se pudo desactivar WhatsApp.",
    "contacts.smsEnabled": "SMS activado",
    "contacts.smsDisabled": "SMS no activado",
    "contacts.smsEnable": "Activar SMS",
    "contacts.smsDisable": "Desactivar SMS",
    "contacts.smsEnabledToast": "Alertas por SMS activadas para este contacto.",
    "contacts.smsDisabledToast": "Alertas por SMS desactivadas.",
    "contacts.smsEnableError": "No se pudo activar SMS.",
    "contacts.smsDisableError": "No se pudo desactivar SMS.",
    "profile.name": "Nombre",
    "profile.phone": "Teléfono",
    "profile.email": "Correo electrónico",
    "profile.newPassword": "Nueva contraseña (opcional)",
    "profile.newPasswordPlaceholder": "Déjalo en blanco para mantener tu contraseña actual",
    "profile.currentPassword": "Contraseña actual",
    "profile.currentPasswordPlaceholder": "Introdúcela para cambiar correo o contraseña",
    "profile.currentPasswordHint": "Solo se necesita al cambiar tu correo o contraseña.",
    "profile.currentPasswordRequired": "Introduce tu contraseña actual para cambiar tu correo o contraseña.",
    "profile.save": "Guardar Cambios",
    "profile.logout": "Cerrar Sesión",
    "profile.noChanges": "No hay cambios que guardar.",
    "profile.updated": "Perfil actualizado.",
    "profile.language": "Idioma",
    "profile.theme": "Tema",
    "profile.themeAuto": "Automático",
    "profile.themeLight": "Claro",
    "profile.themeDark": "Oscuro",
    "profile.color": "Color de la app",
    "profile.colorCustom": "Personalizado",
    "profile.help": "Ayuda",
    "profile.about": "Acerca de",
    "info.back": "Volver",
    "help.intro": "Todo lo que necesitás saber para aprovechar Panic Button al máximo.",
    "help.section.account.title": "Crear tu cuenta",
    "help.section.account.body": "Registrate con tu nombre, teléfono, correo y una contraseña. Te enviaremos un enlace de confirmación a tu correo — ábrelo en este dispositivo para activar tu cuenta y luego volvé a iniciar sesión.",
    "help.section.panic.title": "Enviar una alerta de pánico",
    "help.section.panic.body": "En la pantalla de Inicio, mantené presionado el botón SOS durante aproximadamente un segundo y medio — un anillo se completa alrededor del botón mientras lo mantenés presionado, y soltarlo antes lo cancela. Al completarse, la app obtiene tu ubicación actual y notifica a cada contacto de emergencia confirmado por correo y, para quienes hayan vinculado Telegram, también por ahí.",
    "help.section.contacts.title": "Gestionar contactos de emergencia",
    "help.section.contacts.body": "En la pestaña Contactos, tocá el botón + para agregar a alguien, ya sea eligiéndolo de la agenda de tu teléfono o ingresando sus datos manualmente. Tocá cualquier contacto existente para editar sus datos, conectar o desconectar Telegram, o eliminarlo.",
    "help.section.channels.title": "Contactos confirmados vs. pendientes",
    "help.section.channels.body": "Agregar un contacto no lo notifica automáticamente — cada contacto muestra un ícono de correo y, cuando está disponible, uno de Telegram; un ícono iluminado significa que ese canal está confirmado y recibirá alertas, uno apagado significa que todavía no. El correo se confirma cuando el contacto hace clic en el enlace que le enviamos; Telegram se confirma en el momento en que abre el enlace y presiona Iniciar en el chat con nuestro bot.",
    "help.section.profile.title": "Tu perfil",
    "help.section.profile.body": "Actualizá tu nombre, teléfono, correo o contraseña desde la pestaña Perfil. También podés cambiar el idioma y el color de la app desde ahí — ambos se guardan solo en este dispositivo.",
    "about.description": "Panic Button es una app de seguridad personal: mantené presionado un botón para compartir tu ubicación y alertar a tus contactos de confianza por correo y Telegram, en el momento en que más los necesitás.",
    "about.developedBy": "Desarrollado por Skellent",
    "about.rights": "© Keycodelogics. Todos los derechos reservados.",
    "about.version": "Versión BETA"
  },
  "pt-BR": {
    "nav.home": "Início",
    "nav.contacts": "Contatos",
    "nav.profile": "Perfil",
    "route.login.title": "Entrar",
    "route.register.title": "Criar Conta",
    "route.contacts.title": "Contatos de Emergência",
    "route.profile.title": "Meu Perfil",
    "route.about.title": "Sobre",
    "route.help.title": "Ajuda",
    "errors.generic": "Algo deu errado. Tente novamente.",
    "errors.network": "Não foi possível conectar ao servidor. Verifique sua conexão.",
    "login.subtitle": "Entre para ter seus contatos de emergência a um toque de distância.",
    "login.email": "E-mail",
    "login.password": "Senha",
    "login.submit": "Entrar",
    "login.switch": "Não tem uma conta?",
    "login.switchLink": "Criar uma",
    "register.subtitle": "Alguns dados e você já pode adicionar seus contatos de emergência.",
    "register.name": "Nome completo",
    "register.phone": "Telefone",
    "register.email": "E-mail",
    "register.password": "Senha",
    "register.confirmPassword": "Confirmar senha",
    "register.submit": "Criar Conta",
    "register.switch": "Já tem uma conta?",
    "register.switchLink": "Entrar",
    "register.passwordMismatch": "As senhas não coincidem.",
    "confirmMail.title": "Verifique seu e-mail",
    "confirmMail.subtitle": 'Enviamos um link de confirmação para<br /><span class="confirm-mail-email">{email}</span>. Abra-o neste dispositivo para ativar sua conta e depois volte para entrar.',
    "confirmMail.back": "Voltar para Entrar",
    "home.greeting": "Olá, {name}",
    "home.panicAria": "Mantenha pressionado para enviar um alerta de pânico",
    "home.idle": "Mantenha pressionado para alertar seus contatos",
    "home.holding": "Continue pressionando para confirmar...",
    "home.locating": "Obtendo sua localização...",
    "home.sending": "Enviando alerta...",
    "home.sent": "Alerta enviado — seus contatos estão sendo notificados",
    "home.sentToast": "Alerta de pânico enviado com sucesso.",
    "home.errorFallback": "Não foi possível enviar o alerta.",
    "home.statusReady": "{count} contato pronto para ser alertado",
    "home.statusReadyPlural": "{count} contatos prontos para serem alertados",
    "home.statusNone": "Ainda não há contatos confirmados",
    "home.trackingTitle": "Compartilhando localização ao vivo",
    "home.trackingActive": "Seus contatos agora podem acompanhar sua localização ao vivo",
    "home.trackingConnected": "Conectado · {minutes} min",
    "home.trackingConnecting": "Reconectando · {minutes} min",
    "home.trackingStop": "Parar de compartilhar",
    "home.trackingStopping": "Parando…",
    "home.trackingStopped": "O compartilhamento da localização ao vivo foi encerrado.",
    "home.trackingStopError": "Não foi possível parar a localização ao vivo.",
    "home.trackingUnavailable": "O alerta foi enviado com a localização inicial, mas o rastreamento ao vivo não pôde ser iniciado.",
    "contacts.empty": "Você ainda não tem contatos de emergência. Toque no botão + para adicionar alguém que deva ser notificado quando você acionar um alerta de pânico.",
    "contacts.loadError": "Não foi possível carregar seus contatos. Reabra esta aba para tentar novamente.",
    "contacts.loadErrorToast": "Não foi possível carregar os contatos.",
    "contacts.limitReached": "Você atingiu o limite de {max} contatos de emergência.",
    "contacts.confirmed": "Confirmado",
    "contacts.pending": "Pendente",
    "contacts.addTitle": "Adicionar Contato de Emergência",
    "contacts.pickDevice": "Escolher dos contatos do dispositivo",
    "contacts.addManually": "Adicionar manualmente",
    "contacts.editTitle": "Editar Contato",
    "contacts.name": "Nome",
    "contacts.phone": "Telefone",
    "contacts.email": "E-mail",
    "contacts.emailRequired": "Digite um e-mail para este contato.",
    "contacts.emailHint": "Enviaremos a este contato um link de confirmação por e-mail — apenas contatos confirmados são notificados durante um alerta de pânico.",
    "contacts.save": "Salvar Alterações",
    "contacts.add": "Adicionar Contato",
    "contacts.delete": "Excluir Contato",
    "contacts.updated": "Contato atualizado.",
    "contacts.addedWithEmail": "Contato adicionado — e-mail de confirmação enviado.",
    "contacts.removed": "Contato removido.",
    "contacts.removeError": "Não foi possível remover o contato.",
    "contacts.removeConfirm": "Remover {name} dos seus contatos de emergência?",
    "contacts.pickError": "Não foi possível acessar seus contatos.",
    "contacts.telegramLinked": "Telegram vinculado",
    "contacts.telegramNotLinked": "Telegram não vinculado",
    "contacts.telegramConnect": "Conectar Telegram",
    "contacts.telegramDisconnect": "Desconectar Telegram",
    "contacts.telegramEmailSent": "Link do Telegram enviado ao e-mail dele.",
    "contacts.telegramLinkReady": "Link do Telegram pronto — copiado, compartilhe com seu contato.",
    "contacts.telegramDisconnected": "Telegram desconectado.",
    "contacts.telegramEnableError": "Não foi possível iniciar a vinculação do Telegram.",
    "contacts.telegramDisableError": "Não foi possível desconectar o Telegram.",
    "profile.name": "Nome",
    "profile.phone": "Telefone",
    "profile.email": "E-mail",
    "profile.newPassword": "Nova senha (opcional)",
    "profile.newPasswordPlaceholder": "Deixe em branco para manter a senha atual",
    "profile.save": "Salvar Alterações",
    "profile.logout": "Sair",
    "profile.noChanges": "Não há alterações para salvar.",
    "profile.updated": "Perfil atualizado.",
    "profile.language": "Idioma",
    "profile.theme": "Tema",
    "profile.themeAuto": "Automático",
    "profile.themeLight": "Claro",
    "profile.themeDark": "Escuro",
    "profile.color": "Cor do app",
    "profile.colorCustom": "Personalizado",
    "profile.help": "Ajuda",
    "profile.about": "Sobre",
    "info.back": "Voltar",
    "help.intro": "Tudo o que você precisa saber para aproveitar ao máximo o Panic Button.",
    "help.section.account.title": "Criar sua conta",
    "help.section.account.body": "Registre-se com seu nome, telefone, e-mail e uma senha. Enviaremos um link de confirmação ao seu e-mail — abra-o neste dispositivo para ativar sua conta e depois volte para entrar.",
    "help.section.panic.title": "Enviar um alerta de pânico",
    "help.section.panic.body": "Na tela Início, mantenha pressionado o botão SOS por cerca de um segundo e meio — um anel se preenche ao redor do botão enquanto você o pressiona, e soltar antes cancela o envio. Ao completar, o app obtém sua localização atual e notifica cada contato de emergência confirmado por e-mail e, para quem vinculou o Telegram, também por lá.",
    "help.section.contacts.title": "Gerenciar contatos de emergência",
    "help.section.contacts.body": "Na aba Contatos, toque no botão + para adicionar alguém, escolhendo da agenda do seu telefone ou digitando os dados manualmente. Toque em qualquer contato existente para editar seus dados, conectar ou desconectar o Telegram, ou removê-lo.",
    "help.section.channels.title": "Contatos confirmados vs. pendentes",
    "help.section.channels.body": "Adicionar um contato não o notifica automaticamente — cada contato mostra um ícone de e-mail e, quando disponível, um de Telegram; um ícone aceso significa que aquele canal está confirmado e receberá alertas, um apagado significa que ainda não. O e-mail é confirmado quando o contato clica no link que enviamos; o Telegram é confirmado no momento em que ele abre o link e aperta Iniciar na conversa com nosso bot.",
    "help.section.profile.title": "Seu perfil",
    "help.section.profile.body": "Atualize seu nome, telefone, e-mail ou senha na aba Perfil. Você também pode mudar o idioma e a cor do app por lá — ambos são salvos apenas neste dispositivo.",
    "about.description": "Panic Button é um app de segurança pessoal: mantenha pressionado um botão para compartilhar sua localização e alertar seus contatos de confiança por e-mail e Telegram, no momento em que você mais precisar deles.",
    "about.developedBy": "Desenvolvido por Skellent",
    "about.rights": "© Keycodelogics. Todos os direitos reservados.",
    "about.version": "Versão BETA"
  }
};
var currentLang = "en";
function detectLanguage() {
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en") || "en";
  const lower = nav.toLowerCase();
  if (lower.startsWith("pt"))
    return "pt-BR";
  if (lower.startsWith("es"))
    return "es";
  return "en";
}
async function loadLanguage() {
  const { value } = await Preferences.get({ key: LANG_KEY });
  currentLang = SUPPORTED.includes(value) ? value : detectLanguage();
  return currentLang;
}
async function setLanguage(lang) {
  if (!SUPPORTED.includes(lang))
    return;
  currentLang = lang;
  await Preferences.set({ key: LANG_KEY, value: lang });
}
function getLanguage() {
  return currentLang;
}
function t(key, vars) {
  const template = STRINGS[currentLang]?.[key] ?? STRINGS.en[key] ?? key;
  if (!vars)
    return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
}

// src/lib/api.ts
var BASE_URL = "http://localhost:8000";

class ApiError extends Error {
  status;
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
function extractMessage(body) {
  if (!body)
    return t("errors.generic");
  if (typeof body.detail === "string")
    return body.detail;
  if (Array.isArray(body.detail) && body.detail[0]?.msg)
    return body.detail[0].msg;
  return t("errors.generic");
}
async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token)
      headers["Authorization"] = `Bearer ${token}`;
  }
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(t("errors.network"), 0);
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(extractMessage(data), response.status);
  }
  return data;
}
var Api = {
  register: (data) => request("/auth/register", { method: "POST", body: data }),
  login: (data) => request("/auth/login", { method: "POST", body: data }),
  requestPasswordReset: (email) => request("/auth/password-reset/request", { method: "POST", body: { email } }),
  getMe: () => request("/users/me", { auth: true }),
  updateMe: (data) => request("/users/me", { method: "PUT", body: data, auth: true }),
  listContacts: () => request("/contacts", { auth: true }),
  createContact: (data) => request("/contacts", { method: "POST", body: data, auth: true }),
  updateContact: (id, data) => request(`/contacts/${id}`, { method: "PUT", body: data, auth: true }),
  deleteContact: (id) => request(`/contacts/${id}`, { method: "DELETE", auth: true }),
  resendContactConfirmation: (id) => request(`/contacts/${id}/confirm/resend`, { method: "POST", auth: true }),
  enableContactTelegram: (id) => request(`/contacts/${id}/telegram/enable`, { method: "POST", auth: true }),
  disableContactTelegram: (id) => request(`/contacts/${id}/telegram`, { method: "DELETE", auth: true }),
  enableContactWhatsapp: (id) => request(`/contacts/${id}/whatsapp/enable`, { method: "POST", auth: true }),
  disableContactWhatsapp: (id) => request(`/contacts/${id}/whatsapp`, { method: "DELETE", auth: true }),
  enableContactSms: (id) => request(`/contacts/${id}/sms/enable`, { method: "POST", auth: true }),
  disableContactSms: (id) => request(`/contacts/${id}/sms`, { method: "DELETE", auth: true }),
  createAlert: (data) => request("/alerts", { method: "POST", body: data, auth: true }),
  stopAlert: (id) => request(`/alerts/${id}/stop`, { method: "POST", auth: true }),
  getFeatures: () => request("/features")
};

// src/lib/theme.ts
var COLOR_KEY = "panicbutton.accentColor";
var THEME_KEY = "panicbutton.theme";
var DEFAULT_ACCENT = "#ea2052";
var DEFAULT_THEME = "light";
var THEMES = ["auto", "light", "dark"];
var SHADE_LIGHTNESS = {
  dark: { 900: 0.3, 800: 0.38, 700: 0.45, 600: 0.5, 500: 0.55, 400: 0.65, 300: 0.78 },
  light: { 900: 0.3, 800: 0.38, 700: 0.45, 600: 0.5, 500: 0.55, 400: 0.46, 300: 0.4 }
};
var ALPHA = {
  dark: { glow: 0.55, tint: 0.14 },
  light: { glow: 0.35, tint: 0.14 }
};
var currentAccent = DEFAULT_ACCENT;
var currentTheme = DEFAULT_THEME;
var _media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  return { r: value >> 16 & 255, g: value >> 8 & 255, b: value & 255 };
}
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min)
    return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return { h: h / 6, s, l };
}
function hue2rgb(p, q, t2) {
  if (t2 < 0)
    t2 += 1;
  if (t2 > 1)
    t2 -= 1;
  if (t2 < 1 / 6)
    return p + (q - p) * 6 * t2;
  if (t2 < 1 / 2)
    return q;
  if (t2 < 2 / 3)
    return p + (q - p) * (2 / 3 - t2) * 6;
  return p;
}
function hslToHex(h, s, l) {
  if (s === 0) {
    const gray = Math.round(l * 255);
    return toHex(gray, gray, gray);
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return toHex(Math.round(hue2rgb(p, q, h + 1 / 3) * 255), Math.round(hue2rgb(p, q, h) * 255), Math.round(hue2rgb(p, q, h - 1 / 3) * 255));
}
function toHex(r, g, b) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function scheme() {
  if (currentTheme === "light" || currentTheme === "dark")
    return currentTheme;
  return _media && !_media.matches ? "light" : "dark";
}
function applyAccentColor(hex) {
  currentAccent = hex;
  const { r, g, b } = hexToRgb(hex);
  const { h, s } = rgbToHsl(r, g, b);
  const mode = scheme();
  const root = document.documentElement.style;
  for (const [shade, l] of Object.entries(SHADE_LIGHTNESS[mode])) {
    root.setProperty(`--primary-${shade}`, hslToHex(h, s, l));
  }
  root.setProperty("--primary-rgb", `${r}, ${g}, ${b}`);
  root.setProperty("--primary-50", `rgba(${r}, ${g}, ${b}, ${ALPHA[mode].tint})`);
  root.setProperty("--glow", `rgba(${r}, ${g}, ${b}, ${ALPHA[mode].glow})`);
}
async function loadAccentColor() {
  const { value } = await Preferences.get({ key: COLOR_KEY });
  applyAccentColor(value || DEFAULT_ACCENT);
  return currentAccent;
}
async function setAccentColor(hex) {
  await Preferences.set({ key: COLOR_KEY, value: hex });
  applyAccentColor(hex);
}
function getAccentColor() {
  return currentAccent;
}
function applyTheme(theme) {
  currentTheme = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  document.documentElement.dataset.theme = currentTheme;
  applyAccentColor(currentAccent);
}
async function loadTheme() {
  const { value } = await Preferences.get({ key: THEME_KEY });
  applyTheme(value || DEFAULT_THEME);
  return currentTheme;
}
async function setTheme(theme) {
  await Preferences.set({ key: THEME_KEY, value: theme });
  applyTheme(theme);
}
function getTheme() {
  return currentTheme;
}
if (_media) {
  _media.addEventListener("change", () => applyAccentColor(currentAccent));
}

// node_modules/@capacitor/app/dist/esm/index.js
var App = registerPlugin("App", {
  web: () => import("./chunk-2fa3w26m.js").then((m) => new m.AppWeb)
});

// src/lib/appUpdate.ts
var VERSION_KEY = "panicbutton.appVersion";
var BASE_URL2 = "http://localhost:8000";
async function fetchManifestVersion() {
  const response = await fetch(`${BASE_URL2}/app/manifest`, { cache: "no-store" });
  if (!response.ok)
    return null;
  const { version } = await response.json();
  return version;
}
async function checkForUpdate() {
  let latest;
  try {
    latest = await fetchManifestVersion();
  } catch {
    return;
  }
  if (!latest)
    return;
  const { value: known } = await Preferences.get({ key: VERSION_KEY });
  if (known === null) {
    await Preferences.set({ key: VERSION_KEY, value: latest });
    return;
  }
  if (known !== latest) {
    await Preferences.set({ key: VERSION_KEY, value: latest });
    window.location.reload();
  }
}
function initAppUpdates() {
  checkForUpdate();
  App.addListener("resume", checkForUpdate);
}

// node_modules/@capacitor/synapse/dist/synapse.mjs
function s(t2) {
  t2.CapacitorUtils.Synapse = new Proxy({}, {
    get(e, n) {
      return new Proxy({}, {
        get(w, o) {
          return (c, p, r) => {
            const i = t2.Capacitor.Plugins[n];
            if (i === undefined) {
              r(new Error(`Capacitor plugin ${n} not found`));
              return;
            }
            if (typeof i[o] != "function") {
              r(new Error(`Method ${o} not found in Capacitor plugin ${n}`));
              return;
            }
            (async () => {
              try {
                const a = await i[o](c);
                p(a);
              } catch (a) {
                r(a);
              }
            })();
          };
        }
      });
    }
  });
}
function u(t2) {
  t2.CapacitorUtils.Synapse = new Proxy({}, {
    get(e, n) {
      return t2.cordova.plugins[n];
    }
  });
}
function f(t2 = false) {
  typeof window > "u" || (window.CapacitorUtils = window.CapacitorUtils || {}, window.Capacitor !== undefined && !t2 ? s(window) : window.cordova !== undefined && u(window));
}

// node_modules/@capacitor/geolocation/dist/esm/index.js
var Geolocation = registerPlugin("Geolocation", {
  web: () => import("./chunk-ahvz4860.js").then((m) => new m.GeolocationWeb)
});
f();

// node_modules/@capacitor/local-notifications/dist/esm/definitions.js
var Weekday;
(function(Weekday2) {
  Weekday2[Weekday2["Sunday"] = 1] = "Sunday";
  Weekday2[Weekday2["Monday"] = 2] = "Monday";
  Weekday2[Weekday2["Tuesday"] = 3] = "Tuesday";
  Weekday2[Weekday2["Wednesday"] = 4] = "Wednesday";
  Weekday2[Weekday2["Thursday"] = 5] = "Thursday";
  Weekday2[Weekday2["Friday"] = 6] = "Friday";
  Weekday2[Weekday2["Saturday"] = 7] = "Saturday";
})(Weekday || (Weekday = {}));

// node_modules/@capacitor/local-notifications/dist/esm/index.js
var LocalNotifications = registerPlugin("LocalNotifications", {
  web: () => import("./chunk-zanydgh6.js").then((m) => new m.LocalNotificationsWeb)
});

// src/lib/liveTracking.ts
var BASE_URL3 = "http://localhost:8000";
var HEARTBEAT_MS = 25000;
var MAX_RECONNECT_MS = 30000;
var SESSION_KEY = "panicbutton.liveTracking";
var BackgroundGeolocation = registerPlugin("BackgroundGeolocation");
var state = {
  active: false,
  connected: false,
  stopping: false,
  alertId: null,
  startedAt: null,
  expiresAt: null,
  lastUpdateAt: null,
  error: null
};
var listener = null;
var publisherToken = null;
var socket = null;
var watcherId = null;
var fallbackWatcherId = null;
var heartbeatTimer = null;
var reconnectTimer = null;
var expiryTimer = null;
var reconnectAttempt = 0;
var authenticated = false;
var sequence = 0;
var pendingLocation = null;
function publishState(patch) {
  state = { ...state, ...patch };
  listener?.({ ...state });
}
async function persistSession() {
  if (!state.active || !publisherToken)
    return;
  await Preferences.set({
    key: SESSION_KEY,
    value: JSON.stringify({
      alertId: state.alertId,
      publisherToken,
      startedAt: state.startedAt,
      expiresAt: state.expiresAt,
      lastUpdateAt: state.lastUpdateAt,
      sequence,
      watcherId
    })
  });
}
function getLiveTrackingState() {
  return { ...state };
}
function observeLiveTracking(nextListener) {
  listener = nextListener;
  nextListener({ ...state });
}
function websocketUrl(alertId) {
  const base = new URL(BASE_URL3);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = `${base.pathname.replace(/\/$/, "")}/alerts/${alertId}/track`;
  base.search = "";
  base.hash = "";
  return base.toString();
}
function clearTimer(timer) {
  if (timer !== null)
    clearTimeout(timer);
}
function sendPendingLocation() {
  if (!authenticated || !pendingLocation || socket?.readyState !== WebSocket.OPEN)
    return;
  socket.send(JSON.stringify(pendingLocation));
}
function scheduleReconnect() {
  if (!state.active || state.stopping || reconnectTimer !== null)
    return;
  const delay = Math.min(MAX_RECONNECT_MS, 1000 * 2 ** Math.min(reconnectAttempt, 5));
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}
function connect() {
  if (!state.active || !state.alertId || !publisherToken)
    return;
  authenticated = false;
  const currentSocket = new WebSocket(websocketUrl(state.alertId));
  socket = currentSocket;
  currentSocket.addEventListener("open", () => {
    if (socket !== currentSocket)
      return;
    currentSocket.send(JSON.stringify({ type: "auth", token: publisherToken }));
  });
  currentSocket.addEventListener("message", (event) => {
    if (socket !== currentSocket)
      return;
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.type === "ready") {
      authenticated = true;
      reconnectAttempt = 0;
      sequence = Math.max(sequence, Number(message.latest_sequence) || 0);
      if (pendingLocation && Number(pendingLocation.sequence) <= sequence) {
        sequence += 1;
        pendingLocation.sequence = sequence;
      }
      publishState({ connected: true, error: null });
      sendPendingLocation();
      clearTimer(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN)
          socket.send(JSON.stringify({ type: "ping" }));
      }, HEARTBEAT_MS);
    } else if (message.type === "ack" && pendingLocation?.sequence === message.sequence) {
      pendingLocation = null;
    } else if (message.type === "status" && message.status !== "active") {
      stopLocally(message.status === "expired" ? "Tracking time expired." : null);
    }
  });
  currentSocket.addEventListener("close", (event) => {
    if (socket !== currentSocket)
      return;
    authenticated = false;
    clearTimer(heartbeatTimer);
    heartbeatTimer = null;
    publishState({ connected: false });
    if (event.code === 4401 || event.code === 4409) {
      stopLocally(event.reason || "The tracking session ended.");
      return;
    }
    scheduleReconnect();
  });
  currentSocket.addEventListener("error", () => {
    if (socket === currentSocket)
      publishState({ connected: false });
  });
}
function queueLocation(location) {
  if (!state.active || !location)
    return;
  sequence += 1;
  const recordedAt = location.time ? new Date(location.time).toISOString() : new Date().toISOString();
  pendingLocation = {
    type: "location",
    sequence,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy ?? null,
    speed: location.speed != null && location.speed >= 0 ? location.speed : null,
    bearing: location.bearing != null && location.bearing >= 0 ? location.bearing : null,
    recorded_at: recordedAt
  };
  publishState({ lastUpdateAt: recordedAt });
  persistSession();
  sendPendingLocation();
}
async function startWatcher() {
  try {
    const notificationPermission = await LocalNotifications.checkPermissions();
    if (notificationPermission.display === "prompt") {
      await LocalNotifications.requestPermissions();
    }
    watcherId = await BackgroundGeolocation.addWatcher({
      backgroundMessage: "Your live emergency location is being shared. Tap to return to Panic Button.",
      backgroundTitle: "Panic Button live tracking",
      requestPermissions: true,
      stale: false,
      distanceFilter: 10
    }, (location, error) => {
      if (error) {
        publishState({ error: error.message || "Couldn't update your location." });
        return;
      }
      queueLocation(location);
    });
    await persistSession();
  } catch {
    fallbackWatcherId = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 15000 }, (position, error) => {
      if (error || !position) {
        publishState({ error: "Couldn't update your location." });
        return;
      }
      queueLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        bearing: position.coords.heading,
        time: position.timestamp
      });
    });
    publishState({ error: "Background tracking is unavailable. Keep Panic Button open while sharing." });
  }
}
async function removeWatcher() {
  if (watcherId !== null) {
    await BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
    watcherId = null;
  }
  if (fallbackWatcherId !== null) {
    await Geolocation.clearWatch({ id: fallbackWatcherId }).catch(() => {});
    fallbackWatcherId = null;
  }
}
async function startLiveTracking(alert) {
  await stopLocally();
  publisherToken = alert.publisher_token;
  sequence = 0;
  pendingLocation = null;
  publishState({
    active: true,
    connected: false,
    stopping: false,
    alertId: alert.id,
    startedAt: alert.created_at,
    expiresAt: alert.tracking_expires_at,
    lastUpdateAt: alert.created_at,
    error: null
  });
  await persistSession();
  connect();
  await startWatcher();
  const expiresIn = Math.max(0, new Date(alert.tracking_expires_at).getTime() - Date.now());
  expiryTimer = setTimeout(() => stopLocally("Tracking time expired."), expiresIn);
}
async function restoreLiveTracking() {
  const { value } = await Preferences.get({ key: SESSION_KEY });
  if (!value || state.active)
    return;
  let saved;
  try {
    saved = JSON.parse(value);
  } catch {
    await Preferences.remove({ key: SESSION_KEY });
    return;
  }
  if (!saved.alertId || !saved.publisherToken || !saved.expiresAt || new Date(saved.expiresAt).getTime() <= Date.now()) {
    await Preferences.remove({ key: SESSION_KEY });
    return;
  }
  if (saved.watcherId) {
    await BackgroundGeolocation.removeWatcher({ id: saved.watcherId }).catch(() => {});
  }
  publisherToken = saved.publisherToken;
  sequence = Number(saved.sequence) || 0;
  publishState({
    active: true,
    connected: false,
    stopping: false,
    alertId: saved.alertId,
    startedAt: saved.startedAt,
    expiresAt: saved.expiresAt,
    lastUpdateAt: saved.lastUpdateAt,
    error: null
  });
  connect();
  await startWatcher();
  expiryTimer = setTimeout(() => stopLocally("Tracking time expired."), new Date(saved.expiresAt).getTime() - Date.now());
}
async function stopLiveTracking(stopRequest) {
  if (!state.active || !state.alertId || state.stopping)
    return;
  publishState({ stopping: true });
  try {
    await stopRequest(state.alertId);
    await stopLocally();
  } catch (error) {
    publishState({ stopping: false, error: error instanceof Error ? error.message : "Couldn't stop live tracking." });
    throw error;
  }
}
async function stopLiveTrackingLocally() {
  await stopLocally();
}
async function stopLocally(error = null) {
  clearTimer(reconnectTimer);
  clearTimer(heartbeatTimer);
  clearTimer(expiryTimer);
  reconnectTimer = null;
  heartbeatTimer = null;
  expiryTimer = null;
  await removeWatcher();
  if (socket && socket.readyState < WebSocket.CLOSING)
    socket.close(1000);
  socket = null;
  publisherToken = null;
  authenticated = false;
  pendingLocation = null;
  await Preferences.remove({ key: SESSION_KEY });
  publishState({ active: false, connected: false, stopping: false, alertId: null, error });
}

// src/lib/toast.ts
var container = null;
function ensureContainer() {
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}
function showToast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  ensureContainer().appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast-visible"));
  setTimeout(() => {
    el.classList.remove("toast-visible");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
  }, 3400);
}

// src/lib/dom.ts
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}
function setLoading(button, loading) {
  button.disabled = loading;
  button.querySelector(".btn-label").hidden = loading;
  button.querySelector(".btn-spinner").hidden = !loading;
}
function shake(el) {
  el.classList.remove("shake");
  el.offsetWidth;
  el.classList.add("shake");
}

// src/lib/icons.ts
function icon(path, viewBox = "0 0 24 24") {
  return `<svg class="icon" viewBox="${viewBox}" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
}
var Icon = {
  home: () => icon("M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"),
  contacts: () => icon("M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"),
  settings: () => icon("M19.14,12.94c0.04,-0.3 0.06,-0.61 0.06,-0.94c0,-0.32 -0.02,-0.64 -0.07,-0.94l2.03,-1.58c0.18,-0.14 0.23,-0.41 0.12,-0.61l-1.92,-3.32c-0.12,-0.22 -0.37,-0.29 -0.59,-0.22l-2.39,0.96c-0.5,-0.38 -1.03,-0.7 -1.62,-0.94L14.4,2.81c-0.04,-0.24 -0.24,-0.41 -0.48,-0.41h-3.84c-0.24,0 -0.43,0.17 -0.47,0.41L9.25,5.35C8.66,5.59 8.12,5.92 7.63,6.29L5.24,5.33c-0.22,-0.08 -0.47,0 -0.59,0.22L2.74,8.87C2.62,9.08 2.66,9.34 2.86,9.48l2.03,1.58C4.84,11.36 4.8,11.69 4.8,12s0.02,0.64 0.07,0.94l-2.03,1.58c-0.18,0.14 -0.23,0.41 -0.12,0.61l1.92,3.32c0.12,0.22 0.37,0.29 0.59,0.22l2.39,-0.96c0.5,0.38 1.03,0.7 1.62,0.94l0.36,2.54c0.05,0.24 0.24,0.41 0.48,0.41h3.84c0.24,0 0.44,-0.17 0.47,-0.41l0.36,-2.54c0.59,-0.24 1.13,-0.56 1.62,-0.94l2.39,0.96c0.22,0.08 0.47,0 0.59,-0.22l1.92,-3.32c0.12,-0.22 0.07,-0.47 -0.12,-0.61L19.14,12.94zM12,15.6c-1.98,0 -3.6,-1.62 -3.6,-3.6s1.62,-3.6 3.6,-3.6s3.6,1.62 3.6,3.6S13.98,15.6 12,15.6z"),
  add: () => icon("M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"),
  delete: () => icon("M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"),
  checkCircle: () => icon("M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"),
  mail: () => icon("M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"),
  arrowBack: () => icon("M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"),
  close: () => icon("M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"),
  schedule: () => icon("M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"),
  phone: () => icon("M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"),
  personAdd: () => icon("M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"),
  edit: () => icon("M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"),
  logout: () => icon("M17 7l-1.41 1.41L17.17 10H8v2h9.17l-1.58 1.59L17 15l4-4zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"),
  language: () => icon("M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-.61.08-1.21.21-1.78L8.99 15v1c0 1.1.9 2 2 2v1.93C7.06 19.44 4 16.08 4 12zm13.89 5.4c-.26-.81-1-1.4-1.89-1.4h-1v-3c0-.55-.45-1-1-1h-6v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.11 5.4z"),
  theme: () => icon("M12 2a10 10 0 100 20 10 10 0 000-20zm0 2v16a8 8 0 010-16z"),
  palette: () => icon("M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.6-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"),
  telegram: () => icon("M248 8C111 8 0 119 0 256S111 504 248 504 496 393 496 256 385 8 248 8zM362 176.7c-3.7 39.2-19.9 134.4-28.1 178.3-3.5 18.6-10.4 24.8-17 25.4-14.4 1.3-25.3-9.5-39.3-18.7-21.8-14.3-34.2-23.2-55.3-37.2-24.5-16.1-8.6-25 5.3-39.5 3.7-3.8 67.1-61.5 68.3-66.7 .2-.7 .3-3.1-1.2-4.4s-3.6-.8-5.1-.5q-3.3 .7-104.6 69.1-14.8 10.2-26.9 9.9c-8.9-.2-25.9-5-38.6-9.1-15.5-5-27.9-7.7-26.8-16.3q.8-6.7 18.5-13.7 108.4-47.2 144.6-62.3c68.9-28.6 83.2-33.6 92.5-33.8 2.1 0 6.6 .5 9.6 2.9a10.5 10.5 0 0 1 3.5 6.7A43.8 43.8 0 0 1 362 176.7z", "0 0 496 512"),
  whatsapp: () => icon("M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z", "0 0 448 512"),
  sms: () => icon("M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-3 11H7v-2h10v2zm0-3H7V8h10v2z"),
  info: () => icon("M11 7h2v2h-2V7zm0 4h2v6h-2v-6zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"),
  help: () => icon("M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"),
  eye: () => icon("M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"),
  eyeOff: () => icon("M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.75-2.88 3.54-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm7.98-.82c.05.21.08.43.08.65 0 1.66-1.34 3-3 3-.22 0-.44-.03-.65-.08l-3.15-3.15c.21-.05.43-.08.65-.08 1.66 0 3 1.34 3 3z")
};

// src/views/login.ts
async function renderLogin(container2, { navigate, refreshUser }) {
  container2.innerHTML = `
    <div class="auth-screen">
      <img class="brand-mark" src="assets/icon.png" alt="" />
      <img class="auth-title" src="assets/title.png" />
      <p class="auth-subtitle">${t("login.subtitle")}</p>

      <form id="login-form" class="form" novalidate>
        <label class="field">
          <span>${t("login.email")}</span>
          <input type="email" name="email" autocomplete="email" required />
        </label>
        <label class="field">
          <span>${t("login.password")}</span>
          <div>
            <input type="password" name="password" autocomplete="current-password" required />
            <span id="show-password" class="show-password"></span>
          </div>
        </label>
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-label">${t("login.submit")}</span>
          <span class="btn-spinner" hidden></span>
        </button>
      </form>

      <p class="auth-switch"><a href="#" id="forgot-link">${t("login.forgot")}</a></p>
      <p class="auth-switch">${t("login.switch")} <a href="#/register">${t("login.switchLink")}</a></p>
    </div>
  `;
  const form = container2.querySelector("#login-form");
  const button = form.querySelector('button[type="submit"]');
  const forgotLink = container2.querySelector("#forgot-link");
  forgotLink.addEventListener("click", async (event) => {
    event.preventDefault();
    const email = form.querySelector('input[name="email"]').value.trim();
    if (!email) {
      showToast(t("login.forgotNeedEmail"), "info");
      return;
    }
    try {
      await Api.requestPasswordReset(email);
    } catch {}
    showToast(t("login.forgotSent"), "success");
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      setLoading(button, true);
      const { access_token } = await Api.login(data);
      await setToken(access_token);
      await refreshUser();
      navigate("home");
    } catch (error) {
      shake(form);
      showToast(error instanceof ApiError ? error.message : t("errors.generic"), "error");
    } finally {
      setLoading(button, false);
    }
  });
  const passwordShowSpans = form.querySelectorAll(".show-password");
  passwordShowSpans.forEach((span) => {
    span.innerHTML = Icon.eyeOff();
    span.addEventListener("click", () => togglePasswordVisibility(span));
  });
  function togglePasswordVisibility(span) {
    const input = span.previousElementSibling;
    if (input.type === "password") {
      input.type = "text";
      span.innerHTML = Icon.eye();
    } else {
      input.type = "password";
      span.innerHTML = Icon.eyeOff();
    }
  }
}

// src/lib/phone.ts
var DEFAULT_COUNTRY_CODE = "+1";
var COUNTRY_CODES = [
  { code: "+1", country: "US/CA" },
  { code: "+34", country: "ES" },
  { code: "+52", country: "MX" },
  { code: "+54", country: "AR" },
  { code: "+57", country: "CO" },
  { code: "+56", country: "CL" },
  { code: "+51", country: "PE" },
  { code: "+58", country: "VE" },
  { code: "+593", country: "EC" },
  { code: "+502", country: "GT" },
  { code: "+503", country: "SV" },
  { code: "+504", country: "HN" },
  { code: "+505", country: "NI" },
  { code: "+506", country: "CR" },
  { code: "+507", country: "PA" },
  { code: "+591", country: "BO" },
  { code: "+595", country: "PY" },
  { code: "+598", country: "UY" },
  { code: "+55", country: "BR" },
  { code: "+44", country: "UK" },
  { code: "+49", country: "DE" },
  { code: "+33", country: "FR" },
  { code: "+39", country: "IT" }
];
var _codesByLength = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
function sanitizePhoneDigits(value) {
  return value.replace(/\D/g, "");
}
function splitPhone(fullPhone) {
  const value = (fullPhone ?? "").trim();
  const match = _codesByLength.find((entry) => value.startsWith(entry.code));
  if (match)
    return { countryCode: match.code, number: sanitizePhoneDigits(value.slice(match.code.length)) };
  return { countryCode: DEFAULT_COUNTRY_CODE, number: sanitizePhoneDigits(value) };
}
function combinePhone(countryCode, number) {
  return `${countryCode}${sanitizePhoneDigits(number)}`;
}
function buildCountryCodeOptions(selectedCode) {
  return COUNTRY_CODES.map(({ code, country }) => `<option value="${code}" ${code === selectedCode ? "selected" : ""}>${code} ${country}</option>`).join("");
}
function attachPhoneSanitizer(input) {
  input.addEventListener("input", () => {
    const digitsOnly = sanitizePhoneDigits(input.value);
    if (digitsOnly !== input.value)
      input.value = digitsOnly;
  });
}

// src/views/register.ts
var EMAIL_DOMAINS = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"];
function insertEmailDomain(input, domain) {
  const at = input.value.indexOf("@");
  const local = at >= 0 ? input.value.slice(0, at) : input.value;
  input.value = `${local}@${domain}`;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}
async function renderRegister(container2, { navigate }) {
  container2.innerHTML = `
    <div class="auth-screen">
      <img class="auth-title" src="assets/title.png" alt="" />
      <h2 class="auth-title">${t("route.register.title")}</h2>
      <p class="auth-subtitle">${t("register.subtitle")}</p>

      <form id="register-form" class="form" novalidate>
        <label class="field">
          <span>${t("register.name")}</span>
          <input type="text" name="name" autocomplete="name" required />
        </label>
        <label class="field">
          <span>${t("register.phone")}</span>
          <div class="phone-field">
            <select name="phone_country" class="phone-country">${buildCountryCodeOptions(DEFAULT_COUNTRY_CODE)}</select>
            <input type="tel" name="phone_number" autocomplete="tel" inputmode="numeric" required />
          </div>
        </label>
        <label class="field">
          <span>${t("register.email")}</span>
          <input type="email" name="email" autocomplete="email" required />
          <div class="email-domain-chips">
            ${EMAIL_DOMAINS.map((domain) => `<button type="button" class="email-domain-chip" data-domain="${domain}">@${domain}</button>`).join("")}
          </div>
        </label>
        <label class="field">
          <span>${t("register.password")}</span>
          <div>
            <input type="password" name="password" autocomplete="new-password" minlength="8" required />
            <span id="show-password" class="show-password"></span>
          </div>
        </label>
        <label class="field">
          <span>${t("register.confirmPassword")}</span>
          <div>
            <input type="password" name="confirm_password" autocomplete="new-password" required />
            <span id="show-password" class="show-password"></span>
          </div>
        </label>
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-label">${t("register.submit")}</span>
          <span class="btn-spinner" hidden></span>
        </button>
      </form>

      <p class="auth-switch">${t("register.switch")} <a href="#/login">${t("register.switchLink")}</a></p>
    </div>
  `;
  const form = container2.querySelector("#register-form");
  const button = form.querySelector('button[type="submit"]');
  attachPhoneSanitizer(form.querySelector('input[name="phone_number"]'));
  const emailInput = form.querySelector('input[name="email"]');
  form.querySelectorAll(".email-domain-chip").forEach((chip) => {
    chip.addEventListener("click", () => insertEmailDomain(emailInput, chip.dataset.domain));
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { confirm_password, phone_country, phone_number, ...data } = Object.fromEntries(new FormData(form));
    data.phone = combinePhone(phone_country, phone_number);
    if (data.password !== confirm_password) {
      shake(form);
      showToast(t("register.passwordMismatch"), "error");
      return;
    }
    try {
      setLoading(button, true);
      await Api.register(data);
      renderConfirmEmail(container2, data.email, navigate);
    } catch (error) {
      shake(form);
      showToast(error instanceof ApiError ? error.message : t("errors.generic"), "error");
      setLoading(button, false);
    }
  });
  const passwordShowSpans = form.querySelectorAll(".show-password");
  passwordShowSpans.forEach((span) => {
    span.innerHTML = Icon.eyeOff();
    span.addEventListener("click", () => togglePasswordVisibility(span));
  });
  function togglePasswordVisibility(span) {
    const input = span.previousElementSibling;
    if (input.type === "password") {
      input.type = "text";
      span.innerHTML = Icon.eye();
    } else {
      input.type = "password";
      span.innerHTML = Icon.eyeOff();
    }
  }
}
function renderConfirmEmail(container2, email, navigate) {
  container2.innerHTML = `
    <div class="confirm-mail-screen">
      <div class="confirm-mail-icon">${Icon.mail()}</div>
      <h1 class="auth-title">${t("confirmMail.title")}</h1>
      <p class="auth-subtitle">${t("confirmMail.subtitle", { email: escapeHtml(email) })}</p>
      <button id="back-to-login" class="btn btn-outline" type="button">${t("confirmMail.back")}</button>
    </div>
  `;
  container2.querySelector("#back-to-login").addEventListener("click", () => navigate("login"));
}

// src/lib/geolocation.ts
async function getCurrentCoordinates() {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed != null && position.coords.speed >= 0 ? position.coords.speed : null,
      bearing: position.coords.heading != null && position.coords.heading >= 0 ? position.coords.heading : null
    };
  } catch {
    throw new Error("Couldn't get your location. Make sure location access is enabled for Panic Button.");
  }
}

// src/views/home.ts
var HOLD_DURATION_MS = 1400;
var RING_RADIUS = 54;
var RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
var RESET_DELAY_MS = 2600;
async function renderHome(container2, { getUser: getUser2 }) {
  const user = getUser2();
  const firstName = (user?.name ?? "there").split(" ")[0];
  container2.innerHTML = `
    <div class="home-screen">
      <div class="home-hud">
        <p class="home-greeting">${t("home.greeting", { name: escapeHtml(firstName) })}</p>
        <span id="home-status-chip" class="home-status-chip"></span>
      </div>

      <div class="panic-wrap">
        <button id="panic-btn" class="panic-btn" type="button" aria-label="${t("home.panicAria")}">
          <svg class="panic-ring" viewBox="0 0 120 120">
            <circle class="panic-ring-bg" cx="60" cy="60" r="${RING_RADIUS}"></circle>
            <circle id="panic-ring-progress" class="panic-ring-progress" cx="60" cy="60" r="${RING_RADIUS}"
                    stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="${RING_CIRCUMFERENCE}"></circle>
          </svg>
          <span id="panic-icon" class="panic-icon">SOS</span>
          <svg id="panic-check" class="panic-check" viewBox="0 0 24 24" hidden>
            <polyline points="4 12 9 18 20 6"></polyline>
          </svg>
        </button>
        <p id="panic-status" class="panic-status" aria-live="polite">${t("home.idle")}</p>
      </div>
      <section id="tracking-panel" class="tracking-panel" hidden aria-live="polite">
        <div class="tracking-panel-copy">
          <span id="tracking-dot" class="tracking-dot"></span>
          <div>
            <strong>${t("home.trackingTitle")}</strong>
            <span id="tracking-detail">${t("home.trackingConnecting")}</span>
          </div>
        </div>
        <button id="stop-tracking-btn" class="tracking-stop" type="button">${t("home.trackingStop")}</button>
      </section>
    </div>
  `;
  const btn = container2.querySelector("#panic-btn");
  const ring = container2.querySelector("#panic-ring-progress");
  const icon2 = container2.querySelector("#panic-icon");
  const check = container2.querySelector("#panic-check");
  const status = container2.querySelector("#panic-status");
  const statusChip = container2.querySelector("#home-status-chip");
  const trackingPanel = container2.querySelector("#tracking-panel");
  const trackingDot = container2.querySelector("#tracking-dot");
  const trackingDetail = container2.querySelector("#tracking-detail");
  const stopTrackingBtn = container2.querySelector("#stop-tracking-btn");
  let notifiableCount = null;
  loadStatusChip(statusChip, (count) => {
    notifiableCount = count;
  });
  let holding = false;
  let busy = false;
  let holdStart = 0;
  let rafId = null;
  function renderTrackingState(tracking) {
    trackingPanel.hidden = !tracking.active;
    btn.disabled = tracking.active;
    trackingDot.classList.toggle("tracking-dot-connected", tracking.connected);
    stopTrackingBtn.disabled = tracking.stopping;
    stopTrackingBtn.textContent = tracking.stopping ? t("home.trackingStopping") : t("home.trackingStop");
    if (!tracking.active) {
      if (!busy)
        status.textContent = tracking.error || t("home.idle");
      return;
    }
    busy = true;
    const started = tracking.startedAt ? new Date(tracking.startedAt) : null;
    const minutes = started && !Number.isNaN(started.getTime()) ? Math.max(0, Math.floor((Date.now() - started.getTime()) / 60000)) : 0;
    trackingDetail.textContent = tracking.error ? tracking.error : t(tracking.connected ? "home.trackingConnected" : "home.trackingConnecting", { minutes });
    status.textContent = t("home.trackingActive");
  }
  observeLiveTracking(renderTrackingState);
  const trackingClock = setInterval(() => {
    if (!container2.isConnected) {
      clearInterval(trackingClock);
      return;
    }
    renderTrackingState(getLiveTrackingState());
  }, 30000);
  function setRingProgress(progress) {
    ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
    btn.style.setProperty("--hold", String(progress));
  }
  function tick() {
    const progress = Math.min((performance.now() - holdStart) / HOLD_DURATION_MS, 1);
    setRingProgress(progress);
    if (progress >= 1) {
      holding = false;
      sendAlert();
      return;
    }
    if (holding)
      rafId = requestAnimationFrame(tick);
  }
  function startHold() {
    if (busy || holding)
      return;
    holding = true;
    holdStart = performance.now();
    btn.classList.add("panic-btn-holding");
    status.textContent = t("home.holding");
    rafId = requestAnimationFrame(tick);
  }
  function cancelHold() {
    if (!holding)
      return;
    holding = false;
    cancelAnimationFrame(rafId);
    btn.classList.remove("panic-btn-holding");
    setRingProgress(0);
    status.textContent = t("home.idle");
  }
  async function sendAlert() {
    if (notifiableCount === 0) {
      btn.classList.remove("panic-btn-holding");
      setRingProgress(0);
      status.textContent = t("home.idle");
      showToast(t("home.noContacts"), "error");
      shake(btn);
      return;
    }
    busy = true;
    btn.classList.remove("panic-btn-holding");
    btn.classList.add("panic-btn-busy");
    status.textContent = t("home.locating");
    try {
      const coordinates = await getCurrentCoordinates();
      status.textContent = t("home.sending");
      const alert = await Api.createAlert(coordinates);
      let trackingStarted = true;
      try {
        await startLiveTracking(alert);
      } catch {
        trackingStarted = false;
        await stopLiveTracking(Api.stopAlert).catch(() => {});
      }
      btn.classList.remove("panic-btn-busy");
      btn.classList.add("panic-btn-success");
      icon2.hidden = true;
      check.hidden = false;
      status.textContent = t(trackingStarted ? "home.sent" : "home.trackingUnavailable");
      showToast(t(trackingStarted ? "home.sentToast" : "home.trackingUnavailable"), trackingStarted ? "success" : "error");
    } catch (error) {
      btn.classList.remove("panic-btn-busy");
      btn.classList.add("panic-btn-error");
      const message = error instanceof Error ? error.message : t("home.errorFallback");
      status.textContent = message;
      showToast(message, "error");
      shake(btn);
    } finally {
      setTimeout(resetButton, RESET_DELAY_MS);
    }
  }
  function resetButton() {
    if (getLiveTrackingState().active) {
      btn.classList.remove("panic-btn-busy", "panic-btn-success", "panic-btn-error");
      icon2.hidden = false;
      check.hidden = true;
      renderTrackingState(getLiveTrackingState());
      return;
    }
    busy = false;
    setRingProgress(0);
    btn.classList.remove("panic-btn-busy", "panic-btn-success", "panic-btn-error");
    icon2.hidden = false;
    check.hidden = true;
    status.textContent = t("home.idle");
  }
  const TILT_MAX_DEG = 8;
  function applyTilt(event) {
    const rect = btn.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const scale = holding ? 0.98 : 1;
    btn.style.transform = `perspective(600px) rotateX(${(-dy * TILT_MAX_DEG).toFixed(2)}deg) rotateY(${(dx * TILT_MAX_DEG).toFixed(2)}deg) scale(${scale})`;
  }
  function resetTilt() {
    btn.style.transform = "";
  }
  btn.addEventListener("pointerdown", startHold);
  btn.addEventListener("pointerup", cancelHold);
  btn.addEventListener("pointerleave", cancelHold);
  btn.addEventListener("pointercancel", cancelHold);
  btn.addEventListener("pointermove", applyTilt);
  btn.addEventListener("pointerleave", resetTilt);
  stopTrackingBtn.addEventListener("click", async () => {
    try {
      await stopLiveTracking(Api.stopAlert);
      busy = false;
      btn.disabled = false;
      resetButton();
      showToast(t("home.trackingStopped"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("home.trackingStopError"), "error");
    }
  });
}
async function loadStatusChip(chip, onCount) {
  try {
    const contacts = await Api.listContacts();
    const notifiable = contacts.filter((contact) => contact.confirmed || contact.telegram_linked || contact.whatsapp_confirmed || contact.sms_enabled).length;
    onCount(notifiable);
    chip.innerHTML = notifiable > 0 ? `${Icon.contacts()} ${t(notifiable === 1 ? "home.statusReady" : "home.statusReadyPlural", { count: notifiable })}` : `${Icon.contacts()} ${t("home.statusNone")}`;
    chip.classList.add("home-status-visible");
  } catch {}
}

// src/lib/features.ts
var cached = null;
function getFeatures() {
  if (!cached) {
    cached = Api.getFeatures().catch(() => ({ telegram: false, whatsapp: false, sms: false }));
  }
  return cached;
}

// node_modules/@capacitor-community/contacts/dist/esm/definitions.js
var PhoneType;
(function(PhoneType2) {
  PhoneType2["Home"] = "home";
  PhoneType2["Work"] = "work";
  PhoneType2["Other"] = "other";
  PhoneType2["Custom"] = "custom";
  PhoneType2["Mobile"] = "mobile";
  PhoneType2["FaxWork"] = "fax_work";
  PhoneType2["FaxHome"] = "fax_home";
  PhoneType2["Pager"] = "pager";
  PhoneType2["Callback"] = "callback";
  PhoneType2["Car"] = "car";
  PhoneType2["CompanyMain"] = "company_main";
  PhoneType2["Isdn"] = "isdn";
  PhoneType2["Main"] = "main";
  PhoneType2["OtherFax"] = "other_fax";
  PhoneType2["Radio"] = "radio";
  PhoneType2["Telex"] = "telex";
  PhoneType2["TtyTdd"] = "tty_tdd";
  PhoneType2["WorkMobile"] = "work_mobile";
  PhoneType2["WorkPager"] = "work_pager";
  PhoneType2["Assistant"] = "assistant";
  PhoneType2["Mms"] = "mms";
})(PhoneType || (PhoneType = {}));
var EmailType;
(function(EmailType2) {
  EmailType2["Home"] = "home";
  EmailType2["Work"] = "work";
  EmailType2["Other"] = "other";
  EmailType2["Custom"] = "custom";
  EmailType2["Mobile"] = "mobile";
})(EmailType || (EmailType = {}));
var PostalAddressType;
(function(PostalAddressType2) {
  PostalAddressType2["Home"] = "home";
  PostalAddressType2["Work"] = "work";
  PostalAddressType2["Other"] = "other";
  PostalAddressType2["Custom"] = "custom";
})(PostalAddressType || (PostalAddressType = {}));

// node_modules/@capacitor-community/contacts/dist/esm/index.js
var Contacts = registerPlugin("Contacts", {
  web: () => import("./chunk-50ydnxbr.js").then((m) => new m.ContactsWeb)
});

// src/lib/contactsPicker.ts
async function pickDeviceContact() {
  const { contact } = await Contacts.pickContact({
    projection: { name: true, phones: true, emails: true }
  });
  return {
    name: contact.name?.display ?? "",
    phone: contact.phones?.[0]?.number ?? "",
    email: contact.emails?.[0]?.address ?? ""
  };
}

// src/lib/sheet.ts
function openSheet(bodyElement) {
  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.appendChild(bodyElement);
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
  function close() {
    backdrop.classList.remove("sheet-open");
    backdrop.addEventListener("transitionend", () => backdrop.remove(), { once: true });
  }
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop)
      close();
  });
  requestAnimationFrame(() => backdrop.classList.add("sheet-open"));
  return { close, sheet };
}

// node_modules/@capacitor/share/dist/esm/index.js
var Share = registerPlugin("Share", {
  web: () => import("./chunk-nnq8xjfq.js").then((m) => new m.ShareWeb)
});

// src/lib/share.ts
async function copyToClipboard(url) {
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
async function shareLink({ url, title, text }) {
  if (!Capacitor.isPluginAvailable("Share")) {
    return copyToClipboard(url);
  }
  try {
    await Share.share({ title, text, url });
    return "shared";
  } catch {
    return copyToClipboard(url);
  }
}

// src/views/contacts.ts
var EMAIL_DOMAINS2 = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"];
var MAX_CONTACTS = 4;
function insertEmailDomain2(input, domain) {
  const at = input.value.indexOf("@");
  const local = at >= 0 ? input.value.slice(0, at) : input.value;
  input.value = `${local}@${domain}`;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}
async function renderContacts(container2) {
  container2.innerHTML = `
    <div class="contacts-screen">
      <div id="contacts-list" class="contacts-list"></div>
      <button id="add-contact-fab" class="fab" type="button" aria-label="${t("contacts.addTitle")}">${Icon.add()}</button>
    </div>
  `;
  const list = container2.querySelector("#contacts-list");
  const fab = container2.querySelector("#add-contact-fab");
  renderSkeleton(list);
  const features = await getFeatures();
  await loadContacts(list, fab, features);
  fab.addEventListener("click", () => {
    if (fab.dataset.atLimit === "true") {
      showToast(t("contacts.limitReached", { max: MAX_CONTACTS }), "info");
      return;
    }
    openAddOptionsSheet(() => loadContacts(list, fab, features), features);
  });
}
function updateFabState(fab, count) {
  const atLimit = count >= MAX_CONTACTS;
  fab.dataset.atLimit = String(atLimit);
  fab.classList.toggle("fab-disabled", atLimit);
  fab.setAttribute("aria-disabled", String(atLimit));
}
function renderSkeleton(list) {
  list.innerHTML = Array.from({ length: 3 }).map(() => `<div class="contact-row contact-skeleton"></div>`).join("");
}
async function loadContacts(list, fab, features) {
  try {
    const contacts = await Api.listContacts();
    renderContactRows(list, fab, contacts, features);
    updateFabState(fab, contacts.length);
  } catch (error) {
    list.innerHTML = `<p class="contacts-empty">${t("contacts.loadError")}</p>`;
    showToast(error instanceof ApiError ? error.message : t("contacts.loadErrorToast"), "error");
  }
}
function renderContactRows(list, fab, contacts, features) {
  if (contacts.length === 0) {
    list.innerHTML = `<p class="contacts-empty">${t("contacts.empty")}</p>`;
    return;
  }
  const limitHint = contacts.length >= MAX_CONTACTS ? `<p class="contacts-limit-hint">${t("contacts.limitReached", { max: MAX_CONTACTS })}</p>` : "";
  list.innerHTML = limitHint + contacts.map((contact, index) => `
      <button class="contact-row" type="button" data-id="${contact.id}" style="animation-delay:${index * 60}ms">
        <span class="contact-avatar">${escapeHtml(contact.name.charAt(0).toUpperCase())}</span>
        <span class="contact-info">
          <span class="contact-name">${escapeHtml(contact.name)}</span>
          <span class="contact-phone">${Icon.phone()} ${escapeHtml(contact.phone)}</span>
          ${contact.email ? `<span class="contact-email">${Icon.mail()} ${escapeHtml(contact.email)}</span>` : ""}
        </span>
        <span class="contact-channels">
          <span class="channel-icon ${contact.confirmed ? "channel-active" : "channel-inactive"}"
                title="${contact.confirmed ? t("contacts.confirmed") : t("contacts.pending")}"
                aria-label="${contact.confirmed ? t("contacts.confirmed") : t("contacts.pending")}">${Icon.mail()}</span>
          ${features.telegram ? `<span class="channel-icon channel-telegram ${contact.telegram_linked ? "channel-active" : "channel-inactive"}"
                       title="${contact.telegram_linked ? t("contacts.telegramLinked") : t("contacts.telegramNotLinked")}"
                       aria-label="${contact.telegram_linked ? t("contacts.telegramLinked") : t("contacts.telegramNotLinked")}">${Icon.telegram()}</span>` : ""}
          ${features.whatsapp ? `<span class="channel-icon channel-whatsapp ${contact.whatsapp_enabled && contact.whatsapp_confirmed ? "channel-active" : "channel-inactive"}"
                       title="${contact.whatsapp_enabled && contact.whatsapp_confirmed ? t("contacts.whatsappLinked") : t("contacts.whatsappNotLinked")}"
                       aria-label="${contact.whatsapp_enabled && contact.whatsapp_confirmed ? t("contacts.whatsappLinked") : t("contacts.whatsappNotLinked")}">${Icon.whatsapp()}</span>` : ""}
          ${features.sms ? `<span class="channel-icon channel-sms ${contact.sms_enabled ? "channel-active" : "channel-inactive"}"
                       title="${contact.sms_enabled ? t("contacts.smsEnabled") : t("contacts.smsDisabled")}"
                       aria-label="${contact.sms_enabled ? t("contacts.smsEnabled") : t("contacts.smsDisabled")}">${Icon.sms()}</span>` : ""}
        </span>
      </button>
    `).join("");
  list.querySelectorAll(".contact-row").forEach((row) => {
    row.addEventListener("click", () => {
      const contact = contacts.find((c) => String(c.id) === row.dataset.id);
      openContactFormSheet({ contact, features, onSaved: () => loadContacts(list, fab, features) });
    });
  });
}
function openAddOptionsSheet(onSaved, features) {
  const body = document.createElement("div");
  body.innerHTML = `
    <h2 class="sheet-title">${t("contacts.addTitle")}</h2>
    <div class="sheet-options">
      <button class="btn btn-outline btn-block" type="button" id="pick-device-contact">
        ${Icon.contacts()}
        <span class="btn-label">${t("contacts.pickDevice")}</span>
      </button>
      <button class="btn btn-outline btn-block" type="button" id="add-manually">
        ${Icon.personAdd()}
        <span class="btn-label">${t("contacts.addManually")}</span>
      </button>
    </div>
  `;
  const { close } = openSheet(body);
  body.querySelector("#add-manually").addEventListener("click", () => {
    close();
    openContactFormSheet({ onSaved, features });
  });
  body.querySelector("#pick-device-contact").addEventListener("click", async () => {
    close();
    try {
      const prefill = await pickDeviceContact();
      openContactFormSheet({ prefill, onSaved, features });
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("contacts.pickError"), "error");
    }
  });
}
function openContactFormSheet({ contact = null, prefill = null, features, onSaved }) {
  const isEdit = Boolean(contact);
  const initial = contact ?? prefill ?? { name: "", phone: "", email: "" };
  const { countryCode, number } = splitPhone(initial.phone);
  const body = document.createElement("div");
  body.innerHTML = `
    <form class="form sheet-form" novalidate>
      <h2 class="sheet-title">${isEdit ? t("contacts.editTitle") : t("contacts.addTitle")}</h2>
      <label class="field">
        <span>${t("contacts.name")}</span>
        <input type="text" name="name" required value="${escapeHtml(initial.name ?? "")}" />
      </label>
      <label class="field">
        <span>${t("contacts.phone")}</span>
        <div class="phone-field">
          <select name="phone_country" class="phone-country">${buildCountryCodeOptions(countryCode)}</select>
          <input type="tel" name="phone_number" inputmode="numeric" required value="${escapeHtml(number)}" />
        </div>
      </label>
      <label class="field">
        <span>${t("contacts.email")}</span>
        <input type="email" name="email" required value="${escapeHtml(initial.email ?? "")}" />
        <div class="email-domain-chips">
          ${EMAIL_DOMAINS2.map((domain) => `<button type="button" class="email-domain-chip" data-domain="${domain}">@${domain}</button>`).join("")}
        </div>
      </label>
      ${!isEdit ? `<p class="field-hint">${t("contacts.emailHint")}</p>` : ""}
      <button type="submit" class="btn btn-primary btn-block">
        <span class="btn-label">${isEdit ? t("contacts.save") : t("contacts.add")}</span>
        <span class="btn-spinner" hidden></span>
      </button>
      ${isEdit && contact.email && !contact.confirmed ? `<button type="button" class="btn btn-outline btn-block" id="resend-confirmation">
              ${Icon.mail()}
              <span class="btn-label">${t("contacts.resendConfirmation")}</span>
              <span class="btn-spinner" hidden></span>
            </button>` : ""}
      ${isEdit && features.telegram ? `<button type="button" class="btn btn-outline btn-block" id="telegram-toggle">
              ${Icon.telegram()}
              <span class="btn-label">${contact.telegram_linked ? t("contacts.telegramDisconnect") : t("contacts.telegramConnect")}</span>
              <span class="btn-spinner" hidden></span>
            </button>` : ""}
      ${isEdit && features.whatsapp ? `<button type="button" class="btn btn-outline btn-block" id="whatsapp-toggle">
              ${Icon.whatsapp()}
              <span class="btn-label">${contact.whatsapp_enabled ? t("contacts.whatsappDisconnect") : t("contacts.whatsappConnect")}</span>
              <span class="btn-spinner" hidden></span>
            </button>` : ""}
      ${isEdit && features.sms ? `<button type="button" class="btn btn-outline btn-block" id="sms-toggle">
              ${Icon.sms()}
              <span class="btn-label">${contact.sms_enabled ? t("contacts.smsDisable") : t("contacts.smsEnable")}</span>
              <span class="btn-spinner" hidden></span>
            </button>` : ""}
      ${isEdit ? `<button type="button" class="btn btn-danger-outline btn-block" id="delete-contact">
              ${Icon.delete()}
              <span class="btn-label">${t("contacts.delete")}</span>
              <span class="btn-spinner" hidden></span>
            </button>` : ""}
    </form>
  `;
  const { close } = openSheet(body);
  const form = body.querySelector("form");
  const button = form.querySelector('button[type="submit"]');
  attachPhoneSanitizer(form.querySelector('input[name="phone_number"]'));
  const emailInput = form.querySelector('input[name="email"]');
  form.querySelectorAll(".email-domain-chip").forEach((chip) => {
    chip.addEventListener("click", () => insertEmailDomain2(emailInput, chip.dataset.domain));
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(form));
    const data = {
      name: formData.name,
      phone: combinePhone(formData.phone_country, formData.phone_number),
      email: String(formData.email ?? "").trim()
    };
    if (!data.email) {
      shake(form);
      showToast(t("contacts.emailRequired"), "error");
      return;
    }
    setLoading(button, true);
    try {
      if (isEdit) {
        const changes = diffFields(contact, data);
        if (Object.keys(changes).length === 0) {
          close();
          return;
        }
        await Api.updateContact(contact.id, changes);
        showToast(t("contacts.updated"), "success");
      } else {
        await Api.createContact(data);
        showToast(t("contacts.addedWithEmail"), "success");
      }
      close();
      onSaved();
    } catch (error) {
      shake(form);
      showToast(error instanceof ApiError ? error.message : t("errors.generic"), "error");
    } finally {
      setLoading(button, false);
    }
  });
  if (isEdit) {
    const resendButton = body.querySelector("#resend-confirmation");
    resendButton?.addEventListener("click", async () => {
      setLoading(resendButton, true);
      try {
        await Api.resendContactConfirmation(contact.id);
        showToast(t("contacts.resendConfirmationSent"), "success");
        close();
      } catch (error) {
        showToast(error instanceof ApiError ? error.message : t("errors.generic"), "error");
      } finally {
        setLoading(resendButton, false);
      }
    });
    const telegramButton = body.querySelector("#telegram-toggle");
    telegramButton?.addEventListener("click", async () => {
      setLoading(telegramButton, true);
      try {
        if (contact.telegram_linked) {
          await Api.disableContactTelegram(contact.id);
          showToast(t("contacts.telegramDisconnected"), "success");
        } else {
          const result = await Api.enableContactTelegram(contact.id);
          if (result.telegram_link_url) {
            await shareLink({
              url: result.telegram_link_url,
              title: "Panic Button",
              text: t("contacts.telegramShareText")
            });
            showToast(t("contacts.telegramLinkReady"), "success");
          } else {
            showToast(t("contacts.telegramEmailSent"), "success");
          }
        }
        close();
        onSaved();
      } catch (error) {
        const fallbackKey = contact.telegram_linked ? "contacts.telegramDisableError" : "contacts.telegramEnableError";
        showToast(error instanceof ApiError ? error.message : t(fallbackKey), "error");
      } finally {
        setLoading(telegramButton, false);
      }
    });
    const whatsappButton = body.querySelector("#whatsapp-toggle");
    whatsappButton?.addEventListener("click", async () => {
      setLoading(whatsappButton, true);
      try {
        if (contact.whatsapp_enabled) {
          await Api.disableContactWhatsapp(contact.id);
          showToast(t("contacts.whatsappDisconnected"), "success");
        } else {
          const result = await Api.enableContactWhatsapp(contact.id);
          if (result.join_url) {
            await shareLink({
              url: result.join_url,
              title: "Panic Button",
              text: t("contacts.whatsappShareText")
            });
            showToast(t("contacts.whatsappLinkReady"), "success");
          } else {
            showToast(t("contacts.whatsappEnabled"), "success");
          }
        }
        close();
        onSaved();
      } catch (error) {
        const fallbackKey = contact.whatsapp_enabled ? "contacts.whatsappDisableError" : "contacts.whatsappEnableError";
        showToast(error instanceof ApiError ? error.message : t(fallbackKey), "error");
      } finally {
        setLoading(whatsappButton, false);
      }
    });
    const smsButton = body.querySelector("#sms-toggle");
    smsButton?.addEventListener("click", async () => {
      setLoading(smsButton, true);
      try {
        if (contact.sms_enabled) {
          await Api.disableContactSms(contact.id);
          showToast(t("contacts.smsDisabledToast"), "success");
        } else {
          await Api.enableContactSms(contact.id);
          showToast(t("contacts.smsEnabledToast"), "success");
        }
        close();
        onSaved();
      } catch (error) {
        const fallbackKey = contact.sms_enabled ? "contacts.smsDisableError" : "contacts.smsEnableError";
        showToast(error instanceof ApiError ? error.message : t(fallbackKey), "error");
      } finally {
        setLoading(smsButton, false);
      }
    });
    const deleteButton = body.querySelector("#delete-contact");
    deleteButton.addEventListener("click", async () => {
      if (!confirm(t("contacts.removeConfirm", { name: contact.name })))
        return;
      setLoading(deleteButton, true);
      try {
        await Api.deleteContact(contact.id);
        showToast(t("contacts.removed"), "success");
        close();
        onSaved();
      } catch (error) {
        showToast(error instanceof ApiError ? error.message : t("contacts.removeError"), "error");
      } finally {
        setLoading(deleteButton, false);
      }
    });
  }
}
function diffFields(original, updated) {
  const changes = {};
  for (const key of ["name", "phone", "email"]) {
    if ((original[key] ?? null) !== (updated[key] ?? null)) {
      changes[key] = updated[key];
    }
  }
  return changes;
}

// src/views/profile.ts
var COLOR_PRESETS = [DEFAULT_ACCENT, "#2563eb", "#16a34a", "#9333ea", "#f97316", "#0d9488"];
async function renderProfile(container2, { getUser: getUser2, refreshUser, logout, navigate, getLanguage: getLanguage2, changeLanguage, getAccentColor: getAccentColor2, setAccentColor: setAccentColor2, getTheme: getTheme2, setTheme: setTheme2 }) {
  const user = getUser2();
  const lang = getLanguage2();
  const accentColor = getAccentColor2();
  const isPreset = COLOR_PRESETS.includes(accentColor);
  const theme = getTheme2();
  container2.innerHTML = `
    <div class="profile-screen">

      <form id="profile-form" class="form" novalidate>
        <label class="field">
          <span>${t("profile.name")}</span>
          <input type="text" name="name" required value="${escapeHtml(user?.name ?? "")}" />
        </label>
        <label class="field">
          <span>${t("profile.phone")}</span>
          <input type="tel" name="phone" required value="${escapeHtml(user?.phone ?? "")}" />
        </label>
        <label class="field">
          <span>${t("profile.email")}</span>
          <input type="email" name="email" required value="${escapeHtml(user?.email ?? "")}" />
        </label>
        <label class="field">
          <span>${t("profile.newPassword")}</span>
          <input type="password" name="password" autocomplete="new-password" placeholder="${t("profile.newPasswordPlaceholder")}" />
        </label>
        <label class="field">
          <span>${t("profile.currentPassword")}</span>
          <input type="password" name="current_password" autocomplete="current-password" placeholder="${t("profile.currentPasswordPlaceholder")}" />
          <small class="field-hint">${t("profile.currentPasswordHint")}</small>
        </label>
        <button type="submit" class="btn btn-primary btn-block">
          <span class="btn-label">${t("profile.save")}</span>
          <span class="btn-spinner" hidden></span>
        </button>
      </form>
      <div class="form">
      <div class="lang-switcher">
        <span class="lang-switcher-label">${Icon.language()} ${t("profile.language")}</span>
        <select id="lang-select" class="lang-select">
          ${LANGUAGES.map((l) => `<option value="${l.code}" ${l.code === lang ? "selected" : ""}>${escapeHtml(l.label)}</option>`).join("")}
        </select>
      </div>

      <div class="lang-switcher">
        <span class="lang-switcher-label">${Icon.theme()} ${t("profile.theme")}</span>
        <select id="theme-select" class="lang-select">
          <option value="auto" ${theme === "auto" ? "selected" : ""}>${t("profile.themeAuto")}</option>
          <option value="light" ${theme === "light" ? "selected" : ""}>${t("profile.themeLight")}</option>
          <option value="dark" ${theme === "dark" ? "selected" : ""}>${t("profile.themeDark")}</option>
        </select>
      </div>

      <div class="color-switcher">
        <span class="lang-switcher-label">${Icon.palette()} ${t("profile.color")}</span>
        <div class="color-swatches">
          ${COLOR_PRESETS.map((hex) => `
            <button type="button" class="color-swatch ${!isPreset ? "" : hex === accentColor ? "color-swatch-active" : ""}"
                    data-color="${hex}" style="background:${hex}" aria-label="${hex}"></button>
          `).join("")}
          <label class="color-swatch color-swatch-custom ${!isPreset ? "color-swatch-active" : ""}"
                 style="background:${!isPreset ? accentColor : "conic-gradient(from 0deg, red, orange, yellow, green, blue, violet, red)"}"
                 title="${t("profile.colorCustom")}">
            <input type="color" id="color-custom-input" value="${accentColor}" />
          </label>
        </div>
      </div>
      </div>
      <div class="form configs">
      <button id="help-btn" class="btn btn-outline btn-block" type="button">
        ${Icon.help()}
        <span class="btn-label">${t("profile.help")}</span>
      </button>

      <button id="about-btn" class="btn btn-outline btn-block" type="button">
        ${Icon.info()}
        <span class="btn-label">${t("profile.about")}</span>
      </button>
      </div>

      <button id="logout-btn" class="btn btn-outline btn-block" type="button">
        ${Icon.logout()}
        <span class="btn-label">${t("profile.logout")}</span>
      </button>
    </div>
  `;
  const form = container2.querySelector("#profile-form");
  const button = form.querySelector("button[type=submit]");
  const logoutBtn = container2.querySelector("#logout-btn");
  container2.querySelector("#lang-select").addEventListener("change", (event) => changeLanguage(event.target.value));
  container2.querySelector("#theme-select").addEventListener("change", (event) => setTheme2(event.target.value));
  const customSwatch = container2.querySelector(".color-swatch-custom");
  const customInput = container2.querySelector("#color-custom-input");
  function markActiveSwatch(hex) {
    container2.querySelectorAll(".color-swatch[data-color]").forEach((swatch) => {
      swatch.classList.toggle("color-swatch-active", swatch.dataset.color === hex);
    });
    const isCustom = !COLOR_PRESETS.includes(hex);
    customSwatch.classList.toggle("color-swatch-active", isCustom);
    if (isCustom)
      customSwatch.style.background = hex;
  }
  container2.querySelectorAll(".color-swatch[data-color]").forEach((swatch) => {
    swatch.addEventListener("click", () => {
      setAccentColor2(swatch.dataset.color);
      markActiveSwatch(swatch.dataset.color);
    });
  });
  customInput.addEventListener("input", () => {
    setAccentColor2(customInput.value);
    markActiveSwatch(customInput.value);
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.password)
      delete data.password;
    const changes = {};
    for (const key of ["name", "phone", "email", "password"]) {
      if (data[key] !== undefined && data[key] !== (user?.[key] ?? "")) {
        changes[key] = data[key];
      }
    }
    if (Object.keys(changes).length === 0) {
      showToast(t("profile.noChanges"), "info");
      return;
    }
    const sensitive = "email" in changes || "password" in changes;
    if (sensitive) {
      if (!data.current_password) {
        shake(form);
        showToast(t("profile.currentPasswordRequired"), "error");
        return;
      }
      changes.current_password = data.current_password;
    }
    setLoading(button, true);
    try {
      await Api.updateMe(changes);
      await refreshUser();
      form.querySelector("input[name=password]").value = "";
      form.querySelector("input[name=current_password]").value = "";
      showToast(t("profile.updated"), "success");
    } catch (error) {
      shake(form);
      showToast(error instanceof ApiError ? error.message : t("errors.generic"), "error");
    } finally {
      setLoading(button, false);
    }
  });
  logoutBtn.addEventListener("click", () => logout());
  container2.querySelector("#help-btn").addEventListener("click", () => navigate("help"));
  container2.querySelector("#about-btn").addEventListener("click", () => navigate("about"));
}

// src/views/about.ts
async function renderAbout(container2, { navigate }) {
  container2.innerHTML = `
    <div class="info-screen">
      <div class="info-header">
        <button class="icon-btn" type="button" id="info-back" aria-label="${t("info.back")}">${Icon.arrowBack()}</button>
        <h1 class="info-title">${t("route.about.title")}</h1>
      </div>

      <center>
        <img class="brand-mark" src="assets/icon.png" alt="" />
        <img class="auth-title" src="assets/title.png" alt"" />
      </center>

      <section class="info-section">
        <p class="info-section-body">${t("about.description")}</p>
      </section>

      <section class="info-section">
        <p class="about-credit">${t("about.developedBy")}</p>
        <p class="about-credit">${t("about.rights")}</p>
        <p class="about-credit about-version">${t("about.version")}</p>
      </section>
    </div>
  `;
  container2.querySelector("#info-back").addEventListener("click", () => navigate("profile"));
}

// src/views/help.ts
var SECTIONS = ["account", "panic", "contacts", "channels", "profile"];
async function renderHelp(container2, { navigate }) {
  container2.innerHTML = `
    <div class="info-screen">
      <div class="info-header">
        <button class="icon-btn" type="button" id="info-back" aria-label="${t("info.back")}">${Icon.arrowBack()}</button>
        <h1 class="info-title">${t("route.help.title")}</h1>
      </div>
      <p class="info-intro">${t("help.intro")}</p>
      ${SECTIONS.map((key) => `
        <section class="info-section">
          <h2 class="info-section-title">${t(`help.section.${key}.title`)}</h2>
          <p class="info-section-body">${t(`help.section.${key}.body`)}</p>
        </section>
      `).join("")}
    </div>
  `;
  container2.querySelector("#info-back").addEventListener("click", () => navigate("profile"));
}

// src/main.ts
var viewEl = document.getElementById("view");
var bottomNav = document.getElementById("bottom-nav");
var navTabs = [...document.querySelectorAll("#bottom-nav .nav-tab")];
var ROUTES = {
  login: { render: renderLogin, titleKey: "route.login.title", public: true },
  register: { render: renderRegister, titleKey: "route.register.title", public: true },
  home: { render: renderHome, title: "Panic Button", public: false },
  contacts: { render: renderContacts, titleKey: "route.contacts.title", public: false },
  profile: { render: renderProfile, titleKey: "route.profile.title", public: false },
  about: { render: renderAbout, titleKey: "route.about.title", public: false },
  help: { render: renderHelp, titleKey: "route.help.title", public: false }
};
function applyStaticLabels() {
  navTabs.forEach((tab) => {
    tab.querySelector(".nav-tab-label").textContent = t(`nav.${tab.dataset.route}`);
  });
  const activeRoute = ROUTES[currentRouteName()];
  if (activeRoute) {
    document.title = activeRoute.title ?? t(activeRoute.titleKey);
  }
}
async function changeLanguage(lang) {
  if (lang === getLanguage())
    return;
  await setLanguage(lang);
  applyStaticLabels();
  await renderCurrentRoute();
}
function navigate(route) {
  window.location.hash = `#/${route}`;
}
async function logout() {
  if (getLiveTrackingState().active) {
    await stopLiveTracking(Api.stopAlert).catch(stopLiveTrackingLocally);
  }
  await clearToken();
  navigate("login");
}
async function refreshUser() {
  const user = await Api.getMe();
  setUser(user);
  return user;
}
function currentRouteName() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return ROUTES[hash] ? hash : null;
}
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function renderCurrentRoute() {
  const loggedIn = Boolean(getUser());
  let name = currentRouteName();
  if (!name) {
    window.location.hash = `#/${loggedIn ? "home" : "login"}`;
    return;
  }
  const route = ROUTES[name];
  if (route.public && loggedIn) {
    window.location.hash = "#/home";
    return;
  }
  if (!route.public && !loggedIn) {
    window.location.hash = "#/login";
    return;
  }
  document.title = route.title ?? t(route.titleKey);
  bottomNav.classList.toggle("hidden", route.public);
  navTabs.forEach((tab) => tab.classList.toggle("nav-tab-active", tab.dataset.route === name));
  viewEl.classList.remove("view-visible");
  await wait(140);
  viewEl.innerHTML = "";
  await route.render(viewEl, {
    navigate,
    logout,
    getUser,
    refreshUser,
    getLanguage,
    changeLanguage,
    getAccentColor,
    setAccentColor,
    getTheme,
    setTheme
  });
  requestAnimationFrame(() => viewEl.classList.add("view-visible"));
}
window.addEventListener("hashchange", renderCurrentRoute);
navTabs.forEach((tab) => tab.addEventListener("click", () => navigate(tab.dataset.route)));
async function boot() {
  initAppUpdates();
  await loadLanguage();
  await loadTheme();
  await loadAccentColor();
  applyStaticLabels();
  const token = await getToken();
  if (token) {
    try {
      await refreshUser();
    } catch {
      await clearToken();
    }
    if (getUser())
      await restoreLiveTracking().catch(() => {});
  }
  await renderCurrentRoute();
  await SplashScreen.hide();
}
boot();
