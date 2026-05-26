var Zt=Object.create;var be=Object.defineProperty;var er=Object.getOwnPropertyDescriptor;var tr=Object.getOwnPropertyNames;var rr=Object.getPrototypeOf,nr=Object.prototype.hasOwnProperty;var sr=(t,e)=>{for(var n in e)be(t,n,{get:e[n],enumerable:!0})},st=(t,e,n,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of tr(e))!nr.call(t,s)&&s!==n&&be(t,s,{get:()=>e[s],enumerable:!(r=er(e,s))||r.enumerable});return t};var v=(t,e,n)=>(n=t!=null?Zt(rr(t)):{},st(e||!t||!t.__esModule?be(n,"default",{value:t,enumerable:!0}):n,t)),or=t=>st(be({},"__esModule",{value:!0}),t);var Mr={};sr(Mr,{activate:()=>kr,deactivate:()=>Ar});module.exports=or(Mr);var i=v(require("vscode")),fe=v(require("node:os")),B=v(require("node:path"));var ot=require("node:child_process"),ye=v(require("node:fs")),at=v(require("node:os")),we=v(require("node:path"));async function y(t,e){let n=process.env.ARDUINO_CLI_PATH||"arduino-cli";return new Promise(r=>{let s=(0,ot.spawn)(n,t,{cwd:e,env:process.env,shell:at.platform()==="win32"}),o="",l="";s.stdout.on("data",d=>o+=d.toString()),s.stderr.on("data",d=>l+=d.toString()),s.on("error",d=>r({success:!1,exitCode:null,stdout:o,stderr:`${l}
${String(d)}`})),s.on("close",d=>r({success:d===0,exitCode:d,stdout:o,stderr:l}))})}async function _e(){return y(["core","update-index"])}async function De(t){return y(["core","install",t])}function it(t){if(!t||typeof t!="string")return null;let e=t.split(":");return e.length>=2?`${e[0]}:${e[1]}`:null}async function lt(t){let e=await y(["core","list","--json"]);if(!e.success)return!1;try{let n=JSON.parse(e.stdout),r=Array.isArray(n?.platforms)?n.platforms:[];for(let s of r)if(String(s?.id??"")===t)return!0}catch{}return!1}async function xe(t,e,n){if(!t||!e)return;let r=we.join(e,".grease-build");try{let s=await y(["compile","--fqbn",t,"--only-compilation-database","--build-path",r,e],e);if(!s.success){n.appendLine("[clangd] Failed to generate compile_commands.json: "+s.stderr);return}let o=we.join(r,"compile_commands.json"),l=we.join(e,"compile_commands.json");if(!ye.existsSync(o)){n.appendLine(`[clangd] arduino-cli reported success but ${o} is missing \u2014 clangd will not have a compilation database.`);return}ye.copyFileSync(o,l),n.appendLine("[clangd] compile_commands.json generated for IntelliSense.")}catch(s){n.appendLine("[clangd] Error generating compile_commands.json: "+(s instanceof Error?s.message:String(s)))}}async function dt(){let t=await y(["board","list","--format","json"]),e=t.stdout,n=t.stderr;if(!t.success)return{success:!1,candidates:[],raw:e,stderr:n};let r=e.match(/\{[\s\S]*\}\s*$/)||e.match(/\[[\s\S]*\]\s*$/),s=r?r[0]:e,o;try{o=JSON.parse(s)}catch(p){return{success:!1,candidates:[],raw:e,stderr:`${n}
Failed to parse JSON: ${p instanceof Error?p.message:String(p)}`}}let l=Array.isArray(o?.detected_ports)?o.detected_ports:[],d=[];for(let p of l){let b=p?.port?.address,A=p?.port?.protocol,M=p?.port?.properties?.vid??null,P=p?.port?.properties?.pid??null,$=p?.port?.properties?.serialNumber??null,w=Array.isArray(p?.matching_boards)?p.matching_boards:[];if(w.length===0){typeof b=="string"&&d.push({port:b,protocol:A,vid:M,pid:P,serialNumber:$});continue}for(let L of w)d.push({port:b,protocol:A,fqbn:L?.fqbn,name:L?.name,vid:M,pid:P,serialNumber:$})}return{success:!0,candidates:d,raw:e,stderr:n}}async function ct(){try{await y(["config","set","library.enable_unsafe_install","true"])}catch{}}var Se=v(require("vscode"));var pt="arduinoMcp.target",ut="arduinoMcp.boardMemory";async function Z(t,e){if(!e){await t.globalState.update(pt,void 0);return}await t.globalState.update(pt,e)}async function qe(t){return t.globalState.get(ut)??{}}async function mt(t,e){await t.globalState.update(ut,e)}function Fe(t,e){return!t||!e?null:`${String(t).toLowerCase()}:${String(e).toLowerCase()}`}function je(t){let e=[];t?.serialNumber&&e.push(`serial:${t.serialNumber}`);let n=Fe(t?.vid,t?.pid);return n&&e.push(n),t?.fqbn&&e.push(`fqbn:${t.fqbn}`),e}async function Ge(t){let e=await dt();return e.success?{success:!0,candidates:e.candidates}:(t.appendLine(`Board detect failed: ${e.stderr}`),{success:!1,candidates:[],stderr:e.stderr})}function ar(t){return[t.name||"Unknown board",t.fqbn?`(${t.fqbn})`:"(no fqbn)",t.port].join("  ")}async function He(t,e,n){if(e.length===0)return null;let r=e.map(o=>{let l=typeof o.fqbn=="string"?o.fqbn:null;return{label:ar(o),description:l?void 0:"Port detected (board unknown - install/select core)",target:{port:o.port,fqbn:l}}});if(n?.fqbn){r.push({kind:Se.QuickPickItemKind.Separator,label:"Change port only (keep current board)"});for(let o of e)r.push({label:`$(plug) ${o.port}`,description:`Keep board: ${n.fqbn}`,target:{port:o.port,fqbn:n.fqbn}})}let s=await Se.window.showQuickPick(r,{title:"Select Arduino board/port",placeHolder:"Pick the correct port (and board if known)",ignoreFocusOut:!1});return s?.target?(await Z(t,s.target),s.target):null}var ft=v(require("node:fs")),j=v(require("vscode"));function gt(t){let e=new Map,n;try{n=ft.readFileSync(t,"utf8")}catch{return e}let r=/\/\*\*([\s\S]*?)\*\//g,s;for(;(s=r.exec(n))!==null;){let o=s[1],l=/@brief\b\s*([\s\S]*?)(?=\n\s*\*\s*(?:@|\n)|\n\s*\*\/|$)/,d=o.match(l);if(!d)continue;let p=d[1].split(`
`).map(w=>w.replace(/^\s*\*\s?/,"").trim()).filter(w=>w.length>0).join(" ").replace(/\s+/g," ").trim();if(!p)continue;let b=[],A=/@param\s+(\w+)\s+([\s\S]*?)(?=\n\s*\*\s*(?:@|\n)|\n\s*\*\/|$)/g,M;for(;(M=A.exec(o))!==null;){let w=M[2].split(`
`).map(L=>L.replace(/^\s*\*\s?/,"").trim()).filter(L=>L.length>0).join(" ").replace(/\s+/g," ").trim();M[1]&&w&&b.push({name:M[1],desc:w})}let P=n.slice(s.index+s[0].length,s.index+s[0].length+400),$=ir(P);$&&(e.has($.name)||e.set($.name,{brief:p,signature:$.signature,params:b}))}return e}function ir(t){let e=t.split(`
`).map(l=>l.trim()).find(l=>l.length>0)??"",n=t.match(/^\s*#define\s+([A-Za-z_]\w*)/);if(n)return{name:n[1],signature:e};let r=t.match(/^\s*extern\s+[\w:<>*&\s]+?\s+([A-Za-z_]\w*)\s*[;[]/);if(r){let l=e.replace(/^extern\s+/,"").replace(/;$/,"").trim();return{name:r[1],signature:l}}let s=t.match(/^\s*class\s+([A-Za-z_]\w*)/);if(s)return{name:s[1],signature:`class ${s[1]}`};let o=t.match(/^\s*(?:(?:virtual|static|inline|explicit|constexpr|friend)\s+)*(?:[A-Za-z_][\w:]*\s*[*&\s]+)+([A-Za-z_]\w*)\s*\(/);return o?{name:o[1],signature:e.replace(/;$/,"").trim()}:null}function ht(t,e){return e.appendLine(`[hover-docs] Loaded ${t.size} Arduino symbol descriptions.`),j.languages.registerHoverProvider([{scheme:"file",language:"cpp"},{scheme:"file",language:"c"},{scheme:"file",language:"arduino"}],{provideHover(n,r){let s=n.getWordRangeAtPosition(r);if(!s)return null;let o=n.getText(s),l=t.get(o);if(!l)return null;let d=new j.MarkdownString;d.appendMarkdown(`**function** \`${o}\`

`),d.appendMarkdown(`${l.brief}

`),d.appendCodeblock(l.signature,"cpp");for(let p of l.params)d.appendMarkdown(`*@param* \`${p.name}\` \u2014 ${p.desc}

`);return d.isTrusted=!1,new j.Hover(d,s)}})}async function vt(t,e){let n=j.extensions.getExtension("llvm-vs-code-extensions.vscode-clangd");if(!n){e.appendLine("[hover-filter] clangd extension not found \u2014 filter skipped");return}let r;try{r=n.isActive?n.exports:await n.activate()}catch(p){e.appendLine("[hover-filter] clangd activation error: "+String(p));return}let s=r?.languageClient;if(!s){e.appendLine("[hover-filter] languageClient not exposed by clangd \u2014 filter skipped");return}let l=(s._clientOptions??s.clientOptions)?.middleware;if(!l){e.appendLine("[hover-filter] clangd middleware not accessible \u2014 filter skipped");return}let d=l.provideHover;l.provideHover=async(p,b,A,M)=>{let P=p.getWordRangeAtPosition(b),$=P?p.getText(P):"";if($&&t.has($))return null;let w=d?await d(p,b,A,M):await M(p,b,A);return w&&lr(w)},e.appendLine("[hover-filter] clangd hover filter installed")}function lr(t){let n=(Array.isArray(t.contents)?t.contents:[t.contents]).map(r=>{if(!(r instanceof j.MarkdownString))return r;let s=r.value.replace(/^provided by ["'][^"'\n]*["']\s*$/gm,"").replace(/\n{3,}/g,`

`).trim(),o=new j.MarkdownString(s);return o.isTrusted=r.isTrusted,o});return new j.Hover(n,t.range)}var R=v(require("vscode")),O=v(require("node:fs")),G=v(require("node:path"));var q=v(require("node:fs")),D=v(require("node:path")),bt=require("node:child_process"),Ne="// arduino-grease:hover-docs:v1";function wt(t){return["# Generated by Arduino Grease.","# Tells clangd how to parse .ino files (they are not valid C++ on their own).","CompileFlags:","  Add: [-xc++, -include, Arduino.h]","Index:","  Background: Build",""].join(`
`)}function dr(t){return new Promise(e=>{let n=t||"arduino-cli",r="",s;try{s=(0,bt.spawn)(n,["config","get","directories.data"],{shell:!1})}catch{e(null);return}s.stdout.on("data",o=>{r+=o.toString()}),s.on("error",()=>e(null)),s.on("close",()=>{let o=r.trim();if(o){e(o);return}let l=process.env.HOME||process.env.USERPROFILE||"";if(process.platform==="darwin")e(D.join(l,"Library","Arduino15"));else if(process.platform==="win32"){let d=process.env.LOCALAPPDATA||D.join(l,"AppData","Local");e(D.join(d,"Arduino15"))}else e(D.join(l,".arduino15"))})})}var cr={name:"Print.h (classic AVR shape)",signature:/virtual size_t write\(uint8_t\) = 0;\s*\n\s*size_t write\(const char \*str\)/m,edits:[{find:/(\n)(\s*)virtual size_t write\(uint8_t\) = 0;\n/,replace:`$1$2/**
$2 * \\brief Send one raw byte to the stream.
$2 *
$2 * Sends the byte unchanged (no formatting) and returns the number of
$2 * bytes written (0 if the underlying device couldn't accept it).
$2 */
$2virtual size_t write(uint8_t) = 0;
`},{find:/\n(\s*)size_t print\(const __FlashStringHelper \*\);\n/,replace:`
$1/**
$1 * \\brief Write data to the stream as human-readable text.
$1 *
$1 * Numbers are converted to a decimal string by default; the second
$1 * argument selects a base \u2014 DEC (10), HEX (16), OCT (8), or BIN (2).
$1 * For floating-point values the second argument is the number of digits
$1 * after the decimal point (default 2). Strings, chars, and Printables
$1 * are written verbatim. Returns the number of bytes sent.
$1 */
$1size_t print(const __FlashStringHelper *);
`},{find:/\n(\s*)size_t println\(const __FlashStringHelper \*\);\n/,replace:`
$1/**
$1 * \\brief Like print(), then send "\\r\\n" (carriage return + line feed).
$1 *
$1 * Identical to print() but appends a newline. The no-argument form
$1 * sends just the newline. Returns the number of bytes sent.
$1 */
$1size_t println(const __FlashStringHelper *);
`}]},pr={name:"Stream.h",signature:/virtual int available\(\) = 0;\s*\n\s*virtual int read\(\) = 0;\s*\n\s*virtual int peek\(\) = 0;/m,edits:[{find:/(\n)(\s*)virtual int available\(\) = 0;\n(\s*)virtual int read\(\) = 0;\n(\s*)virtual int peek\(\) = 0;/,replace:`$1$2/**
$2 * \\brief Number of bytes waiting in the stream's input buffer.
$2 *
$2 * Returns 0 if nothing has arrived yet. Use this to check whether read()
$2 * will return immediately. Example: \`if (Serial.available()) ...\`.
$2 */
$2virtual int available() = 0;
$3/**
$3 * \\brief Remove and return the next byte from the stream's input buffer.
$3 *
$3 * Returns -1 if no data is available.
$3 */
$3virtual int read() = 0;
$4/**
$4 * \\brief Look at the next byte without removing it from the input buffer.
$4 *
$4 * Returns -1 if no data is available.
$4 */
$4virtual int peek() = 0;`},{find:/\n(\s*)long parseInt\(LookaheadMode lookahead = SKIP_ALL, char ignore = NO_IGNORE_CHAR\);\n/,replace:`
$1/**
$1 * \\brief Read characters from the stream and parse them as a signed long.
$1 *
$1 * Skips leading non-digit characters (configurable via \`lookahead\`), then
$1 * reads digits until the first non-digit. Returns 0 on timeout.
$1 */
$1long parseInt(LookaheadMode lookahead = SKIP_ALL, char ignore = NO_IGNORE_CHAR);
`},{find:/\n(\s*)size_t readBytes\( char \*buffer, size_t length\);/,replace:`
$1/**
$1 * \\brief Read up to \`length\` bytes into \`buffer\`.
$1 *
$1 * Stops when the buffer is full or the read times out. Returns the actual
$1 * number of bytes placed in the buffer (0 if none).
$1 */
$1size_t readBytes( char *buffer, size_t length);`}]},ur={name:"HardwareSerial.h (AVR concrete shape)",signature:/void begin\(unsigned long baud\) \{ begin\(baud, SERIAL_8N1\); \}\s*\n\s*void begin\(unsigned long, uint8_t\);/m,edits:[{find:/(\n)(\s*)void begin\(unsigned long baud\) \{ begin\(baud, SERIAL_8N1\); \}/,replace:`$1$2/**
$2 * \\brief Start the UART at the given baud rate (8N1).
$2 *
$2 * Always call this from setup() before using Serial. Common rates are
$2 * 9600, 19200, 38400, 57600, 115200. The other side must match.
$2 */
$2void begin(unsigned long baud) { begin(baud, SERIAL_8N1); }`},{find:/(\n)(\s*)void end\(\);(\s*\n)/,replace:`$1$2/** \\brief Shut down the UART. Frees the pins for other use. */
$2void end();$3`}]},mr={name:"HardwareSerial.h (api/ pure-virtual shape)",signature:/virtual void begin\(unsigned long\) = 0;\s*\n\s*virtual void begin\(unsigned long baudrate, uint16_t config\) = 0;/m,edits:[{find:/(\n)(\s*)virtual void begin\(unsigned long\) = 0;\n(\s*)virtual void begin\(unsigned long baudrate, uint16_t config\) = 0;/,replace:`$1$2/**
$2 * \\brief Start the UART at the given baud rate (8N1).
$2 *
$2 * Always call this from setup() before using Serial. Common rates are
$2 * 9600, 19200, 38400, 57600, 115200. The other side must match.
$2 */
$2virtual void begin(unsigned long) = 0;
$3/** \\brief Start the UART with an explicit frame format (SERIAL_xyz). */
$3virtual void begin(unsigned long baudrate, uint16_t config) = 0;`},{find:/(\n)(\s*)virtual void end\(\) = 0;/,replace:`$1$2/** \\brief Shut down the UART. Frees the pins for other use. */
$2virtual void end() = 0;`}]},fr=[cr,pr,ur,mr];function gr(t,e){let n;try{n=q.readFileSync(t,"utf8")}catch(o){return{status:"error",reason:"read: "+(o instanceof Error?o.message:String(o))}}if(n.indexOf(Ne)!==-1)return{status:"skipped",reason:"already patched"};if(!e.signature.test(n))return{status:"skipped",reason:"shape mismatch"};let r=n,s=0;for(let o of e.edits)o.find.test(r)&&(r=r.replace(o.find,o.replace),s++);if(s===0)return{status:"skipped",reason:"no edit anchors matched"};/\*\//.test(r)?r=r.replace(/\*\/\n/,`*/
`+Ne+`
`):r=Ne+`
`+r;try{return q.writeFileSync(t,r,"utf8"),{status:"patched",edits:s}}catch(o){return{status:"error",reason:"write: "+(o instanceof Error?o.message:String(o))}}}function hr(t){let e=[],n=D.join(t,"packages"),r;try{r=q.readdirSync(n)}catch{return e}for(let s of r){let o=D.join(n,s,"hardware"),l;try{l=q.readdirSync(o)}catch{continue}for(let d of l){let p=D.join(o,d),b;try{b=q.readdirSync(p)}catch{continue}for(let A of b){let M=D.join(p,A,"cores"),P;try{P=q.readdirSync(M)}catch{continue}for(let $ of P){let w=D.join(M,$);for(let L of["Print.h","Stream.h","HardwareSerial.h"]){let ge=D.join(w,L),he=D.join(w,"api",L);q.existsSync(ge)&&e.push(ge),q.existsSync(he)&&e.push(he)}}}}}return e}async function yt(t={}){let e=t.log||(()=>{}),n=await dr(t.arduinoCliPath);if(!n)return e("[hover-docs] Could not resolve Arduino data dir; skipping core patches."),{patched:0,skipped:0,errors:0};e("[hover-docs] Scanning cores under "+n);let r=hr(n),s=0,o=0,l=0;for(let d of r){let p={status:"skipped",reason:"no matching patch"};for(let b of fr){let A=gr(d,b);if(A.status==="patched"){p=A;break}if(A.status==="skipped"&&A.reason==="already patched"){p=A;break}p=A}p.status==="patched"?(s++,e("[hover-docs] Patched "+d+" ("+p.edits+" edits)")):p.status==="error"?(l++,e("[hover-docs] Error patching "+d+": "+p.reason)):o++}return e("[hover-docs] Done. Patched "+s+", skipped "+o+", errors "+l+"."),{patched:s,skipped:o,errors:l}}var ee=v(require("vscode")),St=v(require("node:crypto")),F=v(require("node:fs")),Ct=v(require("node:os")),C=v(require("node:path"));function ze(t){try{return F.readdirSync(t)}catch{return[]}}function ne(t){let e=C.basename(t),n=C.join(t,`${e}.ino`);if(F.existsSync(n))return n;let r=ze(t).filter(s=>s.toLowerCase().endsWith(".ino"));return r.length===1?C.join(t,r[0]):null}function xt(t){return ne(t)!==null}function kt(t){if(!t)return{kind:"missing-ino",folder:t};let e=C.basename(t),n=C.join(t,`${e}.ino`);if(F.existsSync(n))return{kind:"ok",folder:t,mainIno:n};let r=ze(t).filter(s=>s.toLowerCase().endsWith(".ino"));if(r.length===0)return{kind:"missing-ino",folder:t};if(r.length===1){let s=C.join(t,r[0]),o=C.basename(r[0],".ino"),l=C.join(t,o,r[0]);return{kind:"name-mismatch",folder:t,looseIno:s,expectedPath:l}}return{kind:"ambiguous",folder:t,candidates:r.map(s=>C.join(t,s))}}function At(){let t=ee.window.activeTextEditor;if(t&&t.document.uri.fsPath.toLowerCase().endsWith(".ino"))return t.document.uri.fsPath;for(let e of ee.window.visibleTextEditors)if(e.document.uri.fsPath.toLowerCase().endsWith(".ino"))return e.document.uri.fsPath;return null}function Mt(t){if(!t||!t.toLowerCase().endsWith(".ino")||!F.existsSync(t))return null;let e=C.basename(t,C.extname(t)),n=C.dirname(t);if(C.basename(n)===e)return{sketchDir:n,mainIno:t,isTemp:!1};let s=St.createHash("sha1").update(t).digest("hex").slice(0,10),o=C.join(Ct.tmpdir(),"arduino-grease-sketches",`${e}-${s}`),l=C.join(o,e),d=C.join(l,`${e}.ino`);try{F.mkdirSync(l,{recursive:!0}),F.copyFileSync(t,d);for(let p of ze(n)){let b=p.toLowerCase();if(b.endsWith(".h")||b.endsWith(".hpp")||b.endsWith(".cpp")||b.endsWith(".c")||b.endsWith(".cc")||b.endsWith(".cxx"))try{F.copyFileSync(C.join(n,p),C.join(l,p))}catch{}}}catch{return null}return{sketchDir:l,mainIno:d,isTemp:!0,originalIno:t,originalDir:n}}function se(){let t=ee.window.activeTextEditor;if(t){let r=t.document.uri.fsPath;if(r.toLowerCase().endsWith(".ino"))return C.dirname(r)}for(let r of ee.window.visibleTextEditors){let s=r.document.uri.fsPath;if(s.toLowerCase().endsWith(".ino"))return C.dirname(s)}let n=ee.workspace.workspaceFolders?.[0]?.uri.fsPath;if(!n)return null;if(xt(n))return n;try{let r=F.readdirSync(n,{withFileTypes:!0});for(let s of r){if(!s.isDirectory())continue;let o=C.join(n,s.name);if(xt(o))return o}}catch{}return n}var vr="# Generated by Arduino Grease.";function We(t,e,n){if(!t)return!1;try{let r=G.join(t,".clangd"),s=wt(e),o=!0;try{let l=O.readFileSync(r,"utf8");if(l===s)o=!1;else if(!l.startsWith(vr))return n.appendLine(`[clangd] Leaving user-owned ${r} untouched.`),!0}catch{}return o&&(O.writeFileSync(r,s),n.appendLine(`[clangd] Wrote ${r}`)),!0}catch(r){return n.appendLine(`[clangd] Failed to write .clangd: ${r instanceof Error?r.message:String(r)}`),!1}}function br(t){let e=G.join(t,"compile_commands.json");if(!O.existsSync(e))return!0;let n=ne(t);if(!n)return!0;try{let r=O.statSync(e);return O.statSync(n).mtimeMs>r.mtimeMs}catch{return!0}}async function Ce(t){let{sketchFolder:e,fqbn:n,sidecarPath:r,output:s,silent:o}=t;if(!e)return s.appendLine("[clangd] No sketch folder \u2014 IntelliSense refresh skipped."),!1;We(e,r,s);let l=kt(e);return l.kind==="name-mismatch"?(s.appendLine(`[clangd] Sketch validation failed: '${G.basename(l.looseIno)}' is loose inside '${G.basename(l.folder)}/'. Arduino requires it to live at '${l.expectedPath}'.`),o||wr(l,s),!1):l.kind==="missing-ino"?(s.appendLine(`[clangd] Sketch validation failed: no .ino in ${l.folder}.`),o||R.window.showWarningMessage(`Arduino Grease: ${l.folder} contains no .ino file. Open or create a sketch first.`),!1):l.kind==="ambiguous"?(s.appendLine(`[clangd] Sketch validation failed: ${l.candidates.length} .ino files in ${l.folder} and none matches the folder name. Pick one and rename the folder to match.`),o||R.window.showWarningMessage("Arduino Grease: Multiple .ino files in this folder. Move the one you're editing into its own folder (e.g., MySketch/MySketch.ino) so Arduino can compile it."),!1):n?(await xe(n,e,s),!0):(s.appendLine("[clangd] No board target set \u2014 .clangd written but compile_commands.json skipped (pick a board first)."),!1)}async function wr(t,e){let n=G.basename(t.looseIno),r=await R.window.showWarningMessage(`Arduino Grease: "${n}" is in the wrong place.

Arduino requires sketches to live in a folder of the same name. Right now it's at ${t.looseIno}, but Arduino expects ${t.expectedPath}.`,{modal:!1},"Auto-fix (move into subfolder)","Open Docs");if(r==="Open Docs"){R.env.openExternal(R.Uri.parse("https://docs.arduino.cc/learn/programming/sketches/"));return}if(r!=="Auto-fix (move into subfolder)")return;let s=G.dirname(t.expectedPath);try{if(O.existsSync(t.expectedPath)){R.window.showErrorMessage(`Arduino Grease: Cannot auto-fix \u2014 ${t.expectedPath} already exists.`);return}O.mkdirSync(s,{recursive:!0}),O.renameSync(t.looseIno,t.expectedPath),e.appendLine(`[clangd] Auto-fix: moved ${t.looseIno} \u2192 ${t.expectedPath}`);let o=await R.workspace.openTextDocument(R.Uri.file(t.expectedPath));await R.window.showTextDocument(o,{preview:!1}),R.window.showInformationMessage(`Arduino Grease: Moved ${n} into ${G.basename(s)}/. Run "Regenerate IntelliSense" to finish setup.`)}catch(o){let l=o instanceof Error?o.message:String(o);e.appendLine(`[clangd] Auto-fix failed: ${l}`),R.window.showErrorMessage(`Arduino Grease: Auto-fix failed \u2014 ${l}`)}}function ke(t,e,n){if(!t||!t.toLowerCase().endsWith(".ino"))return;let r=G.dirname(t);We(r,e,n)}async function Lt(t){let e=se();if(e){if(!br(e)){We(e,t.sidecarPath,t.output);return}t.output.appendLine("[clangd] compile_commands.json missing/stale \u2014 regenerating..."),await Ce({sketchFolder:e,fqbn:t.fqbn,sidecarPath:t.sidecarPath,output:t.output,silent:!0})}}var Pt="http://127.0.0.1:3333",Et="";function $t(t){Et=t}function Tt(t){let e=String(t||"").trim();e&&(Pt=e.replace(/\/$/,""))}async function le(t,e){let n=await fetch(`${Pt}${t}`,{method:"POST",headers:{"content-type":"application/json","x-grease-auth":Et},body:JSON.stringify(e??{})});if(!n.ok)throw new Error(`HTTP ${n.status} ${t}`);return await n.json()}async function V(t){try{await le("/target",{port:t?.port??null,fqbn:t?.fqbn??null})}catch{}}async function Ae(t){return le("/serial/open",t)}async function Me(){return le("/serial/close",{})}async function Bt(t){return le("/serial/write",t)}async function de(){return le("/serial/read",{})}var Ot=require("node:child_process"),Le=v(require("node:path")),_t=v(require("node:net")),Ue=v(require("node:os")),Ve=v(require("node:fs")),Dt=require("node:crypto");function It(t){return new Promise(e=>setTimeout(e,t))}function Rt(t){return new Promise(e=>{let n=_t.createServer();n.once("error",()=>e(!1)),n.once("listening",()=>{n.close(()=>e(!0))}),n.listen(t,"127.0.0.1")})}async function yr(t=3333){if(await Rt(t))return t;for(let e=t+1;e<t+60;e++)if(await Rt(e))return e;throw new Error("No free local port found for Arduino MCP server")}async function qt(t,e,n=3333){let r=await yr(n),s=process.env.ARDUINO_MCP_NODE_PATH||"node",o=t.asAbsolutePath(Le.join("dist","server.mjs")),l=null;try{let p=Le.join(Ue.homedir(),".grease","mcp-auth.json");l=JSON.parse(Ve.readFileSync(p,"utf8")).key||null}catch{}if(!l)try{let p=Le.join(Ue.homedir(),".grease-mcp-auth");l=JSON.parse(Ve.readFileSync(p,"utf8")).key||null}catch{}l||(l=(0,Dt.randomBytes)(24).toString("hex")),e.appendLine(`Starting bundled Arduino MCP server on port ${r}...`);let d=(0,Ot.spawn)(s,[o],{cwd:t.extensionPath,env:{...process.env,MCP_PORT:String(r),MCP_HOST:"127.0.0.1",MCP_AUTH_KEY:l},shell:!1});if(d.stdout?.on("data",p=>e.appendLine(`[server] ${String(p).trimEnd()}`)),d.stderr?.on("data",p=>e.appendLine(`[server:err] ${String(p).trimEnd()}`)),d.on("exit",p=>e.appendLine(`[server] exited with code ${p}`)),await It(250),d.exitCode!==null)throw new Error(`Bundled server exited early with code ${d.exitCode}`);return{port:r,authKey:l,stop:async()=>{d.killed||(d.kill("SIGTERM"),await It(200),d.killed||d.kill("SIGKILL"))}}}var K=v(require("vscode")),Pe=class{constructor(e){this.context=e}context;panel=null;show(e){this.panel?this.panel.reveal(K.ViewColumn.Beside):(this.panel=K.window.createWebviewPanel("arduinoMcp.boardTemplate","Arduino Grease: AI Prompt Template",K.ViewColumn.Beside,{enableScripts:!0}),this.panel.onDidDispose(()=>this.panel=null),this.panel.webview.onDidReceiveMessage(n=>{this.onMessage(n)})),this.panel.webview.html=this.html()}async onMessage(e){if(e?.type&&e.type==="copy"){let n=String(e.text??"");await K.env.clipboard.writeText(n),K.window.showInformationMessage("Arduino Grease: Copied prompt to clipboard.")}}html(){return`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        --bg: #1f1f1f;
        --panel: #2b2b2b;
        --ink: #e6e6e6;
        --muted: #a6a6a6;
        --stroke: #3a3a3a;
      }
      body { margin: 0; padding: 16px; background: var(--bg); color: var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
      .card { border: 2px solid var(--stroke); background: var(--panel); padding: 12px; border-radius: 12px; box-shadow: 6px 6px 0 #000; margin-bottom: 12px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      @media (max-width: 980px) { .grid { grid-template-columns: 1fr; } }
      label { font-size: 12px; color: var(--muted); }
      textarea, button {
        background: #171717;
        color: var(--ink);
        border: 2px solid var(--stroke);
        border-radius: 10px;
        padding: 10px 10px;
        font-size: 13px;
      }
      textarea { width: 100%; min-height: 120px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; line-height: 1.35; }
      button { cursor: pointer; min-height: 44px; }
      .row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
      .muted { color: var(--muted); font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="muted">Answer these questions to structure your prompt</div>
    </div>

    <div class="grid">
      <div class="card">
        <label>Wires, motors and sensors</label>
        <textarea id="wires" placeholder="Example: Left motor on pins 5/6 (PWM), right motor on pins 9/10, ultrasonic trig=2 echo=3, LDR=A0..."></textarea>
      </div>
      <div class="card">
        <label>Other modules installed</label>
        <textarea id="modules" placeholder="Example: IMU (MPU6050) on I2C, OLED 128x64, BLE module..."></textarea>
      </div>
      <div class="card">
        <label>Robot structure</label>
        <textarea id="robot" placeholder="Example: 2-wheel differential drive, geared DC motors, chassis size, power source..."></textarea>
      </div>
      <div class="card">
        <label>Expected behavior</label>
        <textarea id="behavior" placeholder="Example: Follow wall, avoid obstacles, blink status LED, publish sensor data..."></textarea>
      </div>
    </div>

    <div class="card">
      <div class="row">
        <button id="generate">Generate prompt</button>
        <button id="copy">Copy</button>
      </div>
      <textarea id="out" style="min-height: 220px" placeholder="Generated prompt will appear here..."></textarea>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      const $ = (id) => document.getElementById(id);

      function addSection(lines, title, value) {
        const text = String(value || "").trim();
        if (!text) return;
        lines.push(title + ":");
        lines.push(text);
        lines.push("");
      }

      function generate() {
        const wires = $("wires").value;
        const modules = $("modules").value;
        const robot = $("robot").value;
        const behavior = $("behavior").value;

        const lines = ["Arduino prompt context", ""];
        addSection(lines, "Wires, motors and sensors", wires);
        addSection(lines, "Other modules installed", modules);
        addSection(lines, "Robot structure", robot);
        addSection(lines, "Expected behavior", behavior);

        while (lines.length > 0 && lines[lines.length - 1] === "") {
          lines.pop();
        }

        $("out").value = lines.join("\\n");
      }

      $("generate").addEventListener("click", generate);
      $("copy").addEventListener("click", () => vscode.postMessage({ type: "copy", text: $("out").value }));
    </script>
  </body>
</html>`}};var H=v(require("vscode")),te=v(require("node:fs")),Ft=v(require("node:os")),Q=v(require("node:path"));function ce(t){let e=Array.isArray(t?.examples)?t.examples:[],n=[];for(let r of e){let s=String(r?.library?.name??"Unknown"),o=Array.isArray(r?.examples)?r.examples:[];for(let l of o){let d=String(l??"");d&&n.push({library:s,example:Q.basename(d),fullPath:d})}}return n}function Qe(t){let e=new Set,n=[];for(let r of t){let s=`${r.library}::${r.fullPath}`;e.has(s)||(e.add(s),n.push(r))}return n.sort((r,s)=>{let o=r.library.localeCompare(s.library);return o!==0?o:r.example.localeCompare(s.example)})}var Ee=class{constructor(e,n){this.context=e;this.output=n}context;output;panel=null;show(e){this.panel?(this.panel.title="X-mpls",this.panel.reveal(H.ViewColumn.Beside)):(this.panel=H.window.createWebviewPanel("arduinoMcp.examples","X-mpls",H.ViewColumn.Beside,{enableScripts:!0}),this.panel.onDidDispose(()=>this.panel=null),this.panel.webview.onDidReceiveMessage(n=>{this.onMessage(n,e)})),this.panel.webview.html=this.html(),this.onMessage({type:"list",library:""},e)}async listExamples(e){let n=["lib","examples","--json"];this.output.appendLine(`$ arduino-cli ${n.join(" ")}`);let r=await y(n);if(!r.success)throw new Error(r.stderr||r.stdout||"Failed to list examples");let s=ce(JSON.parse(r.stdout));if(e){let l=["lib","examples","--fqbn",e,"--json"];this.output.appendLine(`$ arduino-cli ${l.join(" ")}`);let d=await y(l);d.success&&(s=s.concat(ce(JSON.parse(d.stdout))))}let o=Q.join(Ft.homedir(),"Documents","Arduino","libraries","AdvancedAnalog");if(te.existsSync(o)){let l=Q.join(o,"examples");if(te.existsSync(l))try{let d=te.readdirSync(l,{withFileTypes:!0}).filter(p=>p.isDirectory());for(let p of d)s.push({library:"Filtered analog",example:p.name,fullPath:Q.join(l,p.name)})}catch{}}return Qe(s)}async openExampleAsTab(e){let n=String(e||"").trim();if(!n)return;let r=Q.basename(n),s=Q.join(n,`${r}.ino`),o=null;if(te.existsSync(s))o=s;else try{let d=te.readdirSync(n).filter(p=>p.toLowerCase().endsWith(".ino"));d.length>0&&(o=Q.join(n,d[0]))}catch{}if(!o){H.window.showWarningMessage("Arduino Grease: No .ino file found in this example.");return}let l=await H.workspace.openTextDocument(H.Uri.file(o));await H.window.showTextDocument(l,{preview:!1})}async onMessage(e,n){if(!(!this.panel||!e?.type))if(e.type==="list")try{let r=await this.listExamples(n);this.panel.webview.postMessage({type:"examples",rows:r})}catch(r){this.panel.webview.postMessage({type:"error",error:r instanceof Error?r.message:String(r)})}else e.type==="openExample"&&await this.openExampleAsTab(String(e.path??""))}html(){return`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        --bg: #0b0f0b;
        --panel: #121912;
        --ink: #d5ffd5;
        --soft: #bce6bc;
        --muted: #7ca57c;
        --stroke: #335233;
      }
      body { margin: 0; padding: 12px; background: var(--bg); color: var(--ink); font-family: Consolas, Menlo, Monaco, "Courier New", monospace; font-size:11px; }
      .card { border: 1px solid var(--stroke); background: var(--panel); padding: 9px; border-radius: 8px; margin-bottom: 9px; }
      input {
        background: #0d130d;
        color: var(--ink);
        border: 1px solid var(--stroke);
        border-radius: 6px;
        padding: 6px 7px;
        font-size: 11px;
        width: 168px;
      }
      .muted { color: var(--muted); font-size: 10px; }
      .list { display:flex; flex-direction:column; gap:7px; }
      .item { border:1px solid var(--stroke); border-radius:8px; background:#0d130d; padding:7px; cursor:pointer; }
      .item:hover { border-color:#58aa58; }
      .title { font-weight:700; font-size:11px; overflow-wrap:anywhere; color:var(--soft); }
      .meta { font-size:10px; color:var(--muted); margin-top:2px; overflow-wrap:anywhere; }
      .row { display:flex; gap:8px; align-items:flex-end; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="row">
        <div>
          <div class="muted">Search Text</div>
          <input id="query" placeholder="blink, imu, wifi" />
        </div>
        <div>
          <div class="muted">Library name</div>
          <input id="library" placeholder="wire, serv" />
        </div>
      </div>
    </div>

    <div class="card">
      <div id="error" style="color:#ffb4b4; white-space:pre-wrap"></div>
      <div id="count" class="muted" style="margin-bottom:8px"></div>
      <div id="out" class="list"></div>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      const $ = (id) => document.getElementById(id);
      let rows = [];

      function esc(s) {
        return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
      }

      function render() {
        const q = String($("query").value || "").trim().toLowerCase();
        const lib = String($("library").value || "").trim().toLowerCase();
        const filtered = rows.filter((r) => {
          const full = (r.library + " " + r.example + " " + r.fullPath).toLowerCase();
          const libMatch = !lib || r.library.toLowerCase().includes(lib);
          const textMatch = !q || full.includes(q);
          return libMatch && textMatch;
        });

        $("count").textContent = String(filtered.length) + " example sketches";
        if (filtered.length === 0) {
          $("out").innerHTML = "<div class='muted'>No example sketches found.</div>";
          return;
        }

        $("out").innerHTML = filtered.map((r) => {
          return "<div class='item' data-path='" + esc(r.fullPath) + "'><div class='title'>" + esc(r.example) + "</div><div class='meta'>" + esc(r.library) + "</div><div class='meta'>" + esc(r.fullPath) + "</div></div>";
        }).join("");

        document.querySelectorAll(".item").forEach((el) => {
          el.addEventListener("dblclick", () => {
            vscode.postMessage({ type: "openExample", path: el.getAttribute("data-path") || "" });
          });
        });
      }

      function maybeSearchOnEnter(ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          render();
        }
      }

      $("query").addEventListener("keydown", maybeSearchOnEnter);
      $("library").addEventListener("keydown", maybeSearchOnEnter);
      $("query").addEventListener("input", render);
      $("library").addEventListener("input", render);

      window.addEventListener("message", (event) => {
        const msg = event.data;
        if (msg.type === "error") {
          $("error").textContent = msg.error || "Unknown error";
        } else if (msg.type === "examples") {
          rows = Array.isArray(msg.rows) ? msg.rows : [];
          render();
        }
      });
    </script>
  </body>
</html>`}};var pe=v(require("vscode")),jt=v(require("node:os"));var $e=class{constructor(e){this.output=e}output;pollTimer=null;connectedPort=null;baudRate=9600;isConnected=!1;async start(e,n=9600){if(this.baudRate=n,!e){this.output.appendLine("Serial: no port selected.");return}await this.connect(e,this.baudRate),this.startPolling()}async stop(){this.isConnected&&(await Me(),this.isConnected=!1,this.output.appendLine("Serial disconnected"))}async handleConsoleCommand(e){let n=String(e??"").trim();if(!n)return;if(/^baud\s*=\s*\d+$/i.test(n)){let o=Number(n.split("=")[1]);if(!Number.isFinite(o)||o<=0){this.output.appendLine("Serial: invalid baud value.");return}this.baudRate=o,this.output.appendLine(`Serial baud set to ${o}`),this.connectedPort&&await this.connect(this.connectedPort,this.baudRate);return}if(/^clear$/i.test(n)){let l=(await de()).lines?.length??0;this.output.appendLine(`Serial buffer cleared (${l} lines dropped).`);return}if(/^disconnect$/i.test(n)){await this.stop();return}if(/^connect$/i.test(n)){if(!this.connectedPort){this.output.appendLine("Serial: no known port to connect.");return}await this.connect(this.connectedPort,this.baudRate);return}let r=n.match(/^send\s*=\s*"([\s\S]*)"$/i),s=n.match(/^send\s*=\s*(.+)$/i);if(r||s){let o=r?r[1]:s?.[1]??"";if(!this.isConnected){this.output.appendLine("Serial: not connected.");return}await Bt({data:o}),this.output.appendLine(`[serial:tx] ${o}`);return}this.output.appendLine(`Serial: unknown command "${n}".`)}async connect(e,n){try{await Ae({path:e,baudRate:n})}catch(r){let s=r instanceof Error?r.message:String(r);(s.includes("Permission denied")||s.includes("EACCES")||s.includes("EPERM"))&&jt.platform()==="linux"?pe.window.showErrorMessage(`Serial: Permission denied on ${e}. On Linux, run: sudo usermod -a -G dialout $USER \u2014 then log out and back in.`,"Copy Command").then(l=>{l==="Copy Command"&&pe.env.clipboard.writeText("sudo usermod -a -G dialout $USER")}):pe.window.showErrorMessage(`Serial: Failed to open ${e}: ${s}`),this.output.appendLine(`Serial open failed: ${s}`);return}this.connectedPort=e,this.baudRate=n,this.isConnected=!0,this.output.appendLine(`Serial connected: ${e} @ ${n}`)}startPolling(){this.pollTimer||(this.pollTimer=setInterval(()=>{this.isConnected&&(async()=>{try{let e=await de();for(let n of e.lines??[])this.output.appendLine(`[serial] ${n}`)}catch{}})()},250))}};var W=v(require("vscode")),Ke=v(require("node:os"));function xr(t){let e=t.match(/-?\d+(?:\.\d+)?/g);if(!e)return[];let n=[];for(let r of e){let s=Number(r);Number.isFinite(s)&&n.push(s)}return n}function Sr(t){let e=[],n=/([A-Za-z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?)/g,r;for(;(r=n.exec(String(t)))!==null;)e.push({label:r[1],value:Number(r[2])});return e.length>0?{labels:e.map(s=>s.label),numbers:e.map(s=>s.value)}:{labels:[],numbers:xr(t)}}var Te=class{constructor(e){this.output=e}output;panel=null;pollTimer=null;isConnected=!1;show(e,n=!0){this.panel||(this.panel=W.window.createWebviewPanel("arduinoMcp.serialPlotter","Arduino Grease: Plttr",W.ViewColumn.Beside,{enableScripts:!0}),this.panel.onDidDispose(()=>this.dispose()),this.panel.webview.onDidReceiveMessage(r=>{this.onMessage(r)})),this.panel.title="Arduino Grease: Plttr",this.panel.reveal(W.ViewColumn.Beside),this.panel.webview.html=this.html(e),this.startPolling(),this.postStatus(),n&&e&&!this.isConnected&&this.connect(e,9600)}dispose(){this.panel=null,this.pollTimer&&clearInterval(this.pollTimer),this.pollTimer=null}async connect(e,n){try{await Ae({path:e,baudRate:n})}catch(r){let s=r instanceof Error?r.message:String(r);(s.includes("Permission denied")||s.includes("EACCES")||s.includes("EPERM"))&&Ke.platform()==="linux"?W.window.showErrorMessage(`Serial: Permission denied on ${e}. On Linux, run: sudo usermod -a -G dialout $USER \u2014 then log out and back in.`,"Copy Command").then(l=>{l==="Copy Command"&&W.env.clipboard.writeText("sudo usermod -a -G dialout $USER")}):W.window.showErrorMessage(`Serial: Failed to open ${e}: ${s}`),this.output.appendLine(`Serial open failed (plotter): ${s}`);return}this.output.appendLine(`Serial connected (plotter): ${e} @ ${n}`),this.isConnected=!0,this.postStatus()}startPolling(){this.pollTimer||(this.pollTimer=setInterval(()=>{this.panel&&this.isConnected&&(async()=>{try{let e=await de(),n=[],r=[];for(let s of e.lines??[]){let o=Sr(String(s));o.numbers.length>0&&(n.push(o.numbers),r.push(o.labels))}n.length&&this.panel?.webview.postMessage({type:"points",points:n,labels:r}),this.panel?.webview.postMessage({type:"status",status:e.serial})}catch{this.panel?.webview.postMessage({type:"status",status:{isOpen:!1}})}})()},180))}postStatus(){this.panel&&this.panel.webview.postMessage({type:"status",status:{isOpen:this.isConnected}})}async onMessage(e){if(e?.type)try{if(e.type==="toggle"){let n=String(e.path||""),r=Number(e.baudRate||9600);this.isConnected?(await Me(),this.output.appendLine("Serial disconnected (plotter)"),this.isConnected=!1):await this.connect(n,r),this.postStatus()}else e.type==="clear"&&this.panel&&this.panel.webview.postMessage({type:"clear"})}catch(n){let r=n instanceof Error?n.message:String(n);this.output.appendLine(`Serial plotter error: ${r}`),W.window.showErrorMessage(`Arduino Grease Plotter: ${r}`),this.postStatus()}}html(e){let n=e?e.replaceAll('"',"&quot;"):"";return`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        --bg: #050806;
        --panel: #0d1611;
        --ink: #b5ffc8;
        --muted: #76bf8b;
        --stroke: #2d4d3a;
        --trace: #7dff9e;
      }
      body { margin: 0; padding: 12px; background: radial-gradient(circle at 20% 0%, #0c120f, #050806 65%); color: var(--ink); font-family: Consolas, Menlo, Monaco, "Courier New", monospace; font-size:11px; }
      .card { border: 1px solid var(--stroke); background: var(--panel); padding: 8px; border-radius: 8px; box-shadow: inset 0 0 20px rgba(61, 255, 117, 0.08); }
      .row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: nowrap; }
      label { font-size: 10px; color: var(--muted); }
      input, button {
        background: #07100b;
        color: var(--ink);
        border: 1px solid var(--stroke);
        border-radius: 6px;
        padding: 6px 7px;
        font-size: 11px;
        font-family: Consolas, Menlo, Monaco, "Courier New", monospace;
      }
      input { min-width: 180px; }
      #baud { min-width: 90px; }
      a { color: var(--ink); cursor: pointer; font-family: Consolas, Menlo, Monaco, "Courier New", monospace; font-size: 11px; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .status { font-size: 10px; color: var(--muted); margin-left: auto; }
      .cmdbtn{ color:#d8ffd8; cursor:pointer; position:relative; display:inline; }
      .cmdbtn::after{
        content: attr(data-tip);
        position:absolute; left:0; bottom:120%;
        background:#0a110a; color:#e5ffe5; border:1px solid #335233; border-radius:4px;
        padding:2px 4px; font-size:10px; opacity:0; pointer-events:none; transition:opacity .12s ease; white-space:nowrap;
      }
      .cmdbtn:hover::after{ opacity:1; }
      canvas { width: 100%; height: calc(100vh - 162px); border: 1px solid var(--stroke); border-radius: 8px; background: #020502; box-shadow: inset 0 0 35px rgba(0, 255, 90, 0.08); }
      #legend { display:flex; gap:10px; flex-wrap:wrap; align-items:center; padding:5px 8px; margin-top:4px; border:1px solid var(--stroke); border-radius:6px; background:var(--panel); min-height:26px; font-size:10px; }
      .leg-item { cursor:pointer; display:flex; align-items:center; gap:3px; user-select:none; }
      .leg-item:hover { text-decoration:underline; }
      .leg-bg { cursor:pointer; color:var(--muted); border:1px solid var(--stroke); padding:1px 6px; border-radius:3px; font-size:10px; margin-left:auto; }
      .leg-bg:hover { color:var(--ink); }
    </style>
  </head>
  <body>
    <div class="card" style="margin-bottom:8px">
      <div class="row">
        <div>
          <label>Port</label><br/>
          <input id="port" placeholder="${Ke.platform()==="win32"?"COM1":"/dev/cu.usbmodem..."}" value="${n}"/>
        </div>
        <div>
          <label>Baud</label><br/>
          <input id="baud" value="9600"/>
        </div>
        <a class="cmdbtn" data-tip="start/stop" id="toggle" href="#" onclick="event.preventDefault()">||S||</a>
        <a class="cmdbtn" data-tip="clear" id="clear" href="#" onclick="event.preventDefault()">||C||</a>
        <div class="status" id="status"></div>
      </div>
    </div>

    <canvas id="canvas" width="1500" height="760"></canvas>
    <div id="legend"><span class="leg-bg" onclick="toggleBg()">bg</span></div>

    <script>
      const vscode = acquireVsCodeApi();
      const $ = (id) => document.getElementById(id);
      const canvas = $("canvas");
      const ctx = canvas.getContext("2d");

      const maxPoints = 650;
      const series = [];
      let yMin = -0.2;
      let yMax = 1.2;

      const PLOT_COLORS = ["#7dff9e","#ff7d9e","#9e7dff","#ffff7d","#7dffff","#ffb47d","#ff9e7d","#7db4ff","#ff7dff","#d4ff7d"];
      let seriesColors = [...PLOT_COLORS];
      let seriesLabels = [];
      let numSeriesTotal = 0;
      let plotBgDark = true;

      function setStatus(s) {
        if (!s) return;
        const connected = !!s.isOpen;
        $("status").textContent = connected ? (" " + s.path + " @ " + s.baudRate) : "Disconnected";
        $("toggle").textContent = connected ? "||S|| \u2588running " : "||S|| \u2588stopped ";
        $("toggle").style.color = connected ? "#49c06b" : "#593b3bff";
      }

      function drawGrid(w, h) {
        ctx.strokeStyle = plotBgDark ? "rgba(62,255,120,0.12)" : "rgba(0,80,30,0.12)";
        ctx.lineWidth = 1;
        for (let x = 50; x < w - 20; x += 40) {
          ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, h - 36); ctx.stroke();
        }
        for (let y = 20; y < h - 36; y += 32) {
          ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(w - 20, y); ctx.stroke();
        }
      }

      function draw() {
        const w = canvas.width;
        const h = canvas.height;
        ctx.fillStyle = plotBgDark ? "#020502" : "#f5f5f5";
        ctx.fillRect(0, 0, w, h);
        drawGrid(w, h);

        ctx.strokeStyle = plotBgDark ? "rgba(80,255,140,0.35)" : "rgba(0,100,40,0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(50, 20);
        ctx.lineTo(50, h - 36);
        ctx.lineTo(w - 20, h - 36);
        ctx.stroke();

        if (series.length < 2) return;

        const x0 = 50, y0 = h - 36, x1 = w - 20, y1 = 20;
        const plotW = x1 - x0;
        const plotH = y0 - y1;

        ctx.shadowColor = plotBgDark ? "rgba(140,255,170,0.55)" : "rgba(0,80,30,0.4)";
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2.2;

        const numSeries = series.length > 0 ? series[series.length - 1].length : 0;
        for (let s = 0; s < numSeries; s++) {
          const col = seriesColors[s] !== undefined ? seriesColors[s] : PLOT_COLORS[s % PLOT_COLORS.length];
          ctx.strokeStyle = col;
          ctx.beginPath();
          for (let i = 0; i < series.length; i++) {
            if (s >= series[i].length) continue;
            const x = x0 + (i / (maxPoints - 1)) * plotW;
            const v = series[i][s];
            const y = y0 - ((v - yMin) / (yMax - yMin)) * plotH;
            if (i === 0 || s >= series[i-1].length) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

        ctx.fillStyle = plotBgDark ? "#8de0a0" : "#006400";
        ctx.font = "11px Consolas, Menlo, Monaco, monospace";
        ctx.fillText("min " + yMin.toFixed(2), x0, 14);
        ctx.fillText("max " + yMax.toFixed(2), x0 + 130, 14);
        const lastVals = series[series.length - 1] || [];
        ctx.fillText("last " + lastVals.map(v => v.toFixed(3)).join(", "), x0 + 260, 14);
      }

      function updateLegend() {
        const legend = $("legend");
        if (!legend) return;
        let html = '';
        for (let i = 0; i < numSeriesTotal; i++) {
          if (seriesColors[i] === undefined) seriesColors[i] = PLOT_COLORS[i % PLOT_COLORS.length];
          const col = seriesColors[i];
          const label = seriesLabels[i] || ("ch" + (i + 1));
          html += '<span class="leg-item" style="color:' + col + '" onclick="cycleSeriesColor(' + i + ')">\u2588 ' + label + '</span>';
        }
        html += '<span class="leg-bg" onclick="toggleBg()">bg</span>';
        legend.innerHTML = html;
      }

      function cycleSeriesColor(i) {
        const idx = PLOT_COLORS.indexOf(seriesColors[i]);
        seriesColors[i] = PLOT_COLORS[(idx + 1) % PLOT_COLORS.length];
        updateLegend();
        draw();
      }

      function toggleBg() {
        plotBgDark = !plotBgDark;
        canvas.style.background = plotBgDark ? "#020502" : "#f5f5f5";
        draw();
      }

      $("toggle").addEventListener("click", () => {
        vscode.postMessage({ type: "toggle", path: $("port").value, baudRate: Number($("baud").value || 9600) });
      });
      $("clear").addEventListener("click", () => vscode.postMessage({ type: "clear" }));

      window.addEventListener("message", (event) => {
        const msg = event.data;
        if (msg.type === "points") {
          const labelBatch = Array.isArray(msg.labels) ? msg.labels : [];
          let labelsUpdated = false;
          for (let pi = 0; pi < msg.points.length; pi++) {
            const p = msg.points[pi];
            series.push(p);
            if (series.length > maxPoints) series.shift();
            for (const val of p) {
              if (val > yMax) yMax = val + 0.1;
              if (val < yMin) yMin = val - 0.1;
            }
            if (p.length > numSeriesTotal) { numSeriesTotal = p.length; labelsUpdated = true; }
            const rowLabels = labelBatch[pi];
            if (rowLabels && rowLabels.length > 0) {
              for (let li = 0; li < rowLabels.length; li++) {
                if (seriesLabels[li] !== rowLabels[li]) { seriesLabels[li] = rowLabels[li]; labelsUpdated = true; }
              }
            }
          }
          if (labelsUpdated) updateLegend();
          draw();
        } else if (msg.type === "status") {
          setStatus(msg.status);
        } else if (msg.type === "clear") {
          series.length = 0;
          seriesLabels.length = 0;
          seriesColors = [...PLOT_COLORS];
          numSeriesTotal = 0;
          yMin = -0.2;
          yMax = 1.2;
          updateLegend();
          draw();
        }
      });

      draw();
    </script>
  </body>
</html>`}};var T=v(require("vscode")),Ie=v(require("node:fs")),ue=v(require("node:path"));function Be(t){let e=JSON.parse(t),n=Array.isArray(e?.platforms)?e.platforms:[],r=[];for(let s of n){let o=String(s?.id??""),l=String(s?.installed_version??""),p=(s?.releases??{})?.[l]??null,b=Array.isArray(p?.boards)?p.boards:[];for(let A of b){let M=String(A?.name??"").trim(),P=String(A?.fqbn??"").trim();!M||!P||r.push({name:M,fqbn:P,platform:o,version:l})}}return r.sort((s,o)=>s.name.localeCompare(o.name)),r}function Ye(t){let e=JSON.parse(t),r=(Array.isArray(e?.installed_libraries)?e.installed_libraries:Array.isArray(e?.libraries)?e.libraries:[]).map(s=>({name:String(s?.library?.name??s?.name??"").trim(),version:String(s?.library?.version??s?.version??"").trim()||void 0,author:String(s?.library?.author??s?.author??"").trim()||void 0,sentence:String(s?.library?.sentence??s?.sentence??"").trim()||void 0})).filter(s=>s.name.length>0);return r.sort((s,o)=>s.name.localeCompare(o.name)),r}var me=class{constructor(e,n,r){this.context=e;this.output=n;this.actions=r}context;output;actions;static viewType="arduinoMcp.toolbar";view=null;state={port:null,fqbn:null,connectedPorts:[],serverRunning:!1,serverHealthy:!1,lastScanAtMs:null,serialActive:!1};setState(e){this.state=e,this.postState()}resolveWebviewView(e){this.view=e,e.webview.options={enableScripts:!0,localResourceRoots:[T.Uri.joinPath(this.context.extensionUri,"resources")]},e.webview.html=this.html(e.webview),e.webview.onDidReceiveMessage(n=>{this.onMessage(n)}),this.postState()}postState(){this.view?.webview.postMessage({type:"state",state:this.state})}async onMessage(e){if(!e?.type)return;if(e.type==="cmd"){let r=String(e.command??"");if(!r)return;await T.commands.executeCommand(r);return}if(e.type==="list"){try{let s=await y(["lib","examples","--json"]);if(!s.success)throw new Error(s.stderr||s.stdout||"Failed to list examples");let o=ce(JSON.parse(s.stdout)),l=this.state.fqbn;if(l){let d=await y(["lib","examples","--fqbn",l,"--json"]);d.success&&(o=o.concat(ce(JSON.parse(d.stdout))))}this.view?.webview.postMessage({type:"examples",rows:Qe(o)})}catch(r){this.view?.webview.postMessage({type:"exError",error:r instanceof Error?r.message:String(r)})}return}if(e.type==="openExample"){let r=String(e.path??"").trim();if(!r)return;let s=ue.basename(r),o=ue.join(r,s+".ino"),l=null;if(Ie.existsSync(o))l=o;else try{let p=Ie.readdirSync(r).filter(b=>b.toLowerCase().endsWith(".ino"));p.length>0&&(l=ue.join(r,p[0]))}catch{}if(!l){T.window.showWarningMessage("Arduino Grease: No .ino file found in this example.");return}let d=await T.workspace.openTextDocument(T.Uri.file(l));await T.window.showTextDocument(d,{preview:!1}),await T.commands.executeCommand("workbench.action.files.setActiveEditorReadonlyInSession"),T.window.showInformationMessage("This is a read-only example. Save a copy to edit it.","Save As New Sketch").then(p=>{p==="Save As New Sketch"&&T.commands.executeCommand("workbench.action.files.saveAs")});return}let n=r=>{this.view?.webview.postMessage(r)};try{if(e.type==="updateIndexes"){this.output.appendLine("[Mngrs] Updating board and library indexes...");let r=await y(["update"]);this.output.appendLine(r.stdout),this.output.appendLine(r.stderr);let s=await y(["core","list","--json"]);if(s.success){let o=Be(s.stdout);n({type:"boards",rows:o}),this.output.appendLine(`[Mngrs] Loaded ${o.length} installed boards.`)}else n({type:"mgrError",error:"Failed. See Output > Arduino Grease."})}else if(e.type==="boardSearch"){let r=await y(["core","list","--json"]);if(!r.success){n({type:"mgrError",error:"Failed. See Output > Arduino Grease."});return}n({type:"boards",rows:Be(r.stdout),query:String(e.query??"")})}else if(e.type==="chooseTarget"){let r=String(e.fqbn??"").trim();if(!r){n({type:"mgrError",error:"Select a board first."});return}this.output.appendLine(`[Mngrs] Choosing target ${r}...`),await this.actions.chooseTarget(r)}else if(e.type==="uploadFirmwareToTarget"){let r=String(e.fqbn??"").trim();if(!r){n({type:"mgrError",error:"Select a board first."});return}this.output.appendLine(`[Mngrs] Upload firmware to target ${r}...`),await this.actions.uploadFirmwareToTarget(r)}else if(e.type==="libList"){this.output.appendLine("[Mngrs] Updating library index...");let r=await y(["lib","update-index"]);this.output.appendLine(r.stdout),this.output.appendLine(r.stderr);let s=await y(["lib","list","--json"]);if(!s.success){n({type:"mgrError",error:s.stderr||s.stdout});return}n({type:"libraries",rows:Ye(s.stdout)})}else if(e.type==="libSearch"){let r=String(e.query??"").trim(),s=await y(["lib","search",r,"--json"]);if(!s.success){n({type:"mgrError",error:s.stderr||s.stdout});return}n({type:"libraries",rows:Ye(s.stdout)})}else if(e.type==="libInstallSelected"){let r=String(e.name??"").trim();if(!r){n({type:"mgrError",error:"Select a library first."});return}this.output.appendLine(`[Mngrs] Installing library ${r}...`);let s=await y(["lib","install",r]);this.output.appendLine(s.stdout),this.output.appendLine(s.stderr),s.success?(T.window.showInformationMessage(`Arduino Grease: Library ${r} installed.`),this.actions.onLibraryInstalled&&await this.actions.onLibraryInstalled()):n({type:"mgrError",error:s.stderr||s.stdout})}else if(e.type==="toggleSerial")await T.commands.executeCommand("arduinoMcp.toggleSerial");else if(e.type==="libInstallGit"){let r=String(e.input??"").trim();if(!r)return;this.output.appendLine(`[Mngrs] Installing library from Github: ${r}...`);let s=`https://github.com/${r}.git`,o=await y(["lib","install","--git-url",s]);this.output.appendLine(o.stdout),this.output.appendLine(o.stderr),o.success?(T.window.showInformationMessage(`Arduino Grease: Library ${r} installed.`),this.actions.onLibraryInstalled&&await this.actions.onLibraryInstalled()):n({type:"mgrError",error:o.stderr||o.stdout})}else if(e.type==="boardCatalogInstall"){let r=e.entry;if(!r?.installCommand){n({type:"mgrError",error:"Invalid board entry."});return}if(this.output.appendLine(`[Mngrs] Installing board platform: ${r.name}...`),r.url){let o=await y(["config","add","board_manager.additional_urls",r.url]);this.output.appendLine(o.stdout),this.output.appendLine(o.stderr),await y(["update"])}let s=await y(["core","install",r.installCommand]);if(this.output.appendLine(s.stdout),this.output.appendLine(s.stderr),!s.success)n({type:"mgrError",error:s.stderr||s.stdout});else{T.window.showInformationMessage(`Arduino Grease: ${r.name} installed.`);let o=await y(["core","list","--json"]);o.success&&n({type:"boards",rows:Be(o.stdout)})}}else if(e.type==="serialOff")await this.actions.serialOff();else if(e.type==="cycleAccent"){let r=String(e.color??"#007ACC");await this.actions.cycleAccent(r)}}catch(r){let s=r instanceof Error?r.message:String(r);this.output.appendLine(`[Mngrs] Error: ${s}`),n({type:"mgrError",error:s})}}html(e){return`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --muted: #4a9960; --ink: #c8ffd8; --bg: #080e0a; --panel: #0b120d; --stroke: #1a3322; --mono: Consolas, Menlo, Monaco, 'Courier New', monospace; }
  body { background: var(--bg); color: var(--ink); font-family: var(--mono); font-size: 11px; height: 100vh; overflow: hidden; }
  .panel-area { width: 100%; min-height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; position: relative; }
  canvas.rain { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; }
  .panel-content { position: relative; z-index: 1; padding: 10px 10px 4px; overflow-y: auto; height: 100%; }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }
  a { font-family: var(--mono); font-size: 11px; text-decoration: none; cursor: pointer; background: none; border: none; padding: 0; margin: 0; display: inline; }
  a:hover { text-decoration: underline; }
  a.dim { color: var(--muted); } a.dim:hover { color: var(--ink); }
  a.c-green { color: #55efc4; } a.c-amber { color: #f6c542; } a.c-teal { color: #4ecdc4; }
  a.c-sky { color: #81ecec; } a.c-purple { color: #a29bfe; } a.c-blue { color: #74b9ff; }
  a.c-coral { color: #ff6b6b; } a.c-pink { color: #fd79a8; } a.c-std { color: var(--ink); }
  a.serial-on { color: #49c06b !important; text-decoration: underline !important; }
  .ascii-line { font-family: var(--mono); font-size: 11px; color: var(--ink); white-space: pre; line-height: 1.6; display: block; }
  .dim { color: var(--muted); }
  .actions-wrap { margin-top: 6px; }
  .act-row { padding: 1px 0 1px 2px; font-family: var(--mono); font-size: 10px; line-height: 1.8; white-space: pre; }
  .server-section { margin-top: 12px; font-family: var(--mono); font-size: 11px; color: var(--ink); }
  .server-line { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
  .sblock { font-size: 16px; line-height: 1; cursor: pointer; }
  .logo-area { margin-top: 12px; }
  .logo-img { display: block; width: 132px; opacity: 0.06; filter: brightness(2) saturate(0.3); }
  .logo-caption { font-family: var(--mono); font-size: 10px; color: #5bc8f5; margin-top: 3px; letter-spacing: 0.04em; }
  .logo-ascii { font-family: var(--mono); font-size: 9px; color: var(--muted); white-space: pre; line-height: 1.4; margin-top: 6px; opacity: 0.55; }

  .mgr-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; }
  .mgr-label { color: var(--muted); font-size: 10px; }
  .mgr-section { margin-bottom: 10px; }
  .mgr-section-title { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .mgr-card { border: 1px solid var(--stroke); background: var(--panel); border-radius: 6px; padding: 8px; }
  .mgr-card input { background: #050d07; color: var(--ink); border: 1px solid var(--stroke); border-radius: 4px; padding: 4px 6px; font-size: 11px; font-family: var(--mono); width: 100%; margin-bottom: 6px; }
  .mgr-card input:focus { outline: none; border-color: var(--muted); }
  .mgr-top-row { margin-bottom: 7px; font-family: var(--mono); font-size: 10px; display: flex; gap: 14px; flex-wrap: wrap; }
  .mgr-list { max-height: 160px; overflow-y: auto; }
  .mgr-item { padding: 5px 6px; border: 1px solid var(--stroke); border-radius: 4px; margin-bottom: 3px; cursor: pointer; font-size: 10px; background: #050d07; }
  .mgr-item:hover { border-color: #58aa58; }
  .mgr-item .name { color: var(--ink); font-weight: bold; }
  .mgr-item .meta { color: var(--muted); }
</style>
</head>
<body>
<div class="panel-area" id="panelArea">
    <canvas class="rain" id="rainCanvas"></canvas>
    <div class="panel-content">

      <div class="tab-panel active" id="panel-board">
        <span class="ascii-line"><span class="dim">+------------ -  -   +</span></span>
        <span class="ascii-line"><span class="dim">| Port:     </span><a class="dim" href="#" onclick="cmd('arduinoMcp.refreshPortsBoards');return false">||R||</a></span>
        <span class="ascii-line"><span class="dim">| </span><span id="portVal">?</span></span>
        <span class="ascii-line"><span class="dim">| Board:</span></span>
        <span class="ascii-line"><span class="dim">| </span><span id="fqbnVal">?</span></span>
        <span class="ascii-line"><span class="dim">+   -   -  - --------+</span></span>
        <div class="actions-wrap">
          <div class="act-row"><span class="dim">+-------------- -  -   +</span></div>
          <div class="act-row"> <a class="c-teal"  href="#" onclick="cmd('arduinoMcp.startSketch');return false">||Start Sketch||</a></div>
          <div class="act-row"> <a class="c-coral"  href="#" onclick="onUploadClick();return false">||Upload||</a></div>
          <div class="act-row"> <a class="c-teal"   href="#" onclick="cmd('arduinoMcp.verify');return false">||Verify||</a></div>
          <div class="act-row"> <a id="serialBtn" class="c-blue" href="#" onclick="toggleSerial();return false">||Serial||</a></div>
          <div class="act-row"> <a class="c-teal" href="#" onclick="cmd('arduinoMcp.openSerialPlotter');return false">||Plotter||</a></div>
          <div class="act-row"> <a class="c-blue"   href="#" onclick="switchTab('examples');return false">||Examples||</a></div>
          <div class="act-row"> <a class="c-teal"  href="#" onclick="switchTab('managers');return false">||Managers||</a></div>
          <div class="act-row"> <a class="c-purple"   href="#" onclick="switchTab('prompt');return false">||AI Prompt||</a></div>
          <div class="act-row"><span class="dim">+   -   -  - ----------+</span></div>
        </div>
        <div class="server-section">
          AI Tether <a class="dim" href="#" onclick="cmd('arduinoMcp.refreshServer');return false">||R||</a>
          <div class="server-line">
            <span class="sblock serverBlock" style="color:#49c06b" onclick="cmd('arduinoMcp.toggleServer')">&#x2588;</span>
            <span style="color:var(--muted);font-size:10px" class="serverStatus">running</span>
          </div>
          <div class="server-line" style="margin-top:6px">
            <span class="sblock" id="accentBlock" style="color:#007ACC;cursor:pointer;font-size:16px;line-height:1" onclick="cycleAccent()" title="Click to cycle accent color">&#x2588;</span>
          </div>
        </div>
        <div class="logo-area">
          <img class="logo-img" id="logoImg" src="${e.asWebviewUri(T.Uri.joinPath(this.context.extensionUri,"resources","icon.png"))}" draggable="false" />
        </div>
      </div>

      <div class="tab-panel" id="panel-managers">
        <div class="mgr-header">
          <span class="mgr-label"><a class="c-coral" href="#" onclick="switchTab('board');return false" style="margin-right:4px">||R||</a>Mngrs</span>
          <a class="c-std" id="updateIdx" href="#" onclick="event.preventDefault()">||Update indexes||</a>
        </div>
        <div class="mgr-section">
          <div class="mgr-section-title">Board</div>
          <div class="mgr-card">
            <div class="mgr-top-row">
              <a class="c-std" id="chooseTargetBtn" href="#" onclick="event.preventDefault()">||Choose as target||</a>
            </div>
            <input id="boardQuery" class="boardQuery" placeholder="arduino, esp32, rp2040..." />
            <div class="mgr-list" id="boardsList"></div>
            <a class="c-amber" id="installBoardBtn" href="#" onclick="event.preventDefault()" style="font-size:10px;margin-top:6px;display:block">||Install new board||</a>
          </div>
        </div>
        <div class="mgr-section">
          <div class="mgr-section-title">Library</div>
          <div class="mgr-card">
            <div class="mgr-top-row">
              <a class="c-std" id="libListBtn" href="#" onclick="event.preventDefault()">||List installed||</a>
              <a class="c-green" id="libInstallBtn" href="#" onclick="event.preventDefault()">||Install library||</a>
            </div>
            <input id="libQuery" class="libQuery" placeholder="wire, servo, wifi..." />
            <div class="mgr-list" id="libsList"></div>
          </div>
        </div>
        <div class="mgr-card" style="margin-top: 9px;">
          <div class="muted" style="font-size: 10px; margin-bottom: 4px;">
            Install library from Github (e.g. arduino-libraries/WiFi101)
          </div>
          <input id="libGitInput" placeholder="user/repo" onkeydown="if(event.key==='Enter') { vscode.postMessage({type:'libInstallGit', input:this.value}); this.value=''; }" />
        </div>
      </div>

      <div class="tab-panel" id="panel-examples">
        <div class="mgr-header">
          <span class="mgr-label"><a class="c-coral" href="#" onclick="switchTab('board');return false" style="margin-right:4px">||R||</a>X-mpls</span>
          <a class="c-std" href="#" onclick="vscode.postMessage({type:'list',library:''});return false">&#8635;</a>
        </div>
        <div class="mgr-card" style="margin-bottom:6px">
          <div style="display:flex;align-items:flex-end;gap:6px;flex-wrap:wrap">
            <div style="flex:1;min-width:70px">
              <div class="muted" style="font-size:9px;margin-bottom:2px">Search Text</div>
              <input id="exQuery" placeholder="blink, imu, wifi" oninput="renderEx()" onkeydown="if(event.key==='Enter')renderEx()" />
            </div>
            <div style="flex:1;min-width:70px">
              <div class="muted" style="font-size:9px;margin-bottom:2px">Library name</div>
              <input id="exLibrary" placeholder="wire, servo" oninput="renderEx()" onkeydown="if(event.key==='Enter')renderEx()" />
            </div>
          </div>
        </div>
        <div id="exError" style="color:#ffb4b4;white-space:pre-wrap;font-size:10px;margin-bottom:4px"></div>
        <div id="exCount" class="muted" style="font-size:9px;margin-bottom:4px">loading...</div>
        <div id="exOut" class="mgr-list" style="max-height:416px"></div>
      </div>

      <div class="tab-panel" id="panel-prompt">
        <div class="mgr-header">
          <span class="mgr-label"><a class="c-coral" href="#" onclick="switchTab('board');return false" style="margin-right:4px">||R||</a>AI Prompt Template</span>
        </div>
        <div class="mgr-section">
          <div class="mgr-card" style="padding: 10px; font-size: 10px; line-height: 1.4; color: var(--muted);">
            <p>Please stretch your panel and read this! Important! </p>
            <br>
            <p> Your AI Agent needs greasing and structure!</p>
            <p style="margin-top: 8px;">If your AI Tether is active and "arduino-cli" is on PATH, its time to make sure your AI Agent "knows" it can use it. Try the following as a Prompt: </p>
            <br>
            <div style="margin-top: 8px; color: var(--ink); border-left: 2px solid var(--muted); padding-left: 8px;">
              Use &lt;IDE-Extension&gt; Arduino Grease &lt;/IDE-Extension&gt; to filter incoming A0 signals: read them via its MCP server, generate a new sketch, upload it. Check dist/SKILL.md and dist/server.mjs inside the extension folder for REST endpoints and skills. GET /state returns the current board/port. Auth key lives in ~/.grease/mcp-auth.json \u2014 send it as the x-grease-auth header.
            </div>
            <br>
            <p> When running your sketches, try to use the following XML tags to emphasize goals, electronic hardware, mechanical components or control preferences. One example below:</p>
            <div style="margin-top: 8px; color: var(--ink); border-left: 2px solid var(--muted); padding-left: 8px;">
              Write a program to &lt;goal&gt; stack 5 cups &lt;/goal&gt;. I am using &lt;hw&gt; 2 servo motors and one 3-pin temperature sensor. My orange wire is on pin 13&lt;/hw&gt;.
              <br><br>
              My robot has &lt;mech&gt; a 2 inch wheel &lt;/mech&gt; and is using &lt;control&gt; a PD controller &lt;/control&gt;
            </div>
            <p style="margin-top: 8px;">
              You can also create your own skills (for example, a skill &lt;learning&gt; could specify a preferred deep Q-learning strategy, or &lt;references&gt; could aggregate datasheets from different modules).
            </p>
            <br>
            <p>
              Make sure your AI Tether is running, and that you clearly prompt the logic flow needed to achieve your goal.
            </p>
          </div>
        </div>
        <div class="server-section" style="margin-top: 8px;">
          AI Tether <a class="dim" href="#" onclick="cmd('arduinoMcp.refreshServer');return false">||R||</a>
          <div class="server-line">
            <span class="sblock serverBlock" style="color:#49c06b" onclick="cmd('arduinoMcp.toggleServer')">&#x2588;</span>
            <span style="color:var(--muted);font-size:10px" class="serverStatus">running</span>
          </div>
        </div>
      </div>

    </div>
</div>

<script>
const vscode = acquireVsCodeApi();

function cmd(command) { vscode.postMessage({ type: 'cmd', command: command }); }

function switchTab(panel) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panelEl = document.getElementById('panel-' + panel);
  if (panelEl) panelEl.classList.add('active');
  rainActive = (panel === 'board' || panel === 'managers' || panel === 'examples' || panel === 'prompt');
  if (panel === 'managers') { vscode.postMessage({type:'serialOff'}); vscode.postMessage({type:'updateIndexes'}); vscode.postMessage({type:'libList'}); }
  if (panel === 'examples') { vscode.postMessage({type:'serialOff'}); vscode.postMessage({type:'list',library:''}); }
}

const ACCENT_COLORS = ['#005FA0','#6B0000','#A34300','#8F6809','#6B004A','#520A85','#004D00'];
let accentIndex = 0;
function cycleAccent() {
  accentIndex = (accentIndex + 1) % ACCENT_COLORS.length;
  const color = ACCENT_COLORS[accentIndex];
  const block = document.getElementById('accentBlock');
  if (block) block.style.color = color;
  vscode.postMessage({ type: 'cycleAccent', color: color });
}

const rainCanvas = document.getElementById('rainCanvas');
const rctx = rainCanvas.getContext('2d');
const panelArea = document.getElementById('panelArea');
const CHARS = 'abcdefghijklmnopqrstuvwxyzNH01+=-./\\\\[]{}()?!<>:;'.split('');
const COL = 13;
let drops=[], W=0, H=0, mouseX=-999, mouseY=-999, rainActive=true;
let thrustOpacityBoost = 0, thrustSpeedMult = 1.0;

function resizeRain(){
  const r=panelArea.getBoundingClientRect();W=r.width||300;H=r.height||660;rainCanvas.width=W;rainCanvas.height=H;
  const cols=Math.floor(W/COL);
  if(drops.length!==cols)drops=Array.from({length:cols},()=>({y:H*Math.random(), o:0, blue:false, halted:false}));
}
panelArea.addEventListener('mousemove',e=>{const r=rainCanvas.getBoundingClientRect();mouseX=e.clientX-r.left;mouseY=e.clientY-r.top;});
panelArea.addEventListener('mouseleave',()=>{mouseX=-999;mouseY=-999;});
let rainState='idle',extraDrops=[],thrustRightTimer=null,errorTimer=null;

function setRainState(s){
  rainState=s;
  if(s==='thrust'){
    thrustOpacityBoost = 0.7;
  }
  if(s!=='thrust'){
    extraDrops=[];
    thrustOpacityBoost = 0;
    thrustSpeedMult = 1.0;
    drops.forEach(d => { d.o = 0; d.blue = false; d.halted = false; });
  }
  if(errorTimer){clearTimeout(errorTimer);errorTimer=null;}
  if(s==='error'){errorTimer=setTimeout(()=>{errorTimer=null;setRainState('idle');},5000);}
}

function drawRain(){
  if(!rainActive){rctx.clearRect(0,0,W,H);return;}
  rctx.fillStyle='rgba(8,14,10,0.28)';rctx.fillRect(0,0,W,H);
  const st=rainState;
  const bRGB=st==='error'?'210,30,30':'0,210,80';
  const hRGB=st==='error'?'255,100,100':'140,255,170';

  function drop(d,x){
    const dx=x-mouseX,dy=d.y-mouseY,dist=Math.sqrt(dx*dx+dy*dy);
    const inSlow = dist < 60;
    const inHalt = dist < 15;

    if(inHalt && !d.halted){
      d.halted = true;
      d.o = (d.o || 0) + 0.1;
      d.blue = true;
    } else if(!inHalt) {
      d.halted = false;
    }

    let bo,ho,fz,sp;
    if(st==='error'){bo=0.30;ho=0.30;fz=13;sp=0;}
    else if(st==='bright'){bo=Math.min(1,(inSlow?0.40:0.03)+0.12);ho=Math.min(1,(inSlow?0.80:0.10)+0.50);fz=13;sp=inSlow?(3+(60-dist)*0.08):(1.2+Math.random()*0.6);}
    else if(st==='thrust'){
      if(d.rocket){
        bo=0.7; ho=0.7; fz=14; sp=35;
      } else {
        bo=0.7;
        ho=0.7;
        fz=inSlow?13:12;
        const normalSp = 7.5 * thrustSpeedMult;
        sp = inHalt ? 0 : (inSlow ? (1.2 + Math.random() * 0.6) : normalSp);
      }
    }
    else{bo=Math.min(1,(inSlow?0.40:0.03)+d.o); ho=Math.min(1,(inSlow?0.80:0.10)+d.o); fz=inSlow?13:12; sp=inSlow?(3+(60-dist)*0.08):(1.2+Math.random()*0.6);}

    if(d.y < -20) d.rocket = false;
    const finalBRGB = d.blue ? '0,100,210' : bRGB;
    const finalHRGB = d.blue ? '80,160,255' : hRGB;

    rctx.font=fz+'px Consolas,monospace';
    rctx.fillStyle='rgba('+finalBRGB+','+Math.min(1,bo)+')';rctx.fillText(CHARS[Math.floor(Math.random()*CHARS.length)],x,d.y);
    rctx.fillStyle='rgba('+finalHRGB+','+Math.min(1,ho)+')';rctx.fillText(CHARS[Math.floor(Math.random()*CHARS.length)],x,d.y-13);
    return sp;
  }

  for(let i=0;i<drops.length;i++){
    const sp=drop(drops[i], i*COL+4);
    drops[i].y-=sp;
    if(drops[i].y<-26)drops[i].y=H+Math.floor(Math.random()*80);
    if(st==='thrust'){
      drop({y:drops[i].y+H/3, o:drops[i].o, blue:drops[i].blue, halted:drops[i].halted}, i*COL+4+3);
      drop({y:drops[i].y+2*H/3, o:drops[i].o, blue:drops[i].blue, halted:drops[i].halted}, i*COL+4-3);
    }
  }
  if(st==='thrust'){for(let i=0;i<extraDrops.length;i++){const d=extraDrops[i];const sp=drop(d, d.x);d.y-=sp;if(d.y<-26)d.y=H+Math.floor(Math.random()*80);}}
}
resizeRain();new ResizeObserver(resizeRain).observe(panelArea);setInterval(drawRain,50);
document.addEventListener('mousedown',e=>{
  if(rainState === 'idle' && e.target.closest('a')) setRainState('bright');
  if(rainState === 'thrust' && e.button === 0){
    const r=rainCanvas.getBoundingClientRect();
    const cx=e.clientX-r.left, cy=e.clientY-r.top;
    for(let i=0;i<drops.length;i++){
      const dx=(i*COL+4)-cx, dy=drops[i].y-cy;
      if(Math.sqrt(dx*dx+dy*dy)<25) drops[i].rocket=true;
    }
    for(let i=0;i<extraDrops.length;i++){
      const dx=extraDrops[i].x-cx, dy=extraDrops[i].y-cy;
      if(Math.sqrt(dx*dx+dy*dy)<25) extraDrops[i].rocket=true;
    }
    thrustRightTimer = setInterval(()=>{
      if(extraDrops.length < drops.length * 8) {
        for(let i=0; i<drops.length; i++) extraDrops.push({x:Math.random()*W, y:Math.random()*H, o:0, blue:false, halted:false});
      }
    }, 500);
  }
});
document.addEventListener('mouseup',e=>{
  if(rainState==='bright')setRainState('idle');
  if(e.button===0&&thrustRightTimer){clearInterval(thrustRightTimer);thrustRightTimer=null;}
});
document.addEventListener('contextmenu',e=>{if(rainState==='thrust')e.preventDefault();});


function toggleSerial() { vscode.postMessage({ type: 'toggleSerial' }); }
function setServer(state) {
  const blocks = document.querySelectorAll('.serverBlock');
  const statuses = document.querySelectorAll('.serverStatus');
  blocks.forEach(block => {
    if (!state.serverRunning) block.style.color='#593b3bff';
    else if (state.serverHealthy) block.style.color='#49c06b';
    else block.style.color='#d2b046';
  });
  statuses.forEach(status => {
    if (!state.serverRunning) status.textContent='stopped';
    else if (state.serverHealthy) status.textContent='running';
    else status.textContent='starting...';
  });
}

let exRows = [];
function renderEx() {
  const q = (document.getElementById('exQuery')?.value || '').trim().toLowerCase();
  const lib = (document.getElementById('exLibrary')?.value || '').trim().toLowerCase();
  const filtered = exRows.filter(r => {
    const full = (r.library + ' ' + r.example + ' ' + r.fullPath).toLowerCase();
    return (!lib || r.library.toLowerCase().includes(lib)) && (!q || full.includes(q));
  });
  const countEl = document.getElementById('exCount');
  const outEl = document.getElementById('exOut');
  if (countEl) countEl.textContent = filtered.length + ' example sketches';
  if (!outEl) return;
  if (!filtered.length) { outEl.innerHTML = '<div class="muted" style="font-size:10px">No examples found.</div>'; return; }
  outEl.innerHTML = filtered.map(r =>
    '<div class="mgr-item" style="cursor:pointer" data-path="' + esc(r.fullPath) + '">' +
    '<div class="name">' + esc(r.example) + '</div>' +
    '<div class="meta">' + esc(r.library) + '</div></div>'
  ).join('');
  outEl.querySelectorAll('.mgr-item').forEach(el => {
    el.addEventListener('click', () => vscode.postMessage({type:'openExample', path: el.getAttribute('data-path') || ''}));
  });
}

window.addEventListener('message', event => {
  const msg = event.data;
  if (msg.type === 'state') {
    const s = msg.state || {};
    document.getElementById('portVal').textContent = s.port || '?';
    const fqbnVal = s.fqbn || '?';
    document.getElementById('fqbnVal').textContent = fqbnVal;
    if (fqbnVal === '?') {
      document.getElementById('fqbnVal').innerHTML += '<br><span style="font-size:8px;color:#ffb4b4;line-height:1.2">Unknown board. Access ||Managers||.</span>';
    }
    setServer(s);
    const sBtn = document.getElementById('serialBtn');
    if (sBtn) {
      if (s.serialActive) sBtn.classList.add('serial-on');
      else sBtn.classList.remove('serial-on');
    }
    if (s.accentColor) {
      const block = document.getElementById('accentBlock');
      if (block) block.style.color = s.accentColor;
      const idx = ACCENT_COLORS.indexOf(s.accentColor);
      if (idx !== -1) accentIndex = idx;
    }
  } else if (msg.type === 'accentColor') {
    const block = document.getElementById('accentBlock');
    if (block) block.style.color = msg.color;
    const idx = ACCENT_COLORS.indexOf(msg.color);
    if (idx !== -1) accentIndex = idx;
  } else if (msg.type === 'verifyResult') {
    if(msg.success && rainState === 'thrust') {
      thrustOpacityBoost += 0.1;
      thrustSpeedMult *= 3;
    }
  } else if (msg.type === 'examples') {
    exRows = Array.isArray(msg.rows) ? msg.rows : [];
    const errEl = document.getElementById('exError');
    if (errEl) errEl.textContent = '';
    renderEx();
  } else if (msg.type === 'exError') {
    const errEl = document.getElementById('exError');
    if (errEl) errEl.textContent = msg.error || 'Unknown error';
  } else if (msg.type === 'uploadResult') {
    setRainState(msg.success ? 'idle' : 'error');
  } else if (msg.type === 'rainState') {
    setRainState(msg.state);
  } else if (msg.type === 'boards') {
    boards = Array.isArray(msg.rows) ? msg.rows : [];
    if (!selectedFqbn && boards.length) selectedFqbn = boards[0].fqbn;
    if (typeof msg.query === "string") boardQuery = msg.query;
    boardMode = 'installed';
    selectedCatalogId = null;
    const iBtn = document.getElementById('installBoardBtn');
    if (iBtn) iBtn.textContent = '||Install new board||';
    renderBoards();
  } else if (msg.type === 'libraries') {
    libs = Array.isArray(msg.rows) ? msg.rows : [];
    if (!selectedLib && libs.length) selectedLib = libs[0].name;
    renderLibs();
  } else if (msg.type === 'mgrError') {
    const el = document.getElementById('mgrErr');
    if (el) el.textContent = msg.error || '';
  }
});

let boards = [];
let libs = [];
let selectedFqbn = "";
let selectedLib = "";
let boardQuery = "";
let boardMode = 'installed';
let selectedCatalogId = null;
const BOARD_CATALOG = [
  {id:"esp8266:esp8266",name:"ESP8266 Boards",vendor:"ESP8266 Community",tags:["wifi","iot","nodemcu","wemos","esp8266"],url:"https://arduino.esp8266.com/stable/package_esp8266com_index.json",installCommand:"esp8266:esp8266",exampleBoards:["NodeMCU 1.0","Wemos D1 Mini","Generic ESP8266"]},
  {id:"esp32:esp32",name:"ESP32 Boards (Espressif)",vendor:"Espressif",tags:["wifi","bluetooth","iot","esp32","s2","s3","c3"],url:"https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json",installCommand:"esp32:esp32",exampleBoards:["ESP32 Dev Module","ESP32-S3","ESP32-C3","XIAO ESP32S3"]},
  {id:"rp2040:rp2040",name:"Raspberry Pi Pico / RP2040",vendor:"Earle Philhower",tags:["rp2040","pico","raspberry pi","arm"],url:"https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json",installCommand:"rp2040:rp2040",exampleBoards:["Raspberry Pi Pico","Raspberry Pi Pico W","Adafruit Feather RP2040"]},
  {id:"arduino:mbed_rp2040",name:"Raspberry Pi Pico (Arduino Official)",vendor:"Arduino",tags:["rp2040","pico","mbed","arm"],url:null,installCommand:"arduino:mbed_rp2040",exampleBoards:["Raspberry Pi Pico"]},
  {id:"adafruit:avr",name:"Adafruit AVR Boards",vendor:"Adafruit",tags:["adafruit","avr","flora","gemma","trinket","wearable"],url:"https://adafruit.github.io/arduino-board-index/package_adafruit_index.json",installCommand:"adafruit:avr",exampleBoards:["Adafruit Flora","Adafruit Gemma","Adafruit Trinket"]},
  {id:"adafruit:samd",name:"Adafruit SAMD Boards",vendor:"Adafruit",tags:["adafruit","samd","feather","m0","m4","circuit playground"],url:"https://adafruit.github.io/arduino-board-index/package_adafruit_index.json",installCommand:"adafruit:samd",exampleBoards:["Feather M0","Feather M4 Express","ItsyBitsy M4"]},
  {id:"adafruit:nrf52",name:"Adafruit nRF52 Boards",vendor:"Adafruit",tags:["adafruit","nrf52","bluetooth","ble","nordic"],url:"https://adafruit.github.io/arduino-board-index/package_adafruit_index.json",installCommand:"adafruit:nrf52",exampleBoards:["Feather nRF52840 Express"]},
  {id:"SparkFun:avr",name:"SparkFun AVR Boards",vendor:"SparkFun",tags:["sparkfun","avr","redboard","pro micro","lilypad"],url:"https://raw.githubusercontent.com/sparkfun/Arduino_Boards/master/IDE_Board_Manager/package_sparkfun_index.json",installCommand:"SparkFun:avr",exampleBoards:["SparkFun RedBoard","SparkFun Pro Micro"]},
  {id:"SparkFun:samd",name:"SparkFun SAMD Boards",vendor:"SparkFun",tags:["sparkfun","samd","samd21","thing plus"],url:"https://raw.githubusercontent.com/sparkfun/Arduino_Boards/master/IDE_Board_Manager/package_sparkfun_index.json",installCommand:"SparkFun:samd",exampleBoards:["SparkFun SAMD21 Mini","SparkFun Thing Plus"]},
  {id:"STMicroelectronics:stm32",name:"STM32 Boards",vendor:"STMicroelectronics",tags:["stm32","nucleo","blue pill","arm","cortex-m"],url:"https://raw.githubusercontent.com/stm32duino/BoardManagerFiles/main/package_stmicroelectronics_index.json",installCommand:"STMicroelectronics:stm32",exampleBoards:["Nucleo-64","Generic STM32F1","Blue Pill"]},
  {id:"ATTinyCore:avr",name:"ATtiny Boards",vendor:"Community",tags:["attiny","attiny85","attiny84","avr","bare chip"],url:"https://raw.githubusercontent.com/damellis/attiny/ide-1.6.x-boards-manager/package_damellis_attiny_index.json",installCommand:"ATTinyCore:avr",exampleBoards:["ATtiny85","ATtiny84","ATtiny45"]},
  {id:"MiniCore:avr",name:"MiniCore (MCUdude)",vendor:"MCUdude",tags:["avr","atmega328","atmega168","bare chip"],url:"https://mcudude.github.io/MiniCore/package_MCUdude_MiniCore_index.json",installCommand:"MiniCore:avr",exampleBoards:["ATmega328","ATmega168","ATmega88"]},
  {id:"MegaCore:avr",name:"MegaCore (MCUdude)",vendor:"MCUdude",tags:["avr","atmega2560","mega","bare chip"],url:"https://mcudude.github.io/MegaCore/package_MCUdude_MegaCore_index.json",installCommand:"MegaCore:avr",exampleBoards:["ATmega2560","ATmega1280"]},
  {id:"MightyCore:avr",name:"MightyCore (MCUdude)",vendor:"MCUdude",tags:["avr","atmega1284","atmega644","bare chip"],url:"https://mcudude.github.io/MightyCore/package_MCUdude_MightyCore_index.json",installCommand:"MightyCore:avr",exampleBoards:["ATmega1284","ATmega644"]},
  {id:"Seeeduino:samd",name:"Seeed SAMD Boards",vendor:"Seeed Studio",tags:["seeed","xiao","wio terminal","samd"],url:"https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json",installCommand:"Seeeduino:samd",exampleBoards:["Seeeduino XIAO","Wio Terminal"]},
  {id:"Seeeduino:avr",name:"Seeed AVR Boards",vendor:"Seeed Studio",tags:["seeed","seeeduino","avr"],url:"https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json",installCommand:"Seeeduino:avr",exampleBoards:["Seeeduino v4.2","Seeeduino Lotus"]},
  {id:"SparkFun:apollo3",name:"SparkFun Apollo3 Boards",vendor:"SparkFun",tags:["sparkfun","artemis","apollo3","arm","ble"],url:"https://raw.githubusercontent.com/sparkfun/Arduino_Apollo3/master/package_sparkfun_apollo3_index.json",installCommand:"SparkFun:apollo3",exampleBoards:["SparkFun Artemis Thing Plus","RedBoard Artemis Nano"]}
];

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}

function renderBoards() {
  if (boardMode === 'catalog') { renderCatalogBoards(); return; }
  const filtered = boards.filter((b) => {
    const q = boardQuery.toLowerCase();
    if (!q) return true;
    return (b.name + " " + b.fqbn + " " + b.platform).toLowerCase().includes(q);
  });
  if (!filtered.length) {
    document.getElementById('boardsList').innerHTML = "<div class='muted' style='font-size:10px'>No installed boards found.</div>";
    return;
  }
  document.getElementById('boardsList').innerHTML = filtered.map((b) => {
    const border = selectedFqbn === b.fqbn ? "border-color: #58aa58; box-shadow: 0 0 0 1px #58aa58 inset;" : "";
    return "<div class='mgr-item' style='" + border + "' data-fqbn='" + esc(b.fqbn) + "'><div class='name'>" + esc(b.name) + "</div><div class='meta'>" + esc(b.fqbn) + " | " + esc(b.platform) + " @ " + esc(b.version) + "</div></div>";
  }).join("");
  document.querySelectorAll("#boardsList .mgr-item").forEach((el) => {
    el.addEventListener("click", () => {
      selectedFqbn = el.getAttribute("data-fqbn") || "";
      renderBoards();
    });
  });
}

function renderCatalogBoards() {
  const q = boardQuery.toLowerCase();
  const filtered = q ? BOARD_CATALOG.filter(b =>
    (b.name + ' ' + b.vendor + ' ' + b.tags.join(' ')).toLowerCase().includes(q)
  ) : BOARD_CATALOG;
  if (!filtered.length) {
    document.getElementById('boardsList').innerHTML = "<div class='muted' style='font-size:10px'>No matching boards.</div>";
    return;
  }
  document.getElementById('boardsList').innerHTML = filtered.map((b) => {
    const border = selectedCatalogId === b.id ? "border-color: #f6c542; box-shadow: 0 0 0 1px #f6c542 inset;" : "";
    return "<div class='mgr-item' style='" + border + "' data-catalog-id='" + esc(b.id) + "'><div class='name'>" + esc(b.name) + "</div><div class='meta'>" + esc(b.vendor) + " | " + esc(b.exampleBoards.slice(0,3).join(', ')) + "</div></div>";
  }).join("");
  document.querySelectorAll("#boardsList [data-catalog-id]").forEach((el) => {
    el.addEventListener("click", () => {
      selectedCatalogId = el.getAttribute("data-catalog-id") || "";
      renderCatalogBoards();
    });
    el.addEventListener("dblclick", () => {
      selectedCatalogId = el.getAttribute("data-catalog-id") || "";
      installSelectedCatalogBoard();
    });
  });
}

function installSelectedCatalogBoard() {
  if (!selectedCatalogId) return;
  const entry = BOARD_CATALOG.find(b => b.id === selectedCatalogId);
  if (!entry) return;
  const btn = document.getElementById('installBoardBtn');
  if (btn) btn.textContent = '||Installing...||';
  vscode.postMessage({ type: 'boardCatalogInstall', entry: { id: entry.id, name: entry.name, installCommand: entry.installCommand, url: entry.url } });
}

function renderLibs() {
  if (!libs.length) {
    document.getElementById('libsList').innerHTML = "<div class='muted' style='font-size:10px'>No libraries loaded.</div>";
    return;
  }
  document.getElementById('libsList').innerHTML = libs.map((l) => {
    const right = l.version || l.author || l.sentence || "";
    const border = selectedLib === l.name ? "border-color: #58aa58; box-shadow: 0 0 0 1px #58aa58 inset;" : "";
    return "<div class='mgr-item' style='" + border + "' data-lib='" + esc(l.name) + "'><div class='name'>" + esc(l.name) + "</div><div class='meta'>" + esc(right) + "</div></div>";
  }).join("");

  document.querySelectorAll("#libsList .mgr-item").forEach((el) => {
    el.addEventListener("click", () => {
      selectedLib = el.getAttribute("data-lib") || "";
      renderLibs();
    });
  });
}

const $ = (id) => document.getElementById(id);
$("updateIdx")?.addEventListener("click", () => {
  boardMode = 'installed';
  selectedCatalogId = null;
  const btn = $("installBoardBtn");
  if (btn) btn.textContent = '||Install new board||';
  vscode.postMessage({ type: "updateIndexes" });
});
$("boardQuery")?.addEventListener("keydown", (e) => {
  if(e.key === 'Enter') {
    boardQuery = $("boardQuery").value || "";
    if (boardMode === 'catalog') { renderCatalogBoards(); }
    else { vscode.postMessage({ type: "boardSearch", query: boardQuery }); }
  }
});
$("boardQuery")?.addEventListener("input", () => {
  if (boardMode === 'catalog') { boardQuery = $("boardQuery").value || ""; renderCatalogBoards(); }
});
$("installBoardBtn")?.addEventListener("click", () => {
  if (boardMode === 'installed') {
    boardMode = 'catalog';
    selectedCatalogId = null;
    boardQuery = $("boardQuery")?.value || "";
    const btn = $("installBoardBtn");
    if (btn) btn.textContent = '||Confirm install||';
    renderCatalogBoards();
  } else {
    installSelectedCatalogBoard();
  }
});
$("chooseTargetBtn")?.addEventListener("click", () => vscode.postMessage({ type: "chooseTarget", fqbn: selectedFqbn }));
$("libListBtn")?.addEventListener("click", () => vscode.postMessage({ type: "libList" }));
$("libQuery")?.addEventListener("keydown", (e) => {
  if(e.key === 'Enter') {
    vscode.postMessage({ type: "libSearch", query: $("libQuery").value });
  }
});
$("libInstallBtn")?.addEventListener("click", () => vscode.postMessage({ type: "libInstallSelected", name: selectedLib }));

function onUploadClick(){setRainState('thrust');cmd('arduinoMcp.upload');}
    </script>
  </body>
</html>`}};var Cr="Arduino Grease";function Re(t){return new Promise(e=>setTimeout(e,t))}async function Gt(t){if(t.languageId==="arduino"&&t.fileName.toLowerCase().endsWith(".ino"))try{await i.languages.setTextDocumentLanguage(t,"cpp")}catch{}}async function kr(t){let e=i.window.createOutputChannel(Cr);t.subscriptions.push(e),e.appendLine("Arduino Grease activating...");let n=t.asAbsolutePath(B.join("resources","arduino_docs.h")),r=gt(n);t.subscriptions.push(ht(r,e)),vt(r,e);for(let a of i.workspace.textDocuments)Gt(a),ke(a.uri.fsPath,n,e);t.subscriptions.push(i.workspace.onDidOpenTextDocument(a=>{Gt(a),ke(a.uri.fsPath,n,e)})),t.subscriptions.push(i.window.onDidChangeActiveTextEditor(a=>{a&&ke(a.document.uri.fsPath,n,e)})),i.workspace.getConfiguration().update("output.smartScroll.enabled",!1,i.ConfigurationTarget.Global).then(void 0,()=>{});let s="arduinoMcp.firstInstallDone_1_0_6";if(!t.globalState.get(s)){try{let a=i.workspace.getConfiguration("workbench");await a.update("colorTheme","Grease",i.ConfigurationTarget.Global),await a.update("activityBar.location","top",i.ConfigurationTarget.Global),e.appendLine("First install: Applied Grease theme and moved Activity Bar to top.")}catch(a){e.appendLine("First install theme setup failed: "+(a instanceof Error?a.message:String(a)))}await t.globalState.update(s,!0)}let l=i.languages.createDiagnosticCollection("arduino");t.subscriptions.push(l);let d=null,p=!1,b=!1,A=null,M=!1,P=async()=>{if(d)return!0;try{return d=await qt(t,e,3333),Tt(`http://127.0.0.1:${d.port}`),$t(d.authKey),e.appendLine(`Arduino Grease server started on port ${d.port}.`),!0}catch(a){return e.appendLine(`Failed to start bundled server: ${a instanceof Error?a.message:String(a)}`),!1}},$=async()=>{d&&(await d.stop(),d=null,p=!1,b=!1,e.appendLine("Arduino Grease server stopped."))};await P();{let a=await y(["version"]);if(!a.success&&(a.stderr?.includes("ENOENT")||a.exitCode===null)){let c=fe.platform()==="win32"?"Run: winget install ArduinoSA.ArduinoCLI":fe.platform()==="darwin"?"Run: brew install arduino-cli":"Run: curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh";await i.window.showWarningMessage(`Arduino Grease: arduino-cli not found on PATH. ${c} \u2014 then restart your IDE.`,"Open Install Guide")==="Open Install Guide"&&i.env.openExternal(i.Uri.parse("https://arduino.github.io/arduino-cli/latest/installation/"))}else await ct()}t.subscriptions.push({dispose:()=>{$()}});let w=i.window.createStatusBarItem(i.StatusBarAlignment.Left,100);w.name="Arduino Grease Target",w.command="arduinoMcp.refreshPortsBoards",w.show(),t.subscriptions.push(w);let L=new $e(e),ge=new Te(e),he=new Ee(t,e),Ht=new Pe(t),_=[],m=null,Je=async()=>{let a=se();a&&await Ce({sketchFolder:a,fqbn:m?.fqbn??null,sidecarPath:n,output:e})},U=new me(t,e,{chooseTarget:async a=>{let c=a.split(":").slice(0,2).join(":"),u=_.find(h=>h.fqbn?.startsWith(c+":")&&typeof h.port=="string")??_.find(h=>h.port===m?.port)??_.find(h=>typeof h.port=="string")??null,g=u?.port??m?.port??null;if(!g){i.window.showWarningMessage("Arduino Grease: No port detected. Connect a board first.");return}let x=u??_.find(h=>h.port===g),k=je(x);if(k.length>0){let h=await qe(t);for(let S of k)h[S]={fqbn:a};await mt(t,h),e.appendLine(`[BoardMemory] Saved (${k.join(", ")}) \u2192 ${a}`)}else e.appendLine(`[BoardMemory] Warning: no identifiers found for ${g} \u2014 memory not saved`);m={port:g,fqbn:a,userChosen:!0},await Z(t,m),await V(m),ae(m),E(),Je()},uploadFirmwareToTarget:async a=>{let c=m?.port??_[0]?.port??null;if(!c){i.window.showWarningMessage("Arduino Grease: No port detected. Connect a board first.");return}m={port:c,fqbn:a,userChosen:!0},await Z(t,m),await V(m),ae(m),E(),await Vt(a,c)},serialOff:async()=>{L.isConnected&&(await L.stop(),e.appendLine("Serial disconnected (panel switch)."),E())},cycleAccent:async a=>{let c=i.workspace.getConfiguration("workbench"),g={...c.get("colorCustomizations")||{},"statusBar.background":a,"statusBar.noFolderBackground":a,"statusBar.debuggingBackground":a,"statusBarItem.remoteBackground":a,focusBorder:a,"activityBarBadge.background":a,"panelTitle.activeBorder":a},x=i.workspace.workspaceFolders&&i.workspace.workspaceFolders.length>0?i.ConfigurationTarget.Workspace:i.ConfigurationTarget.Global;await c.update("colorCustomizations",g,x),e.appendLine(`Accent color set to ${a} (Target: ${x===i.ConfigurationTarget.Workspace?"Workspace":"Global"})`),E()},onLibraryInstalled:Je});t.subscriptions.push(i.window.registerWebviewViewProvider(me.viewType,U));let oe=new Set,Y=null,Xe=0;m=null,await V(null);let E=()=>{let c=i.workspace.getConfiguration("workbench").get("colorCustomizations")||{};U.setState({port:m?.port??null,fqbn:m?.fqbn??null,connectedPorts:Array.from(oe),serverRunning:d!==null,serverHealthy:p,lastScanAtMs:A,serialActive:L.isConnected,uploading:!!Y?.uploading,accentColor:c["statusBar.background"]||"#007ACC"})},Ze=a=>{w.text=`$(warning) ${a}`,w.backgroundColor=new i.ThemeColor("statusBarItem.warningBackground"),w.tooltip="Arduino Grease needs a board/port selection"},ae=a=>{a.fqbn?(w.text=`$(circuit-board) ${a.fqbn} @ ${a.port}`,w.backgroundColor=void 0,w.tooltip="Arduino Grease target"):(w.text=`$(plug) ${a.port} (board unknown)`,w.backgroundColor=new i.ThemeColor("statusBarItem.warningBackground"),w.tooltip="Port detected but board not resolved. Use 'arduino-cli board list' and 'arduino-cli core install <package>' to install the correct driver.")},Nt=()=>new Promise(a=>{let c=process.platform==="win32"?'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object -ExpandProperty CommandLine"':"ps -eo args";require("child_process").exec(c,{timeout:3e3},(u,g)=>{if(u)return a(!1);a(/arduino-cli\s+(compile|upload)/.test(g))})}),J=async(a=!1)=>{if(!d){p=!1,E();return}try{let u=await(await fetch(`http://127.0.0.1:${d.port}/state`,{headers:{"x-grease-auth":d.authKey}})).json(),g=!!u.target;p=g;let x=Y?.uploading||Y?.compiling||Y?.serial?.isOpen||Y?._cliActive,k=await Nt(),h=u.uploading||u.compiling||u.serial?.isOpen||k||u.agentActive;u._cliActive=k,h?U.view?.webview.postMessage({type:"rainState",state:"thrust"}):x&&U.view?.webview.postMessage({type:"rainState",state:"idle"}),Y=u,typeof u.portChangeVersion=="number"&&u.portChangeVersion!==Xe&&(Xe=u.portChangeVersion,u.uploading||ve()),g?b&&(e.appendLine("MCP Server recovered."),b=!1):(e.appendLine("Problem with MCP Server"),b=!0),a&&e.appendLine(`Server status: ${g?"running and healthy":"running but unhealthy"}`)}catch(c){p=!1,e.appendLine("Problem with MCP Server"),a&&e.appendLine(`Server health check failed: ${c instanceof Error?c.message:String(c)}`),b=!0}E()},ie=new Set,ve=async()=>{A=Date.now(),_=(await Ge(e)).candidates;let c=new Set(_.map(f=>f.port).filter(f=>typeof f=="string")),u=c.size!==oe.size||Array.from(c).some(f=>!oe.has(f))||Array.from(oe).some(f=>!c.has(f));oe=c,u&&ie.clear(),m?.port&&!c.has(m.port)&&(e.appendLine(`Port ${m.port} disconnected. Clearing selected target.`),m=null,await Z(t,null),await V(null));let g=await qe(t),x=_.map(f=>{for(let I of je(f))if(g[I]){let z=`${f.port}:${I}:${g[I].fqbn}`;return ie.has(z)||(e.appendLine(`[BoardMemory] Restored ${g[I].fqbn} for ${f.port} via ${I}`),ie.add(z)),{...f,fqbn:g[I].fqbn,fromMemory:!0}}return f}),k=new Map;for(let f of x){if(typeof f.port!="string")continue;let I=k.get(f.port);(!I||!I.fromMemory&&f.fromMemory)&&k.set(f.port,f)}let h=Array.from(k.values()),S=h.filter(f=>typeof f.fqbn=="string"&&typeof f.port=="string"),N=h.filter(f=>!f.fqbn&&typeof f.port=="string");if(!m?.userChosen&&S.length===1){let f=S[0],I=f.fromMemory;if(m={port:f.port,fqbn:f.fqbn,userChosen:!!I},I){let z=`auto:${f.fqbn}:${f.port}`;ie.has(z)||(e.appendLine(`[BoardMemory] Restored ${f.fqbn} for ${Fe(f.vid,f.pid)??f.port}`),ie.add(z))}await Z(t,m),await V(m)}else!m?.userChosen&&S.length===0&&N.length===1&&(m={port:N[0].port,fqbn:null},await Z(t,m),await V(m));if(!m)c.size===0?(Ze("No serial ports detected"),u&&e.appendLine("No Arduino port detected.")):Ze("Select board/port");else if(ae(m),u&&e.appendLine(`Port ${m.port} and Board ${m.fqbn??"unknown"} detected.`),m.fqbn&&u){let f=it(m.fqbn);if(f){if(await lt(f))e.appendLine(`Board core ${f} is already installed.`);else if(await i.window.showInformationMessage(`Arduino Grease: Board core "${f}" is not installed. Would you like me to install the driver for this board?`,"Install","Cancel")==="Install"){e.appendLine(`Installing board core ${f}...`);let X=await _e();e.appendLine(X.stdout),e.appendLine(X.stderr);let re=await De(f);e.appendLine(re.stdout),e.appendLine(re.stderr),re.success?i.window.showInformationMessage(`Arduino Grease: Board core ${f} installed successfully.`):i.window.showErrorMessage(`Arduino Grease: Failed to install board core ${f}. See Output.`)}}}E()},et=async()=>{if(e.show(!0),_=(await Ge(e)).candidates,m?.port&&m?.fqbn){let u=await He(t,_,m);u&&(m={...u,userChosen:!0},await V(m),ae(m),E());return}if(M){await i.commands.executeCommand("workbench.action.closeQuickOpen"),M=!1;return}M=!0,setTimeout(()=>{M=!1},6e3);let c=await He(t,_,m);c&&(m={...c,userChosen:!0},await V(m),ae(m),E())},zt=async()=>{let a=se();return a?ne(a)?a:(e.appendLine(`Invalid sketch folder (main .ino missing): ${a}`),await i.window.showWarningMessage("Arduino Grease: Current folder is not a valid sketch (missing main .ino).","Start Sketch","Cancel")==="Start Sketch"&&await i.commands.executeCommand("arduinoMcp.startSketch"),null):null},tt=async()=>{let a=At();if(a){let g=Mt(a);if(g)return g;e.appendLine(`[verify] Could not stage active sketch: ${a}`)}let c=await zt();if(!c)return null;let u=ne(c);return u?{sketchDir:c,mainIno:u,isTemp:!1}:null},Wt=(a,c)=>{if(!c.isTemp||!c.originalDir)return a;let u=B.normalize(a),g=B.normalize(c.sketchDir);if(!u.startsWith(g))return a;let x=B.relative(g,u);return c.originalIno&&B.basename(x).toLowerCase()===B.basename(c.mainIno).toLowerCase()&&B.dirname(x)==="."?c.originalIno:B.join(c.originalDir,x)},rt=async a=>{e.show(!0);let c=await tt();if(!c)return i.window.showErrorMessage("Arduino Grease: No .ino file open or valid sketch folder found."),{ok:!1};let u=c.sketchDir,g=a??m?.fqbn??null;if(!g)return await i.window.showWarningMessage("Arduino Grease: Board unknown. Install/select a core so an FQBN is available.","Install core...","Select board/port...")==="Install core..."?await i.commands.executeCommand("arduinoMcp.installCore"):await i.commands.executeCommand("arduinoMcp.refreshPortsBoards"),{ok:!1};let x=c.isTemp?c.originalIno:u;e.appendLine(`$ arduino-cli compile --fqbn ${g} "${x}"`),c.isTemp&&e.appendLine(`  (staged into temp sketch folder: ${u} \u2014 original folder name '${B.basename(c.originalDir)}' doesn't match .ino basename '${B.basename(c.mainIno,".ino")}')`);let k=await y(["compile","--fqbn",g,u],u);if(e.appendLine(k.stdout),e.appendLine(k.stderr),!k.success){let S=new Map,N=/^(.+):([0-9]+):([0-9]+):\s*(error|warning):\s*(.+)$/gm,f,I=k.stdout+`
`+k.stderr;for(;(f=N.exec(I))!==null;){let z=Wt(f[1],c),X=Math.max(0,parseInt(f[2],10)-1),re=Math.max(0,parseInt(f[3],10)-1),Yt=f[4]==="error"?i.DiagnosticSeverity.Error:i.DiagnosticSeverity.Warning,Jt=f[5],Xt=new i.Range(X,re,X,re+1),nt=new i.Diagnostic(Xt,Jt,Yt);nt.source="Arduino Grease";let Oe=i.Uri.file(z).toString();S.has(Oe)||S.set(Oe,[]),S.get(Oe).push(nt)}l.clear();for(let[z,X]of S)l.set(i.Uri.parse(z),X);return i.window.showErrorMessage("Arduino Grease: Verify failed (see Output)."),{ok:!1,prepared:c}}l.clear();let h=c.isTemp&&c.originalDir?c.originalDir:u;return xe(g,h,e),i.window.showInformationMessage("Arduino Grease: Verify succeeded."),{ok:!0,sketchPath:u,fqbn:g,prepared:c}},Ut=async a=>{e.show(!0),await i.workspace.saveAll(!1);let c=null,u=a?.fqbnOverride??m?.fqbn??null;if(a?.verifyFirst!==!1){let S=await rt(u??void 0);if(!S.ok)return!1;c=S.prepared??null,u=S.fqbn??u}else c=await tt();if(!c)return i.window.showErrorMessage("Arduino Grease: No .ino file to upload."),!1;let g=c.sketchDir,x=a?.portOverride??m?.port??null;if(!x)return i.window.showWarningMessage("Arduino Grease: Select a port first."),await i.commands.executeCommand("arduinoMcp.refreshPortsBoards"),!1;if(!u)return i.window.showWarningMessage("Arduino Grease: Select a board first."),await i.commands.executeCommand("arduinoMcp.refreshPortsBoards"),!1;let k=c.isTemp?c.originalIno:g;e.appendLine(`$ arduino-cli upload -p ${x} --fqbn ${u} "${k}"`),U.view?.webview.postMessage({type:"rainState",state:"thrust"});let h=await y(["upload","-p",x,"--fqbn",u,g],g);return e.appendLine(h.stdout),e.appendLine(h.stderr),U.view?.webview.postMessage({type:"uploadResult",success:h.success}),h.success?(i.window.showInformationMessage("Arduino Grease: Upload succeeded."),!0):(i.window.showErrorMessage("Arduino Grease: Upload failed (see Output)."),!1)},Vt=async(a,c)=>{e.show(!0);let u=await i.window.showInputBox({title:"Programmer",prompt:"Enter programmer (e.g., avrispmkii, usbtinyisp) or leave empty for default",ignoreFocusOut:!1});if(u===void 0)return;e.appendLine(`[Mngrs] Burning bootloader for ${a} on ${c}...`);let g=["burn-bootloader","-b",a,"-p",c];u&&g.push("-P",u);let x=await y(g);if(e.appendLine(x.stdout),e.appendLine(x.stderr),!x.success){i.window.showErrorMessage("Arduino Grease: Burn bootloader failed (see Output).");return}i.window.showInformationMessage("Arduino Grease: Bootloader burned to target.")};await ve(),Lt({fqbn:m?.fqbn??null,sidecarPath:n,output:e}),yt({log:a=>e.appendLine(a),arduinoCliPath:process.env.ARDUINO_CLI_PATH}),await Re(3e3),await J(!0);let Qt=setInterval(()=>{J(!1)},500);t.subscriptions.push({dispose:()=>clearInterval(Qt)});let Kt=setInterval(()=>{Y?.uploading||ve()},5e3);t.subscriptions.push({dispose:()=>clearInterval(Kt)}),t.subscriptions.push(i.commands.registerCommand("arduinoMcp.serverStatus",async()=>{if(e.show(!0),e.appendLine("Checking MCP server status..."),!d){e.appendLine("Server status: stopped"),p=!1,E();return}await J(!0)}),i.commands.registerCommand("arduinoMcp.refreshServer",async()=>{if(e.show(!0),!d){await P(),await Re(1e3),await J(!0);return}if(d&&!p){await $(),await Re(1e3),await P(),await Re(1e3),await J(!0);return}d&&p&&(await $(),E())}),i.commands.registerCommand("arduinoMcp.startServer",async()=>{e.show(!0),await P()&&(await J(!0),e.appendLine("Server start command completed.")),E()}),i.commands.registerCommand("arduinoMcp.stopServer",async()=>{e.show(!0),await $(),E()}),i.commands.registerCommand("arduinoMcp.toggleServer",async()=>{e.show(!0),d?await $():(await P(),await J(!0)),E()}),i.commands.registerCommand("arduinoMcp.startSketch",async()=>{e.show(!0);let a=await i.window.showInputBox({title:"Start new sketch",prompt:"Sketch name",placeHolder:"BlinkNano33",ignoreFocusOut:!1,validateInput:S=>{let N=S.trim();return N?/^[A-Za-z0-9_\-]+$/.test(N)?null:"Use only letters, numbers, underscore, or dash.":"Sketch name is required."}});if(!a)return;let c=i.workspace.workspaceFolders?.[0]?.uri??i.Uri.file(B.join(fe.homedir(),"Documents")),u=await i.window.showOpenDialog({canSelectFiles:!1,canSelectFolders:!0,canSelectMany:!1,defaultUri:c,openLabel:"Create Sketch Here",title:"Choose parent folder"});if(!u?.[0])return;let g=u[0].fsPath,x=B.join(g,a.trim());e.appendLine(`$ arduino-cli sketch new "${x}"`);let k=await y(["sketch","new",x]);if(e.appendLine(k.stdout),e.appendLine(k.stderr),!k.success){i.window.showErrorMessage("Arduino Grease: Failed to create sketch. See output.");return}let h=B.join(x,`${a.trim()}.ino`);try{let S=await i.workspace.openTextDocument(i.Uri.file(h));await i.window.showTextDocument(S,{preview:!1})}catch(S){e.appendLine(`Could not open sketch file automatically: ${S instanceof Error?S.message:String(S)}`)}e.appendLine(`Sketch created: ${x}`),i.window.showInformationMessage(`Arduino Grease: Sketch created (${a.trim()}).`)}),i.commands.registerCommand("arduinoMcp.installCore",async()=>{e.show(!0);let a=[{label:"Arduino AVR (Uno/Nano/Mega)",description:"arduino:avr",pkg:"arduino:avr"},{label:"Arduino SAMD (Nano 33 IoT, MKR)",description:"arduino:samd",pkg:"arduino:samd"},{label:"Arduino Mbed OS (Nano 33 BLE, Portenta)",description:"arduino:mbed",pkg:"arduino:mbed"},{label:"ESP32",description:"esp32:esp32",pkg:"esp32:esp32"},{label:"RP2040",description:"rp2040:rp2040",pkg:"rp2040:rp2040"}],c=await i.window.showQuickPick(a,{title:"Install board core",placeHolder:"Pick a core package",ignoreFocusOut:!1});if(!c)return;let u=await _e();e.appendLine(u.stdout),e.appendLine(u.stderr);let g=await De(c.pkg);e.appendLine(g.stdout),e.appendLine(g.stderr),g.success?(i.window.showInformationMessage(`Arduino Grease: Core installed: ${c.pkg}.`),await ve()):i.window.showErrorMessage(`Arduino Grease: Core install failed for ${c.pkg}.`)}),i.commands.registerCommand("arduinoMcp.verify",async()=>{let a=await rt();U.view?.webview.postMessage({type:"verifyResult",success:a.ok===!0})}),i.commands.registerCommand("arduinoMcp.upload",async()=>{let a=await Ut({verifyFirst:!0});U.view?.webview.postMessage({type:"uploadResult",success:a===!0})}),i.commands.registerCommand("arduinoMcp.refreshPortsBoards",async()=>{await et()}),i.commands.registerCommand("arduinoMcp.selectTarget",async()=>{await et()}),i.commands.registerCommand("arduinoMcp.toggleSerial",async()=>{L.isConnected?await L.stop():await i.commands.executeCommand("arduinoMcp.openSerialMonitor"),E()}),i.commands.registerCommand("arduinoMcp.openSerialMonitor",async()=>{e.show(!0);let a=m?.port??_[0]?.port??null;await L.start(a,9600),e.appendLine(`Type "baud=X" to set a new baud rate, or try any of the following commands: 'send="Hello World"', "clear", "disconnect", or "connect". Transmitting from ${a??"(unknown port)"} below:`)}),i.commands.registerCommand("arduinoMcp.serialCommand",async()=>{e.show(!0);let a=await i.window.showInputBox({title:"Serial command",prompt:"Enter serial command",placeHolder:'baud=9600 | send="Hello World" | clear | disconnect | connect',ignoreFocusOut:!1});a&&await L.handleConsoleCommand(a)}),i.commands.registerCommand("arduinoMcp.openSerialPlotter",async()=>{e.show(!0);let a=m?.port??_[0]?.port??null;ge.show(a,!0),!L.isConnected&&a&&L.start(a,9600),setTimeout(()=>{i.commands.executeCommand("workbench.action.moveEditorToNewWindow")},500),E()}),i.commands.registerCommand("arduinoMcp.openExamples",async()=>{e.show(!0),L.isConnected&&(await L.stop(),e.appendLine("Serial disconnected (Examples panel opened)."),E()),he.show(m?.fqbn??null)}),i.commands.registerCommand("arduinoMcp.openBoardTemplate",async()=>{e.show(!0),Ht.show({fqbn:m?.fqbn??null,port:m?.port??null})}),i.commands.registerCommand("arduinoMcp.cycleAccentColor",async()=>{let a=["#005FA0","#6B0000","#A34300","#8F6809","#6B004A","#520A85","#004D00"],c=i.workspace.getConfiguration("workbench"),u=c.get("colorCustomizations")||{},g=u["statusBar.background"]||"#007ACC",k=(a.indexOf(g)+1)%a.length,h=a[k],S={...u,"statusBar.background":h,"statusBar.noFolderBackground":h,"statusBar.debuggingBackground":h,"statusBarItem.remoteBackground":h,focusBorder:h,"activityBarBadge.background":h,"panelTitle.activeBorder":h},N=i.workspace.workspaceFolders&&i.workspace.workspaceFolders.length>0?i.ConfigurationTarget.Workspace:i.ConfigurationTarget.Global;await c.update("colorCustomizations",S,N),e.appendLine(`Accent color cycled to ${h} (Target: ${N===i.ConfigurationTarget.Workspace?"Workspace":"Global"})`),E(),U.view?.webview.postMessage({type:"accentColor",color:h})}),i.commands.registerCommand("arduinoMcp.regenerateIntelliSense",async()=>{e.show(!0);let a=se();if(!a){i.window.showWarningMessage("Arduino Grease: Open a sketch first to regenerate IntelliSense.");return}e.appendLine(`[clangd] Manual IntelliSense refresh for ${a}...`),await Ce({sketchFolder:a,fqbn:m?.fqbn??null,sidecarPath:n,output:e,silent:!1})?i.window.showInformationMessage("Arduino Grease: IntelliSense refreshed for clangd."):m?.fqbn||i.window.showInformationMessage("Arduino Grease: .clangd written. Pick a board to also refresh compile_commands.json.")})),E(),e.appendLine("Arduino Grease activated.")}function Ar(){}0&&(module.exports={activate,deactivate});
