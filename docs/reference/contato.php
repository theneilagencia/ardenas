<?php
// Arden.AS · recebe o formulário da landing page e envia por e-mail.
// Hospedagem KingHost: subir na mesma pasta do index.html.

header('Content-Type: application/json; charset=utf-8');

$DESTINO   = 'vinicius.debian@theneil.com.br';
$REMETENTE = 'no-reply@' . preg_replace('/^www\./', '', $_SERVER['HTTP_HOST'] ?? 'theneil.com.br');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'erro' => 'metodo']);
    exit;
}

$raw  = file_get_contents('php://input');
$dado = json_decode($raw, true);
if (!is_array($dado)) { $dado = $_POST; }

function campo($dado, $chave, $limite = 400) {
    $v = trim((string)($dado[$chave] ?? ''));
    $v = str_replace(["\r", "\n"], ' ', $v);
    return mb_substr($v, 0, $limite);
}

$nome     = campo($dado, 'name', 120);
$empresa  = campo($dado, 'company', 120);
$cargo    = campo($dado, 'role', 120);
$email    = campo($dado, 'email', 160);
$telefone = campo($dado, 'phone', 60);
$contexto = mb_substr(trim((string)($dado['context'] ?? '')), 0, 4000);
$idioma   = campo($dado, 'lang', 10);
$armadilha = campo($dado, 'website', 80); // honeypot anti-spam

if ($armadilha !== '') {
    echo json_encode(['ok' => true]); // silencioso para robôs
    exit;
}

if ($nome === '' || $email === '' || $contexto === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'erro' => 'campos']);
    exit;
}

$assunto = 'Arden.AS · Avaliação de operação · ' . $nome;

$corpo = "Nova solicitação de avaliação recebida pela landing page.\n\n"
       . "Nome: {$nome}\n"
       . "Empresa: " . ($empresa !== '' ? $empresa : '-') . "\n"
       . "Cargo: " . ($cargo !== '' ? $cargo : '-') . "\n"
       . "E-mail: {$email}\n"
       . "Telefone: " . ($telefone !== '' ? $telefone : '-') . "\n"
       . "Idioma da página: " . ($idioma !== '' ? $idioma : '-') . "\n"
       . "Enviado em: " . date('d/m/Y H:i:s') . "\n"
       . "IP: " . ($_SERVER['REMOTE_ADDR'] ?? '-') . "\n\n"
       . "Operação a avaliar:\n{$contexto}\n";

$cabecalhos = implode("\r\n", [
    'From: Arden.AS <' . $REMETENTE . '>',
    'Reply-To: ' . $nome . ' <' . $email . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    'X-Mailer: Arden.AS Landing',
]);

$enviado = @mail($DESTINO, '=?UTF-8?B?' . base64_encode($assunto) . '?=', $corpo, $cabecalhos);

if (!$enviado) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'erro' => 'envio']);
    exit;
}

echo json_encode(['ok' => true]);
