<?php
require_once 'db_config.php';

$username = 'admin';
$password = 'admin123';
$hash = password_hash($password, PASSWORD_BCRYPT);

try {
    $stmt = $pdo->prepare("UPDATE managers SET password_hash = ? WHERE username = ?");
    $stmt->execute([$hash, $username]);
    
    if ($stmt->rowCount() > 0) {
        echo "Password for '$username' has been successfully updated to '$password'.<br>";
        echo "<strong>IMPORTANT: Please delete this file (reset_password.php) from your server immediately for security.</strong>";
    } else {
        echo "No changes made. Either the user '$username' does not exist or the password was already set to this value.";
    }
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
