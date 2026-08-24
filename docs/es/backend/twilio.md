# Configuración de Twilio — WhatsApp y SMS

Los canales de WhatsApp y SMS pasan por **Twilio**. Comparten `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN` (del panel de la Consola de Twilio) y cada uno agrega su propio remitente.

- **SMS** es simple: compra un número, pon `TWILIO_SMS_FROM`, listo.
- **WhatsApp** es más estricto: WhatsApp solo permite texto libre dentro de las 24 h posteriores a que el *contacto* te escriba. Una alerta de pánico casi siempre ocurre fuera de esa ventana, así que debe enviarse por una **plantilla aprobada**. Eso implica un sender de WhatsApp real **y** una plantilla aprobada.

---

## SMS

1. En la Consola de Twilio, compra un número con capacidad **SMS** (*Phone Numbers → Buy a number*).
2. Ponlo en `.env` (E.164, sin espacios/paréntesis):
   ```bash
   TWILIO_SMS_FROM='+15102964314'
   TWILIO_SMS_ENABLED='true'
   ```
3. Reinicia, activa **SMS** en un contacto en la app, dispara una alerta.

No hay opt-in, plantilla ni ventana de 24 h para SMS. Dos cosas a saber:

- Los **números de EE.UU./Canadá** requieren registro **A2P 10DLC** (o un número **toll-free** verificado) antes de que las operadoras entreguen SMS automatizado de forma fiable. Comprar el número **no** lo registra — hazlo en *Messaging → Regulatory Compliance*. Un número de otro país normalmente no necesita nada de esto.
- Los **destinos internacionales están geo-restringidos.** Enviar a un país que Twilio tiene deshabilitado devuelve el error **21408**; habilita la región en *Messaging → Settings → Geo Permissions*. Aun así, la entrega a algunos países es poco fiable — prefiere Telegram/WhatsApp para contactos en el extranjero.

---

## WhatsApp

### Paso 1 — un WhatsApp Sender

El número debe aparecer como **WhatsApp Sender** aprobado en Twilio (*Messaging → Senders → WhatsApp senders*). Si fue aprobado en Meta pero aún no está enlazado a Twilio, crea el sender ahí y conecta la Meta Business Account (WABA) por el embedded signup. Requisitos: cuenta de Twilio de pago, un Meta Business Manager y un número **que no** esté actualmente en la app de WhatsApp.

El **sandbox** (`whatsapp:+14155238886`) sirve para probar el cableado pero no puede usar plantillas personalizadas — producción necesita un sender real.

### Paso 2 — la plantilla de la alerta

*Messaging → Content Template Builder → Create*:

- Tipo **Text**, categoría **Utility**, idioma **`en`** (el texto de la plantilla va en inglés).
- Cuerpo, con tres variables **en este orden exacto**:

  > 🚨 {{1}} triggered a panic alert on {{2}}. Location: {{3}}

- Envía a aprobación de WhatsApp, espera **Approved**, copia el id `HX…`.

El backend rellena las variables con un contrato fijo — no cambies el número ni el orden:

| Variable | Se rellena con |
|---|---|
| `{{1}}` | el nombre del usuario |
| `{{2}}` | fecha y hora (`MM/DD/YYYY HH:MM:SS`) |
| `{{3}}` | el enlace de ubicación de Google Maps |

### Paso 3 — el webhook de entrada (opt-in)

A diferencia de Telegram, el webhook de WhatsApp **no** se registra solo — configúralo a mano en el sender (o su Messaging Service), campo **"When a message comes in"**:

```
https://TU-DOMINIO/whatsapp/webhook     (POST)
```

Así llega el opt-in del contacto al backend. Debe coincidir exactamente con `API_BASE_URL` + `/whatsapp/webhook`, porque `TWILIO_VALIDATE_SIGNATURE=true` valida la firma de Twilio contra esa URL.

### Paso 4 — configurar y probar

```bash
TWILIO_ACCOUNT_SID='AC...'
TWILIO_AUTH_TOKEN='...'
TWILIO_WHATSAPP_FROM='whatsapp:+<tu número>'
TWILIO_WHATSAPP_TEMPLATE_SID='HX...'
TWILIO_WHATSAPP_JOIN_KEYWORD=''          # solo sandbox; vacío en producción
TWILIO_WHATSAPP_ENABLED='true'
TWILIO_VALIDATE_SIGNATURE='true'
```

Luego:

1. Activa **WhatsApp** en un contacto en la app — devuelve un enlace `wa.me`.
2. El contacto abre el enlace y **envía** el mensaje. El webhook lo confirma (`whatsapp_confirmed`); el log muestra `WhatsApp opt-in confirmed for contacts […]`.
3. Dispara una alerta — llega por la plantilla, sin importar la ventana de 24 h.

### Resolución de problemas

| Síntoma | Causa / arreglo |
|---|---|
| `21654 / 63016 "ContentSid required"` | Alerta enviada como texto libre fuera de las 24 h. Pon `TWILIO_WHATSAPP_TEMPLATE_SID` con una plantilla aprobada. |
| Ningún log del webhook | "When a message comes in" sin configurar (o en el sender equivocado). |
| `received inbound … no whatsapp-enabled contact matches …` | El contacto escribió desde un número distinto al `phone` guardado, o WhatsApp no está activado para él. |
| `/features` da `"whatsapp": false` | Falta `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM`. |
| El webhook devuelve `403` | La URL registrada ≠ `API_BASE_URL` + `/whatsapp/webhook`, o no es HTTPS. |
