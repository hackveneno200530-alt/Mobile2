<?php
/**
 * Configuracion de conexion a la base de datos y cabeceras CORS
 * compartidas por todos los endpoints de la API.
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const DB_HOST = '127.0.0.1';
const DB_NAME = 'delrio_ecommerce';
const DB_USER = 'root';
const DB_PASS = '';
const DB_CHARSET = 'utf8mb4';

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
 * y detiene la ejecucion del script.
 */
function respond(bool $success, string $message, ?array $user = null, int $httpCode = 200): void
{
    http_response_code($httpCode);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'user' => $user,
    ]);
    exit;
}

/**
 * Envia una respuesta JSON con la forma { success, message, data }
 * (usada por los endpoints de catalogo) y detiene la ejecucion.
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
 * Lee y decodifica el body JSON de la peticion actual.
 */
function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
