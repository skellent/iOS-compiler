import { Preferences } from "@capacitor/preferences";

const LANG_KEY = "panicbutton.lang";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt-BR", label: "Português (Brasil)" },
];
const SUPPORTED = LANGUAGES.map((l) => l.code);

const STRINGS = {
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

    "contacts.empty":
      "No emergency contacts yet. Tap the + button to add someone who should be notified when you trigger a panic alert.",
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
    "contacts.emailHint":
      "We'll send this contact a confirmation link by email — only confirmed contacts are notified during a panic alert.",
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
    "help.section.account.body":
      "Register with your name, phone, email and a password. We'll send a confirmation link to your email — open it on this device to activate your account, then come back and log in.",
    "help.section.panic.title": "Sending a panic alert",
    "help.section.panic.body":
      "On the Home screen, press and hold the SOS button for about a second and a half — a ring fills around it as you hold, and releasing early cancels it. Once the hold completes, the app gets your current location and notifies every confirmed emergency contact by email and, for contacts who've linked it, Telegram.",
    "help.section.contacts.title": "Managing emergency contacts",
    "help.section.contacts.body":
      "On the Contacts tab, tap the + button to add someone, either by picking them from your phone's address book or entering their details manually. Tap any existing contact to edit their details, connect or disconnect Telegram, or remove them.",
    "help.section.channels.title": "Confirmed vs. pending contacts",
    "help.section.channels.body":
      "Adding a contact doesn't notify them automatically — each contact shows a mail icon and, where available, a Telegram icon; a lit icon means that channel is confirmed and will receive alerts, a dim one means it isn't yet. Email is confirmed by the contact clicking the link we send them; Telegram is confirmed the moment they open the link and press Start in the chat with our bot.",
    "help.section.profile.title": "Your profile",
    "help.section.profile.body":
      "Update your name, phone, email or password from the Profile tab. You can also change the app's language and accent color from there — both are saved only on this device.",

    "about.description":
      "Panic Button is a personal safety app: press and hold one button to share your location and alert your trusted emergency contacts by email and Telegram, the moment you need them most.",
    "about.developedBy": "Developed by Skellent",
    "about.rights": "© Keycodelogics. All rights reserved.",
    "about.version": "Version BETA",
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

    "contacts.empty":
      "Todavía no tienes contactos de emergencia. Toca el botón + para agregar a alguien que deba ser notificado cuando actives una alerta de pánico.",
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
    "contacts.emailHint":
      "Le enviaremos a este contacto un enlace de confirmación por correo — solo los contactos confirmados son notificados durante una alerta de pánico.",
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
    "help.section.account.body":
      "Registrate con tu nombre, teléfono, correo y una contraseña. Te enviaremos un enlace de confirmación a tu correo — ábrelo en este dispositivo para activar tu cuenta y luego volvé a iniciar sesión.",
    "help.section.panic.title": "Enviar una alerta de pánico",
    "help.section.panic.body":
      "En la pantalla de Inicio, mantené presionado el botón SOS durante aproximadamente un segundo y medio — un anillo se completa alrededor del botón mientras lo mantenés presionado, y soltarlo antes lo cancela. Al completarse, la app obtiene tu ubicación actual y notifica a cada contacto de emergencia confirmado por correo y, para quienes hayan vinculado Telegram, también por ahí.",
    "help.section.contacts.title": "Gestionar contactos de emergencia",
    "help.section.contacts.body":
      "En la pestaña Contactos, tocá el botón + para agregar a alguien, ya sea eligiéndolo de la agenda de tu teléfono o ingresando sus datos manualmente. Tocá cualquier contacto existente para editar sus datos, conectar o desconectar Telegram, o eliminarlo.",
    "help.section.channels.title": "Contactos confirmados vs. pendientes",
    "help.section.channels.body":
      "Agregar un contacto no lo notifica automáticamente — cada contacto muestra un ícono de correo y, cuando está disponible, uno de Telegram; un ícono iluminado significa que ese canal está confirmado y recibirá alertas, uno apagado significa que todavía no. El correo se confirma cuando el contacto hace clic en el enlace que le enviamos; Telegram se confirma en el momento en que abre el enlace y presiona Iniciar en el chat con nuestro bot.",
    "help.section.profile.title": "Tu perfil",
    "help.section.profile.body":
      "Actualizá tu nombre, teléfono, correo o contraseña desde la pestaña Perfil. También podés cambiar el idioma y el color de la app desde ahí — ambos se guardan solo en este dispositivo.",

    "about.description":
      "Panic Button es una app de seguridad personal: mantené presionado un botón para compartir tu ubicación y alertar a tus contactos de confianza por correo y Telegram, en el momento en que más los necesitás.",
    "about.developedBy": "Desarrollado por Skellent",
    "about.rights": "© Keycodelogics. Todos los derechos reservados.",
    "about.version": "Versión BETA",
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
    "confirmMail.subtitle":
      'Enviamos um link de confirmação para<br /><span class="confirm-mail-email">{email}</span>. Abra-o neste dispositivo para ativar sua conta e depois volte para entrar.',
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

    "contacts.empty":
      "Você ainda não tem contatos de emergência. Toque no botão + para adicionar alguém que deva ser notificado quando você acionar um alerta de pânico.",
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
    "contacts.emailHint":
      "Enviaremos a este contato um link de confirmação por e-mail — apenas contatos confirmados são notificados durante um alerta de pânico.",
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
    "contacts.telegramLinkReady": "Link do Telegram pronto — compartilhe com seu contato.",
    "contacts.telegramShareText": "Vincule-me no Telegram para receber meus alertas do Panic Button:",
    "contacts.whatsappShareText": "Envie-me uma mensagem no WhatsApp para receber meus alertas do Panic Button:",
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
    "help.section.account.body":
      "Registre-se com seu nome, telefone, e-mail e uma senha. Enviaremos um link de confirmação ao seu e-mail — abra-o neste dispositivo para ativar sua conta e depois volte para entrar.",
    "help.section.panic.title": "Enviar um alerta de pânico",
    "help.section.panic.body":
      "Na tela Início, mantenha pressionado o botão SOS por cerca de um segundo e meio — um anel se preenche ao redor do botão enquanto você o pressiona, e soltar antes cancela o envio. Ao completar, o app obtém sua localização atual e notifica cada contato de emergência confirmado por e-mail e, para quem vinculou o Telegram, também por lá.",
    "help.section.contacts.title": "Gerenciar contatos de emergência",
    "help.section.contacts.body":
      "Na aba Contatos, toque no botão + para adicionar alguém, escolhendo da agenda do seu telefone ou digitando os dados manualmente. Toque em qualquer contato existente para editar seus dados, conectar ou desconectar o Telegram, ou removê-lo.",
    "help.section.channels.title": "Contatos confirmados vs. pendentes",
    "help.section.channels.body":
      "Adicionar um contato não o notifica automaticamente — cada contato mostra um ícone de e-mail e, quando disponível, um de Telegram; um ícone aceso significa que aquele canal está confirmado e receberá alertas, um apagado significa que ainda não. O e-mail é confirmado quando o contato clica no link que enviamos; o Telegram é confirmado no momento em que ele abre o link e aperta Iniciar na conversa com nosso bot.",
    "help.section.profile.title": "Seu perfil",
    "help.section.profile.body":
      "Atualize seu nome, telefone, e-mail ou senha na aba Perfil. Você também pode mudar o idioma e a cor do app por lá — ambos são salvos apenas neste dispositivo.",

    "about.description":
      "Panic Button é um app de segurança pessoal: mantenha pressionado um botão para compartilhar sua localização e alertar seus contatos de confiança por e-mail e Telegram, no momento em que você mais precisar deles.",
    "about.developedBy": "Desenvolvido por Skellent",
    "about.rights": "© Keycodelogics. Todos os direitos reservados.",
    "about.version": "Versão BETA",
  },
};

let currentLang = "en";

function detectLanguage() {
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en") || "en";
  const lower = nav.toLowerCase();

  if (lower.startsWith("pt")) return "pt-BR";
  if (lower.startsWith("es")) return "es";
  return "en";
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

export function t(key: string, vars?: Record<string, string | number>) {
  const template = STRINGS[currentLang]?.[key] ?? STRINGS.en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? ""));
}
// TypeScript source.
