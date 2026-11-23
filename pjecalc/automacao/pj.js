// Helper library to drive PJe-Calc via Playwright
const { chromium } = require('playwright');
const BASE = 'http://localhost:9257/pjecalc/';

async function open() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('dialog', d => { console.log('DIALOG:', d.message()); d.accept(); });
  await p.goto(BASE, { waitUntil: 'networkidle' });
  return { b, p };
}
async function settle(p, ms = 1500) {
  try { await p.waitForLoadState('networkidle', { timeout: 120000 }); } catch (e) {}
  await p.waitForTimeout(ms);
}
const GROUPS = { 'Cálculo': 0, 'Operações': 2, 'Atualização': 3, 'Tabelas': 4 };
async function menu(p, group, item) {
  const g = GROUPS[group];
  let link;
  if (g !== undefined && (await p.$(`[id^="formulario:j_id38:${g}:"]`))) {
    const ids = await p.$$eval(`a[id^="formulario:j_id38:${g}:"]`, (as, item) => as.filter(a => a.innerText.trim() === item).map(a => a.id), item);
    if (ids.length) link = p.locator(`[id="${ids[0]}"]`);
  }
  if (!link) link = p.getByRole('link', { name: item, exact: true }).first();
  if (!(await link.isVisible().catch(() => false))) {
    await p.getByText(group, { exact: true }).first().click();
    await p.waitForTimeout(1000);
  }
  await link.click();
  await settle(p);
}
async function importar(p, file) {
  await menu(p, 'Cálculo', 'Importar');
  const inp = await p.$('input[type=file]');
  await inp.setInputFiles(file);
  await p.waitForTimeout(2000);
  await p.getByText('Confirmar', { exact: true }).first().click();
  await settle(p, 4000);
  const body = (await p.innerText('body')).replace(/\s+/g, ' ');
  console.log('IMPORT:', body.includes('Sucesso') ? 'OK' : body.slice(0, 600));
}
async function body(p, n = 3000) { return (await p.innerText('body')).replace(/\s+/g, ' ').slice(0, n); }
async function buttons(p) {
  return p.$$eval('input[type=submit],input[type=button],button,a', e => e.filter(x => x.offsetParent !== null).map(x => (x.id || '') + '=' + (x.value || x.innerText || x.title || '').trim()).filter(s => s.length > 1));
}
module.exports = { open, settle, menu, importar, body, buttons };
