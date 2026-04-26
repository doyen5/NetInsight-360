<?php

/**
 * Helper léger pour homogénéiser les réponses JSON.
 * Il limite la duplication des mêmes tableaux `success/error/data`.
 */
class ApiResponse
{
    public static function success(array $payload = [], int $status = 200): void
    {
        http_response_code($status);
        echo json_encode(array_merge(['success' => true], $payload));
        exit();
    }

    public static function error(string $message, int $status = 400, array $payload = []): void
    {
        http_response_code($status);
        echo json_encode(array_merge([
            'success' => false,
            'error' => $message,
        ], $payload));
        exit();
    }
}