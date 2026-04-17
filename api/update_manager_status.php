<?php
require_once 'db_config.php';
require_once 'auth_utils.php';
verify_auth();

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['id']) || !isset($data['status'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing ID or status']);
    exit;
}

$id = $data['id'];
$status = $data['status'];
$action = $data['action'] ?? 'update';

try {
    if ($action === 'delete') {
        // Prevent deleting yourself
        if ($id == $_SESSION['manager_id']) {
            http_response_code(400);
            echo json_encode(['error' => 'You cannot delete your own account']);
            exit;
        }
        $stmt = $pdo->prepare('DELETE FROM managers WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['message' => 'Manager deleted']);
    } else {
        if (!in_array($status, ['PENDING', 'APPROVED', 'REJECTED'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid status']);
            exit;
        }
        $stmt = $pdo->prepare('UPDATE managers SET status = ? WHERE id = ?');
        $stmt->execute([$status, $id]);
        echo json_encode(['message' => 'Status updated']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
