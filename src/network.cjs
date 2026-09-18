'use strict';
// XMCL uses Undici 6. Electron's global dispatcher can be a newer, incompatible version.
const {Agent}=require('undici');
const downloadAgent={dispatcher:new Agent({connections:8})};
module.exports={downloadAgent};
