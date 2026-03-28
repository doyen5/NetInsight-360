<?php
/**
 * NetInsight 360 — Mailer SMTP natif (sans dépendance externe)
 *
 * Supporte TLS (STARTTLS sur port 587) et SSL (port 465).
 * Utilise les streams PHP (fsockopen / stream_socket_client).
 *
 * Usage :
 *   $cfg  = require __DIR__ . '/../../config/mail.php';
 *   $mail = new MailHelper($cfg);
 *   $mail->send('dest@example.com', 'Sujet', '<p>Corps HTML</p>');
 */
class MailHelper
{
    private array $cfg;

    public function __construct(array $cfg)
    {
        $this->cfg = $cfg;
    }

    /**
     * Envoie un e-mail.
     *
     * @param string $to          Adresse destinataire
     * @param string $subject     Sujet
     * @param string $body        Corps HTML
     * @param string $bodyPlain   Corps texte brut (optionnel)
     * @return bool
     * @throws RuntimeException en cas d'échec SMTP
     */
    public function send(string $to, string $subject, string $body, string $bodyPlain = ''): bool
    {
        $host     = $this->cfg['host'];
        $port     = $this->cfg['port'];
        $secure   = strtolower($this->cfg['secure'] ?? 'tls');
        $username = $this->cfg['username'];
        $password = $this->cfg['password'];
        $from     = $this->cfg['from_address'];
        $fromName = $this->cfg['from_name'] ?? 'NetInsight 360';

        // Connexion
        $context = stream_context_create();
        if ($secure === 'ssl') {
            $socket = @stream_socket_client(
                "ssl://{$host}:{$port}", $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context
            );
        } else {
            $socket = @stream_socket_client(
                "tcp://{$host}:{$port}", $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context
            );
        }

        if (!$socket) {
            throw new RuntimeException("SMTP : impossible de se connecter à {$host}:{$port} — {$errstr} ({$errno})");
        }

        stream_set_timeout($socket, 15);

        $this->expect($socket, 220);

        // EHLO
        $this->cmd($socket, "EHLO {$host}");
        $ehloResp = $this->readAll($socket);

        // STARTTLS pour TLS
        if ($secure === 'tls') {
            $this->cmd($socket, 'STARTTLS');
            $this->expectRaw($socket, 220);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('SMTP : échec de la négociation TLS');
            }
            $this->cmd($socket, "EHLO {$host}");
            $this->readAll($socket);
        }

        // AUTH LOGIN
        if (!empty($username)) {
            $this->cmd($socket, 'AUTH LOGIN');
            $this->expectRaw($socket, 334);
            $this->cmd($socket, base64_encode($username));
            $this->expectRaw($socket, 334);
            $this->cmd($socket, base64_encode($password));
            $this->expect($socket, 235);
        }

        // Enveloppe
        $this->cmd($socket, "MAIL FROM:<{$from}>");
        $this->expect($socket, 250);

        $this->cmd($socket, "RCPT TO:<{$to}>");
        $this->expect($socket, 250);

        // Corps
        $this->cmd($socket, 'DATA');
        $this->expect($socket, 354);

        $boundary = bin2hex(random_bytes(8));
        $date     = date('r');
        $msgId    = '<' . bin2hex(random_bytes(8)) . '@netinsight360.local>';
        $fromEncoded = '=?UTF-8?B?' . base64_encode($fromName) . '?=';

        $headers = implode("\r\n", [
            "Date: {$date}",
            "Message-ID: {$msgId}",
            "From: {$fromEncoded} <{$from}>",
            "To: {$to}",
            "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=",
            "MIME-Version: 1.0",
            "Content-Type: multipart/alternative; boundary=\"{$boundary}\"",
        ]);

        $plainPart = !empty($bodyPlain) ? $bodyPlain : strip_tags($body);
        $message   = "{$headers}\r\n\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($plainPart)) . "\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($body)) . "\r\n"
            . "--{$boundary}--";

        // Échapper les lignes commençant par un point seul
        $message = preg_replace('/^\.$/m', '..', $message);

        fwrite($socket, $message . "\r\n.\r\n");
        $this->expect($socket, 250);

        $this->cmd($socket, 'QUIT');
        fclose($socket);

        return true;
    }

    // ── Helpers SMTP ─────────────────────────────────────────────────────────

    private function cmd($socket, string $cmd): void
    {
        fwrite($socket, $cmd . "\r\n");
    }

    private function readLine($socket): string
    {
        return (string) fgets($socket, 1024);
    }

    private function readAll($socket): string
    {
        $response = '';
        while (($line = $this->readLine($socket)) !== '') {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') break; // fin multi-lignes
        }
        return $response;
    }

    private function expect($socket, int $code): void
    {
        $resp = $this->readAll($socket);
        if ((int) substr(trim($resp), 0, 3) !== $code) {
            throw new RuntimeException("SMTP : réponse inattendue (attendu {$code}) — " . trim($resp));
        }
    }

    private function expectRaw($socket, int $code): void
    {
        $line = $this->readLine($socket);
        if ((int) substr(trim($line), 0, 3) !== $code) {
            throw new RuntimeException("SMTP : réponse inattendue (attendu {$code}) — " . trim($line));
        }
    }
}
