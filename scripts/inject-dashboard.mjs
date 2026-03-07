import fs from 'fs';

const html = fs.readFileSync('packages/dashboard/dist/index.html', 'utf8');

const tsContent = `/**
 * Get the embedded dashboard HTML
 */
export function getDashboardHtml(basePath: string): string {
  const rawHtml = ${JSON.stringify(html)};
  return rawHtml.replace(/\\{\\{NODESCOPE_BASE_PATH\\}\\}/g, basePath);
}
`;

fs.writeFileSync('packages/core/src/dashboard/index.ts', tsContent);
console.log('Successfully injected dashboard HTML');
