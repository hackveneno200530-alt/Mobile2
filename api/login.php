<?php
/**
 * POST /api/login.php
 * Body: { "email": string, "password": string }
 *
 * Respuesta (siempre HTTP 200/401/500 con este objeto):
 * {
 *   "success": boolean,
 *   "message": string,
 *   "user": { "id": number, "name": string, "email": string, "created_at": string } | null
 * }
 */

require __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Metodo no permitido.', null, 405);
}

$body = readJsonBody();
$email = trim($body['email'] ?? '');
$password = (string) ($body['password'] ?? '');

if ($email === '' || $password === '') {
    respond(false, 'Email y password son requeridos.', null, 422);
}

try {
    $pdo = getConnection();
    $stmt = $pdo->prepare('SELECT id, name, email, password, created_at FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $email]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($password, $row['password'])) {
        respond(false, 'Credenciales invalidas.', null, 401);
    }

    respond(true, 'Login exitoso.', [
        'id' => (int) $row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
        'created_at' => $row['created_at'],
    ]);
} catch (PDOException $e) {
    respond(false, 'Error de servidor: ' . $e->getMessage(), null, 500);
}
