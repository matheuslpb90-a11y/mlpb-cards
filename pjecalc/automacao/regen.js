// usage: node regen.js in.pjc out.zip   -> import, regerar todas as verbas (sobrescrever), exportar
const pj = require('./pj.js');
(async () => {
  const [file, out] = process.argv.slice(2);
  const { b, p } = await pj.open();
  await pj.importar(p, file);
  await pj.menu(p, 'Cálculo', 'Verbas');
  // expandir reflexas
  const ex = p.getByText('Exibir', { exact: true });
  if (await ex.count()) { await ex.first().click(); await pj.settle(p); }
  const boxes = await p.$$eval('input[type=checkbox]', e => e.filter(x => x.offsetParent !== null).map(x => x.id));
  console.log('checkboxes', boxes.length, boxes.slice(0, 20).join(','));
  const all = p.locator('input[type=checkbox]:visible');
  const n = await all.count();
  for (let i = 0; i < n; i++) { const c = all.nth(i); if (!(await c.isChecked())) { await c.check().catch(() => {}); await p.waitForTimeout(300); } }
  console.log('checked', n);
  for (const nm of ['AVISO PRÉVIO SOBRE', 'MULTA DO ARTIGO 477']) {
    const row = p.locator('tr').filter({ hasText: nm }).last();
    const cbs = row.locator('input[type=checkbox]');
    for (let i = 0; i < await cbs.count(); i++) await cbs.nth(i).uncheck().catch(() => {});
  }
  await p.check('[id="formulario:tipoRegeracao:1"]');
  await p.click('[id="formulario:regerarOcorrencias"]');
  await pj.settle(p, 2000);
  await p.getByText('Deseja gerar novamente').first().waitFor({ timeout: 15000 }).catch(() => console.log('sem popup'));
  const okb = p.locator('input[value="Ok"]:visible, button:has-text("Ok"):visible, a:has-text("Ok"):visible');
  console.log('ok buttons', await okb.count());
  await okb.first().click();
  await pj.settle(p, 8000);
  console.log('REGERAR:', (await pj.body(p, 6000)).replace(/.*Regeração de Ocorrências/, '').slice(0, 1500));
  await p.screenshot({ path: out + '_verbas.png', fullPage: true });
  await pj.menu(p, 'Operações', 'Exportar');
  console.log('EXPORT PAGE:', (await pj.body(p, 3000)).replace(/.*Exportar/, '').slice(0, 800));
  console.log('BTNS', (await pj.buttons(p)).filter(s => !s.startsWith('formulario:j_id38')).join(' | '));
  const eb = p.locator('input[value="Exportar"]').first();
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 180000 }), eb.click()]);
  await dl.saveAs(out); console.log('exported', dl.suggestedFilename());
  await b.close();
})();
