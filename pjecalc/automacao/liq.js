// usage: node liq.js file.pjc dd/mm/aaaa outprefix [export]
const pj = require('./pj.js');
(async () => {
  const [file, data, out, doExport] = process.argv.slice(2);
  const { b, p } = await pj.open();
  await pj.importar(p, file);
  await pj.menu(p, 'Operações', 'Liquidar');
  const di = p.locator('[id="formulario:dataDeLiquidacaoInputDate"]');
  for (let t = 0; t < 3 && (await di.inputValue()) !== data; t++) {
    await di.fill('');
    await di.pressSequentially(data, { delay: 80 });
    await di.press('Tab');
    await p.waitForTimeout(1500);
    if ((await di.inputValue()) !== data) await di.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, data);
  }
  console.log('DATA CAMPO:', await di.inputValue());
  await p.click('[id="formulario:liquidar"]');
  await pj.settle(p, 5000);
  const lt = (await pj.body(p, 20000)).replace(/.*Pendências do Cálculo/, '');
  console.log('LIQ:', lt.slice(0, 5000));
  if (/Erro\. É necessário resolver/.test(await pj.body(p, 20000))) { console.log('LIQUIDACAO FALHOU'); await b.close(); return; }
  await pj.menu(p, 'Operações', 'Imprimir');
  console.log('BTNS', (await pj.buttons(p)).join(' | ').slice(0, 1500));
  const inputs = await p.$$eval('input,select', e => e.filter(x => x.offsetParent !== null && x.type !== 'hidden').map(x => `${x.id}[${x.type}]=${x.value}${x.checked ? '*' : ''}`));
  console.log('INPUTS', inputs.join(' | ').slice(0, 3000));
  await p.screenshot({ path: out + '_imprimir.png', fullPage: true });
  const btn = p.locator('input[value="Imprimir"],input[value="Gerar"],input[value="Visualizar"]').first();
  if (await btn.count()) {
    const [dl] = await Promise.all([
      p.waitForEvent('download', { timeout: 180000 }).catch(() => null),
      p.context().waitForEvent('page', { timeout: 180000 }).catch(() => null),
      btn.click(),
    ]).then(r => [r[0] || r[1]]);
    if (dl && dl.saveAs) { await dl.saveAs(out + '.pdf'); console.log('PDF saved'); }
    else if (dl) { await dl.waitForLoadState(); console.log('new page url', dl.url()); }
  }
  if (doExport) {
    await pj.menu(p, 'Operações', 'Exportar');
    console.log('EXPORT BTNS', (await pj.buttons(p)).join(' | ').slice(0, 1000));
    await p.screenshot({ path: out + '_exportar.png', fullPage: true });
    const eb = p.locator('input[value="Exportar"]').first();
    if (await eb.count()) {
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 180000 }), eb.click()]);
      await dl.saveAs(out + '.pjc.zip'); console.log('PJC saved', dl.suggestedFilename());
    }
  }
  await b.close();
})();
