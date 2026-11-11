import { describe, it, expect, vi } from 'vitest';
import { createShutdown } from '../src/shutdown.js';

function setup({ dbClose = vi.fn() } = {}) {
  const calls = [];
  const timer = { unref: vi.fn() };
  const state = { closeCallback: null, timerCallback: null };
  const server = {
    close: vi.fn((cb) => {
      calls.push('server.close');
      state.closeCallback = cb;
    }),
  };
  const db = {
    close: vi.fn(() => {
      calls.push('db.close');
      dbClose();
    }),
  };
  const exit = vi.fn((code) => calls.push(`exit(${code})`));
  const setTimer = vi.fn((cb) => {
    state.timerCallback = cb;
    return timer;
  });
  const log = { log: vi.fn(), error: vi.fn() };
  const shutdown = createShutdown({ server, db, exit, setTimer, log });
  return { shutdown, server, db, exit, setTimer, timer, log, calls, state };
}

describe('M10 graceful shutdown', () => {
  it('closes the server, then the database, then exits with 0', () => {
    const t = setup();
    t.shutdown('SIGTERM');
    expect(t.calls).toEqual(['server.close']);
    t.state.closeCallback();
    expect(t.calls).toEqual(['server.close', 'db.close', 'exit(0)']);
  });

  it('sets a 10 s forced-exit timer that does not keep the process alive', () => {
    const t = setup();
    t.shutdown('SIGINT');
    expect(t.setTimer).toHaveBeenCalledTimes(1);
    expect(t.setTimer.mock.calls[0][1]).toBe(10_000);
    expect(t.timer.unref).toHaveBeenCalled();
  });

  it('exits with 1 when the timer fires before the server closed', () => {
    const t = setup();
    t.shutdown('SIGTERM');
    t.state.timerCallback();
    expect(t.exit).toHaveBeenCalledWith(1);
    expect(t.log.error).toHaveBeenCalled();
  });

  it('is a no-op when called a second time', () => {
    const t = setup();
    t.shutdown('SIGTERM');
    t.shutdown('SIGINT');
    expect(t.server.close).toHaveBeenCalledTimes(1);
    expect(t.setTimer).toHaveBeenCalledTimes(1);
  });

  it('exits with 1 when closing the database throws', () => {
    const t = setup({
      dbClose: () => {
        throw new Error('db busy');
      },
    });
    t.shutdown('SIGTERM');
    t.state.closeCallback();
    expect(t.exit).toHaveBeenCalledWith(1);
    expect(t.exit).not.toHaveBeenCalledWith(0);
  });
});
