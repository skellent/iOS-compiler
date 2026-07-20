# `querys/` — Scripts SQL

Este directorio contiene el SQL necesario para preparar y poblar la base de datos de PanicSwitch. No es código Python que se ejecute automáticamente: son scripts que un administrador corre manualmente contra MariaDB, en el orden descrito en el README principal (sección "1. Configurar MariaDB").

## `creation.sql` — provisión inicial

```sql
CREATE DATABASE <Nombre de base de datos> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER '<Nombre de Usuario>'@'localhost' IDENTIFIED BY '<Una contraseña>';
GRANT ALL PRIVILEGES ON panic_dev.* TO '<Nombre de Usuario>'@'localhost';
FLUSH PRIVILEGES;
```

Este script se ejecuta una única vez, como usuario `root` de MariaDB, y resuelve dos decisiones de diseño:

- **`utf8mb4` / `utf8mb4_unicode_ci`**: se elige explícitamente sobre el `latin1` o `utf8` (de 3 bytes) que MariaDB podría usar por defecto, porque los datos de la aplicación (nombres, correos) están en español y pueden incluir tildes, la letra "ñ" y, potencialmente, emojis desde un cliente móvil. `utf8mb4` es el único de los tres que representa correctamente el conjunto completo de caracteres Unicode.
- **Un usuario de base de datos dedicado, no `root`**: se crea un usuario propio con privilegios acotados a la base de datos del proyecto (`panic_dev`), en vez de que el backend se conecte con las credenciales de administrador. Es una aplicación directa del principio de menor privilegio: si las credenciales del backend (guardadas en `.env`) se filtran, el daño queda contenido a esa única base de datos.

Los marcadores `<...>` son placeholders a rellenar por quien despliega el proyecto; los valores reales nunca deben quedar versionados en este archivo (de ahí que `.env` esté en `.gitignore`).

## `tables.sql` — esquema de datos

Define las tres tablas que modelan el dominio de la aplicación.

### `usuarios`

```sql
CREATE TABLE usuarios (
    id              INT          AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    telefono        VARCHAR(20)  NOT NULL UNIQUE,
    correo          VARCHAR(120) NOT NULL UNIQUE,
    contraseña_hash VARCHAR(255) NOT NULL,
    creado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Es la tabla central: cada fila es una persona registrada en la app. Algunas decisiones a resaltar:

- `telefono` y `correo` son `UNIQUE`: cada número de teléfono y cada correo solo puede pertenecer a una cuenta. Esto previene registros duplicados y es coherente con que, en una app de botón de pánico, el teléfono es probablemente el identificador que otros sistemas (SMS, llamadas) usarán para ubicar a un usuario.
- `contraseña_hash VARCHAR(255)`: el tamaño generoso no es casualidad — los hashes de bcrypt (ver `guard.md`) tienen un formato de longitud fija conocida, pero dejar margen evita tener que migrar el esquema si el algoritmo de hashing cambia en el futuro (por ejemplo, a Argon2, cuyos hashes son más largos).
- `creado_en DATETIME DEFAULT CURRENT_TIMESTAMP`: se registra automáticamente cuándo se creó la cuenta, sin que la aplicación tenga que enviarlo explícitamente en cada `INSERT` (de hecho, `Querys.INSERT_USUARIO` en `cursor.py` no incluye esta columna).

### `contactos`

```sql
CREATE TABLE contactos (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT          NOT NULL,
    nombre     VARCHAR(100) NOT NULL,
    telefono   VARCHAR(20)  NOT NULL,
    correo     VARCHAR(120),
    confirmado BOOLEAN      NOT NULL DEFAULT FALSE,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);
