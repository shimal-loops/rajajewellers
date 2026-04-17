require_once 'db_config.php';
require_once 'auth_utils.php';
verify_auth();

try {
    $stmt = $pdo->query('SELECT * FROM user_fittings ORDER BY created_at DESC');
    $fittings = [];
    while ($row = $stmt->fetch()) {
        $fittings[] = [
            'id' => $row['id'],
            'userName' => $row['user_name'],
            'userEmail' => $row['user_email'],
            'userPhone' => $row['user_phone'],
            'portraitPath' => $row['original_portrait_path'],
            'resultPath' => $row['fitting_result_path'],
            'createdAt' => $row['created_at']
        ];
    }
    echo json_encode($fittings);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
