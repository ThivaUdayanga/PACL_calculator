<?php
/**
 * Database Configuration & PDO Connection
 * Target Database: pacl_calculator (MariaDB 10.2 / WampServer)
 */

define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3307'); // Default MariaDB port in WAMP
define('DB_NAME', 'pacl_calculator');
define('DB_USER', 'root');
define('DB_PASS', '');     // Default WampServer root password is empty
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