```

Representa los **contactos de emergencia** de cada usuario: las personas que deben ser notificadas cuando se activa una alerta. Es una relación uno-a-muchos con `usuarios` mediante la clave foránea `id_usuario`.

- `correo` es nullable a diferencia de `usuarios.correo`: un contacto de emergencia puede ser alcanzable solo por teléfono (por ejemplo, vía SMS), sin que eso impida registrarlo.
- `confirmado BOOLEAN DEFAULT FALSE`: existe porque agregar a alguien como contacto de emergencia no debería depender únicamente de la palabra del usuario que lo registra — esa persona probablemente deba confirmar (por ejemplo, respondiendo un mensaje o correo de verificación) que acepta recibir alertas en su nombre. El valor por defecto `FALSE` refleja que ese consentimiento no se asume, se otorga explícitamente en un paso posterior. Ese paso ya está implementado (ver `correo.md`, `token.md` y `routers.md`): `POST /contactos` manda un correo con un link de confirmación cuando el contacto tiene `correo`, y `GET /contactos/confirmar/{token}` es quien efectivamente pone esta columna en `TRUE`. Un contacto creado sin `correo` (recordar que es el único campo opcional de `Contacto`, ver `types.md`) sigue quedando en `FALSE` indefinidamente, porque hoy no existe otro canal (SMS, por ejemplo) para confirmarlo.

### `alertas`

```sql
CREATE TABLE alertas (
    id         INT      AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT      NOT NULL,
    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    latitud    DOUBLE   NOT NULL,
    longitud   DOUBLE   NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);
```

Es el registro histórico de cada vez que un usuario activa el botón de pánico: qué usuario, cuándo (`fecha_hora`, con el mismo patrón de `DEFAULT CURRENT_TIMESTAMP` que `usuarios.creado_en`) y dónde (`latitud`/`longitud` como `DOUBLE`, la precisión estándar para coordenadas GPS). Esta tabla es, en cierto sentido, la razón de ser del proyecto: las otras dos tablas existen para poder responder correctamente cuando aquí se inserta una fila.

Desde que se agregó el CRUD de contactos (ver `routers.md`), esta tabla ya se lee y escribe activamente: `POST /contactos`, `GET /contactos`, `GET /contactos/confirmar/{token}` y `PUT /contactos/{id}`. A diferencia de antes, `confirmado` ya no es un campo que ningún endpoint toque: `GET /contactos/confirmar/{token}` la pone en `TRUE` cuando el contacto hace clic en el link que le llegó por correo (ver `correo.md`).

`alertas` ya tampoco es solo un esquema preparado con anticipación: `POST /alertas` (ver `routers.md`) inserta acá una fila por cada vez que se activa el botón de pánico, y usa exactamente esa fila (`id_usuario`, `latitud`, `longitud`) para armar la notificación que le llega a los contactos de emergencia **confirmados** de ese usuario (ver `correo.md`). El vínculo entre `confirmado` y esta tabla es, en el fondo, el motivo de ser de esa columna: un contacto que nunca aceptó recibir alertas no debería empezar a recibirlas justo en el momento más crítico, así que `POST /alertas` filtra por `confirmado = TRUE` antes de notificar a nadie (`Querys.SELECT_CONTACTOS_CONFIRMADOS_POR_USUARIO`, ver `cursor.md`). Notificar por SMS (además de o en vez de correo) sigue pendiente de la integración con Twilio (ver `TASK.md`).

## `insertions.sql` — datos de ejemplo

```sql
INSERT INTO usuarios (...) VALUES ('Nombre Apellido', '+1234567891233', 'nombre@example.com', '$2b$12$...hashdeejemplo');
INSERT INTO contactos (...) VALUES (1, 'María Pérez', ...), (1, 'Carlos Pérez', ...);
INSERT INTO alertas (id_usuario, latitud, longitud) VALUES (1, 10.4880600, -66.8791500);
```

No es un script que la aplicación ejecute: es material de referencia, mencionado en el README, para que quien configura el entorno por primera vez pueda ver un ejemplo concreto del formato esperado por cada tabla (incluyendo cómo luce un hash de bcrypt real) y, opcionalmente, sembrar datos de prueba en un entorno de desarrollo local. El hash de contraseña que aparece ahí es un valor de ejemplo, no corresponde a una contraseña real utilizable.
