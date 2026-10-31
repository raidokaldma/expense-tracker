// npm run dev: the API server (restarting on changes) and Vite, stopped together with Ctrl+C.
import { spawn } from 'node:child_process';

const env = { ...process.env, PORT: '8787', HOST: '127.0.0.1' };
const children = [
  spawn('node', ['--watch', '--env-file-if-exists=.env', 'server/main.ts'], { stdio: 'inherit', env }),
  spawn('npx', ['vite'], { stdio: 'inherit' }),
];
const stop = () => {
  for (const child of children) child.kill();
  process.exit();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', stop);
