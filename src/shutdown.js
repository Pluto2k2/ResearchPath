// Idempotent: a second signal while closing must not restart the sequence.
export function createShutdown({
  server,
  db,
  exit = process.exit,
  setTimer = setTimeout,
  timeoutMs = 10_000,
  log = console,
}) {
  let started = false;

  return function shutdown(signal) {
    if (started) return;
    started = true;
    log.log(`Received ${signal}, shutting down`);

    // Open keep-alive connections can hold server.close() forever.
    const timer = setTimer(() => {
      log.error(`Forced exit after ${timeoutMs / 1000} s`);
      exit(1);
    }, timeoutMs);
    timer.unref?.();

    server.close(() => {
      try {
        db.close();
        exit(0);
      } catch (err) {
        log.error(err);
        exit(1);
      }
    });
  };
}
