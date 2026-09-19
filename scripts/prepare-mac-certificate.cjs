'use strict';
// Normalize OpenSSL 3 PKCS12 archives for Apple's Security framework.
// Private material stays in memory or mode-0600 temporary files, never artifacts/logs.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const source=process.env.CSC_LINK,password=process.env.CSC_KEY_PASSWORD;
if(!source||!password)throw Error('Missing signing configuration');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cobblemine-sign-'));
fs.chmodSync(dir,0o700);
const input=path.join(dir,'source.p12'),output=path.join(dir,'apple.p12'),bundle=path.join(dir,'bundle.pem');
fs.writeFileSync(input,Buffer.from(source,'base64'),{mode:0o600});
const prefix=execFileSync('brew',['--prefix','openssl@3'],{encoding:'utf8'}).trim();
const openssl=path.join(prefix,'bin','openssl');
let pem;
try {
  try {
    pem=execFileSync(openssl,['pkcs12','-in',input,'-nodes','-passin','env:CSC_KEY_PASSWORD'],{stdio:['ignore','pipe','pipe']});
  } catch {
    throw Error('Cannot decrypt CSC_LINK with CSC_KEY_PASSWORD. Verify the P12 export password and uploaded file.');
  }
  let archive;
  try {
    // OpenSSL must read the key and certificate separately; stdin cannot be rewound.
    fs.writeFileSync(bundle,pem,{mode:0o600});
    // This compatibility archive exists only in the ephemeral runner keychain import path.
    archive=execFileSync(openssl,['pkcs12','-export','-in',bundle,'-inkey',bundle,'-keypbe','PBE-SHA1-3DES','-certpbe','PBE-SHA1-3DES','-macalg','sha1','-passout','env:CSC_KEY_PASSWORD'],{stdio:['ignore','pipe','pipe']});
    fs.writeFileSync(output,archive,{mode:0o600});
  } catch {
    throw Error('Unable to prepare the Apple-compatible signing archive.');
  } finally {archive?.fill(0);}
  fs.appendFileSync(process.env.GITHUB_OUTPUT,`certificate=${output}\n`);
  console.log('Certificate password verified; Apple-compatible archive prepared.');
} finally {pem?.fill(0);fs.rmSync(input,{force:true});fs.rmSync(bundle,{force:true});}
