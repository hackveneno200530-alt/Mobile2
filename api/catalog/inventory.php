<?php
/**
 * Lectura y ajuste de inventario. No expone create/delete: la fila nace
 * junto con la variante (variants.php) y se elimina en cascada con ella.
 *
 * GET /catalog/inventory.php?variant_id=1  -> consulta stock
 * PUT /catalog/inventory.php?variant_id=1  -> { quantity } ajusta cantidad
 *
 * Respuesta: { success, message, data }
 */

require __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$variantId = isset($_GET['variant_id']) ? (int) $_GET['variant_id'] : null;

if ($variantId === null) {
    respondData(false, 'Falta el parametro variant_id.', null, 422);
}

try {
    $pdo = getCatalogConnection();

    if ($method === 'GET') {
        $stmt = $pdo->prepare('SELECT * FROM inventory WHERE variant_id = :id');
        $stmt->execute(['id' => $variantId]);
        $row = $stmt->fetch();
        if (!$row) {
            respondData(false, 'Inventario no encontrado para esa variante.', null, 404);
        }
        respondData(true, 'OK', $row);
    }

    if ($method === 'PUT') {
        $body = readJsonBody();
        if (!isset($body['quantity']) || !is_numeric($body['quantity']) || (int) $body['quantity'] < 0) {
            respondData(false, 'quantity es requerido y debe ser >= 0.', null, 422);
        }

        // Ajuste directo (no transaccional): uso administrativo (alta de
        // stock, correccion de inventario). El descuento durante checkout
        // usa la transaccion con SELECT ... FOR UPDATE documentada en
        // database/database.sql, no este endpoint.
        $stmt = $pdo->prepare(
            'UPDATE inventory SET quantity = :qty, version = version + 1 WHERE variant_id = :id'
        );
        $stmt->execute(['qty' => (int) $body['quantity'], 'id' => $variantId]);

        if ($stmt->rowCount() === 0) {
            respondData(false, 'Inventario no encontrado para esa variante.', null, 404);
        }

        $updated = $pdo->prepare('SELECT * FROM inventory WHERE variant_id = :id');
        $updated->execute(['id' => $variantId]);
        respondData(true, 'Inventario actualizado.', $updated->fetch());
    }

    respondData(false, 'Metodo no permitido.', null, 405);
} catch (PDOException $e) {
    respondData(false, 'Error de servidor: ' . $e->getMessage(), null, 500);
}
