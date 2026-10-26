<?php
/**
 * Configuracion de conexion a la base de datos y cabeceras CORS
 * compartidas por todos los endpoints de la API.
 *
 * TODOS los demas archivos PHP (login.php, register.php, catalog/*.php)
 * empiezan con require __DIR__ . '/config.php' — por eso lo que esta
 * aqui aplica a cada peticion que llega a la API.
 */

// CORS: permite que el navegador (localhost:8100, distinto origen que
// Apache en localhost:80) pueda llamar a esta API sin que la bloquee.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Antes de cada peticion "real" (POST/PUT/DELETE), el navegador manda un
// OPTIONS de prueba (preflight) preguntando si tiene permiso. Aqui se
// responde que si, sin ejecutar ninguna logica de negocio.
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Datos de conexion a MySQL (XAMPP en este proyecto).
const DB_HOST = '127.0.0.1';
const DB_NAME = 'delrio_ecommerce';
const DB_USER = 'root';
const DB_PASS = '';
const DB_CHARSET = 'utf8mb4';

/**
 * "Donde manda a llamar la base de datos": abre y devuelve una conexion
 * PDO nueva. PDO::ATTR_ERRMODE en modo excepcion hace que cualquier error
 * de SQL lance un throw en vez de fallar en silencio.
 */
function getConnection(): PDO
{
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    return new PDO($dsn, DB_USER, DB_PASS, $options);
}

/**
 * Alias de getConnection(): historicamente los endpoints de catalogo
 * usaban una base separada; ahora delrio_ecommerce es la unica base,
 * se conserva el nombre para no tener que tocar catalog/*.php.
 */
function getCatalogConnection(): PDO
{
    return getConnection();
}

/**
 * Envia una respuesta JSON con la forma { success, message, user }
 * y detiene la ejecucion del script. La usan login.php y register.php.
 */
function respond(bool $success, string $message, ?array $user = null, int $httpCode = 200): void
{
    http_response_code($httpCode);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'user' => $user,
    ]);
    exit; // corta la ejecucion aqui: nada despues de respond() se llega a correr
}

/**
 * Envia una respuesta JSON con la forma { success, message, data }
 * (usada por los endpoints de catalogo: categories/products/variants/inventory).
 */
function respondData(bool $success, string $message, $data = null, int $httpCode = 200): void
{
    http_response_code($httpCode);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data,
    ]);
    exit;
}

/**
 * Lee el cuerpo JSON crudo de la peticion (lo que Axios mando en el
 * .post()/.put()) y lo convierte en un arreglo asociativo de PHP.
 */
function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
