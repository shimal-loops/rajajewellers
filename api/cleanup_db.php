<?php
header('Content-Type: text/plain');
require 'api/db_config.php';

echo "Starting Database Cleanup...\n";

try {
    $stmt = $pdo->query('SELECT id, name, category FROM jewelry_items');
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $fixed_count = 0;
    foreach ($items as $item) {
        $old_id = $item['id'];
        $clean_id = trim($old_id);
        $clean_name = trim($item['name']);
        $clean_category = trim($item['category']);
        
        $has_changes = ($old_id !== $clean_id) || ($item['name'] !== $clean_name) || ($item['category'] !== $clean_category);
        
        if ($has_changes) {
            echo "Fixing item: '$old_id' -> '$clean_id'\n";
            
            // If ID itself changed, we need careful update because it is a PK
            if ($old_id !== $clean_id) {
                // Check if the clean version already exists to avoid collisions
                $check = $pdo->prepare("SELECT id FROM jewelry_items WHERE id = ?");
                $check->execute([$clean_id]);
                if ($check->fetch()) {
                    echo "  WARNING: Clean ID already exists. Deleting redundant corrupted entry.\n";
                    $del = $pdo->prepare("DELETE FROM jewelry_items WHERE id = ?");
                    $del->execute([$old_id]);
                } else {
                    $update = $pdo->prepare("UPDATE jewelry_items SET id = ?, name = ?, category = ? WHERE id = ?");
                    $update->execute([$clean_id, $clean_name, $clean_category, $old_id]);
                }
            } else {
                $update = $pdo->prepare("UPDATE jewelry_items SET name = ?, category = ? WHERE id = ?");
                $update->execute([$clean_name, $clean_category, $old_id]);
            }
            $fixed_count++;
        }
    }
    
    echo "\nCleanup Finished. Fixed $fixed_count items.\n";

} catch (Exception $e) {
    echo "CRITICAL ERROR: " . $e->getMessage() . "\n";
}
