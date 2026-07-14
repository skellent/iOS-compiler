CREATE TABLE usuarios (
    id              INT          AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    telefono        VARCHAR(20)  NOT NULL UNIQUE,
    correo          VARCHAR(120) NOT NULL UNIQUE,
    contraseña_hash VARCHAR(255) NOT NULL,
    creado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE contactos (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT          NOT NULL,
    nombre     VARCHAR(100) NOT NULL,
    telefono   VARCHAR(20)  NOT NULL,
    correo     VARCHAR(120),
    confirmado BOOLEAN      NOT NULL DEFAULT FALSE,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);


CREATE TABLE alertas (
    id         INT      AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT      NOT NULL,
    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    latitud    DOUBLE   NOT NULL,
    longitud   DOUBLE   NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);
