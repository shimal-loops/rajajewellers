<?php
require_once 'db_config.php';
require_once 'auth_utils.php';
verify_auth();

try {
    $stmt = $pdo->query('SELECT id, username, email, google_id, status, last_login, created_at FROM managers ORDER BY created_at DESC');
    $managers = $stmt->fetchAll();
    echo json_encode($managers);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
