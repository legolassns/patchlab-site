<?php
/**
 * Endpoint del modulo preventivo PatchLab.
 *
 * Riceve i dati dal form in it/preventivo/index.html (fetch POST, FormData)
 * e li inoltra via email a info@patchlab.net tramite SMTP autenticato su
 * Zoho Mail Europa (smtp.zoho.eu:465, SSL/TLS implicito), usando PHPMailer
 * ufficiale (PHPMailer/PHPMailer, tag v7.1.1) vendorizzato in
 * vendor/phpmailer/phpmailer/src/ — vedi FORM_SETUP.md per provenienza,
 * verifica di integrità e procedura di aggiornamento.
 *
 * Le credenziali SMTP non sono MAI in questo file: vengono lette a runtime
 * da un file di configurazione esterno al repository (vedi resolve_mail_config_path()).
 */

// Compatibilità PHP 7.4+: niente sintassi né funzioni introdotte in versioni
// più recenti, per non assumere una versione PHP specifica sull'hosting.

error_reporting(E_ALL);
ini_set('display_errors', '0'); // mai stack trace o warning nella risposta pubblica

require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/Exception.php';
require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/PHPMailer.php';
require_once __DIR__ . '/../vendor/phpmailer/phpmailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;
use PHPMailer\PHPMailer\SMTP;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const MAX_LEN_NOME = 150;
const MAX_LEN_AZIENDA = 150;
const MAX_LEN_EMAIL = 254;
const MAX_LEN_TELEFONO = 40;
const MAX_LEN_QUANTITA = 100;
const MAX_LEN_NOTE = 4000;

const MIN_SECONDS_TO_FILL_FORM = 3; // sotto questa soglia: probabile bot

// Finestra di rate limiting per IP: 20 secondi in produzione. Configurabile
// via PATCHLAB_RATE_LIMIT_SECONDS solo per permettere ai test automatici
// (tests/smoke-test.sh in CI) di eseguire più richieste consecutive dallo
// stesso IP senza attendere il cooldown reale. Se la variabile non è
// impostata, il comportamento in produzione resta invariato (20s).
define(
    'RATE_LIMIT_SECONDS_PER_IP',
    getenv('PATCHLAB_RATE_LIMIT_SECONDS') !== false ? (int) getenv('PATCHLAB_RATE_LIMIT_SECONDS') : 20
);

const TIPO_PATCH_AMMESSI = array('ricamata', 'woven-hd', 'pvc', 'sublimatica', 'non-so');
const APPLICAZIONE_AMMESSE = array('', 'cucibile', 'termosaldabile', 'velcro');

/**
 * Risponde in JSON con lo status HTTP indicato e termina l'esecuzione.
 * Non include mai dettagli tecnici: solo un messaggio adatto al pubblico.
 */
