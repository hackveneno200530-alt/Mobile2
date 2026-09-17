-- =====================================================================
-- ESQUEMA RELACIONAL — E-COMMERCE DEL RÍO CAPS (MySQL 8.0+ / InnoDB)
-- Motor: InnoDB (obligatorio: soporta transacciones, FKs, row-locking)
-- Aislamiento por defecto asumido: REPEATABLE READ (default InnoDB)
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS delrio_ecommerce
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE delrio_ecommerce;

-- ---------------------------------------------------------------------
-- USERS
-- password_hash: SIEMPRE hash (bcrypt/argon2id), nunca texto plano.
-- email: tipo estricto + UNIQUE, valida formato a nivel app (no en CHECK
--        por compatibilidad de motor), longitud acotada.
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email             VARCHAR(190)      NOT NULL,
  password_hash     VARCHAR(255)      NOT NULL,   -- bcrypt/argon2id (60-97 chars)
  first_name        VARCHAR(80)       NOT NULL,
  last_name         VARCHAR(80)       NOT NULL,
  phone             VARCHAR(20)       NULL,
  role              ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  status            ENUM('active','disabled') NOT NULL DEFAULT 'active',
  failed_login_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until      DATETIME          NULL,
  created_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT chk_users_email_len CHECK (CHAR_LENGTH(email) >= 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_users_role_status ON users (role, status);

-- Primera carga: usuario de prueba para poder iniciar sesion de inmediato.
-- Credenciales:  email: demo@example.com   password: Demo1234!
-- (hash bcrypt real, generado y verificado con bcryptjs antes de
-- insertarlo, para que funcione directamente con password_verify()).
INSERT INTO users (email, password_hash, first_name, last_name) VALUES
  ('demo@example.com', '$2b$10$YV98ZpI8VN5gaSzGGN03XeWjLNwkKH5QVXRFIezOb8HELWXXTZiqG', 'Usuario', 'Demo')
ON DUPLICATE KEY UPDATE email = email;

-- ---------------------------------------------------------------------
-- PASSWORD RESET / TOKENS DE SESIÓN
-- Se almacena el HASH del token (sha256), nunca el token en claro.
-- El valor en claro solo existe en memoria/URL del correo enviado.
-- ---------------------------------------------------------------------
CREATE TABLE password_reset_tokens (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  token_hash    CHAR(64)        NOT NULL,   -- SHA-256 hex del token
  expires_at    DATETIME        NOT NULL,
  used_at       DATETIME        NULL,
  ip_address    VARBINARY(16)   NULL,       -- INET6_ATON()
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_reset_token_hash UNIQUE (token_hash),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_reset_user_expires ON password_reset_tokens (user_id, expires_at);

-- ---------------------------------------------------------------------
-- DIRECCIONES (PII normalizada, separada de users)
-- ---------------------------------------------------------------------
CREATE TABLE user_addresses (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  label         VARCHAR(40)     NOT NULL DEFAULT 'default',
  recipient     VARCHAR(120)    NOT NULL,
  line1         VARCHAR(160)    NOT NULL,
  line2         VARCHAR(160)    NULL,
  city          VARCHAR(80)     NOT NULL,
  state         VARCHAR(80)     NOT NULL,
  postal_code   VARCHAR(12)     NOT NULL,
  country_code  CHAR(2)         NOT NULL DEFAULT 'MX',
  phone         VARCHAR(20)     NULL,
  is_default    TINYINT(1)      NOT NULL DEFAULT 0,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_address_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_addresses_user ON user_addresses (user_id);

-- ---------------------------------------------------------------------
-- CATEGORIES (jerárquica: Ropa / Gorras / Calzado / Perfumes + subcat.)
-- ---------------------------------------------------------------------
CREATE TABLE categories (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id     INT UNSIGNED    NULL,
  name          VARCHAR(80)     NOT NULL,
  slug          VARCHAR(100)    NOT NULL,
  CONSTRAINT uq_categories_slug UNIQUE (slug),
  CONSTRAINT fk_category_parent FOREIGN KEY (parent_id)
    REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_categories_parent ON categories (parent_id);

-- ---------------------------------------------------------------------
-- PRODUCTS (entidad conceptual; el stock vive en variantes)
-- ---------------------------------------------------------------------
CREATE TABLE products (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id   INT UNSIGNED    NOT NULL,
  sku_base      VARCHAR(40)     NOT NULL,
  name          VARCHAR(160)    NOT NULL,
  description   TEXT            NULL,
  brand         VARCHAR(80)     NULL,
  base_price    DECIMAL(10,2)   NOT NULL,
  active        TINYINT(1)      NOT NULL DEFAULT 1,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_products_sku_base UNIQUE (sku_base),
  CONSTRAINT fk_product_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT chk_products_price CHECK (base_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_products_category ON products (category_id);
CREATE INDEX idx_products_name ON products (name);
CREATE FULLTEXT INDEX ftx_products_name_desc ON products (name, description);

-- ---------------------------------------------------------------------
-- PRODUCT_VARIANTS (talla/color/ml — unidad real de venta e inventario)
-- ---------------------------------------------------------------------
CREATE TABLE product_variants (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id     BIGINT UNSIGNED NOT NULL,
  sku            VARCHAR(60)     NOT NULL,
  size           VARCHAR(20)     NULL,        -- ropa/calzado/gorras
  color          VARCHAR(40)     NULL,
  volume_ml      SMALLINT UNSIGNED NULL,      -- perfumes
  price          DECIMAL(10,2)   NOT NULL,
  active         TINYINT(1)      NOT NULL DEFAULT 1,
  CONSTRAINT uq_variants_sku UNIQUE (sku),
  CONSTRAINT fk_variant_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT chk_variants_price CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_variants_product ON product_variants (product_id);

-- ---------------------------------------------------------------------
-- INVENTORY (1:1 con variante) — núcleo del control de concurrencia.
-- quantity: stock disponible real.
-- reserved: apartado por carritos/checkouts en curso (evita sobreventa
--           visual antes de confirmar pago).
-- version: contador para control OPTIMISTA alternativo (ver script de
--          checkout, opción B, al final de este archivo).
-- ---------------------------------------------------------------------
CREATE TABLE inventory (
  variant_id     BIGINT UNSIGNED PRIMARY KEY,
  quantity       INT UNSIGNED    NOT NULL DEFAULT 0,
  reserved       INT UNSIGNED    NOT NULL DEFAULT 0,
  version        INT UNSIGNED    NOT NULL DEFAULT 0,
  updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_variant FOREIGN KEY (variant_id)
    REFERENCES product_variants(id) ON DELETE CASCADE,
  CONSTRAINT chk_inventory_quantity CHECK (quantity >= 0),
  CONSTRAINT chk_inventory_reserved CHECK (reserved >= 0 AND reserved <= quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- CARTS / CART_ITEMS
-- ---------------------------------------------------------------------
CREATE TABLE carts (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NULL,          -- NULL = carrito de invitado
  session_token CHAR(64)        NULL,          -- hash de sesión anónima
  status        ENUM('open','converted','abandoned') NOT NULL DEFAULT 'open',
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_carts_user_status ON carts (user_id, status);
CREATE INDEX idx_carts_session ON carts (session_token);

CREATE TABLE cart_items (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cart_id       BIGINT UNSIGNED NOT NULL,
  variant_id    BIGINT UNSIGNED NOT NULL,
  quantity      INT UNSIGNED    NOT NULL,
  unit_price    DECIMAL(10,2)   NOT NULL,   -- snapshot al agregar
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_cart_variant UNIQUE (cart_id, variant_id),
  CONSTRAINT fk_cartitem_cart FOREIGN KEY (cart_id)
    REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cartitem_variant FOREIGN KEY (variant_id)
    REFERENCES product_variants(id) ON DELETE RESTRICT,
  CONSTRAINT chk_cartitem_qty CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_cartitems_cart ON cart_items (cart_id);

-- ---------------------------------------------------------------------
-- ORDERS / ORDER_ITEMS
-- ---------------------------------------------------------------------
CREATE TABLE orders (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id             BIGINT UNSIGNED NOT NULL,
  shipping_address_id BIGINT UNSIGNED NOT NULL,
  billing_address_id  BIGINT UNSIGNED NOT NULL,
  status  ENUM('pending','paid','processing','shipped','delivered','cancelled','refunded')
                       NOT NULL DEFAULT 'pending',
  subtotal            DECIMAL(10,2)   NOT NULL,
  shipping_cost       DECIMAL(10,2)   NOT NULL DEFAULT 0,
  total               DECIMAL(10,2)   NOT NULL,
  payment_ref         VARCHAR(120)    NULL,   -- referencia del gateway (token, no PAN)
  created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_shipaddr FOREIGN KEY (shipping_address_id)
    REFERENCES user_addresses(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_billaddr FOREIGN KEY (billing_address_id)
    REFERENCES user_addresses(id) ON DELETE RESTRICT,
  CONSTRAINT chk_order_totals CHECK (subtotal >= 0 AND shipping_cost >= 0 AND total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_orders_user ON orders (user_id);
CREATE INDEX idx_orders_status_created ON orders (status, created_at);

CREATE TABLE order_items (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id      BIGINT UNSIGNED NOT NULL,
  variant_id    BIGINT UNSIGNED NOT NULL,
  quantity      INT UNSIGNED    NOT NULL,
  unit_price    DECIMAL(10,2)   NOT NULL,
  subtotal      DECIMAL(10,2)   NOT NULL,
  CONSTRAINT fk_orderitem_order FOREIGN KEY (order_id)
    REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_orderitem_variant FOREIGN KEY (variant_id)
    REFERENCES product_variants(id) ON DELETE RESTRICT,
  CONSTRAINT chk_orderitem_qty CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_orderitems_order ON order_items (order_id);
CREATE INDEX idx_orderitems_variant ON order_items (variant_id);

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- TRANSACCIÓN DE CHECKOUT — CONTROL DE CONCURRENCIA
-- Aplica por cada :variant_id del carrito, dentro de UNA sola
-- transacción que además inserta la orden.
-- =====================================================================

-- Nivel de aislamiento: READ COMMITTED.
-- Justificación: con SELECT ... FOR UPDATE el bloqueo de la fila ya
-- impide la carrera; READ COMMITTED evita el next-key/gap locking
-- adicional de REPEATABLE READ (default de InnoDB), reduciendo
-- deadlocks bajo alta concurrencia en checkouts simultáneos sobre
-- variantes distintas.
--
-- SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
--
-- START TRANSACTION;
--
-- -- 1) BLOQUEO PESIMISTA de la fila de inventario de la variante.
-- --    Ninguna otra transacción puede leer/escribir esta fila con
-- --    FOR UPDATE hasta el COMMIT/ROLLBACK de esta.
-- SELECT quantity, reserved, version
-- FROM inventory
-- WHERE variant_id = :variant_id
-- FOR UPDATE;
--
-- -- 2) Validación en aplicación: si (quantity - reserved) < :qty_requested
-- --    → ROLLBACK inmediato y responder "sin stock" (sin tocar más filas).
--
-- -- 3) Descuento atómico del inventario (solo se ejecuta si el paso 2
-- --    fue exitoso; la fila sigue bloqueada desde el paso 1).
-- UPDATE inventory
-- SET quantity = quantity - :qty_requested,
--     version  = version + 1
-- WHERE variant_id = :variant_id
--   AND quantity >= :qty_requested;
--
-- -- Verificación de la aplicación: ROW_COUNT() debe ser 1.
-- -- Si es 0 → otra transacción ya modificó el stock entre el SELECT y
-- -- el UPDATE (no debería ocurrir gracias al FOR UPDATE, pero se deja
-- -- como cinturón de seguridad) → ROLLBACK.
--
-- -- 4) Creación de la orden.
-- INSERT INTO orders
--   (user_id, shipping_address_id, billing_address_id, status,
--    subtotal, shipping_cost, total)
-- VALUES
--   (:user_id, :shipping_address_id, :billing_address_id, 'pending',
--    :subtotal, :shipping_cost, :total);
--
-- SET @order_id = LAST_INSERT_ID();
--
-- -- 5) Detalle de la orden (repetir por cada línea del carrito).
-- INSERT INTO order_items
--   (order_id, variant_id, quantity, unit_price, subtotal)
-- VALUES
--   (@order_id, :variant_id, :qty_requested, :unit_price,
--    :unit_price * :qty_requested);
--
-- -- 6) Vaciar/convertir el carrito de origen.
-- UPDATE carts SET status = 'converted' WHERE id = :cart_id;
--
-- COMMIT;
-- -- Ante cualquier fallo en 2, 3 o excepción de la app: ROLLBACK;

-- ---------------------------------------------------------------------
-- OPCIÓN B — CONTROL OPTIMISTA (alternativa sin FOR UPDATE, para catálogos
-- de muy alta concurrencia donde se prefiere evitar locks largos):
-- ---------------------------------------------------------------------
-- START TRANSACTION;
-- SELECT quantity, version FROM inventory WHERE variant_id = :variant_id;
-- -- (aplicación valida stock y guarda :version_leida)
-- UPDATE inventory
-- SET quantity = quantity - :qty_requested, version = version + 1
-- WHERE variant_id = :variant_id
--   AND version = :version_leida
--   AND quantity >= :qty_requested;
-- -- ROW_COUNT() = 0  → conflicto de concurrencia → reintentar desde el
-- -- SELECT (backoff) o abortar con "sin stock".
-- COMMIT;
