<?php
require_once 'db_config.php';
session_start();

$data = json_decode(file_get_contents("php://input"), true);
$id_token = $data['credential'] ?? '';

if (empty($id_token)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Google token required"]);
    exit;
}

// Verify token with Google
$url = "https://oauth2.googleapis.com/tokeninfo?id_token=" . $id_token;
$response = file_get_contents($url);
$payload = json_decode($response, true);

if (!$payload || isset($payload['error'])) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Invalid Google token"]);
    exit;
}

$google_id = $payload['sub'];
$email = $payload['email'];
$name = $payload['name'] ?? 'Google User';

try {
    // Check if manager exists by google_id or email
    $stmt = $pdo->prepare("SELECT * FROM managers WHERE google_id = ? OR email = ?");
    $stmt->execute([$google_id, $email]);
    $user = $stmt->fetch();

    if ($user) {
        // Update google_id if it wasn't set (linked by email)
        if (empty($user['google_id'])) {
            $updateStmt = $pdo->prepare("UPDATE managers SET google_id = ? WHERE id = ?");
            $updateStmt->execute([$google_id, $user['id']]);
        }
        
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
    } else {
        // Automatically create a PENDING account for unknown Google users
        $insertStmt = $pdo->prepare("INSERT INTO managers (username, email, google_id, status) VALUES (?, ?, ?, 'PENDING')");
        $insertStmt->execute([$email, $email, $google_id]);
        
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "Account created! Please wait for an administrator to approve your access."]);
        exit;
    }

    $_SESSION['manager_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    
    // Update last login
    $updateStmt = $pdo->prepare("UPDATE managers SET last_login = CURRENT_TIMESTAMP WHERE id = ?");
    $updateStmt->execute([$user['id']]);

    echo json_encode(["status" => "success", "message" => "Google login successful", "username" => $user['username']]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}
?>