function respond($httpStatus, $ok, $publicMessage, array $extra = array())
{
    http_response_code($httpStatus);
    $payload = array_merge(array('ok' => $ok, 'message' => $publicMessage), $extra);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Logga un errore interno senza includere dati personali completi
 * (solo un identificatore breve, mai il corpo del messaggio del cliente).
 */
function log_internal_error($context, $detail)
{
    error_log('[patchlab-preventivo] ' . $context . ': ' . $detail);
}

/**
 * Risolve il percorso del file di configurazione del mailer.
 *
 * Ordine di risoluzione:
 *   1. variabile d'ambiente PATCHLAB_MAIL_CONFIG (percorso assoluto);
 *   2. dirname($_SERVER['DOCUMENT_ROOT']) . '/config/patchlab-mail.php'
 *      (su cPanel: un livello sopra public_html, es. /home/USERNAME/config/...).
 *
 * Non genera mai un percorso dentro il webroot pubblico.
 */
function resolve_mail_config_path()
{
    $fromEnv = getenv('PATCHLAB_MAIL_CONFIG');
    if ($fromEnv !== false && trim($fromEnv) !== '') {
        return $fromEnv;
    }

    $documentRoot = isset($_SERVER['DOCUMENT_ROOT']) ? $_SERVER['DOCUMENT_ROOT'] : '';
    if ($documentRoot === '') {
        return null;
    }

    $documentRoot = rtrim($documentRoot, '/\\');
    return dirname($documentRoot) . '/config/patchlab-mail.php';
}

/**
 * Percorso del piccolo file di stato usato per il rate limiting per IP.
 * Vive nella stessa cartella privata della configurazione mailer.
 */
function resolve_ratelimit_path($configPath)
{
    return dirname($configPath) . '/patchlab-mail-ratelimit.json';
}

/**
 * Rimuove ritorni a capo e caratteri di controllo pericolosi per gli header
 * email, senza toccare newline legittimi nel corpo (gestiti a parte in note()).
 */
function strip_header_unsafe_chars($value)
{
    $value = str_replace(array("\r", "\n"), '', $value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $value);
    return $value;
}

/**
 * Estrae, valida e sanitizza un campo testuale semplice dalla whitelist.
 * Restituisce null se il campo manca ed è opzionale con valore vuoto ammesso.
 * Lancia InvalidArgumentException se il dato non è accettabile.
 */
function read_simple_field($fieldName, $maxLength, $required)
{
    if (!isset($_POST[$fieldName])) {
        if ($required) {
            throw new InvalidArgumentException("Campo obbligatorio mancante: $fieldName");
        }
        return '';
    }

    $value = $_POST[$fieldName];
    if (!is_string($value)) {
        throw new InvalidArgumentException("Campo non valido: $fieldName");
    }

    $value = trim($value);
    $value = strip_header_unsafe_chars($value);

    if ($required && $value === '') {
        throw new InvalidArgumentException("Campo obbligatorio vuoto: $fieldName");
    }

    if (function_exists('mb_strlen')) {
        $length = mb_strlen($value, 'UTF-8');
    } else {
        $length = strlen($value);
    }
    if ($length > $maxLength) {
        throw new InvalidArgumentException("Campo troppo lungo: $fieldName");
    }

    return $value;
}

/**
 * Estrae e valida il campo note (multi-riga, più permissivo su lunghezza,
 * ma con lo stesso limite duro e senza tag HTML).
 */
function read_note_field()
{
    if (!isset($_POST['note'])) {
        return '';
    }
    $value = $_POST['note'];
    if (!is_string($value)) {
        throw new InvalidArgumentException('Campo note non valido');
    }

    // Normalizza gli a-capo a \n e rimuove altri caratteri di controllo,
    // ma mantiene i newline legittimi del testo libero.
    $value = str_replace(array("\r\n", "\r"), "\n", $value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $value);
    $value = trim($value);
    $value = strip_tags($value);

    $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
    if ($length > MAX_LEN_NOTE) {
        throw new InvalidArgumentException('Campo note troppo lungo');
    }

    return $value;
}

/**
 * Valida un valore contro un elenco esplicito di opzioni ammesse.
 */
function read_enum_field($fieldName, array $allowed, $required)
{
    $value = isset($_POST[$fieldName]) && is_string($_POST[$fieldName]) ? trim($_POST[$fieldName]) : '';
    if ($required && $value === '') {
        throw new InvalidArgumentException("Campo obbligatorio mancante: $fieldName");
    }
    if (!in_array($value, $allowed, true)) {
        throw new InvalidArgumentException("Valore non ammesso per: $fieldName");
    }
    return $value;
}

class SmtpException extends RuntimeException
{
}

/**
 * Invia l'email della richiesta di preventivo via PHPMailer, SMTP autenticato
 * su Zoho Mail Europa con STARTTLS (porta 587).
 * Lancia SmtpException in caso di qualunque problema di connessione/invio.
 */
function send_quote_email(array $config, $subject, $htmlBody, $textBody, $replyTo)
{
    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->Host = $config['smtp_host'];
        $mail->SMTPAuth = true;
        $mail->Username = $config['smtp_user'];
        $mail->Password = $config['smtp_password'];
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = (int) $config['smtp_port'];
        $mail->CharSet = PHPMailer::CHARSET_UTF8;
        $mail->Timeout = 15;
        $mail->SMTPKeepAlive = false;

        // Mai debug SMTP visibile o loggato: nessun dettaglio protocollo,
        // nessuna credenziale, nemmeno nei log del server.
        $mail->SMTPDebug = SMTP::DEBUG_OFF;
        $mail->Debugoutput = function () {
        };

        $mail->setFrom($config['smtp_user'], $config['from_name']);
        $mail->addAddress($config['recipient']);
        if ($replyTo !== '') {
            $mail->addReplyTo($replyTo);
        }

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $htmlBody;
        $mail->AltBody = $textBody;

        $mail->send();
    } catch (PHPMailerException $e) {
        // getMessage() di PHPMailer non include mai credenziali; il dettaglio
        // resta comunque solo nel log server-side, mai nella risposta pubblica.
        throw new SmtpException('Invio PHPMailer fallito: ' . $e->getMessage());
    }
}

/**
 * Rate limiting semplice per IP: un solo invio ogni RATE_LIMIT_SECONDS_PER_IP
 * secondi. Se lo storage non è scrivibile, la richiesta procede comunque
 * (non è una funzione di sicurezza critica: honeypot e timing restano il
 * primo filtro, questo è un livello aggiuntivo best-effort).
 */
