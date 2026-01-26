/**
 * Utility functions for subdomain detection and retailer routing
 */

/**
 * Extract subdomain from hostname
 * Examples:
 *   jairajendra.goldsaver.com → 'jairajendra'
 *   retailer2.goldsaver.com → 'retailer2'
 *   localhost:3000 → null
 *   goldsaver.com → null (root domain)
 */
export function getSubdomain(): string | null {
  if (typeof window === 'undefined') return null;
  
  const hostname = window.location.hostname;
  
  // Localhost or IP address
  if (hostname === 'localhost' || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return null;
  }
  
  // Split by dots
  const parts = hostname.split('.');
  
  // Need at least 3 parts for subdomain (subdomain.domain.tld)
  if (parts.length < 3) {
    return null; // Root domain or invalid
  }
  
  // First part is the subdomain
  const subdomain = parts[0];
  
  // Ignore 'www'
  if (subdomain === 'www') {
    return null;
  }
  
  return subdomain;
}

/**
 * Check if we're on a subdomain (not root domain)
 */
export function isSubdomain(): boolean {
  return getSubdomain() !== null;
}

/**
 * Get the root domain from current hostname
 * Examples:
 *   jairajendra.goldsaver.com → 'goldsaver.com'
 *   localhost:3000 → 'localhost:3000'
 */
export function getRootDomain(): string {
  if (typeof window === 'undefined') return '';
  
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // Localhost
  if (hostname === 'localhost') {
    return port ? `${hostname}:${port}` : hostname;
  }
  
  const parts = hostname.split('.');
  
  // If less than 2 parts, return as-is
  if (parts.length < 2) {
    return hostname;
  }
  
  // Return last 2 parts (domain.tld)
  return parts.slice(-2).join('.');
}

/**
 * Build a URL for a specific subdomain
 * Examples:
 *   buildSubdomainUrl('retailer1', '/login') → 'https://retailer1.goldsaver.com/login'
 */
export function buildSubdomainUrl(subdomain: string, path: string = '/'): string {
  if (typeof window === 'undefined') return path;
  
  const protocol = window.location.protocol;
  const port = window.location.port;
  const rootDomain = getRootDomain();
  
  // Localhost
  if (rootDomain.includes('localhost')) {
    return `${protocol}//${rootDomain}${path}`;
  }
  
  // Production
  const domain = subdomain ? `${subdomain}.${rootDomain}` : rootDomain;
  return `${protocol}//${domain}${path}`;
}
