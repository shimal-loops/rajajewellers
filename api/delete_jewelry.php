require_once 'db_config.php';
require_once 'auth_utils.php';
verify_auth();

$id = $_GET['id'] ?? null;

if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'No ID provided']);
    exit;
}

try {
    // 1. Fetch path to delete file from disk
    $stmt = $pdo->prepare('SELECT image_path FROM jewelry_items WHERE id = ?');
    $stmt->execute([$id]);
    $item = $stmt->fetch();

    if ($item && !empty($item['image_path'])) {
        $filePath = '../public/' . $item['image_path'];
        if (file_exists($filePath)) {
            unlink($filePath);
        }
    }

    // 2. Delete database entry
    $stmt = $pdo->prepare('DELETE FROM jewelry_items WHERE id = ?');
    $stmt->execute([$id]);
    echo json_encode(['message' => 'Item and its asset deleted successfully']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
