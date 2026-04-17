<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// PRODUCTION Database Configuration for Hostinger
// IMPORTANT: Update these values with your actual Hostinger database credentials

$host = 'mysql.hostinger.com'; // Usually 'localhost' on Hostinger
$db   = 'u451149423_jewelry'; // Replace with your actual database name from Hostinger
$user = 'u451149423_raja'; // Replace with your actual database username
$pass = '@@t7|tUd8'; // Replace with your actual database password
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
     $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
     // Log error for debugging (make sure error_log is configured)
     error_log("Database connection failed: " . $e->getMessage());
     
     // Return user-friendly error
     http_response_code(500);
     echo json_encode([
         'error' => 'Database connection failed. Please contact support.',
         'details' => $e->getMessage() // Remove this line in production for security
     ]);
     exit;
}
?>
