<?php
/**
 * Database Seeder for PACL Coagulant Jar Test Records
 * Populates jar_test_records with the 90 verified lab records from the Excel dataset
 */

require_once __DIR__ . '/db.php';
$pdo = getDbConnection();

$defaultRecords = [
  ['ph' => 4.4, 'turbidity' => 6.6, 'pacl' => 0.6, 'test_date' => '01-Oct'],
  ['ph' => 5.59, 'turbidity' => 6.7, 'pacl' => 0.5, 'test_date' => '14-Aug'],
  ['ph' => 5.8, 'turbidity' => 6.7, 'pacl' => 0.6, 'test_date' => '30-Sep'],
  
  // pH 6.6 Series (32 records)
  ['ph' => 6.6, 'turbidity' => 1.97, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 3.5, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 3.7, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 3.71, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 4.3, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 4.7, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 6.0, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 6.1, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 7.05, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 7.2, 'pacl' => 0.6, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 7.7, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 7.71, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 7.74, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 8.1, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 8.8, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 9.24, 'pacl' => 0.6, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 10.4, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 10.4, 'pacl' => 0.6, 'test_date' => '18-Apr'],
  ['ph' => 6.6, 'turbidity' => 11.6, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 11.7, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 12.7, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 17.2, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 23.2, 'pacl' => 0.6, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 42.1, 'pacl' => 0.7, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 55.3, 'pacl' => 0.7, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 55.6, 'pacl' => 0.7, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 70.1, 'pacl' => 0.7, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 72.0, 'pacl' => 0.8, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 75.0, 'pacl' => 0.7, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 76.5, 'pacl' => 0.8, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 110.0, 'pacl' => 0.8, 'test_date' => 'Historical'],
  ['ph' => 6.6, 'turbidity' => 201.0, 'pacl' => 1.0, 'test_date' => 'Historical'],

  // pH 6.7 Series (32 records)
  ['ph' => 6.7, 'turbidity' => 1.4, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 1.7, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 1.7, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 1.98, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 2.1, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 2.3, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 2.4, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 2.7, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 2.7, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 2.7, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 3.16, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 3.2, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 3.3, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 3.3, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 3.3, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 3.4, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 3.8, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 3.8, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 3.86, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 3.9, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 4.2, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 4.3, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 4.5, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 4.7, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 4.8, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 4.8, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 5.02, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 5.2, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 6.2, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 7.5, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.7, 'turbidity' => 14.1, 'pacl' => 0.6, 'test_date' => '03-Mar'],
  ['ph' => 6.7, 'turbidity' => 34.8, 'pacl' => 0.5, 'test_date' => 'Historical'],

  // pH 6.8 Series (21 records)
  ['ph' => 6.8, 'turbidity' => 1.38, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 1.73, 'pacl' => 0.8, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 1.9, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 2.5, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 2.7, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 2.86, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 3.2, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 3.5, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 3.51, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 3.6, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 3.7, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 4.1, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 6.1, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 6.1, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 6.1, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 7.2, 'pacl' => 0.5, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 7.2, 'pacl' => 0.6, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 8.05, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 9.01, 'pacl' => 0.4, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 20.5, 'pacl' => 0.6, 'test_date' => 'Historical'],
  ['ph' => 6.8, 'turbidity' => 25.7, 'pacl' => 0.6, 'test_date' => 'Historical'],

  // pH 10.1 & 10.9 Series
  ['ph' => 10.1, 'turbidity' => 6.7, 'pacl' => 0.8, 'test_date' => '12-Aug'],
  ['ph' => 10.9, 'turbidity' => 6.7, 'pacl' => 0.5, 'test_date' => '13-Aug']
];

$count = $pdo->query("SELECT COUNT(*) FROM `jar_test_records`")->fetchColumn();

if ($count == 0 || isset($_GET['force'])) {
    if (isset($_GET['force'])) {
        $pdo->exec("TRUNCATE TABLE `jar_test_records`");
    }
    
    $stmt = $pdo->prepare("
        INSERT INTO `jar_test_records` (`ph`, `turbidity`, `pacl`, `test_date`, `status`)
        VALUES (?, ?, ?, ?, 'Verified')
    ");

    $pdo->beginTransaction();
    foreach ($defaultRecords as $row) {
        $stmt->execute([$row['ph'], $row['turbidity'], $row['pacl'], $row['test_date']]);
    }
    $pdo->commit();

    $newCount = $pdo->query("SELECT COUNT(*) FROM `jar_test_records`")->fetchColumn();
    echo json_encode([
        'success' => true,
        'message' => "Successfully seeded $newCount jar test records into database.",
        'count' => (int)$newCount
    ]);
} else {
    echo json_encode([
        'success' => true,
        'message' => "Database already contains $count records.",
        'count' => (int)$count
    ]);
}
