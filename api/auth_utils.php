<?php
session_start();

function verify_auth() {
    if (!isset($_SESSION['manager_id'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "Unauthorized access. Please login."]);
        exit;
    }
}
?>