function check_and_update_rate_limit($ratelimitPath, $ipHash)
{
    $now = time();
    $handle = @fopen($ratelimitPath, 'c+');
    if ($handle === false) {
        log_internal_error('ratelimit', 'impossibile aprire il file di stato, controllo saltato');
        return true;
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            log_internal_error('ratelimit', 'impossibile acquisire il lock, controllo saltato');
            return true;
        }

        $size = filesize($ratelimitPath);
        $raw = $size > 0 ? fread($handle, $size) : '';
        $data = array();
        if ($raw !== '' && $raw !== false) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $data = $decoded;
            }
        }

        // Pulizia voci più vecchie di un'ora, per non far crescere il file.
        foreach ($data as $hash => $timestamp) {
            if (!is_int($timestamp) || ($now - $timestamp) > 3600) {
                unset($data[$hash]);
            }
        }

        $allowed = true;
        if (isset($data[$ipHash]) && ($now - $data[$ipHash]) < RATE_LIMIT_SECONDS_PER_IP) {
            $allowed = false;
        }

        $data[$ipHash] = $now;

        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($data));
        fflush($handle);
        flock($handle, LOCK_UN);

        return $allowed;
    } finally {
        fclose($handle);
    }
}

// ============================================================
// 1. Metodo HTTP
// ============================================================

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, false, 'Metodo non consentito.');
}

// ============================================================
// 2. Honeypot e timing anti-spam (prima di qualunque validazione dati:
//    un bot che ha compilato il campo trappola o ha inviato troppo in
//    fretta riceve sempre la stessa risposta generica).
// ============================================================

$honeypot = isset($_POST['sito-web']) && is_string($_POST['sito-web']) ? trim($_POST['sito-web']) : '';
if ($honeypot !== '') {
    respond(429, false, 'Richiesta non elaborata. Riprova tra qualche istante.');
}

$formOpenedAtMs = isset($_POST['ts_apertura']) ? filter_var($_POST['ts_apertura'], FILTER_VALIDATE_INT) : false;
if ($formOpenedAtMs !== false) {
    $elapsedSeconds = time() - (int) floor($formOpenedAtMs / 1000);
    if ($elapsedSeconds < MIN_SECONDS_TO_FILL_FORM) {
        respond(429, false, 'Richiesta non elaborata. Riprova tra qualche istante.');
    }
}

// ============================================================
// 3. Configurazione mailer
// ============================================================

$configPath = resolve_mail_config_path();
if ($configPath === null || !is_readable($configPath)) {
    log_internal_error('config', 'file di configurazione mailer non trovato o non leggibile: ' . var_export($configPath, true));
    respond(500, false, 'Servizio temporaneamente non disponibile. Scrivici a info@patchlab.net.');
}

$mailConfig = include $configPath;
if (
    !is_array($mailConfig)
    || empty($mailConfig['smtp_host'])
    || empty($mailConfig['smtp_port'])
    || empty($mailConfig['smtp_user'])
    || !isset($mailConfig['smtp_password']) || $mailConfig['smtp_password'] === ''
    || empty($mailConfig['recipient'])
    || empty($mailConfig['from_name'])
) {
    log_internal_error('config', 'file di configurazione mailer incompleto');
    respond(500, false, 'Servizio temporaneamente non disponibile. Scrivici a info@patchlab.net.');
}

// ============================================================
// 4. Rate limiting per IP (best-effort, vedi commento sulla funzione)
// ============================================================

$clientIp = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'sconosciuto';
$ipHash = hash('sha256', $clientIp);
$ratelimitPath = resolve_ratelimit_path($configPath);
if (!check_and_update_rate_limit($ratelimitPath, $ipHash)) {
    respond(429, false, 'Troppe richieste in poco tempo. Riprova tra qualche istante.');
}

// ============================================================
// 5. Validazione whitelist dei campi dati
// ============================================================

try {
    $nome = read_simple_field('nome', MAX_LEN_NOME, true);
    $azienda = read_simple_field('azienda', MAX_LEN_AZIENDA, false);
    $telefono = read_simple_field('telefono', MAX_LEN_TELEFONO, false);
    $quantita = read_simple_field('quantita', MAX_LEN_QUANTITA, true);
    $note = read_note_field();
    $tipoPatch = read_enum_field('tipo-patch', TIPO_PATCH_AMMESSI, true);
    $applicazione = read_enum_field('applicazione', APPLICAZIONE_AMMESSE, false);

    $emailRaw = isset($_POST['email']) && is_string($_POST['email']) ? trim($_POST['email']) : '';
    if (function_exists('mb_strlen') ? mb_strlen($emailRaw, 'UTF-8') > MAX_LEN_EMAIL : strlen($emailRaw) > MAX_LEN_EMAIL) {
        throw new InvalidArgumentException('Email troppo lunga');
    }
    $email = filter_var($emailRaw, FILTER_VALIDATE_EMAIL);
    if ($email === false) {
        throw new InvalidArgumentException('Email non valida');
    }
    $email = strip_header_unsafe_chars($email);
} catch (InvalidArgumentException $e) {
    log_internal_error('validazione', $e->getMessage());
    respond(400, false, 'Controlla i dati inseriti e riprova.');
}

