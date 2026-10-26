<?php
/**
 * POST /api/register.php
 * Body: { "name": string, "email": string, "password": string }
 * ("name" se divide en first_name/last_name: la primera palabra es el
 *  nombre, el resto el apellido; si no hay espacio, last_name queda '').
 *
 * Respuesta: mismo objeto que login.php -> { success, message, user }
 *
 * Este es el archivo que "consume" AuthService.register() desde Angular.
 */

require __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Metodo no permitido.', null, 405);
}

$body = readJsonBody();
$name = trim($body['name'] ?? '');
$email = trim($body['email'] ?? '');
$password = (string) ($body['password'] ?? '');

// Validaciones antes de tocar la base de datos.
if ($name === '' || $email === '' || $password === '') {
    respond(false, 'Nombre, email y password son requeridos.', null, 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'El email no es valido.', null, 422);
}

if (strlen($password) < 6) {
    respond(false, 'El password debe tener al menos 6 caracteres.', null, 422);
}

// El formulario manda un solo campo "name" (ej. "Juan Perez"), pero la
// tabla users tiene first_name/last_name por separado. Se divide en la
// primera palabra y el resto.
$parts = preg_split('/\s+/', $name, 2);
$firstName = $parts[0];
$lastName = $parts[1] ?? '';

try {
    $pdo = getConnection();

    // No se puede repetir el mismo email (columna UNIQUE en la tabla).
    $check = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $check->execute(['email' => $email]);
    if ($check->fetch()) {
        respond(false, 'Ese email ya esta registrado.', null, 409);
    }

    // password_hash(): convierte el password en texto plano a un hash
    // bcrypt seguro. Esto es lo que se guarda, nunca el password original.
    $hash = password_hash($password, PASSWORD_DEFAULT);

    // "Donde registra las cosas": este INSERT es el que crea el usuario
    // nuevo de forma permanente en MySQL.
    $insert = $pdo->prepare(
        'INSERT INTO users (first_name, last_name, email, password_hash)
         VALUES (:first_name, :last_name, :email, :password_hash)'
    );
    $insert->execute([
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => $email,
        'password_hash' => $hash,
    ]);

    // Se vuelve a consultar el usuario recien creado para regresarlo completo
    // (con su id real y su created_at generado por la base de datos).
    $userId = (int) $pdo->lastInsertId();
    $created = $pdo->prepare('SELECT id, first_name, last_name, email, created_at FROM users WHERE id = :id');
    $created->execute(['id' => $userId]);
    $row = $created->fetch();

    respond(true, 'Cuenta creada correctamente.', [
        'id' => (int) $row['id'],
        'first_name' => $row['first_name'],
        'last_name' => $row['last_name'],
        'email' => $row['email'],
        'created_at' => $row['created_at'],
    ], 201);
} catch (PDOException $e) {
    respond(false, 'Error de servidor: ' . $e->getMessage(), null, 500);
}
