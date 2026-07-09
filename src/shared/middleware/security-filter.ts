import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger('security-filter');

// Paths that are never valid for a Node.js API — instant reject
const BLOCKED_PATH_PATTERNS = [
  // PHP exploits
  /\.php$/i,
  /phpunit/i,
  /eval-stdin/i,
  /wp-admin/i,
  /wp-login/i,
  /xmlrpc\.php/i,
  /pearcmd/i,
  /invokefunction/i,
  /shell_exec/i,

  // RCE / injection
  /allow_url_include/i,
  /auto_prepend_file/i,
  /\/etc\/passwd/i,
  /hello\.world/i,

  // Docker / container API probes
  /\/containers\/json/i,
  /\/v\d+\/containers/i,
  /\.docker\/config/i,

  // Credential & config file harvesting
  /\.env$/i,
  /\.env\./i,
  /google-credentials\.json/i,
  /serviceAccountKey\.json/i,
  /firebase-adminsdk\.json/i,
  /\.aws\/credentials/i,
  /\.ssh\//i,
  /\/id_rsa/i,
  /\.pgpass/i,
  /\.my\.cnf/i,
  /\.htpasswd/i,
  /\.netrc/i,
  /\.npmrc/i,
  /\.pypirc/i,

  // Database dump probes
  /\.(sql|bak|dump)$/i,
  /database\.(yml|yaml|json)/i,

  // Log file probes
  /storage\/logs\//i,
  /laravel\.log/i,

  // Spring Boot / Go actuator probes
  /\/actuator\//i,
  /\/debug\/vars/i,
];

// Known malicious user agents
const BLOCKED_USER_AGENTS = [
  /libredtail/i,
  /masscan/i,
  /zgrab/i,
  /python-requests\/2\.[0-1]/i, // old scanner versions
];

// Known scanner IPs (extend as new scanners appear in logs)
const BLOCKED_IPS = new Set<string>([
  '217.60.195.113', // reverse shell C2 server seen in CVE-2024-4577 payload
]);

export function securityFilter(req: Request, res: Response, next: NextFunction): void {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
  const path = req.path;
  const userAgent = req.headers['user-agent'] || '';
  const rawUrl = req.originalUrl;

  // Block known malicious IPs
  if (BLOCKED_IPS.has(ip)) {
    logger.warn('[security-filter] Blocked IP', { ip, path, userAgent });
    res.status(444).end(); return; // No response — drop connection
  }

  // Block known malicious user agents
  if (BLOCKED_USER_AGENTS.some((pattern) => pattern.test(userAgent))) {
    logger.warn('[security-filter] Blocked user agent', { ip, path, userAgent });
    res.status(444).end(); return;
  }

  // Block paths matching exploit/scanner patterns
  if (BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(path) || pattern.test(rawUrl))) {
    logger.warn('[security-filter] Blocked malicious path', { ip, path, userAgent });
    res.status(444).end(); return;
  }

  next();
}
