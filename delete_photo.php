<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Gestione preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configurazione
$uploadDir = 'uploads/employees/';

// Verifica metodo POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Metodo non consentito']);
    exit();
}

// Leggi dati JSON
$input = json_decode(file_get_contents('php://input'), true);
$employeeId = isset($input['employeeId']) ? trim($input['employeeId']) : '';

// Validazione employee ID
if (empty($employeeId) || !preg_match('/^[a-zA-Z0-9_-]+$/', $employeeId)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID dipendente non valido']);
    exit();
}

// Trova e rimuovi tutte le foto del dipendente
$pattern = $uploadDir . $employeeId . '_*';
$existingFiles = glob($pattern);
$deletedCount = 0;

foreach ($existingFiles as $existingFile) {
    if (is_file($existingFile)) {
        if (unlink($existingFile)) {
            $deletedCount++;
        }
    }
}

if ($deletedCount > 0) {
    echo json_encode([
        'success' => true,
        'message' => "Foto rimossa con successo ($deletedCount file eliminati)"
    ]);
} else {
    echo json_encode([
        'success' => true,
        'message' => 'Nessuna foto da rimuovere'
    ]);
}
?>