<?php
require_once 'db_config.php';

// This script will compress existing jewelry images to improve performance on Hostinger.
// It targets high-resolution images and converts them to optimized JPEGs.

header('Content-Type: text/plain');
echo "Starting Database Optimization...\n";

try {
    $stmt = $pdo->query("SELECT id, name, base64 FROM jewelry_items");
    $items = $stmt->fetchAll();
    
    $processedCount = 0;
    $optimizedCount = 0;
    
    foreach ($items as $item) {
        $processedCount++;
        $id = $item['id'];
        $base64 = $item['base64'];
        
        if (empty($base64)) continue;
        
        // Check size (rough estimate)
        $sizeKB = strlen($base64) * 0.75 / 1024;
        
        if ($sizeKB > 300) { // Optimize if larger than 300KB
            echo "Optimizing [{$item['name']}] (Current: " . round($sizeKB, 2) . " KB)... ";
            
            // Extract image data
            if (strpos($base64, ',') !== false) {
                $data = explode(',', $base64)[1];
            } else {
                $data = $base64;
            }
            
            $imgData = base64_decode($data);
            $img = imagecreatefromstring($imgData);
            
            if ($img) {
                $width = imagesx($img);
                $height = imagesy($img);
                
                // Max width 800px
                $maxWidth = 800;
                if ($width > $maxWidth) {
                    $newWidth = $maxWidth;
                    $newHeight = ($height / $width) * $newWidth;
                    
                    $newImg = imagecreatetruecolor($newWidth, $newHeight);
                    
                    // Maintain transparency for some types if needed, but we force white for JPEG
                    $white = imagecolorallocate($newImg, 255, 255, 255);
                    imagefill($newImg, 0, 0, $white);
                    
                    imagecopyresampled($newImg, $img, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
                    
                    // Capture output
                    ob_start();
                    imagejpeg($newImg, null, 70); // 70% quality
                    $optimizedData = ob_get_clean();
                    
                    $newBase64 = 'data:image/jpeg;base64,' . base64_encode($optimizedData);
                    
                    // Update DB
                    $updateStmt = $pdo->prepare("UPDATE jewelry_items SET base64 = ?, preview_url = ? WHERE id = ?");
                    $updateStmt->execute([$newBase64, $newBase64, $id]);
                    
                    imagedestroy($newImg);
                    $optimizedCount++;
                    echo "Optimized to " . round(strlen($newBase64) * 0.75 / 1024, 2) . " KB.\n";
                } else {
                    echo "Skipped (width within limits).\n";
                }
                imagedestroy($img);
            } else {
                echo "Failed to process image.\n";
            }
        }
    }
    
    echo "\nOptimization Complete!\n";
    echo "Total Processed: $processedCount\n";
    echo "Total Optimized: $optimizedCount\n";

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage();
}
?>
