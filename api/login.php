<?php
require_once 'db_config.php';
session_start();

$data = json_decode(file_get_contents("php://input"), true);
$username = $data['username'] ?? '';
$password = $data['password'] ?? '';

if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Username and password required"]);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT * FROM managers WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        // Check Status
        if ($user['status'] === 'PENDING') {
            http_response_code(403);
            echo json_encode(["status" => "error", "message" => "Your account is pending approval by an administrator."]);
            exit;
        } elseif ($user['status'] === 'REJECTED') {
            http_response_code(403);
            echo json_encode(["status" => "error", "message" => "Your access has been rejected by an administrator."]);
            exit;
        }

        $_SESSION['manager_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        
        // Update last login
        $updateStmt = $pdo->prepare("UPDATE managers SET last_login = CURRENT_TIMESTAMP WHERE id = ?");
        $updateStmt->execute([$user['id']]);

        echo json_encode(["status" => "success", "message" => "Login successful"]);
    } else {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "Invalid credentials"]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}
?>
