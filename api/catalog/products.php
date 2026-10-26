<?php
/**
 * CRUD de productos.
 * GET    /catalog/products.php                     -> lista todos       (Consulta)
 * GET    /catalog/products.php?category_id=2        -> lista por categoria (Consulta)
 * GET    /catalog/products.php?id=1                 -> un producto       (Consulta)
 * POST   /catalog/products.php                      -> crea               (Alta)
 * PUT    /catalog/products.php?id=1                 -> actualiza campos   (Modificacion)
 * DELETE /catalog/products.php?id=1                 -> elimina            (Eliminacion)
 *
 * Respuesta: { success, message, data }
 *
 * Este archivo es lo que ProductService (Angular) consume via apiClient.
 */

require __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? (int) $_GET['id'] : null;
$categoryId = isset($_GET['category_id']) ? (int) $_GET['category_id'] : null;

try {
    $pdo = getCatalogConnection();

    // ---------- CONSULTA ----------
    if ($method === 'GET') {
        $baseSql = 'SELECT p.*, c.name AS category_name,
                           COALESCE((SELECT SUM(i.quantity) FROM product_variants pv JOIN inventory i ON pv.id = i.variant_id WHERE pv.product_id = p.id), 0) AS total_stock
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id';

        if ($id !== null) {
            $stmt = $pdo->prepare($baseSql . ' WHERE p.id = :id');
            $stmt->execute(['id' => $id]);
            $row = $stmt->fetch();
            if (!$row) {
                respondData(false, 'Producto no encontrado.', null, 404);
            }
            respondData(true, 'OK', $row);
        }

        if ($categoryId !== null) {
            $stmt = $pdo->prepare($baseSql . ' WHERE p.category_id = :cat ORDER BY p.name');
            $stmt->execute(['cat' => $categoryId]);
            respondData(true, 'OK', $stmt->fetchAll());
        }

        $stmt = $pdo->query($baseSql . ' ORDER BY p.name');
        respondData(true, 'OK', $stmt->fetchAll());
    }

    // ---------- ALTA ----------
    if ($method === 'POST') {
        $body = readJsonBody();
        $categoryIdIn = (int) ($body['category_id'] ?? 0);
        $skuBase = trim($body['sku_base'] ?? '');
        $name = trim($body['name'] ?? '');
        $description = $body['description'] ?? null;
        $brand = $body['brand'] ?? null;
        $basePrice = $body['base_price'] ?? null;
        $active = array_key_exists('active', $body) ? (bool) $body['active'] : true;

        if ($categoryIdIn <= 0 || $skuBase === '' || $name === '' || $basePrice === null) {
            respondData(false, 'category_id, sku_base, name y base_price son requeridos.', null, 422);
        }
        if (!is_numeric($basePrice) || (float) $basePrice < 0) {
            respondData(false, 'base_price debe ser un numero >= 0.', null, 422);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO products (category_id, sku_base, name, description, brand, base_price, image_url, active)
             VALUES (:category_id, :sku_base, :name, :description, :brand, :base_price, :image_url, :active)'
        );
        $stmt->execute([
            'category_id' => $categoryIdIn,
            'sku_base' => $skuBase,
            'name' => $name,
            'description' => $description,
            'brand' => $brand,
            'base_price' => $basePrice,
            'image_url' => $body['image_url'] ?? null,
            'active' => $active ? 1 : 0,
        ]);

        $newId = (int) $pdo->lastInsertId();
        $created = $pdo->prepare('SELECT * FROM products WHERE id = :id');
        $created->execute(['id' => $newId]);
        respondData(true, 'Producto creado.', $created->fetch(), 201);
    }

    // ---------- MODIFICACION ----------
    if ($method === 'PUT') {
        if ($id === null) {
            respondData(false, 'Falta el parametro id.', null, 422);
        }

        $body = readJsonBody();
        $fields = [];
        $params = ['id' => $id];

        // Solo actualiza los campos que vinieron en el body.
        foreach (['category_id', 'sku_base', 'name', 'description', 'brand', 'base_price', 'image_url', 'active'] as $col) {
            if (array_key_exists($col, $body)) {
                $fields[] = "$col = :$col";
                $params[$col] = $col === 'active' ? ((bool) $body[$col] ? 1 : 0) : $body[$col];
            }
        }

        if (empty($fields)) {
            respondData(false, 'No se enviaron campos para actualizar.', null, 422);
        }

        $sql = 'UPDATE products SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $pdo->prepare($sql)->execute($params);

        $updated = $pdo->prepare('SELECT * FROM products WHERE id = :id');
        $updated->execute(['id' => $id]);
        $row = $updated->fetch();
        if (!$row) {
            respondData(false, 'Producto no encontrado.', null, 404);
        }
        respondData(true, 'Producto actualizado.', $row);
    }

    // ---------- ELIMINACION ----------
    if ($method === 'DELETE') {
        if ($id === null) {
            respondData(false, 'Falta el parametro id.', null, 422);
        }
        $stmt = $pdo->prepare('DELETE FROM products WHERE id = :id');
        $stmt->execute(['id' => $id]);
        if ($stmt->rowCount() === 0) {
            respondData(false, 'Producto no encontrado.', null, 404);
        }
        respondData(true, 'Producto eliminado.', null);
    }

    respondData(false, 'Metodo no permitido.', null, 405);
} catch (PDOException $e) {
    respondData(false, 'Error de servidor: ' . $e->getMessage(), null, 500);
}
