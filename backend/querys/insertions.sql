INSERT INTO usuarios (nombre, telefono, correo, contraseña_hash) VALUES (
    'Nombre Apellido',
    '+1234567891233',
    'nombre@example.com',
    '$2b$12$KIXQ7z8vN3f9wJmR5tYkOuL8x4PqEjabc123456789hashdeejemplo'
);


INSERT INTO contactos (id_usuario, nombre, telefono, correo, confirmado) VALUES
(   1,
    'María Pérez',
    '+584241234567',
    'maria@example.com',
    TRUE),
(   1,
    'Carlos Pérez',
    '+584161234567',
    NULL,
    FALSE);


INSERT INTO alertas (id_usuario, latitud, longitud) VALUES (1, 10.4880600, -66.8791500);
