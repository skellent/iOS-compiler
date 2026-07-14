CREATE DATABASE <Nombre de base de datos> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER '<Nombre de Usuario>'@'localhost' IDENTIFIED BY '<Una contraseña>';

GRANT ALL PRIVILEGES ON panic_dev.* TO '<Nombre de Usuario>'@'localhost';

FLUSH PRIVILEGES;
