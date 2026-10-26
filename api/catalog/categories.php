<?php
/**
 * CRUD de categorias.
 * GET    /catalog/categories.php            -> lista todas       (Consulta)
 * GET    /catalog/categories.php?id=1       -> una categoria     (Consulta)
 * POST   /catalog/categories.php            -> crea               (Alta)
 * PUT    /catalog/categories.php?id=1       -> actualiza campos   (Modificacion)
 * DELETE /catalog/categories.php?id=1       -> elimina            (Eliminacion)
 *
 * Respuesta: { success, message, data }
 *
 * Este archivo es lo que CategoryService (Angular) consume via apiClient.
 */

require __DIR__ . '/../config.php';

// $method decide que bloque de abajo se ejecuta; $id viene de la URL (?id=).
$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? (int) $_GET['id'] : null;

try {
    $pdo = getCatalogConnection();

    // ---------- CONSULTA ----------
    if ($method === 'GET') {
        if ($id !== null) {
            // Con id: trae una sola categoria.
            $stmt = $pdo->prepare('SELECT * FROM categories WHERE id = :id');
            $stmt->execute(['id' => $id]);
            $row = $stmt->fetch();
            if (!$row) {
                respondData(false, 'Categoria no encontrada.', null, 404);
            }
            respondData(true, 'OK', $row);
        }

        // Sin id: trae todas, ordenadas por nombre.
        $stmt = $pdo->query('SELECT * FROM categories ORDER BY name');
        respondData(true, 'OK', $stmt->fetchAll());
    }

    // ---------- ALTA ----------
    if ($method === 'POST') {
        $body = readJsonBody();
        $name = trim($body['name'] ?? '');
        $slug = trim($body['slug'] ?? '');
        $parentId = isset($body['parent_id']) && $body['parent_id'] !== null ? (int) $body['parent_id'] : null;

        if ($name === '' || $slug === '') {
            respondData(false, 'name y slug son requeridos.', null, 422);
        }

        $stmt = $pdo->prepare('INSERT INTO categories (parent_id, name, slug) VALUES (:parent_id, :name, :slug)');
        $stmt->execute(['parent_id' => $parentId, 'name' => $name, 'slug' => $slug]);

        // Se vuelve a consultar la fila recien creada para regresarla completa (con su id real).
        $newId = (int) $pdo->lastInsertId();
        $created = $pdo->prepare('SELECT * FROM categories WHERE id = :id');
        $created->execute(['id' => $newId]);
        respondData(true, 'Categoria creada.', $created->fetch(), 201);
    }

    // ---------- MODIFICACION ----------
    if ($method === 'PUT') {
        if ($id === null) {
            respondData(false, 'Falta el parametro id.', null, 422);
        }

        $body = readJsonBody();
        $fields = [];
        $params = ['id' => $id];

        // Solo se arma el UPDATE con los campos que realmente vinieron en
        // el body (asi el frontend puede mandar solo lo que cambio).
        foreach (['name', 'slug'] as $col) {
            if (isset($body[$col])) {
                $fields[] = "$col = :$col";
                $params[$col] = trim($body[$col]);
            }
        }
        if (array_key_exists('parent_id', $body)) {
            $fields[] = 'parent_id = :parent_id';
            $params['parent_id'] = $body['parent_id'] !== null ? (int) $body['parent_id'] : null;
        }

        if (empty($fields)) {
            respondData(false, 'No se enviaron campos para actualizar.', null, 422);
        }

        $sql = 'UPDATE categories SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $pdo->prepare($sql)->execute($params);

        $updated = $pdo->prepare('SELECT * FROM categories WHERE id = :id');
        $updated->execute(['id' => $id]);
        $row = $updated->fetch();
        if (!$row) {
            respondData(false, 'Categoria no encontrada.', null, 404);
        }
        respondData(true, 'Categoria actualizada.', $row);
    }

    // ---------- ELIMINACION ----------
    if ($method === 'DELETE') {
        if ($id === null) {
            respondData(false, 'Falta el parametro id.', null, 422);
        }
        $stmt = $pdo->prepare('DELETE FROM categories WHERE id = :id');
        $stmt->execute(['id' => $id]);
        if ($stmt->rowCount() === 0) {
            respondData(false, 'Categoria no encontrada.', null, 404);
        }
        respondData(true, 'Categoria eliminada.', null);
    }

    // Si el metodo no fue ninguno de los de arriba (ej. PATCH):
    respondData(false, 'Metodo no permitido.', null, 405);
} catch (PDOException $e) {
    respondData(false, 'Error de servidor: ' . $e->getMessage(), null, 500);
}
