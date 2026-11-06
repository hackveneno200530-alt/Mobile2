<?php
/**
 * Endpoint de Cupones y Promociones para Del Río Caps.
 *
 * GET  /orders/coupon.php                  -> Lista cupones y promociones vigentes.
 * GET  /orders/coupon.php?code=DELRIO10    -> Consulta datos de un cupón específico.
 * POST /orders/coupon.php                  -> Valida un cupón con el subtotal del carrito y calcula el descuento.
 *
 * Body esperado en POST:
 * {
 *   "coupon_code": "DELRIO10",
 *   "subtotal": 1500.00
 * }
 *
 * Códigos de estado HTTP:
 * 200 OK                   -> Cupón válido y descuento calculado.
 * 404 Not Found            -> El cupón no existe o ha expirado.
 * 422 Unprocessable Entity -> Faltan campos requeridos o no cumple monto mínimo.
 * 405 Method Not Allowed   -> Verbo HTTP no soportado.
 * 500 Internal Error       -> Error inesperado de base de datos.
 */

require __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $pdo = getCatalogConnection();

    // -------------------------------------------------------------
    // 1. GET: Consultar cupones activos o detalle de un código
    // -------------------------------------------------------------
    if ($method === 'GET') {
        $code = isset($_GET['code']) ? strtoupper(trim((string)$_GET['code'])) : null;

        if ($code !== null && $code !== '') {
            $stmt = $pdo->prepare(
                'SELECT id, code, description, discount_percent, min_purchase, expires_at 
                 FROM coupons 
                 WHERE code = :code AND active = 1 AND (expires_at IS NULL OR expires_at >= CURDATE()) 
                 LIMIT 1'
            );
            $stmt->execute(['code' => $code]);
            $coupon = $stmt->fetch();

            if (!$coupon) {
                respondData(false, "El cupón '{$code}' no es válido o ya expiró.", null, 404);
            }

            respondData(true, 'Cupón encontrado.', $coupon, 200);
        }

        // Listar todos los cupones activos públicos
        $stmt = $pdo->query(
            'SELECT id, code, description, discount_percent, min_purchase, expires_at 
             FROM coupons 
             WHERE active = 1 AND (expires_at IS NULL OR expires_at >= CURDATE()) 
             ORDER BY discount_percent DESC'
        );
        $coupons = $stmt->fetchAll();
        respondData(true, 'Cupones vigentes obtenidos con éxito.', $coupons, 200);
    }

    // -------------------------------------------------------------
    // 2. POST: Validar cupón y aplicar cálculo de descuento
    // -------------------------------------------------------------
    if ($method === 'POST') {
        $body = readJsonBody();
        $couponCode = strtoupper(trim((string)($body['coupon_code'] ?? '')));
        $subtotal = isset($body['subtotal']) && is_numeric($body['subtotal']) ? (float)$body['subtotal'] : null;

        if ($couponCode === '') {
            respondData(false, 'El código de cupón es obligatorio.', null, 422);
        }

        if ($subtotal === null || $subtotal <= 0) {
            respondData(false, 'El subtotal del carrito debe ser un número mayor a cero.', null, 422);
        }

        // Buscar cupón en base de datos
        $stmt = $pdo->prepare(
            'SELECT * FROM coupons 
             WHERE code = :code AND active = 1 AND (expires_at IS NULL OR expires_at >= CURDATE()) 
             LIMIT 1'
        );
        $stmt->execute(['code' => $couponCode]);
        $coupon = $stmt->fetch();

        if (!$coupon) {
            respondData(false, "El cupón '{$couponCode}' no existe, no está activo o ha expirado.", null, 404);
        }

        $minPurchase = (float)($coupon['min_purchase'] ?? 0);
        if ($subtotal < $minPurchase) {
            $formattedMin = number_format($minPurchase, 2);
            respondData(
                false, 
                "El cupón '{$couponCode}' requiere una compra mínima de \${$formattedMin} MXN. Subtotal actual: \$" . number_format($subtotal, 2) . " MXN.", 
                null, 
                422
            );
        }

        $discountPercent = (float)$coupon['discount_percent'];
        $discountAmount = round($subtotal * ($discountPercent / 100), 2);
        $finalTotal = max(0, round($subtotal - $discountAmount, 2));

        $result = [
            'coupon_id'         => (int)$coupon['id'],
            'coupon_code'       => $coupon['code'],
            'description'       => $coupon['description'],
            'discount_percent'  => $discountPercent,
            'original_subtotal' => $subtotal,
            'discount_amount'   => $discountAmount,
            'final_total'       => $finalTotal,
            'expires_at'        => $coupon['expires_at'] ?? 'Sin vigencia',
        ];

        respondData(true, "¡Cupón '{$couponCode}' aplicado exitosamente! Obtuviste un {$discountPercent}% de descuento.", $result, 200);
    }

    // Cualquier otro verbo HTTP
    respondData(false, 'Método HTTP no permitido para este endpoint.', null, 405);

} catch (Throwable $e) {
    respondData(false, 'Error interno del servidor al procesar el cupón: ' . $e->getMessage(), null, 500);
}