// ============================================================
// 6. Composizione e invio email
// ============================================================

$labelTipoPatch = array(
    'ricamata' => 'Ricamata',
    'woven-hd' => 'Woven HD',
    'pvc' => 'PVC',
    'sublimatica' => 'Sublimatica',
    'non-so' => 'Non so quale scegliere',
);
$labelApplicazione = array(
    '' => 'Da valutare',
    'cucibile' => 'Cucibile',
    'termosaldabile' => 'Termosaldabile',
    'velcro' => 'Velcro',
);

$nomeOAzienda = $azienda !== '' ? $azienda : $nome;
$subject = 'Nuova richiesta preventivo PatchLab — ' . $nomeOAzienda;

$now = new DateTime('now', new DateTimeZone('Europe/Rome'));
$dataOra = $now->format('d/m/Y H:i');

$textLines = array();
$textLines[] = 'Nuova richiesta di preventivo da patchlab.net';
$textLines[] = '';
$textLines[] = 'Data e ora: ' . $dataOra;
$textLines[] = 'Nome: ' . $nome;
$textLines[] = 'Azienda/Ente: ' . ($azienda !== '' ? $azienda : '(non indicata)');
$textLines[] = 'Email: ' . $email;
$textLines[] = 'Telefono: ' . ($telefono !== '' ? $telefono : '(non indicato)');
$textLines[] = 'Tipologia patch: ' . $labelTipoPatch[$tipoPatch];
$textLines[] = 'Applicazione: ' . $labelApplicazione[$applicazione];
$textLines[] = 'Quantità indicativa: ' . $quantita;
$textLines[] = '';
$textLines[] = 'Descrizione progetto:';
$textLines[] = ($note !== '' ? $note : '(nessuna nota aggiuntiva)');
$textLines[] = '';
$textLines[] = 'Provenienza: modulo sito PatchLab (it/preventivo/).';
$textBody = implode("\n", $textLines);

$escape = function ($value) {
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
};

$noteHtml = $note !== '' ? nl2br($escape($note)) : '(nessuna nota aggiuntiva)';

$htmlBody = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head><body '
    . 'style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#1a1a1a;">'
    . '<h2 style="margin:0 0 16px;">Nuova richiesta di preventivo — PatchLab</h2>'
    . '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;">'
    . '<tr><td><strong>Data e ora</strong></td><td>' . $escape($dataOra) . '</td></tr>'
    . '<tr><td><strong>Nome</strong></td><td>' . $escape($nome) . '</td></tr>'
    . '<tr><td><strong>Azienda/Ente</strong></td><td>' . ($azienda !== '' ? $escape($azienda) : '(non indicata)') . '</td></tr>'
    . '<tr><td><strong>Email</strong></td><td>' . $escape($email) . '</td></tr>'
    . '<tr><td><strong>Telefono</strong></td><td>' . ($telefono !== '' ? $escape($telefono) : '(non indicato)') . '</td></tr>'
    . '<tr><td><strong>Tipologia patch</strong></td><td>' . $escape($labelTipoPatch[$tipoPatch]) . '</td></tr>'
    . '<tr><td><strong>Applicazione</strong></td><td>' . $escape($labelApplicazione[$applicazione]) . '</td></tr>'
    . '<tr><td><strong>Quantità indicativa</strong></td><td>' . $escape($quantita) . '</td></tr>'
    . '</table>'
    . '<p><strong>Descrizione progetto</strong><br>' . $noteHtml . '</p>'
    . '<p style="color:#7d7f84; font-size:12px;">Provenienza: modulo sito PatchLab (it/preventivo/).</p>'
    . '</body></html>';

try {
    send_quote_email($mailConfig, $subject, $htmlBody, $textBody, $email);
} catch (SmtpException $e) {
    log_internal_error('smtp', $e->getMessage());
    respond(500, false, 'Non siamo riusciti a inviare la richiesta. Riprova oppure scrivi a info@patchlab.net.');
} catch (Throwable $e) {
    log_internal_error('smtp-inatteso', $e->getMessage());
    respond(500, false, 'Non siamo riusciti a inviare la richiesta. Riprova oppure scrivi a info@patchlab.net.');
}

respond(200, true, 'Grazie, abbiamo ricevuto la tua richiesta. Ti risponderemo dopo aver valutato il progetto.');
