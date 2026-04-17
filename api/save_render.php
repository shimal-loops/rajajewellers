<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

require_once 'db_config.php';

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['userName']) || !isset($data['personImage']) || !isset($data['resultImage'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required data']);
    exit;
}

$userName = preg_replace('/[^a-zA-Z0-9]/', '_', $data['userName']);
$userEmail = isset($data['userEmail']) ? $data['userEmail'] : null;
$userPhone = isset($data['userPhone']) ? $data['userPhone'] : null;

$timestamp = time();
$saveDirName = $userName . '_' . $timestamp;
$baseUploadsDir = '../uploads';
$fullSaveDir = $baseUploadsDir . '/' . $saveDirName;

// Ensure base uploads directory exists and is writable
if (!is_dir($baseUploadsDir)) {
    mkdir($baseUploadsDir, 0777, true);
    chmod($baseUploadsDir, 0777);
}

if (!is_writable($baseUploadsDir)) {
    echo json_encode(['error' => 'Uploads directory is not writable. Please check permissions.']);
    exit;
}

if (!is_dir($fullSaveDir)) {
    mkdir($fullSaveDir, 0777, true);
    chmod($fullSaveDir, 0777);
}

function saveBase64Image($base64String, $fullDirPath, $fileNameWithoutExt) {
    if (preg_match('/^data:image\/(\w+);base64,/', $base64String, $type)) {
        $extension = strtolower($type[1]); // png, jpeg, etc.
        if ($extension === 'jpeg') $extension = 'jpg';
        
        $data = substr($base64String, strpos($base64String, ',') + 1);
        $data = base64_decode($data);
        
        if ($data === false) return false;
        
        $fileName = $fileNameWithoutExt . '.' . $extension;
        $filePath = $fullDirPath . '/' . $fileName;
        
        if (file_put_contents($filePath, $data)) {
            return $fileName;
        }
    }
    return false;
}

$personFileName = saveBase64Image($data['personImage'], $fullSaveDir, 'original_portrait');
$resultFileName = saveBase64Image($data['resultImage'], $fullSaveDir, 'fitting_result');

if ($personFileName !== false && $resultFileName !== false) {
    $portraitRelativePath = 'uploads/' . $saveDirName . '/' . $personFileName;
    $resultRelativePath = 'uploads/' . $saveDirName . '/' . $resultFileName;

    try {
        $stmt = $pdo->prepare('INSERT INTO user_fittings (user_name, user_email, user_phone, original_portrait_path, fitting_result_path) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([
            $data['userName'],
            $userEmail,
            $userPhone,
            $portraitRelativePath,
            $resultRelativePath
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Data and images saved successfully',
            'portrait' => $portraitRelativePath,
            'result' => $resultRelativePath
        ]);
    } catch (Exception $e) {
        echo json_encode([
            'success' => true,
            'message' => 'Images saved but database record failed: ' . $e->getMessage(),
            'portrait' => $portraitRelativePath
        ]);
    }
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to decode or save images. Check if the image format is supported.']);
}
?>
