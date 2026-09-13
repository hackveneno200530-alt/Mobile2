-- Base de datos para el login/registro de la app Ionic
CREATE DATABASE IF NOT EXISTS ionic_login CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ionic_login;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Primera carga: usuario de prueba para poder iniciar sesion de inmediato.
-- Credenciales:  email: demo@example.com   password: Demo1234!
-- (el hash de abajo es bcrypt real de "Demo1234!", generado y verificado
-- para que funcione directamente con password_verify() en login.php)
INSERT INTO users (name, email, password) VALUES
  ('Usuario Demo', 'demo@example.com', '$2b$10$YV98ZpI8VN5gaSzGGN03XeWjLNwkKH5QVXRFIezOb8HELWXXTZiqG')
ON DUPLICATE KEY UPDATE email = email;
