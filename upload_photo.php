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
$maxFileSize = 2 * 1024 * 1024; // 2MB
$allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
$allowedExtensions = ['jpg', 'jpeg', 'png', 'gif'];

// Crea directory se non esiste
if (!file_exists($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Impossibile creare la directory di upload']);
        exit();
    }
}

// Verifica metodo POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Metodo non consentito']);
    exit();
}

// Verifica presenza file
if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE => 'File troppo grande (limite server)',
        UPLOAD_ERR_FORM_SIZE => 'File troppo grande (limite form)',
        UPLOAD_ERR_PARTIAL => 'Upload parziale',
        UPLOAD_ERR_NO_FILE => 'Nessun file caricato',
        UPLOAD_ERR_NO_TMP_DIR => 'Directory temporanea mancante',
        UPLOAD_ERR_CANT_WRITE => 'Errore scrittura disco',
        UPLOAD_ERR_EXTENSION => 'Upload bloccato da estensione'
    ];
    
    $error = isset($errorMessages[$_FILES['photo']['error']]) 
        ? $errorMessages[$_FILES['photo']['error']] 
        : 'Errore sconosciuto';
    
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $error]);
    exit();
}

$file = $_FILES['photo'];
$employeeId = isset($_POST['employeeId']) ? trim($_POST['employeeId']) : '';

// Validazione employee ID
if (empty($employeeId) || !preg_match('/^[a-zA-Z0-9_-]+$/', $employeeId)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID dipendente non valido']);
    exit();
}

// Verifica dimensione file
if ($file['size'] > $maxFileSize) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'File troppo grande. Massimo 2MB consentiti']);
    exit();
}

// Verifica tipo MIME
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mimeType, $allowedTypes)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Tipo file non supportato. Usa JPG, PNG o GIF']);
    exit();
}

// Verifica estensione
$pathInfo = pathinfo($file['name']);
$extension = strtolower($pathInfo['extension']);

if (!in_array($extension, $allowedExtensions)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Estensione file non supportata']);
    exit();
}

// Genera nome file sicuro
$fileName = $employeeId . '_' . time() . '.' . $extension;
$filePath = $uploadDir . $fileName;

// Rimuovi foto precedente se esiste
$pattern = $uploadDir . $employeeId . '_*';
$existingFiles = glob($pattern);
foreach ($existingFiles as $existingFile) {
    if (is_file($existingFile)) {
        unlink($existingFile);
    }
}

// Sposta il file caricato
if (!move_uploaded_file($file['tmp_name'], $filePath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Errore durante il salvataggio del file']);
    exit();
}

// Ottimizza immagine (ridimensiona se troppo grande)
try {
    $maxWidth = 400;
    $maxHeight = 400;
    
    switch ($mimeType) {
        case 'image/jpeg':
            $image = imagecreatefromjpeg($filePath);
            break;
        case 'image/png':
            $image = imagecreatefrompng($filePath);
            break;
        case 'image/gif':
            $image = imagecreatefromgif($filePath);
            break;
        default:
            throw new Exception('Tipo immagine non supportato');
    }
    
    if ($image) {
        $width = imagesx($image);
        $height = imagesy($image);
        
        // Calcola nuove dimensioni mantenendo proporzioni
        if ($width > $maxWidth || $height > $maxHeight) {
            $ratio = min($maxWidth / $width, $maxHeight / $height);
            $newWidth = round($width * $ratio);
            $newHeight = round($height * $ratio);
            
            $resized = imagecreatetruecolor($newWidth, $newHeight);
            
            // Mantieni trasparenza per PNG
            if ($mimeType === 'image/png') {
                imagealphablending($resized, false);
                imagesavealpha($resized, true);
                $transparent = imagecolorallocatealpha($resized, 255, 255, 255, 127);
                imagefill($resized, 0, 0, $transparent);
            }
            
            imagecopyresampled($resized, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            
            // Salva immagine ridimensionata
            switch ($mimeType) {
                case 'image/jpeg':
                    imagejpeg($resized, $filePath, 85);
                    break;
                case 'image/png':
                    imagepng($resized, $filePath, 6);
                    break;
                case 'image/gif':
                    imagegif($resized, $filePath);
                    break;
            }
            
            imagedestroy($resized);
        }
        
        imagedestroy($image);
    }
} catch (Exception $e) {
    // Se l'ottimizzazione fallisce, mantieni il file originale
    error_log('Errore ottimizzazione immagine: ' . $e->getMessage());
}

// Restituisci successo con URL del file
$fileUrl = $fileName; // Solo il nome del file, il path sarà gestito dal frontend
echo json_encode([
    'success' => true,
    'fileName' => $fileName,
    'fileUrl' => $fileUrl,
    'message' => 'Foto caricata con successo'
]);
?>