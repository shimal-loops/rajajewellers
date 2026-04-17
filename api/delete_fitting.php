require_once 'db_config.php';
require_once 'auth_utils.php';
verify_auth();

$id = isset($_GET['id']) ? $_GET['id'] : null;

if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'No ID provided']);
    exit;
}

try {
    // Get paths first to delete files
    $stmt = $pdo->prepare('SELECT original_portrait_path, fitting_result_path FROM user_fittings WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    if ($row) {
        // Paths are like 'uploads/FolderName/file.png'
        // Need to delete the directory
        $dir = dirname('../' . $row['original_portrait_path']);
        
        function deleteDirectory($dir) {
            if (!file_exists($dir)) return true;
            if (!is_dir($dir)) return unlink($dir);
            foreach (scandir($dir) as $item) {
                if ($item == '.' || $item == '..') continue;
                if (!deleteDirectory($dir . DIRECTORY_SEPARATOR . $item)) return false;
            }
            return rmdir($dir);
        }

        deleteDirectory($dir);
    }

    $stmt = $pdo->prepare('DELETE FROM user_fittings WHERE id = ?');
    $stmt->execute([$id]);
    echo json_encode(['message' => 'Fitting deleted']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
