<?php
/**
 * Checkout transaccional con control de concurrencia ACID para Del Río Caps.
 * POST /orders/checkout.php
 *
 * Implementa el protocolo documentado en api/schema_ecommerce.sql:
 * 1. Abre transacción InnoDB (beginTransaction).
 * 2. Bloquea las filas de inventario involucradas con SELECT ... FOR UPDATE.
 * 3. Valida que el stock disponible (quantity - reserved) sea suficiente.
 *    Si falta stock -> ROLLBACK y respuesta HTTP 409 (Conflicto).
 * 4. Descuenta el inventario atómicamente.
 * 5. Registra la dirección, la orden en `orders` y las partidas en `order_items`.
 * 6. Confirma la transacción (commit) y devuelve el folio único de compra.
 */

require __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respondData(false, 'Método no permitido.', null, 405);
}

$body = readJsonBody();
$userId = (int) ($body['user_id'] ?? 0);
$deliveryType = ($body['delivery_type'] ?? '') === 'home_delivery' ? 'home_delivery' : 'store_pickup';
$recipientName = trim($body['recipient_name'] ?? '');
$recipientPhone = trim($body['recipient_phone'] ?? '');
$shippingAddress = trim($body['shipping_address'] ?? '');
$paymentMethod = $body['payment_method'] ?? 'cash_on_delivery';
$items = $body['items'] ?? [];

if ($userId <= 0) {
    respondData(false, 'Debes iniciar sesión para realizar un pedido.', null, 401);
}

if (empty($items) || !is_array($items)) {
    respondData(false, 'El carrito está vacío. Agrega artículos antes de continuar.', null, 422);
}

if ($recipientName === '' || $recipientPhone === '') {
    respondData(false, 'Nombre de quien recibe y teléfono de contacto son obligatorios.', null, 422);
}

if ($deliveryType === 'home_delivery' && $shippingAddress === '') {
    respondData(false, 'Para entrega a domicilio, ingresa tu dirección completa.', null, 422);
}

