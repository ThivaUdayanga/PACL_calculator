<?php
/**
 * Database Configuration & PDO Connection
 * Automatically loads .env file if present, with fallback defaults
 */

// Lightweight .env file loader (no Composer/external library needed)
function loadEnvFile($path = __DIR__ . '/.env') {
    if (!file_exists($path) || !is_readable($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            list($name, $value) = explode('=', $line, 2);
            $name  = trim($name);
            $value = trim($value);

            // Strip optional quotes
            $len = strlen($value);
            if ($len >= 2 && (($value[0] === '"' && $value[$len - 1] === '"') || ($value[0] === "'" && $value[$len - 1] === "'"))) {
                $value = substr($value, 1, -1);
            }

            // Set in environment if not already set
            if (getenv($name) === false) {
                putenv("$name=$value");
                $_ENV[$name] = $value;
                $_SERVER[$name] = $value;
            }
        }
    }
}
loadEnvFile();

define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DB_PORT') ?: '3307'); // Default MariaDB port in WAMP; automatically tries 3306 as well
define('DB_NAME', getenv('DB_NAME') ?: 'pacl_calculator');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') !== false ? getenv('DB_PASS') : '');
define('DB_CHARSET', 'utf8mb4');

function getDbConnection() {
    static $pdo = null;

    if ($pdo === null) {
        $portsToTry = [DB_PORT, '3306'];
        $lastException = null;

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        foreach (array_unique($portsToTry) as $port) {
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                DB_HOST,
                $port,
                DB_NAME,
                DB_CHARSET
            );

            try {
                $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
                return $pdo;
            } catch (PDOException $e) {
                $lastException = $e;
            }
        }

        // If all attempts failed
        http_response_code(500);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'message' => 'Database connection error: ' . ($lastException ? $lastException->getMessage() : 'Unable to connect to database.')
        ]);
        exit;
    }

    return $pdo;
}
