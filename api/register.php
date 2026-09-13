<?php
/**
 * POST /api/register.php
 * Body: { "name": string, "email": string, "password": string }
 *
 * Respuesta: mismo objeto que login.php -> { success, message, user }
 */

require __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Metodo no permitido.', null, 405);
}

$body = readJsonBody();
$name = trim($body['name'] ?? '');
$email = trim($body['email'] ?? '');
$password = (string) ($body['password'] ?? '');

if ($name === '' || $email === '' || $password === '') {
    respond(false, 'Nombre, email y password son requeridos.', null, 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'El email no es valido.', null, 422);
}

if (strlen($password) < 6) {
    respond(false, 'El password debe tener al menos 6 caracteres.', null, 422);
}

try {
    $pdo = getConnection();

    $check = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $check->execute(['email' => $email]);
    if ($check->fetch()) {
        respond(false, 'Ese email ya esta registrado.', null, 409);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);

    $insert = $pdo->prepare('INSERT INTO users (name, email, password) VALUES (:name, :email, :password)');
    $insert->execute([
        'name' => $name,
        'email' => $email,
        'password' => $hash,
    ]);

    $userId = (int) $pdo->lastInsertId();
    $created = $pdo->prepare('SELECT id, name, email, created_at FROM users WHERE id = :id');
    $created->execute(['id' => $userId]);
    $row = $created->fetch();

    respond(true, 'Cuenta creada correctamente.', [
        'id' => (int) $row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
        'created_at' => $row['created_at'],
    ], 201);
} catch (PDOException $e) {
    respond(false, 'Error de servidor: ' . $e->getMessage(), null, 500);
}
