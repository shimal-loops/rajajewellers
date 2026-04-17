<?php
session_start();

if (isset($_SESSION['manager_id'])) {
    echo json_encode([
        "status" => "success", 
        "authenticated" => true,
        "username" => $_SESSION['username']
    ]);
} else {
    http_response_code(401);
    echo json_encode([
        "status" => "error", 
        "authenticated" => false,
        "message" => "Not authenticated"
    ]);
}
?>
