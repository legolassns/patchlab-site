<?php
/**
 * Template di configurazione del mailer PatchLab — NESSUNA credenziale reale.
 *
 * Questo file è tracciato nel repository solo come riferimento ed è escluso
 * dal deploy (vedi .github/workflows/deploy-production.yml, whitelist di
 * _release/, e la verifica dedicata che fallisce se "config/" comparisse
 * nella release pubblicata).
 *
 * Il file REALE va creato manualmente sul server DominiOK, fuori da
 * public_html, con questo stesso nome ma senza ".example" nel percorso:
 *
 *   /home/USERNAME/config/patchlab-mail.php
 *
 * (sostituire USERNAME con l'utente cPanel reale — non è noto da questa
 * sessione). Procedura completa in FORM_SETUP.md.
 *
 * api/invia-preventivo.php risolve il percorso di questo file in due modi,
 * nell'ordine:
 *   1. variabile d'ambiente PATCHLAB_MAIL_CONFIG (percorso assoluto), se impostata;
 *   2. altrimenti dirname($_SERVER['DOCUMENT_ROOT']) . '/config/patchlab-mail.php'
 *      — su cPanel questo risolve tipicamente a /home/USERNAME/config/patchlab-mail.php,
 *      cioè un livello sopra public_html.
 *
 * Permessi consigliati sul file reale: 600 (solo l'utente proprietario può
 * leggerlo/scriverlo). Vedi FORM_SETUP.md per i dettagli.
 */

return [
    // Host SMTP autenticato di Zoho Mail Europa.
    'smtp_host' => 'smtp.zoho.eu',

    // Porta STARTTLS (upgrade a TLS dopo la connessione in chiaro).
    // Valore verificato operativo in produzione il 2026-07-23 — vedi
    // docs/SMTP_SETUP.md per la motivazione della scelta (587/STARTTLS,
    // non 465/SMTPS) e la registrazione della verifica.
    'smtp_port' => 587,

    // Username SMTP: normalmente coincide con l'indirizzo mittente.
    'smtp_user' => 'info@patchlab.net',

    // Password: su Zoho, generare una "password per applicazione" dedicata
    // (non la password di accesso principale alla casella). Vedi FORM_SETUP.md.
    'smtp_password' => 'CHANGE_ME_APPLICATION_PASSWORD',

    // Destinatario delle richieste di preventivo.
    'recipient' => 'info@patchlab.net',

    // Nome visualizzato come mittente (l'indirizzo From resta smtp_user).
    'from_name' => 'PatchLab',
];
