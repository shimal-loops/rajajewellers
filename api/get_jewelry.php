<?php
require_once 'db_config.php';

try {
    // Optimization: Do NOT fetch the massive base64 column here. 
    // It's fetched on-demand by the frontend only when needed.
    $stmt = $pdo->query('SELECT id, name, category, image_path, preview_url, height, width FROM jewelry_items ORDER BY created_at DESC');
    $items = [];
    while ($row = $stmt->fetch()) {
        // Use image_path as the primary source, fallback to preview_url
        $previewUrl = !empty($row['image_path']) ? $row['image_path'] : $row['preview_url'];
        
        $items[] = [
            'id' => $row['id'],
            'name' => $row['name'],
            'category' => trim($row['category']),
            'image' => [
                'base64' => null, // Excluded for performance
                'previewUrl' => $previewUrl,
                'name' => $row['name']
            ],
            'height' => (float)$row['height'],
            'width' => (float)$row['width']
        ];
    }
    echo json_encode($items);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
