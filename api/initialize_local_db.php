<?php
// Local XAMPP Setup Script
// This script will create the database 'raja' if it doesn't exist and initialize the tables.

$host = 'localhost';
$user = 'root';
$pass = '';
$dbName = 'raja';

try {
    // 1. Connect without database to create it
    $pdo = new PDO("mysql:host=$host", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Connecting to MySQL at localhost...\n";
    
    // 2. Create database if not exists
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    echo "Database '$dbName' checked/created.\n";
    
    // 3. Connect to the 'raja' database
    $pdo->exec("USE `$dbName` ");
    $pdo = new PDO("mysql:host=$host;dbname=$dbName", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // 4. Read schema.sql
    $schemaFile = __DIR__ . '/../schema.sql';
    if (!file_exists($schemaFile)) {
        throw new Exception("schema.sql not found at $schemaFile");
    }
    
    $sql = file_get_contents($schemaFile);
    
    // 5. Execute schema.sql
    // Note: We need to split the SQL into individual commands if there are multiple
    // but PDO's exec can sometimes handle multiple if the driver allows.
    // However, it's safer to use query or split.
    
    echo "Initializing tables from schema.sql...\n";
    $pdo->exec($sql);
    
    echo "SUCCESS: Local database 'raja' is ready!\n";
    echo "Default Admin: login: 'admin', password: 'admin123'\n";

} catch (PDOException $e) {
    die("DATABASE ERROR: " . $e->getMessage() . "\n");
} catch (Exception $e) {
    die("ERROR: " . $e->getMessage() . "\n");
}
?>
