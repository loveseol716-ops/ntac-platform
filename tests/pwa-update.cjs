// Production-build upgrade regression. Pass the previous dist and current dist directories.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
(async()=>{
 let root=path.resolve(process.argv[2]),revision=0;
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.replace(/^\/ntac-platform\//,'')||'index.html';const file=path.join(root,name);try{let data=fs.readFileSync(file);if(name==='sw.js'&&revision)data=Buffer.concat([data,Buffer.from(`\n// update-test-${revision}`)]);res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'application/octet-stream');res.end(data)}catch{res.statusCode=404;res.end()}});
 await new Promise(r=>server.listen(5176,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/root/.cache/ms-playwright/chromium_headless_shell-1161/chrome-linux/headless_shell',headless:true});
 try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5176/ntac-platform/');await page.evaluate(()=>navigator.serviceWorker.register('/ntac-platform/sw.js'));await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const oldScript=await page.locator('script[type=module]').getAttribute('src');
 root=path.resolve(process.argv[3]);
 await page.evaluate(async()=>{await new Promise(async resolve=>{navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});await(await navigator.serviceWorker.getRegistration()).update()})});
 assert.equal(await page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting)),false);
 await page.reload();assert.notEqual(await page.locator('script[type=module]').getAttribute('src'),oldScript);
 await page.getByRole('button',{name:'회원 가입',exact:true}).waitFor();
 await page.evaluate(()=>{const t=document.createElement('textarea');t.id='unsaved-test';t.value='작성 중인 내용';document.body.append(t)});
 revision=1;await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update()});
 await page.getByRole('button',{name:'새 화면 적용',exact:true}).waitFor();
 assert.equal(await page.locator('#unsaved-test').inputValue(),'작성 중인 내용');
 await page.getByRole('button',{name:'새 화면 적용',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('unsaved-test'));
 console.log('PASS: old cached app upgrades without waiting, new build loads, future updates show banner and preserve unsaved content until applied');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
