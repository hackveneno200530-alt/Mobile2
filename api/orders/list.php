<?php
/**
 * Consulta de historial de pedidos del cliente.
 * GET /orders/list.php?user_id=1
 */

require __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respondData(false, 'Método no permitido.', null, 405);
}

$userId = isset($_GET['user_id']) ? (int) $_GET['user_id'] : 0;

if ($userId <= 0) {
    respondData(false, 'Falta el parámetro user_id.', null, 422);
}

try {
    $pdo = getCatalogConnection();

    $stmt = $pdo->prepare(
        'SELECT o.id, o.user_id, o.status, o.subtotal, o.shipping_cost, o.total,
                o.payment_ref, o.created_at, o.updated_at,
                ua.recipient AS recipient_name, ua.phone AS recipient_phone, ua.line1 AS shipping_address
         FROM orders o
         LEFT JOIN user_addresses ua ON o.shipping_address_id = ua.id
         WHERE o.user_id = :uid
         ORDER BY o.created_at DESC'
    );
    $stmt->execute(['uid' => $userId]);
    $orders = $stmt->fetchAll();

    $orderIds = array_column($orders, 'id');
    $itemsByOrder = [];

    if (!empty($orderIds)) {
        $inQuery = implode(',', array_map('intval', $orderIds));
        $itemSql = "SELECT oi.id, oi.order_id, oi.variant_id, oi.quantity, oi.unit_price, oi.subtotal,
                           p.name AS product_name, pv.size, pv.color, pv.volume_ml, pv.sku
                    FROM order_items oi
                    JOIN product_variants pv ON oi.variant_id = pv.id
                    JOIN products p ON pv.product_id = p.id
                    WHERE oi.order_id IN ($inQuery)
                    ORDER BY oi.id ASC";
        $itemStmt = $pdo->query($itemSql);
        while ($row = $itemStmt->fetch()) {
            $itemsByOrder[$row['order_id']][] = $row;
        }
    }

    foreach ($orders as &$ord) {
        $ord['items'] = $itemsByOrder[$ord['id']] ?? [];
        $ord['folio'] = 'DRC-' . str_pad((string)$ord['id'], 6, '0', STR_PAD_LEFT);
    }

    respondData(true, 'OK', $orders);
} catch (Exception $e) {
    respondData(false, 'Error al consultar pedidos: ' . $e->getMessage(), null, 500);
}
