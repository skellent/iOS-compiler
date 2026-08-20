# Cambio de dominio

La URL pública aparece en varios sitios — enlaces de confirmación, los webhooks de Telegram y WhatsApp, el bundle de la app. Esta es la lista completa cuando cambia (por ejemplo de `old.example.com` a `new.example.com`).

La única fuente de verdad en el backend es **`API_BASE_URL`**. Acierta con eso y casi todo lo demás sigue.

## 1. `.env` del backend

```bash
API_BASE_URL='https://new.example.com'
```

Debe ser la URL pública **HTTPS**, sin barra final. Reinicia el backend. Esto arregla de inmediato:

- los **enlaces de confirmación** de cuenta y contacto en los correos,
- los **enlaces del mapa** de las alertas (`/alerts/view/…`),
- el **enlace de opt-in de WhatsApp** que se entrega a la app,
- las URLs canónicas de landing/panel.

## 2. Webhook de Telegram — automático

Al reiniciar, el backend re-registra el webhook de Telegram a `API_BASE_URL/telegram/webhook` y verifica que quedó (con reintentos). Nada manual — solo confirma el log de arranque:

```
Telegram webhook status: url=https://new.example.com/telegram/webhook last_error=none
```

Si muestra la URL vieja o un error, la tarea keeper también lo re-afirma periódicamente; un reinicio es el arreglo más rápido.

## 3. Webhook de WhatsApp — manual

Twilio **no** aprende la URL nueva por sí solo. En la Consola de Twilio, en el WhatsApp Sender (o su Messaging Service), actualiza **"When a message comes in"**:

```
https://new.example.com/whatsapp/webhook     (POST)
```

Debe coincidir exactamente con `API_BASE_URL` + `/whatsapp/webhook`, o la validación de firma rechaza los opt-in de entrada con `403`. (SMS no tiene webhook de entrada, así que ahí no hay nada que cambiar.)

## 4. Proxy inverso / TLS

- Apunta el `server_name` de nginx al nuevo dominio y emite un certificado TLS para él.
- Sigue corriendo Uvicorn con `--proxy-headers` para que el backend vea el HTTPS y la IP real del cliente.

## 5. La app móvil

La app carga su UI del backend, y `API_BASE_URL` se **hornea en el bundle JS al compilar**. Tras un cambio de dominio, recompila y redespliega el bundle:

```bash
cd app
API_BASE_URL='https://new.example.com' bun run build   # regenera www/js/main.js
```

El backend sirve `app/www` en `/app`, así que redesplegar el backend publica el nuevo bundle; las apps instaladas lo toman al siguiente arranque (el hash de contenido de `/app/manifest` dispara la recarga). **Solo hace falta recompilar el APK** si cambia la URL de inicio del contenedor nativo en sí — un cambio de dominio puro que mantiene la misma app se cubre recompilando el bundle.

## Lista rápida

- [ ] `API_BASE_URL` actualizado, backend reiniciado
- [ ] El log de arranque muestra el webhook de Telegram en la URL nueva
- [ ] "When a message comes in" de WhatsApp actualizado en Twilio
- [ ] `server_name` de nginx + certificado TLS para el nuevo dominio
- [ ] Bundle de la app recompilado con el nuevo `API_BASE_URL` y redesplegado
- [ ] Prueba de humo: registrarse → el enlace de confirmación resuelve; el opt-in de WhatsApp de un contacto confirma; el enlace del mapa de una alerta abre
