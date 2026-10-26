<?php
/**
 * POST /api/login.php
 * Body: { "email": string, "password": string }
 *
 * Respuesta (siempre HTTP 200/401/500 con este objeto):
 * {
 *   "success": boolean,
 *   "message": string,
 *   "user": { "id": number, "first_name": string, "last_name": string,
 *              "email": string, "created_at": string } | null
 * }
 *
 * Este es el archivo que "consume" AuthService.login() desde Angular
 * (this.http.post('/login.php', ...) en auth.service.ts).
 */

require __DIR__ . '/config.php'; // trae getConnection(), respond(), readJsonBody()

// Este endpoint solo acepta POST; cualquier otro verbo se rechaza.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Metodo no permitido.', null, 405);
}

// Lee { email, password } del body JSON que mando Axios.
$body = readJsonBody();
$email = trim($body['email'] ?? '');
$password = (string) ($body['password'] ?? '');

// Validacion basica: si falta algo, ni siquiera se consulta la base de datos.
if ($email === '' || $password === '') {
    respond(false, 'Email y password son requeridos.', null, 422);
}

try {
    $pdo = getConnection();
    // Prepared statement: el :email se manda como parametro, nunca se
    // concatena directo en el SQL (asi se evita inyeccion SQL).
    $stmt = $pdo->prepare(
        'SELECT id, first_name, last_name, email, password_hash, status, created_at
         FROM users WHERE email = :email LIMIT 1'
    );
    $stmt->execute(['email' => $email]);
    $row = $stmt->fetch();

    // password_verify() compara el password en texto plano contra el
    // hash guardado (nunca se guarda ni se compara la contrasena en claro).
    if (!$row || !password_verify($password, $row['password_hash'])) {
        respond(false, 'Credenciales invalidas.', null, 401);
    }

    // Aunque el password sea correcto, si la cuenta esta deshabilitada no entra.
    if ($row['status'] !== 'active') {
        respond(false, 'Esta cuenta esta deshabilitada.', null, 403);
    }

    // Login correcto: se regresa el usuario (sin el password_hash, por seguridad).
    respond(true, 'Login exitoso.', [
        'id' => (int) $row['id'],
        'first_name' => $row['first_name'],
        'last_name' => $row['last_name'],
        'email' => $row['email'],
        'created_at' => $row['created_at'],
    ]);
} catch (PDOException $e) {
    // Error de conexion/consulta a MySQL (ej. XAMPP apagado).
    respond(false, 'Error de servidor: ' . $e->getMessage(), null, 500);
}
