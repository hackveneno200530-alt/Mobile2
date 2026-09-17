<?php
/**
 * CRUD de variantes de producto (talla/color/ml).
 * GET    /catalog/variants.php                  -> lista todas
 * GET    /catalog/variants.php?product_id=1      -> lista por producto
 * GET    /catalog/variants.php?id=1              -> una variante
 * POST   /catalog/variants.php                   -> crea variante + inventario en 0
 * PUT    /catalog/variants.php?id=1              -> actualiza campos enviados
 * DELETE /catalog/variants.php?id=1              -> elimina (inventario cae en cascada)
 *
 * Respuesta: { success, message, data }
 */

require __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? (int) $_GET['id'] : null;
$productId = isset($_GET['product_id']) ? (int) $_GET['product_id'] : null;

try {
    $pdo = getCatalogConnection();

    if ($method === 'GET') {
        if ($id !== null) {
            $stmt = $pdo->prepare('SELECT * FROM product_variants WHERE id = :id');
            $stmt->execute(['id' => $id]);
            $row = $stmt->fetch();
            if (!$row) {
                respondData(false, 'Variante no encontrada.', null, 404);
            }
            respondData(true, 'OK', $row);
        }

        if ($productId !== null) {
            $stmt = $pdo->prepare('SELECT * FROM product_variants WHERE product_id = :pid ORDER BY id');
            $stmt->execute(['pid' => $productId]);
            respondData(true, 'OK', $stmt->fetchAll());
        }

        $stmt = $pdo->query('SELECT * FROM product_variants ORDER BY id');
        respondData(true, 'OK', $stmt->fetchAll());
    }

    if ($method === 'POST') {
        $body = readJsonBody();
        $productIdIn = (int) ($body['product_id'] ?? 0);
        $sku = trim($body['sku'] ?? '');
        $size = $body['size'] ?? null;
        $color = $body['color'] ?? null;
        $volumeMl = isset($body['volume_ml']) && $body['volume_ml'] !== null ? (int) $body['volume_ml'] : null;
        $price = $body['price'] ?? null;
        $active = array_key_exists('active', $body) ? (bool) $body['active'] : true;

        if ($productIdIn <= 0 || $sku === '' || $price === null) {
            respondData(false, 'product_id, sku y price son requeridos.', null, 422);
        }
        if (!is_numeric($price) || (float) $price < 0) {
            respondData(false, 'price debe ser un numero >= 0.', null, 422);
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO product_variants (product_id, sku, size, color, volume_ml, price, active)
                 VALUES (:product_id, :sku, :size, :color, :volume_ml, :price, :active)'
            );
            $stmt->execute([
                'product_id' => $productIdIn,
                'sku' => $sku,
                'size' => $size,
                'color' => $color,
                'volume_ml' => $volumeMl,
                'price' => $price,
                'active' => $active ? 1 : 0,
            ]);

            $newId = (int) $pdo->lastInsertId();

            // Toda variante nueva nace con su fila de inventario en 0.
            $pdo->prepare('INSERT INTO inventory (variant_id, quantity, reserved, version) VALUES (:id, 0, 0, 0)')
                ->execute(['id' => $newId]);

            $pdo->commit();
        } catch (PDOException $e) {
            $pdo->rollBack();
            throw $e;
        }

        $created = $pdo->prepare('SELECT * FROM product_variants WHERE id = :id');
        $created->execute(['id' => $newId]);
        respondData(true, 'Variante creada.', $created->fetch(), 201);
    }

    if ($method === 'PUT') {
        if ($id === null) {
            respondData(false, 'Falta el parametro id.', null, 422);
        }

        $body = readJsonBody();
        $fields = [];
        $params = ['id' => $id];

        foreach (['sku', 'size', 'color', 'volume_ml', 'price', 'active'] as $col) {
            if (array_key_exists($col, $body)) {
                $fields[] = "$col = :$col";
                $params[$col] = $col === 'active' ? ((bool) $body[$col] ? 1 : 0) : $body[$col];
            }
        }

        if (empty($fields)) {
            respondData(false, 'No se enviaron campos para actualizar.', null, 422);
        }

        $sql = 'UPDATE product_variants SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $pdo->prepare($sql)->execute($params);

        $updated = $pdo->prepare('SELECT * FROM product_variants WHERE id = :id');
        $updated->execute(['id' => $id]);
        $row = $updated->fetch();
        if (!$row) {
            respondData(false, 'Variante no encontrada.', null, 404);
        }
        respondData(true, 'Variante actualizada.', $row);
    }

    if ($method === 'DELETE') {
        if ($id === null) {
            respondData(false, 'Falta el parametro id.', null, 422);
        }
        $stmt = $pdo->prepare('DELETE FROM product_variants WHERE id = :id');
        $stmt->execute(['id' => $id]);
        if ($stmt->rowCount() === 0) {
            respondData(false, 'Variante no encontrada.', null, 404);
        }
        respondData(true, 'Variante eliminada.', null);
    }

    respondData(false, 'Metodo no permitido.', null, 405);
} catch (PDOException $e) {
    respondData(false, 'Error de servidor: ' . $e->getMessage(), null, 500);
}
