# Timeouts (ARDEN-BE-005 §21)

`timeoutSeconds` no request define `timeoutAt` na execução e nas etapas. O **worker**
verifica o timeout no checkpoint no topo de cada iteração de etapa (antes de iniciar a
próxima). Ao exceder: execução → `TIMED_OUT`, evidência `ERROR`, evento
`execution.timed_out`, seguida de compensação.

O timeout NÃO é implementado pelo cliente HTTP — é uma verificação server-side
persistida. Uma instrução atômica já em curso pode terminar antes do timeout ser
observado (o checkpoint é entre etapas).