try {
    $pdo = getCatalogConnection();
    // Iniciar transacción atómica
    $pdo->beginTransaction();

    $subtotal = 0.0;
    $validatedItems = [];

    // 1. Verificación y Bloqueo Pesimista (FOR UPDATE) de cada variante
    foreach ($items as $item) {
        $variantId = (int) ($item['variant_id'] ?? 0);
        $qty = (int) ($item['quantity'] ?? 0);

        if ($variantId <= 0 || $qty <= 0) {
            $pdo->rollBack();
            respondData(false, 'Datos de partida inválidos en el carrito.', null, 422);
        }

        // Bloqueo pesimista de la fila de inventario
        $stmt = $pdo->prepare(
            'SELECT i.quantity, i.reserved, pv.price, pv.sku, p.name AS product_name
             FROM inventory i
             JOIN product_variants pv ON i.variant_id = pv.id
             JOIN products p ON pv.product_id = p.id
             WHERE i.variant_id = :vid
             FOR UPDATE'
        );
        $stmt->execute(['vid' => $variantId]);
        $row = $stmt->fetch();

        if (!$row) {
            $pdo->rollBack();
            respondData(false, "El artículo con variante ID {$variantId} ya no existe en el catálogo.", null, 404);
        }

        $availableStock = (int)$row['quantity'] - (int)$row['reserved'];
        if ($availableStock < $qty) {
            $pdo->rollBack();
            $msg = "Stock insuficiente para '{$row['product_name']}'. Solo quedan {$availableStock} piezas disponibles.";
            respondData(false, $msg, [
                'conflict_variant_id' => $variantId,
                'available_stock' => $availableStock
            ], 409);
        }

        $unitPrice = (float)$row['price'];
        $lineSubtotal = $unitPrice * $qty;
        $subtotal += $lineSubtotal;

        $validatedItems[] = [
            'variant_id' => $variantId,
            'quantity' => $qty,
            'unit_price' => $unitPrice,
            'subtotal' => $lineSubtotal,
        ];
    }

    // 2. Descuento atómico del inventario
    foreach ($validatedItems as $vItem) {
        $deductStmt = $pdo->prepare(
            'UPDATE inventory
             SET quantity = quantity - :qty,
                 version = version + 1
             WHERE variant_id = :vid AND quantity >= :qty_chk'
        );
        $deductStmt->execute([
            'qty' => $vItem['quantity'],
            'vid' => $vItem['variant_id'],
            'qty_chk' => $vItem['quantity'],
        ]);

        if ($deductStmt->rowCount() === 0) {
            $pdo->rollBack();
            respondData(false, 'Conflicto de concurrencia al reservar el stock. Por favor reintenta.', null, 409);
        }
    }

    // 3. Registrar o enlazar dirección en `user_addresses` para cumplir FK de InnoDB
    $addressLine = $deliveryType === 'home_delivery'
        ? $shippingAddress
        : 'Recolección en sucursal Del Río Caps (Matriz)';

    $addrStmt = $pdo->prepare(
        'INSERT INTO user_addresses (user_id, label, recipient, line1, city, state, postal_code, country_code, phone)
         VALUES (:uid, :label, :recipient, :line1, :city, :state, :cp, "MX", :phone)'
    );
    $addrStmt->execute([
        'uid' => $userId,
        'label' => $deliveryType === 'home_delivery' ? 'Domicilio de Envío' : 'Punto de Entrega',
        'recipient' => $recipientName,
        'line1' => $addressLine,
        'city' => 'Ciudad Del Río',
        'state' => 'Estado',
        'cp' => '00000',
        'phone' => $recipientPhone,
    ]);
    $addressId = (int)$pdo->lastInsertId();

    // 4. Calcular costos finales
    $shippingCost = ($deliveryType === 'store_pickup' || $subtotal >= 999.0) ? 0.0 : 99.0;
    $total = $subtotal + $shippingCost;
    $paymentRef = 'METH:' . $paymentMethod . '|DELIV:' . $deliveryType;

    // 5. Insertar cabecera de orden en `orders`
    $orderStmt = $pdo->prepare(
        'INSERT INTO orders (user_id, shipping_address_id, billing_address_id, status, subtotal, shipping_cost, total, payment_ref)
         VALUES (:uid, :ship, :bill, "pending", :sub, :ship_cost, :total, :pref)'
    );
    $orderStmt->execute([
        'uid' => $userId,
        'ship' => $addressId,
        'bill' => $addressId,
        'sub' => $subtotal,
        'ship_cost' => $shippingCost,
        'total' => $total,
        'pref' => $paymentRef,
    ]);
    $orderId = (int)$pdo->lastInsertId();

    // 6. Insertar partidas en `order_items`
    $itemInsert = $pdo->prepare(
        'INSERT INTO order_items (order_id, variant_id, quantity, unit_price, subtotal)
         VALUES (:oid, :vid, :qty, :price, :sub)'
    );
    foreach ($validatedItems as $vItem) {
        $itemInsert->execute([
            'oid' => $orderId,
            'vid' => $vItem['variant_id'],
            'qty' => $vItem['quantity'],
            'price' => $vItem['unit_price'],
            'sub' => $vItem['subtotal'],
        ]);
    }

    // 7. Todo exitoso: consolidar en base de datos
    $pdo->commit();

    $folio = 'DRC-' . str_pad((string)$orderId, 6, '0', STR_PAD_LEFT);

    respondData(true, '¡Tu pedido ha sido confirmado con éxito!', [
        'order_id' => $orderId,
        'folio' => $folio,
        'subtotal' => $subtotal,
        'shipping_cost' => $shippingCost,
        'total' => $total,
        'status' => 'pending',
        'created_at' => date('Y-m-d H:i:s'),
    ], 201);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respondData(false, 'Error en el servidor al procesar el checkout: ' . $e->getMessage(), null, 500);
}
