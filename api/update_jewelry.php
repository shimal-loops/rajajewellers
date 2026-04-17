<?php
require_once 'db_config.php';
require_once 'auth_utils.php';
verify_auth();

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid data provided']);
    exit;
}

try {
    // Build dynamic update query based on provided fields
    $updates = [];
    $params = [];
    
    if (isset($data['name'])) {
        $updates[] = 'name = ?';
        $params[] = $data['name'];
    }
    
    if (isset($data['category'])) {
        $updates[] = 'category = ?';
        $params[] = $data['category'];
    }

    if (isset($data['height'])) {
        $updates[] = 'height = ?';
        $params[] = (float)$data['height'];
    }

    if (isset($data['width'])) {
        $updates[] = 'width = ?';
        $params[] = (float)$data['width'];
    }


    if (isset($data['image']['base64'])) {
        $base64 = $data['image']['base64'];
        $updates[] = 'base64 = ?';
        $params[] = $base64;

        // Save as file
        $assetsDir = '../jewelry_assets';
        if (!is_dir($assetsDir)) {
            mkdir($assetsDir, 0777, true);
        }
        $fileName = 'jewelry_' . $data['id'] . '_' . time() . '.jpg';
        $filePath = $assetsDir . '/' . $fileName;
        $relativePath = 'jewelry_assets/' . $fileName;

        if (preg_match('/^data:image\/(\w+);base64,/', $base64, $type)) {
            $imgData = base64_decode(substr($base64, strpos($base64, ',') + 1));
            if ($imgData !== false) {
                file_put_contents($filePath, $imgData);
                $updates[] = 'preview_url = ?';
                $params[] = $relativePath;
            }
        }
    } else if (isset($data['image']['previewUrl'])) {
        $updates[] = 'preview_url = ?';
        $params[] = $data['image']['previewUrl'];
    }
    
    if (empty($updates)) {
        http_response_code(400);
        echo json_encode(['error' => 'No fields to update']);
        exit;
    }
    
    // Add ID to params
    $params[] = $data['id'];
    
    $sql = 'UPDATE jewelry_items SET ' . implode(', ', $updates) . ' WHERE id = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    if ($stmt->rowCount() > 0) {
        echo json_encode(['message' => 'Item updated successfully']);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Item not found']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
