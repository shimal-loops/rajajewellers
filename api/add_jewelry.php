<?php
require_once 'db_config.php';
require_once 'auth_utils.php';
verify_auth();

// Set error reporting to catch everything
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't output raw errors to break JSON

$rawData = file_get_contents('php://input');
$data = json_decode($rawData, true);

if (!$data) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error', 
        'error' => 'Invalid JSON input', 
        'details' => json_last_error_msg()
    ]);
    exit;
}

try {
    $base64 = $data['image']['base64'];
    $previewUrl = $data['image']['previewUrl'];

    // Define assets directory in public for standard static serving
    $assetsDir = '../public/jewelry_assets';
    if (!is_dir($assetsDir)) {
        mkdir($assetsDir, 0777, true);
    }

    // Save base64 as a file for better performance
    $fileName = 'jewelry_' . $data['id'] . '_' . time() . '.jpg';
    $filePath = $assetsDir . '/' . $fileName;
    $relativePath = 'jewelry_assets/' . $fileName;

    if (preg_match('/^data:image\/(\w+);base64,/', $base64, $type)) {
        $imgData = base64_decode(substr($base64, strpos($base64, ',') + 1));
        if ($imgData !== false) {
            file_put_contents($filePath, $imgData);
            $previewUrl = $relativePath;
        }
    }

    $height = isset($data['height']) ? (float)$data['height'] : 0;
    $width = isset($data['width']) ? (float)$data['width'] : 0;

    // Optimization: Stop storing massive base64 in the DB.
    // Insert with the new image_path column.
    $stmt = $pdo->prepare('INSERT INTO jewelry_items (id, name, category, image_path, preview_url, height, width) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        trim($data['id']),
        trim($data['name']),
        trim($data['category']),
        $relativePath, // Save filename/path to DB
        $previewUrl,
        $height,
        $width
    ]);

    echo json_encode([
        'status' => 'success',
        'message' => 'Item added successfully',
        'id' => $data['id'],
        'preview_url' => $previewUrl
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'error' => 'Database failure: ' . $e->getMessage(),
        'code' => $e->getCode(),
        'info' => $pdo->errorInfo()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'error' => 'Server error: ' . $e->getMessage()
    ]);
}
?>
