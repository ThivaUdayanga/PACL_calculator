<?php
/**
 * RESTful API Handler for PACL Jar Test Records CRUD Operations
 * Supports GET (Read), POST (Create/Seed), PUT (Update), and DELETE (Delete)
 */

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db.php';
$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

// Helper to send JSON response
function jsonResponse($success, $data = null, $message = '', $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data'    => $data
    ]);
    exit;
}

// Format record numeric types
function formatRecord($record) {
    if (!$record) return null;
    return [
        'id'         => (int)$record['id'],
        'ph'         => (float)$record['ph'],
        'turbidity'  => (float)$record['turbidity'],
        'pacl'       => (float)$record['pacl'],
        'test_date'  => $record['test_date'] ?? 'Lab Series',
        'status'     => $record['status'] ?? 'Verified',
        'created_at' => $record['created_at'] ?? null,
        'updated_at' => $record['updated_at'] ?? null,
    ];
}

switch ($method) {
    // ----------------------------------------------------
    // READ / GET: Fetch all records, single record, or stats
    // ----------------------------------------------------
    case 'GET':
        // Check for seed action via GET
        if (isset($_GET['action']) && $_GET['action'] === 'seed') {
            $force = isset($_GET['force']) && $_GET['force'] == '1';
            $count = $pdo->query("SELECT COUNT(*) FROM `jar_test_records`")->fetchColumn();

            if ($count == 0 || $force) {
                if (file_exists(__DIR__ . '/seed_db.php')) {
                    ob_start();
                    require __DIR__ . '/seed_db.php';
                    $out = ob_get_clean();
                    $result = json_decode($out, true);
                    jsonResponse(true, $result, 'Database seeded successfully.');
                }
            } else {
                jsonResponse(true, ['count' => (int)$count], "Database already contains $count records.");
            }
        }

        // Check for stats request
        if (isset($_GET['action']) && $_GET['action'] === 'stats') {
            $totalStmt = $pdo->query("SELECT COUNT(*) as total, COUNT(DISTINCT ph) as ph_series_count, MIN(turbidity) as min_turb, MAX(turbidity) as max_turb, MIN(pacl) as min_pacl, MAX(pacl) as max_pacl, AVG(pacl) as avg_pacl FROM `jar_test_records`");
            $stats = $totalStmt->fetch();
            jsonResponse(true, [
                'total_records'   => (int)$stats['total'],
                'ph_series_count' => (int)$stats['ph_series_count'],
                'min_turbidity'   => (float)$stats['min_turb'],
                'max_turbidity'   => (float)$stats['max_turb'],
                'min_pacl'        => (float)$stats['min_pacl'],
                'max_pacl'        => (float)$stats['max_pacl'],
                'avg_pacl'        => round((float)$stats['avg_pacl'], 2),
            ], 'Dataset statistics retrieved successfully.');
        }

        // Check for duplicate record existence check
        if (isset($_GET['action']) && $_GET['action'] === 'check_duplicate') {
            $ph = isset($_GET['ph']) && is_numeric($_GET['ph']) ? (float)$_GET['ph'] : null;
            $turbidity = isset($_GET['turbidity']) && is_numeric($_GET['turbidity']) ? (float)$_GET['turbidity'] : null;
            $excludeId = isset($_GET['exclude_id']) && is_numeric($_GET['exclude_id']) ? (int)$_GET['exclude_id'] : null;

            if ($ph === null || $turbidity === null) {
                jsonResponse(false, null, 'Valid pH and turbidity values are required to check for duplicates.', 400);
            }

            $sql = "SELECT * FROM `jar_test_records` WHERE ABS(`ph` - ?) < 0.001 AND ABS(`turbidity` - ?) < 0.001";
            $params = [$ph, $turbidity];
            if ($excludeId !== null) {
                $sql .= " AND `id` != ?";
                $params[] = $excludeId;
            }
            $sql .= " LIMIT 1";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $existing = $stmt->fetch();

            if ($existing) {
                jsonResponse(true, [
                    'duplicate' => true,
                    'existing'  => formatRecord($existing)
                ], 'Duplicate record found.');
            } else {
                jsonResponse(true, [
                    'duplicate' => false,
                    'existing'  => null
                ], 'No duplicate record found.');
            }
        }

        // Fetch single record by ID
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("SELECT * FROM `jar_test_records` WHERE `id` = ?");
            $stmt->execute([(int)$_GET['id']]);
            $record = $stmt->fetch();
            if ($record) {
                jsonResponse(true, formatRecord($record), 'Record fetched successfully.');
            } else {
                jsonResponse(false, null, 'Record not found.', 404);
            }
        } else {
            // --- Server-side pagination with optional search/series filter ---
            $page  = isset($_GET['page'])  && is_numeric($_GET['page'])  ? max(1, (int)$_GET['page'])  : null;
            $limit = isset($_GET['limit']) && is_numeric($_GET['limit']) ? max(1, (int)$_GET['limit']) : null;
            $search = isset($_GET['search']) ? trim($_GET['search']) : '';
            $series = isset($_GET['series']) && is_numeric($_GET['series']) ? (float)$_GET['series'] : null;
            // Legacy single-ph filter support
            if ($series === null && isset($_GET['ph']) && is_numeric($_GET['ph'])) {
                $series = (float)$_GET['ph'];
            }

            // Build WHERE clause
            $where  = [];
            $params = [];
            if ($series !== null) {
                $where[]  = 'ABS(`ph` - ?) < 0.001';
                $params[] = $series;
            }
            if ($search !== '') {
                $like     = '%' . $search . '%';
                $where[]  = '(CAST(`ph` AS CHAR) LIKE ? OR CAST(`turbidity` AS CHAR) LIKE ? OR CAST(`pacl` AS CHAR) LIKE ? OR DATE(`created_at`) LIKE ? OR CAST(`id` AS CHAR) LIKE ?)';
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
            }

            $whereSql = count($where) ? 'WHERE ' . implode(' AND ', $where) : '';

            // Count total matching rows
            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM `jar_test_records` $whereSql");
            $countStmt->execute($params);
            $total = (int)$countStmt->fetchColumn();

            // If pagination requested
            if ($page !== null && $limit !== null) {
                $totalPages = max(1, (int)ceil($total / $limit));
                $page       = min($page, $totalPages);
                $offset     = ($page - 1) * $limit;

                $dataStmt = $pdo->prepare("SELECT * FROM `jar_test_records` $whereSql ORDER BY `ph` ASC, `turbidity` ASC LIMIT ? OFFSET ?");
                $dataStmt->execute(array_merge($params, [$limit, $offset]));
                $records   = $dataStmt->fetchAll();
                $formatted = array_map('formatRecord', $records);

                jsonResponse(true, [
                    'records'     => $formatted,
                    'total'       => $total,
                    'page'        => $page,
                    'limit'       => $limit,
                    'total_pages' => $totalPages,
                ], 'Records retrieved successfully (paginated).');
            } else {
                // No pagination: return all (backwards-compat for app.js interpolation)
                $dataStmt = $pdo->prepare("SELECT * FROM `jar_test_records` $whereSql ORDER BY `ph` ASC, `turbidity` ASC");
                $dataStmt->execute($params);
                $records   = $dataStmt->fetchAll();
                $formatted = array_map('formatRecord', $records);
                jsonResponse(true, $formatted, 'Records retrieved successfully.');
            }
        }
        break;

    // ----------------------------------------------------
    // CREATE / POST: Add a new jar test record OR trigger seed
    // ----------------------------------------------------
    case 'POST':
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true);

        if (!$payload && !empty($_POST)) {
            $payload = $_POST;
        }

        // Check for seed action
        if ((isset($_GET['action']) && $_GET['action'] === 'seed') || (isset($payload['action']) && $payload['action'] === 'seed')) {
            $force = isset($_GET['force']) || !empty($payload['force']);
            $count = $pdo->query("SELECT COUNT(*) FROM `jar_test_records`")->fetchColumn();
            
            if ($count == 0 || $force) {
                if (file_exists(__DIR__ . '/seed_db.php')) {
                    ob_start();
                    require __DIR__ . '/seed_db.php';
                    $out = ob_get_clean();
                    $result = json_decode($out, true);
                    jsonResponse(true, $result, 'Database seeded successfully.');
                }
            } else {
                jsonResponse(true, ['count' => (int)$count], "Database already contains $count records.");
            }
        }

        $ph = isset($payload['ph']) && is_numeric($payload['ph']) ? (float)$payload['ph'] : null;
        $turbidity = isset($payload['turbidity']) && is_numeric($payload['turbidity']) ? (float)$payload['turbidity'] : null;
        $pacl = isset($payload['pacl']) && is_numeric($payload['pacl']) ? (float)$payload['pacl'] : null;
        $testDate = !empty($payload['test_date']) ? trim($payload['test_date']) : (!empty($payload['date']) ? trim($payload['date']) : 'Manual Entry');
        $status = !empty($payload['status']) ? trim($payload['status']) : 'Verified';

        if ($ph === null || $turbidity === null || $pacl === null) {
            jsonResponse(false, null, 'Missing required fields: ph, turbidity, or pacl must be numeric.', 400);
        }

        // Validate duplicate record: each pH value should have a single turbidity value
        $checkStmt = $pdo->prepare("
            SELECT * FROM `jar_test_records`
            WHERE ABS(`ph` - ?) < 0.001 AND ABS(`turbidity` - ?) < 0.001
            ORDER BY `id` ASC
            LIMIT 1
        ");
        $checkStmt->execute([$ph, $turbidity]);
        $existing = $checkStmt->fetch();

        if ($existing) {
            $allowOverwrite = !empty($payload['overwrite']) || !empty($payload['update_duplicate']);
            if ($allowOverwrite) {
                // Update existing record with the new PACL dosage result
                $stmtUpdate = $pdo->prepare("
                    UPDATE `jar_test_records`
                    SET `pacl` = ?,
                        `test_date` = COALESCE(?, `test_date`),
                        `status` = COALESCE(?, `status`)
                    WHERE `id` = ?
                ");
                $stmtUpdate->execute([$pacl, $testDate, $status, $existing['id']]);

                $stmtUp = $pdo->prepare("SELECT * FROM `jar_test_records` WHERE `id` = ?");
                $stmtUp->execute([$existing['id']]);
                $updatedRecord = $stmtUp->fetch();

                jsonResponse(true, formatRecord($updatedRecord), "Record #{$existing['id']} updated successfully with new PACL dosage result.", 200);
            } else {
                // Reject duplicate record creation with 409 Conflict
                jsonResponse(false, [
                    'duplicate' => true,
                    'existing'  => formatRecord($existing)
                ], "A record with pH {$ph} and Turbidity {$turbidity} NTU already exists (Record #{$existing['id']}).", 409);
            }
        }

        $stmt = $pdo->prepare("
            INSERT INTO `jar_test_records` (`ph`, `turbidity`, `pacl`, `test_date`, `status`)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$ph, $turbidity, $pacl, $testDate, $status]);
        $newId = (int)$pdo->lastInsertId();

        $stmtNew = $pdo->prepare("SELECT * FROM `jar_test_records` WHERE `id` = ?");
        $stmtNew->execute([$newId]);
        $newRecord = $stmtNew->fetch();

        jsonResponse(true, formatRecord($newRecord), 'Record added successfully.', 201);
        break;

    // ----------------------------------------------------
    // UPDATE / PUT: Modify an existing record
    // ----------------------------------------------------
    case 'PUT':
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true);

        if (!$payload && !empty($_POST)) {
            $payload = $_POST;
        }

        $id = isset($payload['id']) ? (int)$payload['id'] : (isset($_GET['id']) ? (int)$_GET['id'] : null);
        $ph = isset($payload['ph']) && is_numeric($payload['ph']) ? (float)$payload['ph'] : null;
        $turbidity = isset($payload['turbidity']) && is_numeric($payload['turbidity']) ? (float)$payload['turbidity'] : null;
        $pacl = isset($payload['pacl']) && is_numeric($payload['pacl']) ? (float)$payload['pacl'] : null;
        $testDate = isset($payload['test_date']) ? trim($payload['test_date']) : (isset($payload['date']) ? trim($payload['date']) : null);
        $status = isset($payload['status']) ? trim($payload['status']) : null;

        if (!$id || $ph === null || $turbidity === null || $pacl === null) {
            jsonResponse(false, null, 'Valid ID, pH, turbidity, and PACL values are required for update.', 400);
        }

        // Validate duplicate record: ensure another record doesn't already have the same (pH, turbidity)
        $checkStmt = $pdo->prepare("
            SELECT * FROM `jar_test_records`
            WHERE ABS(`ph` - ?) < 0.001 AND ABS(`turbidity` - ?) < 0.001 AND `id` != ?
            LIMIT 1
        ");
        $checkStmt->execute([$ph, $turbidity, $id]);
        $duplicateOther = $checkStmt->fetch();

        if ($duplicateOther) {
            jsonResponse(false, [
                'duplicate' => true,
                'existing'  => formatRecord($duplicateOther)
            ], "Cannot update: Another record (#{$duplicateOther['id']}) already exists with pH {$ph} and Turbidity {$turbidity} NTU.", 409);
        }

        $stmt = $pdo->prepare("
            UPDATE `jar_test_records`
            SET `ph` = ?, `turbidity` = ?, `pacl` = ?,
                `test_date` = COALESCE(?, `test_date`),
                `status` = COALESCE(?, `status`)
            WHERE `id` = ?
        ");
        $stmt->execute([$ph, $turbidity, $pacl, $testDate, $status, $id]);

        $stmtUp = $pdo->prepare("SELECT * FROM `jar_test_records` WHERE `id` = ?");
        $stmtUp->execute([$id]);
        $updatedRecord = $stmtUp->fetch();

        if ($updatedRecord) {
            jsonResponse(true, formatRecord($updatedRecord), 'Record updated successfully.');
        } else {
            jsonResponse(false, null, 'Record not found for update.', 404);
        }
        break;

    // ----------------------------------------------------
    // DELETE: Remove a record
    // ----------------------------------------------------
    case 'DELETE':
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true);

        $id = isset($payload['id']) ? (int)$payload['id'] : (isset($_GET['id']) ? (int)$_GET['id'] : null);

        if (!$id) {
            jsonResponse(false, null, 'Record ID is required for deletion.', 400);
        }

        $stmt = $pdo->prepare("DELETE FROM `jar_test_records` WHERE `id` = ?");
        $stmt->execute([$id]);

        if ($stmt->rowCount() > 0) {
            jsonResponse(true, ['id' => $id], 'Record deleted successfully.');
        } else {
            jsonResponse(false, null, 'Record not found or already deleted.', 404);
        }
        break;

    default:
        jsonResponse(false, null, 'Method not allowed.', 405);
        break;
}
