const pj = require('./pj.js');
(async () => {
  const { b, p } = await pj.open();
  await pj.importar(p, process.argv[2]);
  for (const spec of (process.argv[3] || 'Operações:Liquidar').split(',')) {
    const [g, item] = spec.split(':');
    await pj.menu(p, g, item);
    await p.screenshot({ path: `exp_${item.replace(/\W/g, '')}.png`, fullPage: true });
    console.log('=== ', item, '\n', await pj.body(p, 2500));
    console.log('BTNS', (await pj.buttons(p)).join(' | ').slice(0, 2000));
    const inputs = await p.$$eval('input,select', e => e.filter(x => x.offsetParent !== null && x.type !== 'hidden').map(x => `${x.id}[${x.type}]=${x.value}`));
    console.log('INPUTS', inputs.join(' | ').slice(0, 2500));
  }
  await b.close();
})();
