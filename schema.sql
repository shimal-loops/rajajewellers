CREATE TABLE IF NOT EXISTS jewelry_items (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    image_path VARCHAR(255) DEFAULT NULL,
    base64 LONGTEXT NULL,
    preview_url LONGTEXT,
    height DECIMAL(10, 2) DEFAULT 0,
    width DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_fittings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(255) NOT NULL,
    user_email VARCHAR(255),
    user_phone VARCHAR(50),
    original_portrait_path VARCHAR(255),
    fitting_result_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS managers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    google_id VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NULL,
    status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default manager: admin / admin123
-- Password hash for 'admin123'
INSERT IGNORE INTO managers (username, password_hash, status)
VALUES ('admin', '$2y$10$P7OszmOayMShuQT9ym/Qtg.M0eyksHiJhVOru5Hy', 'APPROVED');
