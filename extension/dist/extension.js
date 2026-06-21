var qt=Object.create;var ge=Object.defineProperty;var Ft=Object.getOwnPropertyDescriptor;var Gt=Object.getOwnPropertyNames;var jt=Object.getPrototypeOf,Ut=Object.prototype.hasOwnProperty;var Wt=(t,e)=>{for(var r in e)ge(t,r,{get:e[r],enumerable:!0})},Ve=(t,e,r,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let o of Gt(e))!Ut.call(t,o)&&o!==r&&ge(t,o,{get:()=>e[o],enumerable:!(n=Ft(e,o))||n.enumerable});return t};var b=(t,e,r)=>(r=t!=null?qt(jt(t)):{},Ve(e||!t||!t.__esModule?ge(r,"default",{value:t,enumerable:!0}):r,t)),Ht=t=>Ve(ge({},"__esModule",{value:!0}),t);var Zt={};Wt(Zt,{activate:()=>Xt,deactivate:()=>Jt});module.exports=Ht(Zt);var s=b(require("vscode")),fe=b(require("node:fs")),J=b(require("node:os")),A=b(require("node:path"));var Ye=require("node:child_process");var Qe=b(require("node:os"));async function w(t,e){let r=process.env.ARDUINO_CLI_PATH||"arduino-cli";return new Promise(n=>{let o=(0,Ye.spawn)(r,t,{cwd:e,env:process.env,shell:Qe.platform()==="win32"}),a="",c="";o.stdout.on("data",d=>a+=d.toString()),o.stderr.on("data",d=>c+=d.toString()),o.on("error",d=>n({success:!1,exitCode:null,stdout:a,stderr:`${c}
${String(d)}`})),o.on("close",d=>n({success:d===0,exitCode:d,stdout:a,stderr:c}))})}async function $e(){return w(["core","update-index"])}async function Ie(t){return w(["core","install",t])}function Ke(t){if(!t||typeof t!="string")return null;let e=t.split(":");return e.length>=2?`${e[0]}:${e[1]}`:null}async function Xe(t){let e=await w(["core","list","--json"]);if(!e.success)return!1;try{let r=JSON.parse(e.stdout),n=Array.isArray(r?.platforms)?r.platforms:[];for(let o of n)if(String(o?.id??"")===t)return!0}catch{}return!1}async function Je(){let t=await w(["board","list","--format","json"]),e=t.stdout,r=t.stderr;if(!t.success)return{success:!1,candidates:[],raw:e,stderr:r};let n=e.match(/\{[\s\S]*\}\s*$/)||e.match(/\[[\s\S]*\]\s*$/),o=n?n[0]:e,a;try{a=JSON.parse(o)}catch(p){return{success:!1,candidates:[],raw:e,stderr:`${r}
Failed to parse JSON: ${p instanceof Error?p.message:String(p)}`}}let c=Array.isArray(a?.detected_ports)?a.detected_ports:[],d=[];for(let p of c){let v=p?.port?.address,M=p?.port?.protocol,$=p?.port?.properties?.vid??null,G=p?.port?.properties?.pid??null,O=p?.port?.properties?.serialNumber??null,I=Array.isArray(p?.matching_boards)?p.matching_boards:[];if(I.length===0){typeof v=="string"&&d.push({port:v,protocol:M,vid:$,pid:G,serialNumber:O});continue}for(let k of I)d.push({port:v,protocol:M,fqbn:k?.fqbn,name:k?.name,vid:$,pid:G,serialNumber:O})}return{success:!0,candidates:d,raw:e,stderr:r}}async function Re(){try{await w(["config","set","library.enable_unsafe_install","true"])}catch{}}var he=b(require("vscode"));var Ze="arduinoMcp.target",et="arduinoMcp.boardMemory";async function N(t,e){if(!e){await t.globalState.update(Ze,void 0);return}await t.globalState.update(Ze,e)}async function ve(t){return t.globalState.get(et)??{}}async function Oe(t,e){await t.globalState.update(et,e)}function De(t,e){return!t||!e?null:`${String(t).toLowerCase()}:${String(e).toLowerCase()}`}function be(t){let e=[];t?.serialNumber&&e.push(`serial:${t.serialNumber}`);let r=De(t?.vid,t?.pid);return r&&e.push(r),t?.fqbn&&e.push(`fqbn:${t.fqbn}`),e}async function ae(t){let e=await Je();return e.success?{success:!0,candidates:e.candidates}:(t.appendLine(`Board detect failed: ${e.stderr}`),{success:!1,candidates:[],stderr:e.stderr})}function zt(t){return[t.name||"Unknown board",t.fqbn?`(${t.fqbn})`:"(no fqbn)",t.port].join("  ")}async function tt(t,e,r){if(e.length===0)return null;let n=e.map(a=>{let c=typeof a.fqbn=="string"?a.fqbn:null;return{label:zt(a),description:c?void 0:"Port detected (board unknown - install/select core)",target:{port:a.port,fqbn:c}}});if(r?.fqbn){n.push({kind:he.QuickPickItemKind.Separator,label:"Change port only (keep current board)"});for(let a of e)n.push({label:`$(plug) ${a.port}`,description:`Keep board: ${r.fqbn}`,target:{port:a.port,fqbn:r.fqbn}})}let o=await he.window.showQuickPick(n,{title:"Select Arduino board/port",placeHolder:"Pick the correct port (and board if known)",ignoreFocusOut:!1});return o?.target?(await N(t,o.target),o.target):null}var rt=b(require("node:fs")),Q=b(require("vscode"));function nt(t){let e=new Map,r;try{r=rt.readFileSync(t,"utf8")}catch{return e}let n=/\/\*\*([\s\S]*?)\*\//g,o;for(;(o=n.exec(r))!==null;){let a=o[1],c=/@brief\b\s*([\s\S]*?)(?=\n\s*\*\s*(?:@|\n)|\n\s*\*\/|$)/,d=a.match(c);if(!d)continue;let p=d[1].split(`
`).map(I=>I.replace(/^\s*\*\s?/,"").trim()).filter(I=>I.length>0).join(" ").replace(/\s+/g," ").trim();if(!p)continue;let v=[],M=/@param\s+(\w+)\s+([\s\S]*?)(?=\n\s*\*\s*(?:@|\n)|\n\s*\*\/|$)/g,$;for(;($=M.exec(a))!==null;){let I=$[2].split(`
`).map(k=>k.replace(/^\s*\*\s?/,"").trim()).filter(k=>k.length>0).join(" ").replace(/\s+/g," ").trim();$[1]&&I&&v.push({name:$[1],desc:I})}let G=r.slice(o.index+o[0].length,o.index+o[0].length+400),O=Nt(G);O&&(e.has(O.name)||e.set(O.name,{brief:p,signature:O.signature,params:v}))}return e}function Nt(t){let e=t.split(`
`).map(c=>c.trim()).find(c=>c.length>0)??"",r=t.match(/^\s*#define\s+([A-Za-z_]\w*)/);if(r)return{name:r[1],signature:e};let n=t.match(/^\s*extern\s+[\w:<>*&\s]+?\s+([A-Za-z_]\w*)\s*[;[]/);if(n){let c=e.replace(/^extern\s+/,"").replace(/;$/,"").trim();return{name:n[1],signature:c}}let o=t.match(/^\s*class\s+([A-Za-z_]\w*)/);if(o)return{name:o[1],signature:`class ${o[1]}`};let a=t.match(/^\s*(?:(?:virtual|static|inline|explicit|constexpr|friend)\s+)*(?:[A-Za-z_][\w:]*\s*[*&\s]+)+([A-Za-z_]\w*)\s*\(/);return a?{name:a[1],signature:e.replace(/;$/,"").trim()}:null}function ot(t,e){return e.appendLine(`[hover-docs] Loaded ${t.size} Arduino symbol descriptions.`),Q.languages.registerHoverProvider([{scheme:"file",language:"cpp"},{scheme:"file",language:"c"},{scheme:"file",language:"arduino"}],{provideHover(r,n){let o=r.getWordRangeAtPosition(n);if(!o)return null;let a=r.getText(o),c=t.get(a);if(!c)return null;let d=new Q.MarkdownString;d.appendMarkdown(`**function** \`${a}\`

`),d.appendMarkdown(`${c.brief}

`),d.appendCodeblock(c.signature,"cpp");for(let p of c.params)d.appendMarkdown(`*@param* \`${p.name}\` \u2014 ${p.desc}

`);return d.isTrusted=!1,new Q.Hover(d,o)}})}var K=b(require("vscode")),at=b(require("node:crypto")),q=b(require("node:fs")),it=b(require("node:os")),E=b(require("node:path"));function lt(t){try{return q.readdirSync(t)}catch{return[]}}function we(t){let e=E.basename(t),r=E.join(t,`${e}.ino`);if(q.existsSync(r))return r;let n=lt(t).filter(o=>o.toLowerCase().endsWith(".ino"));return n.length===1?E.join(t,n[0]):null}function st(t){return we(t)!==null}function dt(){let t=K.window.activeTextEditor;if(t&&t.document.uri.fsPath.toLowerCase().endsWith(".ino"))return t.document.uri.fsPath;for(let e of K.window.visibleTextEditors)if(e.document.uri.fsPath.toLowerCase().endsWith(".ino"))return e.document.uri.fsPath;return null}function ct(t){if(!t||!t.toLowerCase().endsWith(".ino")||!q.existsSync(t))return null;let e=E.basename(t,E.extname(t)),r=E.dirname(t);if(E.basename(r)===e)return{sketchDir:r,mainIno:t,isTemp:!1};let o=at.createHash("sha1").update(t).digest("hex").slice(0,10),a=E.join(it.tmpdir(),"arduino-grease-sketches",`${e}-${o}`),c=E.join(a,e),d=E.join(c,`${e}.ino`);try{q.mkdirSync(c,{recursive:!0}),q.copyFileSync(t,d);for(let p of lt(r)){let v=p.toLowerCase();if(v.endsWith(".h")||v.endsWith(".hpp")||v.endsWith(".cpp")||v.endsWith(".c")||v.endsWith(".cc")||v.endsWith(".cxx"))try{q.copyFileSync(E.join(r,p),E.join(c,p))}catch{}}}catch{return null}return{sketchDir:c,mainIno:d,isTemp:!0,originalIno:t,originalDir:r}}function pt(){let t=K.window.activeTextEditor;if(t){let n=t.document.uri.fsPath;if(n.toLowerCase().endsWith(".ino"))return E.dirname(n)}for(let n of K.window.visibleTextEditors){let o=n.document.uri.fsPath;if(o.toLowerCase().endsWith(".ino"))return E.dirname(o)}let r=K.workspace.workspaceFolders?.[0]?.uri.fsPath;if(!r)return null;if(st(r))return r;try{let n=q.readdirSync(r,{withFileTypes:!0});for(let o of n){if(!o.isDirectory())continue;let a=E.join(r,o.name);if(st(a))return a}}catch{}return r}var ut="http://127.0.0.1:3333",mt="";function ft(t){mt=t}function gt(t){let e=String(t||"").trim();e&&(ut=e.replace(/\/$/,""))}async function U(t,e){let r=await fetch(`${ut}${t}`,{method:"POST",headers:{"content-type":"application/json","x-grease-auth":mt},body:JSON.stringify(e??{})});if(!r.ok)throw new Error(`HTTP ${r.status} ${t}`);return await r.json()}async function W(t){try{await U("/target",{port:t?.port??null,fqbn:t?.fqbn??null})}catch{}}async function ye(t){return U("/serial/open",t)}async function ie(){return U("/serial/close",{})}async function ht(t){return U("/serial/write",t)}async function le(){return U("/serial/read",{})}async function vt(t){return U("/compile",{sketchPath:t})}async function bt(t){return U("/upload",{sketchPath:t})}async function _e(){await U("/thrust",{})}async function qe(){await U("/idle",{})}var xt=require("node:child_process"),de=b(require("node:path")),St=b(require("node:net")),xe=b(require("node:os")),Se=b(require("node:fs")),Ct=require("node:crypto");function wt(t){return new Promise(e=>setTimeout(e,t))}function yt(t){return new Promise(e=>{let r=St.createServer();r.once("error",()=>e(!1)),r.once("listening",()=>{r.close(()=>e(!0))}),r.listen(t,"127.0.0.1")})}async function Vt(t=3333){if(await yt(t))return t;for(let e=t+1;e<t+60;e++)if(await yt(e))return e;throw new Error("No free local port found for Arduino MCP server")}async function kt(t,e,r=3333){let n=await Vt(r),o=process.env.ARDUINO_MCP_NODE_PATH||"node",a=t.asAbsolutePath(de.join("dist","server.mjs")),c=null;try{let p=de.join(xe.homedir(),".grease","extension","mcp-auth.json");c=JSON.parse(Se.readFileSync(p,"utf8")).key||null}catch{}if(!c)try{let p=de.join(xe.homedir(),".grease","mcp-auth.json");c=JSON.parse(Se.readFileSync(p,"utf8")).key||null}catch{}if(!c)try{let p=de.join(xe.homedir(),".grease-mcp-auth");c=JSON.parse(Se.readFileSync(p,"utf8")).key||null}catch{}c||(c=(0,Ct.randomBytes)(24).toString("hex")),e.appendLine(`Starting bundled Arduino MCP server on port ${n}...`);let d=(0,xt.spawn)(o,[a],{cwd:t.extensionPath,env:{...process.env,MCP_PORT:String(n),MCP_HOST:"127.0.0.1",MCP_AUTH_KEY:c},shell:!1});if(d.stdout?.on("data",p=>e.appendLine(`[server] ${String(p).trimEnd()}`)),d.stderr?.on("data",p=>e.appendLine(`[server:err] ${String(p).trimEnd()}`)),d.on("exit",p=>e.appendLine(`[server] exited with code ${p}`)),await wt(250),d.exitCode!==null)throw new Error(`Bundled server exited early with code ${d.exitCode}`);return{port:n,authKey:c,stop:async()=>{d.killed||(d.kill("SIGTERM"),await wt(200),d.killed||d.kill("SIGKILL"))}}}var V=b(require("vscode")),Ce=class{constructor(e){this.context=e}context;panel=null;show(e){this.panel?this.panel.reveal(V.ViewColumn.Beside):(this.panel=V.window.createWebviewPanel("arduinoMcp.boardTemplate","Arduino Grease: AI Prompt Template",V.ViewColumn.Beside,{enableScripts:!0}),this.panel.onDidDispose(()=>this.panel=null),this.panel.webview.onDidReceiveMessage(r=>{this.onMessage(r)})),this.panel.webview.html=this.html()}async onMessage(e){if(e?.type&&e.type==="copy"){let r=String(e.text??"");await V.env.clipboard.writeText(r),V.window.showInformationMessage("Arduino Grease: Copied prompt to clipboard.")}}html(){return`<!DOCTYPE html>
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
</html>`}};var F=b(require("vscode")),X=b(require("node:fs")),Mt=b(require("node:os")),H=b(require("node:path"));function ce(t){let e=Array.isArray(t?.examples)?t.examples:[],r=[];for(let n of e){let o=String(n?.library?.name??"Unknown"),a=Array.isArray(n?.examples)?n.examples:[];for(let c of a){let d=String(c??"");d&&r.push({library:o,example:H.basename(d),fullPath:d})}}return r}function Fe(t){let e=new Set,r=[];for(let n of t){let o=`${n.library}::${n.fullPath}`;e.has(o)||(e.add(o),r.push(n))}return r.sort((n,o)=>{let a=n.library.localeCompare(o.library);return a!==0?a:n.example.localeCompare(o.example)})}var ke=class{constructor(e,r){this.context=e;this.output=r}context;output;panel=null;show(e){this.panel?(this.panel.title="X-mpls",this.panel.reveal(F.ViewColumn.Beside)):(this.panel=F.window.createWebviewPanel("arduinoMcp.examples","X-mpls",F.ViewColumn.Beside,{enableScripts:!0}),this.panel.onDidDispose(()=>this.panel=null),this.panel.webview.onDidReceiveMessage(r=>{this.onMessage(r,e)})),this.panel.webview.html=this.html(),this.onMessage({type:"list",library:""},e)}async listExamples(e){let r=["lib","examples","--json"];this.output.appendLine(`$ arduino-cli ${r.join(" ")}`);let n=await w(r);if(!n.success)throw new Error(n.stderr||n.stdout||"Failed to list examples");let o=ce(JSON.parse(n.stdout));if(e){let c=["lib","examples","--fqbn",e,"--json"];this.output.appendLine(`$ arduino-cli ${c.join(" ")}`);let d=await w(c);d.success&&(o=o.concat(ce(JSON.parse(d.stdout))))}let a=H.join(Mt.homedir(),"Documents","Arduino","libraries","AdvancedAnalog");if(X.existsSync(a)){let c=H.join(a,"examples");if(X.existsSync(c))try{let d=X.readdirSync(c,{withFileTypes:!0}).filter(p=>p.isDirectory());for(let p of d)o.push({library:"Filtered analog",example:p.name,fullPath:H.join(c,p.name)})}catch{}}return Fe(o)}async openExampleAsTab(e){let r=String(e||"").trim();if(!r)return;let n=H.basename(r),o=H.join(r,`${n}.ino`),a=null;if(X.existsSync(o))a=o;else try{let d=X.readdirSync(r).filter(p=>p.toLowerCase().endsWith(".ino"));d.length>0&&(a=H.join(r,d[0]))}catch{}if(!a){F.window.showWarningMessage("Arduino Grease: No .ino file found in this example.");return}let c=await F.workspace.openTextDocument(F.Uri.file(a));await F.window.showTextDocument(c,{preview:!1})}async onMessage(e,r){if(!(!this.panel||!e?.type))if(e.type==="list")try{let n=await this.listExamples(r);this.panel.webview.postMessage({type:"examples",rows:n})}catch(n){this.panel.webview.postMessage({type:"error",error:n instanceof Error?n.message:String(n)})}else e.type==="openExample"&&await this.openExampleAsTab(String(e.path??""))}html(){return`<!DOCTYPE html>
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
</html>`}};var pe=b(require("vscode")),At=b(require("node:os"));var Me=class{constructor(e){this.output=e}output;pollTimer=null;connectedPort=null;baudRate=9600;isConnected=!1;async start(e,r=9600){if(this.baudRate=r,!e){this.output.appendLine("Serial: no port selected.");return}await this.connect(e,this.baudRate),this.startPolling()}async stop(){this.isConnected&&(await ie(),this.isConnected=!1,this.output.appendLine("Serial disconnected"))}async handleConsoleCommand(e){let r=String(e??"").trim();if(!r)return;if(/^baud\s*=\s*\d+$/i.test(r)){let a=Number(r.split("=")[1]);if(!Number.isFinite(a)||a<=0){this.output.appendLine("Serial: invalid baud value.");return}this.baudRate=a,this.output.appendLine(`Serial baud set to ${a}`),this.connectedPort&&await this.connect(this.connectedPort,this.baudRate);return}if(/^clear$/i.test(r)){let c=(await le()).lines?.length??0;this.output.appendLine(`Serial buffer cleared (${c} lines dropped).`);return}if(/^disconnect$/i.test(r)){await this.stop();return}if(/^connect$/i.test(r)){if(!this.connectedPort){this.output.appendLine("Serial: no known port to connect.");return}await this.connect(this.connectedPort,this.baudRate);return}let n=r.match(/^send\s*=\s*"([\s\S]*)"$/i),o=r.match(/^send\s*=\s*(.+)$/i);if(n||o){let a=n?n[1]:o?.[1]??"";if(!this.isConnected){this.output.appendLine("Serial: not connected.");return}await ht({data:a}),this.output.appendLine(`[serial:tx] ${a}`);return}this.output.appendLine(`Serial: unknown command "${r}".`)}async connect(e,r){let a="";for(let d=1;d<=3;d++)try{await ye({path:e,baudRate:r}),this.connectedPort=e,this.baudRate=r,this.isConnected=!0,this.output.appendLine(`Serial connected: ${e} @ ${r}`);return}catch(p){if(a=p instanceof Error?p.message:String(p),a.includes("Permission denied")||a.includes("EACCES")||a.includes("EPERM"))break;d<3&&(this.output.appendLine(`Serial open failed (attempt ${d}/3): ${a} \u2014 retrying in 600ms`),await new Promise(M=>setTimeout(M,600)))}(a.includes("Permission denied")||a.includes("EACCES")||a.includes("EPERM"))&&At.platform()==="linux"?pe.window.showErrorMessage(`Serial: Permission denied on ${e}. On Linux, run: sudo usermod -a -G dialout $USER \u2014 then log out and back in.`,"Copy Command").then(d=>{d==="Copy Command"&&pe.env.clipboard.writeText("sudo usermod -a -G dialout $USER")}):pe.window.showErrorMessage(`Serial: Failed to open ${e}: ${a}`),this.output.appendLine(`Serial open failed: ${a}`)}startPolling(){this.pollTimer||(this.pollTimer=setInterval(()=>{this.isConnected&&(async()=>{try{let e=await le();for(let r of e.lines??[])this.output.appendLine(`[serial] ${r}`)}catch{}})()},250))}};var j=b(require("vscode")),Ge=b(require("node:os"));function Yt(t){let e=t.match(/-?\d+(?:\.\d+)?/g);if(!e)return[];let r=[];for(let n of e){let o=Number(n);Number.isFinite(o)&&r.push(o)}return r}function Qt(t){let e=[],r=/([A-Za-z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?)/g,n;for(;(n=r.exec(String(t)))!==null;)e.push({label:n[1],value:Number(n[2])});return e.length>0?{labels:e.map(o=>o.label),numbers:e.map(o=>o.value)}:{labels:[],numbers:Yt(t)}}var Ae=class{constructor(e){this.output=e}output;panel=null;pollTimer=null;isConnected=!1;show(e,r=!0){this.panel||(this.panel=j.window.createWebviewPanel("arduinoMcp.serialPlotter","Arduino Grease: Plttr",j.ViewColumn.Beside,{enableScripts:!0}),this.panel.onDidDispose(()=>this.dispose()),this.panel.webview.onDidReceiveMessage(n=>{this.onMessage(n)})),this.panel.title="Arduino Grease: Plttr",this.panel.reveal(j.ViewColumn.Beside),this.panel.webview.html=this.html(e),this.startPolling(),this.postStatus(),r&&e&&!this.isConnected&&this.connect(e,9600)}dispose(){this.panel=null,this.pollTimer&&clearInterval(this.pollTimer),this.pollTimer=null,this.isConnected&&(ie(),this.isConnected=!1)}async connect(e,r){let a="";for(let d=1;d<=3;d++)try{await ye({path:e,baudRate:r}),this.output.appendLine(`Serial connected (plotter): ${e} @ ${r}`),this.isConnected=!0,this.postStatus();return}catch(p){if(a=p instanceof Error?p.message:String(p),a.includes("Permission denied")||a.includes("EACCES")||a.includes("EPERM"))break;d<3&&(this.output.appendLine(`Serial open failed (plotter, attempt ${d}/3): ${a} \u2014 retrying in 600ms`),await new Promise(M=>setTimeout(M,600)))}(a.includes("Permission denied")||a.includes("EACCES")||a.includes("EPERM"))&&Ge.platform()==="linux"?j.window.showErrorMessage(`Serial: Permission denied on ${e}. On Linux, run: sudo usermod -a -G dialout $USER \u2014 then log out and back in.`,"Copy Command").then(d=>{d==="Copy Command"&&j.env.clipboard.writeText("sudo usermod -a -G dialout $USER")}):j.window.showErrorMessage(`Serial: Failed to open ${e}: ${a}`),this.output.appendLine(`Serial open failed (plotter): ${a}`)}startPolling(){this.pollTimer||(this.pollTimer=setInterval(()=>{this.panel&&this.isConnected&&(async()=>{try{let e=await le(),r=[],n=[];for(let o of e.lines??[]){let a=Qt(String(o));a.numbers.length>0&&(r.push(a.numbers),n.push(a.labels))}r.length&&this.panel?.webview.postMessage({type:"points",points:r,labels:n}),this.panel?.webview.postMessage({type:"status",status:e.serial})}catch{this.panel?.webview.postMessage({type:"status",status:{isOpen:!1}})}})()},180))}postStatus(){this.panel&&this.panel.webview.postMessage({type:"status",status:{isOpen:this.isConnected}})}async onMessage(e){if(e?.type)try{if(e.type==="toggle"){let r=String(e.path||""),n=Number(e.baudRate||9600);this.isConnected?(await ie(),this.output.appendLine("Serial disconnected (plotter)"),this.isConnected=!1):await this.connect(r,n),this.postStatus()}else e.type==="clear"&&this.panel&&this.panel.webview.postMessage({type:"clear"})}catch(r){let n=r instanceof Error?r.message:String(r);this.output.appendLine(`Serial plotter error: ${n}`),j.window.showErrorMessage(`Arduino Grease Plotter: ${n}`),this.postStatus()}}html(e){let r=e?e.replaceAll('"',"&quot;"):"";return`<!DOCTYPE html>
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
          <input id="port" placeholder="${Ge.platform()==="win32"?"COM1":"/dev/cu.usbmodem..."}" value="${r}"/>
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
</html>`}};var B=b(require("vscode")),Ee=b(require("node:fs")),ue=b(require("node:path"));function Le(t){let e=JSON.parse(t),r=Array.isArray(e?.platforms)?e.platforms:[],n=[];for(let o of r){let a=String(o?.id??""),c=String(o?.installed_version??""),p=(o?.releases??{})?.[c]??null,v=Array.isArray(p?.boards)?p.boards:[];for(let M of v){let $=String(M?.name??"").trim(),G=String(M?.fqbn??"").trim();!$||!G||n.push({name:$,fqbn:G,platform:a,version:c})}}return n.sort((o,a)=>o.name.localeCompare(a.name)),n}function je(t){let e=JSON.parse(t),n=(Array.isArray(e?.installed_libraries)?e.installed_libraries:Array.isArray(e?.libraries)?e.libraries:[]).map(o=>({name:String(o?.library?.name??o?.name??"").trim(),version:String(o?.library?.version??o?.version??"").trim()||void 0,author:String(o?.library?.author??o?.author??"").trim()||void 0,sentence:String(o?.library?.sentence??o?.sentence??"").trim()||void 0})).filter(o=>o.name.length>0);return n.sort((o,a)=>o.name.localeCompare(a.name)),n}var me=class{constructor(e,r,n){this.context=e;this.output=r;this.actions=n}context;output;actions;static viewType="arduinoMcp.toolbar";view=null;state={port:null,fqbn:null,connectedPorts:[],serverRunning:!1,serverHealthy:!1,lastScanAtMs:null,serialActive:!1};setState(e){this.state=e,this.postState()}resolveWebviewView(e){this.view=e,e.title="",e.webview.options={enableScripts:!0,localResourceRoots:[B.Uri.joinPath(this.context.extensionUri,"resources")]},e.webview.html=this.html(e.webview),e.webview.onDidReceiveMessage(r=>{this.onMessage(r)}),this.postState()}postState(){this.view?.webview.postMessage({type:"state",state:this.state})}async onMessage(e){if(!e?.type)return;if(e.type==="cmd"){let n=String(e.command??"");if(!n)return;await B.commands.executeCommand(n);return}if(e.type==="list"){try{let o=await w(["lib","examples","--json"]);if(!o.success)throw new Error(o.stderr||o.stdout||"Failed to list examples");let a=ce(JSON.parse(o.stdout)),c=this.state.fqbn;if(c){let d=await w(["lib","examples","--fqbn",c,"--json"]);d.success&&(a=a.concat(ce(JSON.parse(d.stdout))))}this.view?.webview.postMessage({type:"examples",rows:Fe(a)})}catch(n){this.view?.webview.postMessage({type:"exError",error:n instanceof Error?n.message:String(n)})}return}if(e.type==="openExample"){let n=String(e.path??"").trim();if(!n)return;let o=ue.basename(n),a=ue.join(n,o+".ino"),c=null;if(Ee.existsSync(a))c=a;else try{let p=Ee.readdirSync(n).filter(v=>v.toLowerCase().endsWith(".ino"));p.length>0&&(c=ue.join(n,p[0]))}catch{}if(!c){B.window.showWarningMessage("Arduino Grease: No .ino file found in this example.");return}let d=await B.workspace.openTextDocument(B.Uri.file(c));await B.window.showTextDocument(d,{preview:!1}),await B.commands.executeCommand("workbench.action.files.setActiveEditorReadonlyInSession"),B.window.showInformationMessage("This is a read-only example. Save a copy to edit it.","Save As New Sketch").then(p=>{p==="Save As New Sketch"&&B.commands.executeCommand("workbench.action.files.saveAs")});return}let r=n=>{this.view?.webview.postMessage(n)};try{if(e.type==="updateIndexes"){this.output.appendLine("[Mngrs] Updating board and library indexes...");let n=await w(["update"]);this.output.appendLine(n.stdout),this.output.appendLine(n.stderr);let o=await w(["core","list","--json"]);if(o.success){let a=Le(o.stdout);r({type:"boards",rows:a}),this.output.appendLine(`[Mngrs] Loaded ${a.length} installed boards.`)}else r({type:"mgrError",error:"Failed. See Output > Arduino Grease."})}else if(e.type==="boardSearch"){let n=await w(["core","list","--json"]);if(!n.success){r({type:"mgrError",error:"Failed. See Output > Arduino Grease."});return}r({type:"boards",rows:Le(n.stdout),query:String(e.query??"")})}else if(e.type==="chooseTarget"){let n=String(e.fqbn??"").trim();if(!n){r({type:"mgrError",error:"Select a board first."});return}this.output.appendLine(`[Mngrs] Choosing target ${n}...`),await this.actions.chooseTarget(n)}else if(e.type==="uploadFirmwareToTarget"){let n=String(e.fqbn??"").trim();if(!n){r({type:"mgrError",error:"Select a board first."});return}this.output.appendLine(`[Mngrs] Upload firmware to target ${n}...`),await this.actions.uploadFirmwareToTarget(n)}else if(e.type==="recoveryUpload")await this.actions.recoveryUpload();else if(e.type==="libList"){this.output.appendLine("[Mngrs] Updating library index...");let n=await w(["lib","update-index"]);this.output.appendLine(n.stdout),this.output.appendLine(n.stderr);let o=await w(["lib","list","--json"]);if(!o.success){r({type:"mgrError",error:o.stderr||o.stdout});return}r({type:"libraries",rows:je(o.stdout)})}else if(e.type==="libSearch"){let n=String(e.query??"").trim(),o=await w(["lib","search",n,"--json"]);if(!o.success){r({type:"mgrError",error:o.stderr||o.stdout});return}r({type:"libraries",rows:je(o.stdout)})}else if(e.type==="libInstallSelected"){let n=String(e.name??"").trim();if(!n){r({type:"mgrError",error:"Select a library first."});return}this.output.appendLine(`[Mngrs] Installing library ${n}...`),await Re();let o=await w(["lib","install",n]);this.output.appendLine(o.stdout),this.output.appendLine(o.stderr),o.success?(B.window.showInformationMessage(`Arduino Grease: Library ${n} installed.`),this.actions.onLibraryInstalled&&await this.actions.onLibraryInstalled()):r({type:"mgrError",error:o.stderr||o.stdout})}else if(e.type==="toggleSerial")await B.commands.executeCommand("arduinoMcp.toggleSerial");else if(e.type==="libInstallGit"){let n=String(e.input??"").trim();if(!n)return;this.output.appendLine(`[Mngrs] Installing library from Github: ${n}...`);let o=`https://github.com/${n}.git`;await Re();let a=await w(["lib","install","--git-url",o]);this.output.appendLine(a.stdout),this.output.appendLine(a.stderr),a.success?(B.window.showInformationMessage(`Arduino Grease: Library ${n} installed.`),this.actions.onLibraryInstalled&&await this.actions.onLibraryInstalled()):r({type:"mgrError",error:a.stderr||a.stdout})}else if(e.type==="boardCatalogInstall"){let n=e.entry;if(!n?.installCommand){r({type:"mgrError",error:"Invalid board entry."});return}if(this.output.appendLine(`[Mngrs] Installing board platform: ${n.name}...`),n.url){let a=await w(["config","add","board_manager.additional_urls",n.url]);this.output.appendLine(a.stdout),this.output.appendLine(a.stderr),await w(["update"])}let o=await w(["core","install",n.installCommand]);if(this.output.appendLine(o.stdout),this.output.appendLine(o.stderr),!o.success)r({type:"mgrError",error:o.stderr||o.stdout});else{B.window.showInformationMessage(`Arduino Grease: ${n.name} installed.`);let a=await w(["core","list","--json"]);a.success&&r({type:"boards",rows:Le(a.stdout)}),this.actions.onBoardInstalled&&await this.actions.onBoardInstalled()}}else if(e.type==="serialOff")await this.actions.serialOff();else if(e.type==="cycleAccent"){let n=String(e.color??"#007ACC");await this.actions.cycleAccent(n)}}catch(n){let o=n instanceof Error?n.message:String(n);this.output.appendLine(`[Mngrs] Error: ${o}`),r({type:"mgrError",error:o})}}html(e){return`<!DOCTYPE html>
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
          <img class="logo-img" id="logoImg" src="${e.asWebviewUri(B.Uri.joinPath(this.context.extensionUri,"resources","icon.png"))}" draggable="false" />
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
              <a class="c-coral" id="recoveryUploadBtn" href="#" onclick="event.preventDefault()">||Recovery Upload||</a>
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
              Use &lt;IDE-Extension&gt; Arduino Grease &lt;/IDE-Extension&gt; to filter incoming A0 signals: read them via its MCP server, generate a new sketch, upload it. Check dist/SKILL.md and dist/server.mjs inside the extension folder for REST endpoints and skills. GET /state returns the current board/port. Auth key lives in ~/.grease/extension/mcp-auth.json \u2014 send it as the x-grease-auth header.
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
$("recoveryUploadBtn")?.addEventListener("click", () => vscode.postMessage({ type: "recoveryUpload" }));
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
</html>`}};var Kt="Arduino Grease";function ee(t){return new Promise(e=>setTimeout(e,t))}async function Xt(t){let e=s.window.createOutputChannel(Kt);t.subscriptions.push(e),e.appendLine("Arduino Grease activating...");let r=A.join(J.homedir(),"Documents","Grease");try{fe.mkdirSync(r,{recursive:!0})}catch{}let n=t.asAbsolutePath(A.join("resources","arduino_docs.h")),o=nt(n);t.subscriptions.push(ot(o,e));let a=s.workspace.createFileSystemWatcher("**/*.ino");a.onDidCreate(i=>{e.appendLine(`[Grease] New sketch detected: ${i.fsPath}`),s.workspace.openTextDocument(i).then(l=>s.window.showTextDocument(l,{preview:!1}),()=>{})}),t.subscriptions.push(a),s.workspace.getConfiguration().update("output.smartScroll.enabled",!1,s.ConfigurationTarget.Global).then(void 0,()=>{});let c="arduinoMcp.firstInstallDone_1_0_6";if(!t.globalState.get(c)){try{let i=s.workspace.getConfiguration("workbench");await i.update("colorTheme","Grease",s.ConfigurationTarget.Global),await i.update("activityBar.location","top",s.ConfigurationTarget.Global),e.appendLine("First install: Applied Grease theme and moved Activity Bar to top.")}catch(i){e.appendLine("First install theme setup failed: "+(i instanceof Error?i.message:String(i)))}await t.globalState.update(c,!0)}let p=s.languages.createDiagnosticCollection("arduino");t.subscriptions.push(p);let v=null,M=!1,$=!1,G=null,O=async()=>{if(v)return!0;try{return v=await kt(t,e,3333),gt(`http://127.0.0.1:${v.port}`),ft(v.authKey),e.appendLine(`Arduino Grease server started on port ${v.port}.`),!0}catch(i){return e.appendLine(`Failed to start bundled server: ${i instanceof Error?i.message:String(i)}`),!1}},I=async()=>{v&&(await v.stop(),v=null,M=!1,$=!1,e.appendLine("Arduino Grease server stopped."))};await O();{let i=await w(["version"]);if(!i.success&&(i.stderr?.includes("ENOENT")||i.exitCode===null)){let l=J.platform()==="win32"?"Run: winget install ArduinoSA.ArduinoCLI":J.platform()==="darwin"?"Run: brew install arduino-cli":"Run: curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh";await s.window.showWarningMessage(`Arduino Grease: arduino-cli not found on PATH. ${l} \u2014 then restart your IDE.`,"Open Install Guide")==="Open Install Guide"&&s.env.openExternal(s.Uri.parse("https://arduino.github.io/arduino-cli/latest/installation/"))}}t.subscriptions.push({dispose:()=>{I()}});let k=s.window.createStatusBarItem(s.StatusBarAlignment.Left,100);k.name="Arduino Grease Target",k.command="arduinoMcp.refreshPortsBoards",k.show(),t.subscriptions.push(k);let _=new Me(e),Lt=new Ae(e),Et=new ke(t,e),Tt=new Ce(t),R=[],m=null,z=new me(t,e,{chooseTarget:async i=>{let l=i.split(":").slice(0,2).join(":"),u=R.find(g=>g.fqbn?.startsWith(l+":")&&typeof g.port=="string")??R.find(g=>g.port===m?.port)??R.find(g=>typeof g.port=="string")??null,h=u?.port??m?.port??null,y=u??(h?R.find(g=>g.port===h):null),S=be(y??null);if(S.length>0){let g=await ve(t);for(let x of S)g[x]={fqbn:i};await Oe(t,g),e.appendLine(`[BoardMemory] Saved (${S.join(", ")}) \u2192 ${i}`)}else h&&e.appendLine(`[BoardMemory] Warning: no identifiers found for ${h} \u2014 memory not saved`);m={port:h,fqbn:i,userChosen:!0},await N(t,m),await W(m),h?re(m):(Be(`${i} \u2014 no port`),s.window.showInformationMessage(`Arduino Grease: Board type set to ${i}. Connect the board and use Recovery Upload.`)),L()},recoveryUpload:async()=>{await s.commands.executeCommand("arduinoMcp.recoveryUpload")},uploadFirmwareToTarget:async i=>{let l=m?.port??R[0]?.port??null;if(!l){s.window.showWarningMessage("Arduino Grease: No port detected. Connect a board first.");return}m={port:l,fqbn:i,userChosen:!0},await N(t,m),await W(m),re(m),L(),await It(i,l)},serialOff:async()=>{_.isConnected&&(await _.stop(),e.appendLine("Serial disconnected (panel switch)."),L())},cycleAccent:async i=>{let l=s.workspace.getConfiguration("workbench"),h={...l.get("colorCustomizations")||{},"statusBar.background":i,"statusBar.noFolderBackground":i,"statusBar.debuggingBackground":i,"statusBarItem.remoteBackground":i,focusBorder:i,"activityBarBadge.background":i,"panelTitle.activeBorder":i},y=s.workspace.workspaceFolders&&s.workspace.workspaceFolders.length>0?s.ConfigurationTarget.Workspace:s.ConfigurationTarget.Global;await l.update("colorCustomizations",h,y),e.appendLine(`Accent color set to ${i} (Target: ${y===s.ConfigurationTarget.Workspace?"Workspace":"Global"})`),L()},onBoardInstalled:async()=>{await oe()}});t.subscriptions.push(s.window.registerWebviewViewProvider(me.viewType,z));let te=new Set,Z=null,Ue=0,Te=!1;m=null,await W(null);let L=()=>{let l=s.workspace.getConfiguration("workbench").get("colorCustomizations")||{};z.setState({port:m?.port??null,fqbn:m?.fqbn??null,connectedPorts:Array.from(te),serverRunning:v!==null,serverHealthy:M,lastScanAtMs:G,serialActive:_.isConnected,uploading:!!Z?.uploading,accentColor:l["statusBar.background"]||"#007ACC"})},Be=i=>{k.text=`$(warning) ${i}`,k.backgroundColor=new s.ThemeColor("statusBarItem.warningBackground"),k.tooltip="Arduino Grease needs a board/port selection"},re=i=>{i.fqbn&&i.port?(k.text=`$(circuit-board) ${i.fqbn} @ ${i.port}`,k.backgroundColor=void 0,k.tooltip="Arduino Grease target"):i.fqbn&&!i.port?(k.text=`$(circuit-board) ${i.fqbn} \u2014 Recovery mode`,k.backgroundColor=new s.ThemeColor("statusBarItem.warningBackground"),k.tooltip="Board type set, no port detected. Use Recovery Upload."):(k.text=`$(plug) ${i.port} (board unknown)`,k.backgroundColor=new s.ThemeColor("statusBarItem.warningBackground"),k.tooltip="Port detected but board not resolved. Use 'arduino-cli board list' and 'arduino-cli core install <package>' to install the correct driver.")},Y=async(i=!1)=>{if(!v){M=!1,L();return}try{let u=await(await fetch(`http://127.0.0.1:${v.port}/state`,{headers:{"x-grease-auth":v.authKey}})).json(),h=!!u.target;M=h;let y=Z?.uploading||Z?.compiling||Z?.serial?.isOpen;u.uploading||u.compiling||u.serial?.isOpen||u.agentActive?z.view?.webview.postMessage({type:"rainState",state:"thrust"}):y&&z.view?.webview.postMessage({type:"rainState",state:"idle"}),Z=u,typeof u.portChangeVersion=="number"&&u.portChangeVersion!==Ue&&(Ue=u.portChangeVersion,u.uploading||oe()),h?$&&(e.appendLine("Grease Server recovered."),$=!1):(e.appendLine("Problem with Grease Server"),$=!0),i&&e.appendLine(`Server status: ${h?"running and healthy":"running but unhealthy"}`)}catch(l){M=!1,e.appendLine("Problem with Grease Server"),i&&e.appendLine(`Server health check failed: ${l instanceof Error?l.message:String(l)}`),$=!0}L()},ne=new Set,oe=async()=>{G=Date.now(),R=(await ae(e)).candidates;let l=new Set(R.map(f=>f.port).filter(f=>typeof f=="string")),u=l.size!==te.size||Array.from(l).some(f=>!te.has(f))||Array.from(te).some(f=>!l.has(f));te=l,u&&ne.clear(),m?.port&&!l.has(m.port)&&(e.appendLine(`Port ${m.port} disconnected. Clearing selected target.`),m=null,await N(t,null),await W(null));let h=await ve(t),y=R.map(f=>{for(let C of be(f))if(h[C]){let P=`${f.port}:${C}:${h[C].fqbn}`;return ne.has(P)||(e.appendLine(`[BoardMemory] Restored ${h[C].fqbn} for ${f.port} via ${C}`),ne.add(P)),{...f,fqbn:h[C].fqbn,fromMemory:!0}}return f}),S=new Map;for(let f of y){if(typeof f.port!="string")continue;let C=S.get(f.port);(!C||!C.fromMemory&&f.fromMemory)&&S.set(f.port,f)}let g=Array.from(S.values()),x=g.filter(f=>typeof f.fqbn=="string"&&typeof f.port=="string"),T=g.filter(f=>!f.fqbn&&typeof f.port=="string");if(!m?.userChosen&&x.length===1){let f=x[0],C=f.fromMemory;if(m={port:f.port,fqbn:f.fqbn,userChosen:!1},C){let P=`auto:${f.fqbn}:${f.port}`;ne.has(P)||(e.appendLine(`[BoardMemory] Restored ${f.fqbn} for ${De(f.vid,f.pid)??f.port}`),ne.add(P))}await N(t,m),await W(m)}else!m?.userChosen&&x.length===0&&T.length===1&&(m={port:T[0].port,fqbn:null},await N(t,m),await W(m));if(!m)l.size===0?(Be("No serial ports detected"),u&&e.appendLine("No Arduino port detected.")):Be("Select board/port");else if(re(m),u&&e.appendLine(`Port ${m.port} and Board ${m.fqbn??"unknown"} detected.`),m.fqbn&&u){let f=Ke(m.fqbn);if(f){if(await Xe(f))e.appendLine(`Board core ${f} is already installed.`);else if(await s.window.showInformationMessage(`Arduino Grease: Board core "${f}" is not installed. Would you like me to install the driver for this board?`,"Install","Cancel")==="Install"){e.appendLine(`Installing board core ${f}...`);let D=await $e();e.appendLine(D.stdout),e.appendLine(D.stderr);let se=await Ie(f);e.appendLine(se.stdout),e.appendLine(se.stderr),se.success?s.window.showInformationMessage(`Arduino Grease: Board core ${f} installed successfully.`):s.window.showErrorMessage(`Arduino Grease: Failed to install board core ${f}. See Output.`)}}}L()},We=async()=>{if(!Te){Te=!0,e.show(!0);try{R=(await ae(e)).candidates;let l=await tt(t,R,m);l&&(m={...l,userChosen:!0},await W(m),re(m),L())}finally{Te=!1}}},Bt=async()=>{let i=pt();return i?we(i)?i:(e.appendLine(`Invalid sketch folder (main .ino missing): ${i}`),await s.window.showWarningMessage("Arduino Grease: Current folder is not a valid sketch (missing main .ino).","Start Sketch","Cancel")==="Start Sketch"&&await s.commands.executeCommand("arduinoMcp.startSketch"),null):null},He=async()=>{let i=dt();if(i){let h=ct(i);if(h)return h;e.appendLine(`[verify] Could not stage active sketch: ${i}`)}let l=await Bt();if(!l)return null;let u=we(l);return u?{sketchDir:l,mainIno:u,isTemp:!1}:null},Pt=(i,l)=>{if(!l.isTemp||!l.originalDir)return i;let u=A.normalize(i),h=A.normalize(l.sketchDir);if(!u.startsWith(h))return i;let y=A.relative(h,u);return l.originalIno&&A.basename(y).toLowerCase()===A.basename(l.mainIno).toLowerCase()&&A.dirname(y)==="."?l.originalIno:A.join(l.originalDir,y)},ze=async i=>{e.show(!0);let l=await He();if(!l)return s.window.showErrorMessage("Arduino Grease: No .ino file open or valid sketch folder found."),{ok:!1};let u=l.sketchDir,h=i??m?.fqbn??null;if(!h)return await s.window.showWarningMessage("Arduino Grease: Board unknown. Install/select a core so an FQBN is available.","Install core...","Select board/port...")==="Install core..."?await s.commands.executeCommand("arduinoMcp.installCore"):await s.commands.executeCommand("arduinoMcp.refreshPortsBoards"),{ok:!1};let y=l.isTemp?l.originalIno:u;e.appendLine(`Compiling "${y}"...`),l.isTemp&&e.appendLine(`  (staged into temp sketch folder: ${u} \u2014 original folder name '${A.basename(l.originalDir)}' doesn't match .ino basename '${A.basename(l.mainIno,".ino")}')`);let S;try{S=await vt(u)}catch{return s.window.showErrorMessage("Arduino Grease: Compile failed \u2014 server unreachable."),{ok:!1}}if(e.appendLine(S.stdout??""),e.appendLine(S.stderr??""),!S.ok){let g=new Map,x=/^(.+):([0-9]+):([0-9]+):\s*(error|warning):\s*(.+)$/gm,T,f=S.stdout+`
`+S.stderr;for(;(T=x.exec(f))!==null;){let C=Pt(T[1],l),P=Math.max(0,parseInt(T[2],10)-1),D=Math.max(0,parseInt(T[3],10)-1),se=T[4]==="error"?s.DiagnosticSeverity.Error:s.DiagnosticSeverity.Warning,Dt=T[5],_t=new s.Range(P,D,P,D+1),Ne=new s.Diagnostic(_t,Dt,se);Ne.source="Arduino Grease";let Pe=s.Uri.file(C).toString();g.has(Pe)||g.set(Pe,[]),g.get(Pe).push(Ne)}p.clear();for(let[C,P]of g)p.set(s.Uri.parse(C),P);return s.window.showErrorMessage("Arduino Grease: Verify failed (see Output)."),{ok:!1,prepared:l}}return p.clear(),s.window.showInformationMessage("Arduino Grease: Verify succeeded."),{ok:!0,sketchPath:u,fqbn:h,prepared:l}},$t=async i=>{e.show(!0),await s.workspace.saveAll(!1);let l=null,u=i?.fqbnOverride??m?.fqbn??null;if(i?.verifyFirst!==!1){let x=await ze(u??void 0);if(!x.ok)return!1;l=x.prepared??null,u=x.fqbn??u}else l=await He();if(!l)return s.window.showErrorMessage("Arduino Grease: No .ino file to upload."),!1;let h=l.sketchDir;if(!(i?.portOverride??m?.port??null))return s.window.showWarningMessage("Arduino Grease: Select a port first."),await s.commands.executeCommand("arduinoMcp.refreshPortsBoards"),!1;if(!u)return s.window.showWarningMessage("Arduino Grease: Select a board first."),await s.commands.executeCommand("arduinoMcp.refreshPortsBoards"),!1;let S=l.isTemp?l.originalIno:h;e.appendLine(`Uploading "${S}"...`);let g;try{g=await bt(h)}catch{return s.window.showErrorMessage("Arduino Grease: Upload failed \u2014 server unreachable."),!1}return e.appendLine(g.stdout??""),e.appendLine(g.stderr??""),z.view?.webview.postMessage({type:"uploadResult",success:g.ok}),g.ok?(s.window.showInformationMessage("Arduino Grease: Upload succeeded."),!0):(s.window.showErrorMessage("Arduino Grease: Upload failed (see Output)."),!1)},It=async(i,l)=>{e.show(!0);let u=await s.window.showInputBox({title:"Programmer",prompt:"Enter programmer (e.g., avrispmkii, usbtinyisp) or leave empty for default",ignoreFocusOut:!1});if(u===void 0)return;e.appendLine(`[Mngrs] Burning bootloader for ${i} on ${l}...`);let h=["burn-bootloader","-b",i,"-p",l];u&&h.push("-P",u);try{await _e()}catch{}let y=await w(h);try{await qe()}catch{}if(e.appendLine(y.stdout),e.appendLine(y.stderr),!y.success){s.window.showErrorMessage("Arduino Grease: Burn bootloader failed (see Output).");return}s.window.showInformationMessage("Arduino Grease: Bootloader burned to target.")};await oe(),await ee(3e3),await Y(!0);let Rt=setInterval(()=>{Y(!1)},500);t.subscriptions.push({dispose:()=>clearInterval(Rt)});let Ot=setInterval(()=>{Z?.uploading||oe()},5e3);t.subscriptions.push({dispose:()=>clearInterval(Ot)}),t.subscriptions.push(s.commands.registerCommand("arduinoMcp.serverStatus",async()=>{if(e.show(!0),e.appendLine("Checking MCP server status..."),!v){e.appendLine("Server status: stopped"),M=!1,L();return}await Y(!0)}),s.commands.registerCommand("arduinoMcp.refreshServer",async()=>{if(e.show(!0),!v){await O(),await ee(1e3),await Y(!0);return}if(v&&!M){await I(),await ee(1e3),await O(),await ee(1e3),await Y(!0);return}v&&M&&(await I(),L())}),s.commands.registerCommand("arduinoMcp.startServer",async()=>{e.show(!0),await O()&&(await Y(!0),e.appendLine("Server start command completed.")),L()}),s.commands.registerCommand("arduinoMcp.stopServer",async()=>{e.show(!0),await I(),L()}),s.commands.registerCommand("arduinoMcp.toggleServer",async()=>{e.show(!0),v?await I():(await O(),await Y(!0)),L()}),s.commands.registerCommand("arduinoMcp.startSketch",async()=>{e.show(!0);let i=await s.window.showInputBox({title:"Start new sketch",prompt:"Sketch name",placeHolder:"BlinkNano33",ignoreFocusOut:!1,validateInput:x=>{let T=x.trim();return T?/^[A-Za-z0-9_\-]+$/.test(T)?null:"Use only letters, numbers, underscore, or dash.":"Sketch name is required."}});if(!i)return;let l=s.Uri.file(r),u=await s.window.showOpenDialog({canSelectFiles:!1,canSelectFolders:!0,canSelectMany:!1,defaultUri:l,openLabel:"Create Sketch Here",title:"Choose parent folder"});if(!u?.[0])return;let h=u[0].fsPath,y=A.join(h,i.trim());e.appendLine(`$ arduino-cli sketch new "${y}"`);let S=await w(["sketch","new",y]);if(e.appendLine(S.stdout),e.appendLine(S.stderr),!S.success){s.window.showErrorMessage("Arduino Grease: Failed to create sketch. See output.");return}let g=A.join(y,`${i.trim()}.ino`);try{let x=await s.workspace.openTextDocument(s.Uri.file(g));await s.window.showTextDocument(x,{preview:!1})}catch(x){e.appendLine(`Could not open sketch file automatically: ${x instanceof Error?x.message:String(x)}`)}e.appendLine(`Sketch created: ${y}`),s.window.showInformationMessage(`Arduino Grease: Sketch created (${i.trim()}).`)}),s.commands.registerCommand("arduinoMcp.installCore",async()=>{e.show(!0);let i=[{label:"Arduino AVR (Uno/Nano/Mega)",description:"arduino:avr",pkg:"arduino:avr"},{label:"Arduino SAMD (Nano 33 IoT, MKR)",description:"arduino:samd",pkg:"arduino:samd"},{label:"Arduino Mbed OS (Nano 33 BLE, Portenta)",description:"arduino:mbed",pkg:"arduino:mbed"},{label:"ESP32",description:"esp32:esp32",pkg:"esp32:esp32"},{label:"RP2040",description:"rp2040:rp2040",pkg:"rp2040:rp2040"}],l=await s.window.showQuickPick(i,{title:"Install board core",placeHolder:"Pick a core package",ignoreFocusOut:!1});if(!l)return;let u=await $e();e.appendLine(u.stdout),e.appendLine(u.stderr);let h=await Ie(l.pkg);e.appendLine(h.stdout),e.appendLine(h.stderr),h.success?(s.window.showInformationMessage(`Arduino Grease: Core installed: ${l.pkg}.`),await oe()):s.window.showErrorMessage(`Arduino Grease: Core install failed for ${l.pkg}.`)}),s.commands.registerCommand("arduinoMcp.verify",async()=>{let i=await ze();z.view?.webview.postMessage({type:"verifyResult",success:i.ok===!0})}),s.commands.registerCommand("arduinoMcp.upload",async()=>{let i=await $t({verifyFirst:!0});z.view?.webview.postMessage({type:"uploadResult",success:i===!0})}),s.commands.registerCommand("arduinoMcp.refreshPortsBoards",async()=>{await We()}),s.commands.registerCommand("arduinoMcp.selectTarget",async()=>{await We()}),s.commands.registerCommand("arduinoMcp.toggleSerial",async()=>{_.isConnected?await _.stop():await s.commands.executeCommand("arduinoMcp.openSerialMonitor"),L()}),s.commands.registerCommand("arduinoMcp.openSerialMonitor",async()=>{e.show(!0);let i=m?.port??R[0]?.port??null;await _.start(i,9600),e.appendLine(`Type "baud=X" to set a new baud rate, or try any of the following commands: 'send="Hello World"', "clear", "disconnect", or "connect". Transmitting from ${i??"(unknown port)"} below:`)}),s.commands.registerCommand("arduinoMcp.serialCommand",async()=>{e.show(!0);let i=await s.window.showInputBox({title:"Serial command",prompt:"Enter serial command",placeHolder:'baud=9600 | send="Hello World" | clear | disconnect | connect',ignoreFocusOut:!1});i&&await _.handleConsoleCommand(i)}),s.commands.registerCommand("arduinoMcp.openSerialPlotter",async()=>{e.show(!0);let i=m?.port??R[0]?.port??null;Lt.show(i,!0),!_.isConnected&&i&&_.start(i,9600),setTimeout(()=>{s.commands.executeCommand("workbench.action.moveEditorToNewWindow")},500),L()}),s.commands.registerCommand("arduinoMcp.openExamples",async()=>{e.show(!0),_.isConnected&&(await _.stop(),e.appendLine("Serial disconnected (Examples panel opened)."),L()),Et.show(m?.fqbn??null)}),s.commands.registerCommand("arduinoMcp.openBoardTemplate",async()=>{e.show(!0),Tt.show({fqbn:m?.fqbn??null,port:m?.port??null})}),s.commands.registerCommand("arduinoMcp.cycleAccentColor",async()=>{let i=["#005FA0","#6B0000","#A34300","#8F6809","#6B004A","#520A85","#004D00"],l=s.workspace.getConfiguration("workbench"),u=l.get("colorCustomizations")||{},h=u["statusBar.background"]||"#007ACC",S=(i.indexOf(h)+1)%i.length,g=i[S],x={...u,"statusBar.background":g,"statusBar.noFolderBackground":g,"statusBar.debuggingBackground":g,"statusBarItem.remoteBackground":g,focusBorder:g,"activityBarBadge.background":g,"panelTitle.activeBorder":g},T=s.workspace.workspaceFolders&&s.workspace.workspaceFolders.length>0?s.ConfigurationTarget.Workspace:s.ConfigurationTarget.Global;await l.update("colorCustomizations",x,T),e.appendLine(`Accent color cycled to ${g} (Target: ${T===s.ConfigurationTarget.Workspace?"Workspace":"Global"})`),L(),z.view?.webview.postMessage({type:"accentColor",color:g})}),s.commands.registerCommand("arduinoMcp.recoveryUpload",async()=>{if(!m?.fqbn){s.window.showWarningMessage("Arduino Grease: Pick a board from the Managers panel first.");return}let i=m.fqbn,l=A.join(J.tmpdir(),"grease-recovery","Blink");fe.mkdirSync(l,{recursive:!0}),fe.writeFileSync(A.join(l,"Blink.ino"),`void setup() { pinMode(LED_BUILTIN, OUTPUT); }
void loop() {
  digitalWrite(LED_BUILTIN, HIGH); delay(500);
  digitalWrite(LED_BUILTIN, LOW);  delay(500);
}
`),s.window.showInformationMessage("Arduino Grease: Double-tap RESET on your board now. Watching 10 seconds for bootloader port..."),e.appendLine("[Recovery] Watching for bootloader port (10s)...");let u=new Set(R.map(C=>C.port).filter(Boolean)),h=1e4,y=500,S=Date.now()+h,g=null;for(;Date.now()<S;){await ee(y);let P=(await ae(e)).candidates.map(D=>D.port).find(D=>typeof D=="string"&&!u.has(D));if(P){g=P;break}}if(!g){s.window.showWarningMessage("Arduino Grease: No bootloader port appeared within 10 seconds."),e.appendLine("[Recovery] Timed out \u2014 no new port detected.");return}e.appendLine(`[Recovery] Bootloader port found: ${g}. Uploading blink sketch...`);try{await _e()}catch{}let x=await w(["upload","-b",i,"-p",g,l]);try{await qe()}catch{}if(e.appendLine(x.stdout),e.appendLine(x.stderr),!x.success){s.window.showErrorMessage("Arduino Grease: Recovery upload failed (see Output).");return}m={port:g,fqbn:i,userChosen:!0},await N(t,m),await W(m),re(m),L(),await ee(1500);let T=await ae(e);R=T.candidates;let f=T.candidates.find(C=>C.port===g);if(f){let C=be(f);if(C.length>0){let P=await ve(t);for(let D of C)P[D]={fqbn:i};await Oe(t,P),e.appendLine(`[Recovery] BoardMemory saved (${C.join(", ")}) \u2192 ${i}`)}}s.window.showInformationMessage(`Arduino Grease: Recovery successful. Board is live on ${g}.`)})),L(),e.appendLine("Arduino Grease activated.")}function Jt(){}0&&(module.exports={activate,deactivate});
