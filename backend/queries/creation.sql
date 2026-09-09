CREATE DATABASE <Database Name> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER '<Username>'@'localhost' IDENTIFIED BY '<A Password>';

GRANT ALL PRIVILEGES ON <Database Name>.* TO '<Username>'@'localhost';

FLUSH PRIVILEGES;
