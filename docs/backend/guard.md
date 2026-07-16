# `modules/guard.py`

## Propósito

Este módulo aísla todo lo relacionado con el manejo seguro de contraseñas detrás de una clase `Guard` con dos métodos estáticos:

- `Guard.Crear(contraseña)`: convierte una contraseña en texto plano en un hash seguro para almacenar.
- `Guard.Validar(contraseña, hash_guardado)`: verifica si una contraseña en texto plano corresponde a un hash ya almacenado.

## Por qué nunca se guarda la contraseña en texto plano

La tabla `usuarios` (ver `sql.md`) tiene una columna `contraseña_hash`, no `contraseña`. Esto es intencional: si la base de datos llegara a filtrarse, guardar contraseñas en texto plano expondría directamente las credenciales de todos los usuarios de un sistema pensado para situaciones de emergencia personal, donde la confidencialidad es especialmente sensible. En cambio, se guarda únicamente un hash del que, en teoría, no se puede recuperar la contraseña original.

## Por qué bcrypt en vez de un hash genérico (SHA-256, MD5, etc.)

`Guard` usa `passlib.context.CryptContext` configurado con `schemes=["bcrypt"]`. La elección de bcrypt (en vez de un hash criptográfico genérico) responde a que bcrypt está diseñado deliberadamente para ser **lento y costoso de computar**, con un factor de costo ajustable. Esto es justo lo que se necesita para contraseñas: un atacante que obtenga la base de datos y quiera probar contraseñas por fuerza bruta se ve limitado por ese costo computacional, algo que un hash rápido como SHA-256 no ofrece (fue diseñado para velocidad, no para resistir este tipo de ataque).

El parámetro `deprecated="auto"` le dice a `passlib` que, si en el futuro se agrega un esquema de hash más nuevo a la lista de `schemes`, los hashes generados con el esquema anterior se sigan aceptando como válidos pero se marquen como "a migrar". Esto permite endurecer el algoritmo de hashing en el futuro sin invalidar de golpe las contraseñas ya almacenadas.

## Por qué `bcrypt<4.1` en `pyproject.toml`

En `backend/pyproject.toml` la dependencia está fijada como `"bcrypt<4.1"`. Esto no es arbitrario: versiones de `bcrypt` iguales o posteriores a la 4.1 cambiaron detalles internos del paquete que rompen la forma en que `passlib` (en su versión 1.7.4, usada aquí) detecta la versión del backend de bcrypt instalado, lo que provoca errores o advertencias al hashear contraseñas. Fijar el techo de versión evita ese problema de compatibilidad conocido entre ambas librerías.

## Métodos estáticos, no instancias

`Crear` y `Validar` son `@staticmethod`: `Guard` no necesita guardar estado propio entre llamadas (el `CryptContext` vive a nivel de módulo y es compartido), así que no tiene sentido instanciar un objeto `Guard()` para usarlos. Se llaman directamente como `Guard.Crear(...)`.

## Relación con el resto del backend

`Guard` se usa en dos puntos distintos de `modules/routers/` (ver `routers.md`):

- `auth.py` llama a `Guard.Crear(data.contraseña)` justo antes de insertar un nuevo usuario (`POST /auth/registro`) y también dentro de `PUT /usuarios/me` cuando el cliente decide cambiar su contraseña (`usuarios.py`), de modo que el valor que llega a la base de datos es siempre el hash, nunca la contraseña original.
- `auth.py` llama a `Guard.Validar(data.contraseña, fila["contraseña_hash"])` dentro de `POST /auth/login`: trae el hash guardado con `Querys.SELECT_USUARIO_POR_CORREO` (ver `cursor.md`) y compara la contraseña en texto plano que mandó el cliente contra ese hash. Si coincide, se emite un JWT con `Token.Crear` (ver `token.md`); si no, el endpoint responde `401 Unauthorized` sin dar más detalle sobre si el correo existe o la contraseña es la que falló, para no ayudar a alguien a enumerar qué correos están registrados.

Con esto, los dos métodos de `Guard` que existían desde el principio del proyecto ya están en uso.
