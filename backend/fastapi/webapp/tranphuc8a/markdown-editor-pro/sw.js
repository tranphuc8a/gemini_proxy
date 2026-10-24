/* ==========================================================================
   sw.js - Markdown Editor Pro keeps working with no network once installed.

   This file is a TEMPLATE. `scripts/make-sw.mjs` runs after `vite build`, fills in the two
   placeholders on the `var BUILD` and `var PRECACHE` lines below, and writes the result to dist/sw.js.
   Filling in the build id is what makes the browser see a new worker after every deploy (it compares
   sw.js byte for byte).

   It must sit at the ROOT of the app folder: a worker's scope is the folder that holds it.

   The invariant that matters most: the worker only touches GET requests below its own scope. The API
   (/api/v1/markdown/..., /api/v1/ai/...) lives outside it, and a server on another origin is ignored, so
   a stale saved copy can never be served for a sync call and then overwrite the shared store.
   Offline, API calls fail for real, which is what the editor expects.

   Strategy:
   * install   - save the page plus EVERY file the build emitted (js, css, woff2, icons). Mermaid, PDF
                 export and syntax highlighting are lazy chunks the page never lists, so saving only what
                 index.html mentions would leave those features dead offline. A file that an earlier build
                 already saved under the same (hashed) name is copied over, not downloaded again.
   * assets/*  - hashed and immutable: saved copy first, network only to fill a gap.
   * the rest  - network first, saved copy when offline or when the network hangs past NETWORK_WAIT_MS.
   ========================================================================== */
"use strict";

var BUILD = "a2f61290ac55";
var PRECACHE = ["assets/KaTeX_AMS-Regular-BQhdFMY1.woff2","assets/KaTeX_Caligraphic-Bold-Dq_IR9rO.woff2","assets/KaTeX_Caligraphic-Regular-Di6jR-x-.woff2","assets/KaTeX_Fraktur-Bold-CL6g_b3V.woff2","assets/KaTeX_Fraktur-Regular-CTYiF6lA.woff2","assets/KaTeX_Main-Bold-Cx986IdX.woff2","assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2","assets/KaTeX_Main-Italic-NWA7e6Wa.woff2","assets/KaTeX_Main-Regular-B22Nviop.woff2","assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2","assets/KaTeX_Math-Italic-t53AETM-.woff2","assets/KaTeX_SansSerif-Bold-D1sUS0GD.woff2","assets/KaTeX_SansSerif-Italic-C3H0VqGB.woff2","assets/KaTeX_SansSerif-Regular-DDBCnlJ7.woff2","assets/KaTeX_Script-Regular-D3wIWfF6.woff2","assets/KaTeX_Size1-Regular-mCD8mA8B.woff2","assets/KaTeX_Size2-Regular-Dy4dx90m.woff2","assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2","assets/KaTeX_Typewriter-Regular-CO6r4hn1.woff2","assets/SharePage-DQVEblJt.css","assets/SharePage-DqC2Dc2V.js","assets/abap-C1aVpbp_.js","assets/abnf-40Fo_Vtj.js","assets/abnfDiagram-VCTEODGH-Ms6_gJmM.js","assets/actionscript-DOL57wfo.js","assets/ada-CulH8oqI.js","assets/agda-uS3zBbvL.js","assets/al-DCOMDDak.js","assets/antlr4-XraleXvN.js","assets/apacheconf-D72xpb2t.js","assets/apex-Bk89eWsX.js","assets/apl-D1-3En04.js","assets/applescript-CMxJz5BX.js","assets/aql-vMdHpWig.js","assets/arc-Pry-7G1_.js","assets/architecture-7GRP2DOG-DIEQtAzS.js","assets/architectureDiagram-5GKGNRK7-DL3QLB_w.js","assets/arduino-HHhHHuwz.js","assets/arff-DrptKHcu.js","assets/armasm-BrfBtT9v.js","assets/array-BifhSqXX.js","assets/arturo-CXbgK3GJ.js","assets/asciidoc-DDXwstOS.js","assets/asm6502-CRL1W035.js","assets/asmatmel-BI-S8lDS.js","assets/aspnet-BVxNpN6H.js","assets/autohotkey-NKYlqafD.js","assets/autoit-XLsjApYF.js","assets/avisynth-CHXSu3lG.js","assets/avro-idl-9kRV7bUR.js","assets/awk-q4YWlkWR.js","assets/bash-4sOSYtlG.js","assets/basic-CX1PCMAh.js","assets/batch-ExsvRcTe.js","assets/bbcode-D6OMWDTq.js","assets/bbj-CGdFgIN6.js","assets/bicep-BgiflvoR.js","assets/birb-9MIj_l2S.js","assets/bison-PTLn5HWZ.js","assets/blockDiagram-I7D4REHJ-ClLV3lHH.js","assets/bnf-C0XyL7NM.js","assets/bqn-CAmdIE_e.js","assets/brainfuck-CIuPsdNI.js","assets/brightscript-z9kOOoxM.js","assets/bro-rdG3ka22.js","assets/bsl-CD2CmxFZ.js","assets/c-O68t_gYn.js","assets/c4Diagram-7LVT6UL2-CXH9xN30.js","assets/cfscript-BNcLXDpm.js","assets/chaiscript-CWp-BysO.js","assets/channel-BzMLSy9w.js","assets/chunk-2Q5K7J3B-C1jixKkw.js","assets/chunk-4HAMMTFA-CznbkyRx.js","assets/chunk-5VM5RSS4-ZNzvKenW.js","assets/chunk-75Z2AOVW-BoM5cIA3.js","assets/chunk-DU6HZSFF-BL5C2QGf.js","assets/chunk-F27PBJKO-rn8jK1lb.js","assets/chunk-FOHPRMQF-CoA4358r.js","assets/chunk-GMAD6QVW-bJZgQR3m.js","assets/chunk-GVQU2GXP-mLKgMKkV.js","assets/chunk-IMKFNOWR-DWABmnnj.js","assets/chunk-JWPE2WC7-DVXcaiue.js","assets/chunk-L3NEJ4N5-CiWr4_3X.js","assets/chunk-OSK3NFVY-B5Grw_-z.js","assets/chunk-P2QGCYS3-C7gBJE-I.js","assets/chunk-POPQ4Y6H-D2uTD1Qg.js","assets/chunk-PWAF6VOD-k5pTNULP.js","assets/chunk-SHT3W25Y-C0gdq5Yx.js","assets/chunk-SVP7TREG-85aDfTux.js","assets/chunk-TICWLB2K-DY2_S5sS.js","assets/chunk-XXDRQBXY-DqAYeljN.js","assets/chunk-Y2CYZVJY-DsF7k-Jl.js","assets/cil-B8_gfQ5d.js","assets/cilkc-B8wCqFcY.js","assets/cilkcpp-BmXlBGe4.js","assets/classDiagram-ZZMXUADV-D6tcOsIj.js","assets/classDiagram-v2-VYDZK3BY-D6tcOsIj.js","assets/clike-uIxolCJw.js","assets/clojure-Cal39ug-.js","assets/cmake-CjNjy5sG.js","assets/cobol-DOV3u-Ty.js","assets/coffeescript-Uw_84LZ_.js","assets/concurnas-BBlql4Uj.js","assets/cooklang-CudJKlCU.js","assets/coq-CK0VuwP0.js","assets/core-Dfo0SdhN.js","assets/cose-bilkent-JH36ORCC-CVh1icwb.js","assets/cpp-DMwdw9_-.js","assets/crystal-CfNUyyvD.js","assets/csharp-iSavxb6g.js","assets/cshtml-CASV7GJD.js","assets/csp-D_cTitSG.js","assets/css-BLUnUyF9.js","assets/css-extras-BUKTif8p.js","assets/csv-DeoZPBvg.js","assets/cue-nEhSTQ5F.js","assets/cynefin-OW5HDTMX-CEfJrCtH.js","assets/cynefinDiagram-5FMLGOSQ-Z1vTveKQ.js","assets/cypher-Bp-c8qFh.js","assets/cytoscape.esm-c2aL46s-.js","assets/d-In6pUZOf.js","assets/dagre-C-rnJpZF.js","assets/dagre-GXQ25YYZ-M1kcBwJR.js","assets/dart-CauNBTFQ.js","assets/dataweave-CZbfBwNi.js","assets/dax-CKB8QRdy.js","assets/defaultLocale-BFoDCU3G.js","assets/dhall-85OdaVgO.js","assets/diagram-S7CK7UJ4-D58IuQpo.js","assets/diagram-UQ7AKVKN-DS0btkpT.js","assets/diagram-VSXAHHWV-Orzeufg8.js","assets/diagram-VX7I27RA-B5b2TWyN.js","assets/diagram-Z3DM3KII-CLyva_p8.js","assets/diff-CnVbg4kZ.js","assets/dist-v5Q1xZ2K.js","assets/django-CHOsY1_o.js","assets/dns-zone-file-DIw4tGE3.js","assets/docker-C_eDFnUW.js","assets/dot-Cte5oIpV.js","assets/ebnf-L8SoqwZ8.js","assets/ebnfDiagram-PWID7BFC-ZLX4xy02.js","assets/editorconfig-XJ0zNcNf.js","assets/eiffel-C7SR1lph.js","assets/ejs-CPEs4CEO.js","assets/elixir-DLp7SwIK.js","assets/elm-CnpgxzWV.js","assets/erDiagram-RLTQ6QDP-BLAyhpvL.js","assets/erb-CsEEnCf3.js","assets/erlang-DFlnBev6.js","assets/etlua-BuAEq7ff.js","assets/eventmodeling-NTZA5JFV-FW1OaY-u.js","assets/excel-formula-BXhYwmBR.js","assets/factor-CTBqOjKA.js","assets/false-D4D70b-Z.js","assets/firestore-security-rules--je0fu7A.js","assets/flow-C-1Uw1N1.js","assets/flowDiagram-HODETNUW-Z0i0advP.js","assets/fortran-CRREqS6m.js","assets/fsharp-BNIFeyjb.js","assets/ftl-Bulzttrg.js","assets/ganttDiagram-EL5Y4UJY-CabJmgWg.js","assets/gap-CtLis1Xu.js","assets/gcode-BXEcl5qa.js","assets/gdscript-DQmNHg50.js","assets/gedcom-C5YFAf6D.js","assets/gettext-BaPu7_e8.js","assets/gherkin-ClajUNSI.js","assets/git-BASw3ufu.js","assets/gitGraph-4MIJSDKK-pix2OaXp.js","assets/gitGraphDiagram-WWUBYQGX-DdJo4BNc.js","assets/glsl-DqWpsMK-.js","assets/gml-DHddCZtI.js","assets/gn-wwd7v58L.js","assets/go-BzkVnXfq.js","assets/go-module-BEI50IkE.js","assets/gradle-BeXG6pWK.js","assets/graphlib-DS17s2tU.js","assets/graphql-yR0KZn6_.js","assets/groovy-BNk9U2r6.js","assets/haml-_mv6jnyw.js","assets/handlebars-CGDiHX2N.js","assets/haskell-fbSFjs_d.js","assets/haxe-DD6vPlAt.js","assets/hcl-BVMyo2BJ.js","assets/hlsl-BQ9D-HvS.js","assets/hoon-CUqn1Uky.js","assets/hpkp-CZL65u9s.js","assets/hsts-ex6XpwRW.js","assets/html2canvas-Cm_vP64m.js","assets/http-D4oga4du.js","assets/ichigojam-Di1Ns6X_.js","assets/icon-Dzyu6qEV.js","assets/icu-message-format-Dx59rolq.js","assets/idris-DHAJW6jN.js","assets/iecst-Dp4yaA1l.js","assets/ignore-C5N49Roq.js","assets/index-BnoVxS-6.js","assets/index-D7brvA97.css","assets/index.es-CXKky28S.js","assets/info-A6RAGUB7-BiX0t5fu.js","assets/infoDiagram-27XIBGKW-CCsdIJD5.js","assets/inform7-hBjdaCQN.js","assets/ini-_H0-Wnh8.js","assets/init-C-OQMol4.js","assets/io-6xqbEpcP.js","assets/ishikawaDiagram-5VMMS53U-BEP7v7rt.js","assets/j-DQt7bR4l.js","assets/java-D62mCkGJ.js","assets/javadoc-BYIAEqLm.js","assets/javadoclike-BBI20IT2.js","assets/javascript-Ckm84pHf.js","assets/javastacktrace-BjbuPutP.js","assets/jexl-DbkIzZKC.js","assets/jolie-CneHJTtS.js","assets/journeyDiagram-3NMN7TZE-WzZha4lw.js","assets/jq-BmCy6E6o.js","assets/js-extras-CWeNWCgr.js","assets/js-templates-De3TbPJ6.js","assets/jsdoc-QzW-vDUZ.js","assets/json-B02E3pk2.js","assets/json5-BkFQEBcI.js","assets/jsonp-5kZSLV4l.js","assets/jspdf.es.min-B3DuMbfU.js","assets/jsstacktrace-DwWA-I7r.js","assets/jsx-opE8CVQV.js","assets/julia-m-tue8zV.js","assets/kanban-definition-UXKFOSKX-BE39kfIQ.js","assets/keepalived-fDo2-RHG.js","assets/keyman-CJcnrxrj.js","assets/kotlin-E3O-ABdy.js","assets/kumir-CtNudeVI.js","assets/kusto-De8KKPxY.js","assets/latex-euonHM-l.js","assets/latte-BKXueKyF.js","assets/less-DZtXz-rP.js","assets/lilypond-C-fbis9c.js","assets/line-e3s1Y57P.js","assets/linear-SzVmGSw4.js","assets/linker-script-XTh_UVOA.js","assets/liquid-Dimf0C7r.js","assets/lisp-Im1BsEoa.js","assets/livescript-Bc5OVJRm.js","assets/llvm-BML3FRzH.js","assets/log-CZXGB4zT.js","assets/lolcode-CfMr6tZs.js","assets/lua-Dl7axvik.js","assets/magma-9lzosfcB.js","assets/makefile-C7Vj606s.js","assets/markdown-BorAY7qD.css","assets/markdown-DXbxDm-S.js","assets/markdown-Dog5XVNi.js","assets/markup-CQbyB_E0.js","assets/markup-templating-D1SaRNMd.js","assets/mata-Dc5rk9nS.js","assets/matlab-BQyvBoSn.js","assets/maxscript-C-5mgloj.js","assets/mel-6r1HqpkP.js","assets/mermaid-Cke4m_Cz.js","assets/mermaid-parser.core-ihTUt4vT.js","assets/mermaid.core-DB89C9el.js","assets/metafont-CgGUclsg.js","assets/mindmap-definition-YA3MSWOX-mv7USqjL.js","assets/mizar-B6Z6M1Ed.js","assets/mongodb-IR-MXxan.js","assets/monkey-es2e915U.js","assets/moonscript-Diqag_n2.js","assets/n1ql-D9ZVNH8B.js","assets/n4js-DOYHCI4R.js","assets/nand2tetris-hdl-gURQffqi.js","assets/naniscript-00Efet83.js","assets/nasm-BYyRWXsA.js","assets/neon-zwwbwoMR.js","assets/nevod-CzE30xVf.js","assets/nginx-B19tPRFV.js","assets/nim-CjyG8OP2.js","assets/nix-BkfMGg2d.js","assets/nsis-BAiVBhPp.js","assets/objectivec-C8G0gFhP.js","assets/ocaml-CGRmXfd0.js","assets/odin-Byl7CSB2.js","assets/opencl-ScNLtKxk.js","assets/openqasm-D58R-1tG.js","assets/ordinal-BDEzSJ7C.js","assets/oz-C41MtKuJ.js","assets/packet-AYTQ26CC-Dsvwzu_Y.js","assets/parigp-DdjG9MK8.js","assets/parser-Dmkz1m1l.js","assets/pascal-DzYtueWJ.js","assets/pascaligo-DpmXB4fk.js","assets/path-fybaL0A-.js","assets/pcaxis-1DvWz8SL.js","assets/pegDiagram-XKGWAZYB-CHZfnMEy.js","assets/peoplecode-BgBWHHHM.js","assets/perl-Ci2iz3Xf.js","assets/php-Bgap5ftj.js","assets/php-extras-CmLr2BZe.js","assets/phpdoc-B0kpyDnZ.js","assets/pie-WAS4IAKB-Bwraln1r.js","assets/pieDiagram-E7YTZNPT-DnJfwBoT.js","assets/plant-uml-Dr2Y4irI.js","assets/plsql-Gdc5k5FM.js","assets/powerquery-CdxcVCeV.js","assets/powershell-CO2koXZw.js","assets/processing-BnBhnciG.js","assets/prolog-DM-3k7xl.js","assets/promql-Cyu0bSs-.js","assets/properties-DKg_-2lZ.js","assets/protobuf-DUMZX0xn.js","assets/psl-C4ZUpXFx.js","assets/pug-DLxJFFCN.js","assets/puppet-D28JRZD1.js","assets/pure-BJm2LNYT.js","assets/purebasic-BtBdE_z6.js","assets/purescript-NMXprYIU.js","assets/purify.es-ChwZkWde.js","assets/python-PcNiIBxw.js","assets/q-Bk86XahR.js","assets/qml-BOqQFScb.js","assets/qore-51LHFvPV.js","assets/qsharp-CQUOoqxS.js","assets/quadrantDiagram-AXDQQJYC-CypikuXz.js","assets/r-CjN4PMnd.js","assets/racket-DUkyhs4D.js","assets/radar-RG4KPBEZ-Br3VHG2Q.js","assets/railroad-74A4TZTK-D18HXU8L.js","assets/railroad-abnf-HS5TGJTU-BnNO_m6N.js","assets/railroad-ebnf-LZEXJU2U-D_WacScZ.js","assets/railroad-peg-WCYAUIDC-BuupshOB.js","assets/railroadDiagram-O6MQD6OU-BXBOcDrI.js","assets/react-rXQ76o_G.js","assets/reason-DkIFNbXg.js","assets/regex-Dv2vm_uO.js","assets/rego-DgqoaeAa.js","assets/renpy-DroUj61n.js","assets/requirementDiagram-BXWQKSXE-tmYXGhoq.js","assets/rescript-Cla-WDKB.js","assets/rest-Jn9jSZ2s.js","assets/rip-B4Ycriad.js","assets/roboconf-Bn3ncXn_.js","assets/robotframework-BZw9gX0w.js","assets/rolldown-runtime-hePW80VL.js","assets/rough.esm-Dy-Kn_BL.js","assets/ruby-2TvTD2ED.js","assets/rust-CYWeblTv.js","assets/sankeyDiagram-P5KCCOFB-dvCMMN9X.js","assets/sas-BI7KPfej.js","assets/sass-RhMvkm29.js","assets/scala-DtBa56Af.js","assets/scheme-DEQeAjll.js","assets/scss-BSDGjs1D.js","assets/sequenceDiagram-WJ2MYXX4-BWAGj34F.js","assets/shell-session-8H-pu4k1.js","assets/sizeCapture-INFHLROL-B0uUizjq.js","assets/smali-DHR2StmD.js","assets/smalltalk-lZkBJf_H.js","assets/smarty-D7P6ioim.js","assets/sml-CGCKZ7_9.js","assets/solidity-Ds-FAeRa.js","assets/solution-file-gE9JyDmu.js","assets/soy-Bs6HeHj1.js","assets/sparql-B019SYfI.js","assets/splunk-spl-BkLEGjpI.js","assets/sqf-lonMp9Wx.js","assets/sql-DL4klaVE.js","assets/squirrel-97PU9mU0.js","assets/src-B6xuSHsQ.js","assets/stan-Byqu5KZz.js","assets/stata-DvkMgPus.js","assets/stateDiagram-D77RDMKH-Dob_Ksqe.js","assets/stateDiagram-v2-MP3YSRHH-1VHRhROS.js","assets/stylus-ChgJAoS8.js","assets/supercollider-BpgCy7pe.js","assets/swift-7bJ1Hzvg.js","assets/swimlanes-42K2YHIH-DsFXJNGj.js","assets/swimlanesDiagram-VR7AAH4N-DwYrAjKX.js","assets/systemd-D1_5snoB.js","assets/t4-cs-BIhf7ZLW.js","assets/t4-templating-xhBpS6bs.js","assets/t4-vb-BNrnskRm.js","assets/tap-1l_zd01v.js","assets/tcl-CEa2RNd5.js","assets/textile-3RSBk2kj.js","assets/timeline-definition-24CTP7MA-Pn-rxyT4.js","assets/toml-shH6cMOm.js","assets/treeView-Q6P3EWNA-DxGTyZ3l.js","assets/treemap-WGGIJYW6-CjDJqLPi.js","assets/tremor-C12yT62p.js","assets/tsx-Cl2BjV3I.js","assets/tt2-BD8qnOng.js","assets/turtle-BajsPQ9K.js","assets/twig-Cn3Iz3mR.js","assets/typescript-BygPYxtY.js","assets/typoscript-L2xWg453.js","assets/unrealscript-B-NggFno.js","assets/uorazor-Cd-VrsLz.js","assets/uri-9IuvSt6-.js","assets/v-OX2Cy3CI.js","assets/vala-zUpAg68F.js","assets/vbnet-C9vXWYsq.js","assets/velocity-ish806Gd.js","assets/vennDiagram-4TSXK5OY-Bu7Hg3pm.js","assets/verilog-Ccu_Xk-I.js","assets/vhdl-CIWn_y0q.js","assets/vim-ChHP2Qq7.js","assets/visual-basic-BwH6S-m8.js","assets/wardley-WFR3VGLG-B2Wb1FQW.js","assets/wardleyDiagram-VM6X3IG4-oiNqW4ya.js","assets/warpscript-BcDDSmPD.js","assets/wasm-CL-PBsLm.js","assets/web-idl-L-ew2qx6.js","assets/wgsl-DESs6Ww8.js","assets/wiki-ZEaxU63c.js","assets/wolfram-D2zPSWp1.js","assets/wren-ZVk8-izA.js","assets/xeora-zeb8OL_h.js","assets/xml-doc-Bajxxvjj.js","assets/xojo-ByP3cRow.js","assets/xquery-Btfx_3LE.js","assets/xychartDiagram-S5SC5T6Z-_YjAgd9S.js","assets/yaml-n53w1Kfi.js","assets/yang-0H42dP10.js","assets/zig-JX-h6b9i.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable.png","manifest.webmanifest"];
var SCOPE = self.registration.scope;                       /* .../markdown-editor-pro/ */
var BASE_PATH = new URL(SCOPE).pathname;
var PREFIX = "mdpro:" + SCOPE + ":";
var CACHE = PREFIX + BUILD;
var READY = SCOPE + "__offline-ready.json";                 /* written last: its presence means "install finished" */
var NETWORK_WAIT_MS = 4000;

function keyOf(url) { return url.origin + url.pathname; }   /* ?import=1 and ?read=1 are the same page */

function precache() {
  return caches.open(CACHE).then(function (cache) {
    /* The page is re-fetched (not taken from the HTTP cache) so what we keep includes the config the server injects. */
    return fetch(new Request(SCOPE, { cache: "reload" })).then(function (res) {
      if (!res.ok) throw new Error("page: HTTP " + res.status);
      return cache.put(SCOPE, res);
    }).then(function () {
      var failed = 0;
      return Promise.all(PRECACHE.map(function (path) {
        var url = new URL(path, SCOPE).href;
        return caches.match(url).then(function (hit) {
          return hit || fetch(new Request(url, { cache: "reload" })).then(function (res) {
            if (!res.ok) throw new Error(path + ": HTTP " + res.status);
            return res;
          });
        }).then(function (res) { return cache.put(url, res); }).catch(function () { failed += 1; });
      })).then(function () {
        var body = JSON.stringify({ build: BUILD, files: PRECACHE.length, failed: failed });
        return cache.put(READY, new Response(body, { headers: { "Content-Type": "application/json" } }));
      });
    });
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil(precache().then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (names) {
    return Promise.all(names.filter(function (n) { return n.indexOf(PREFIX) === 0 && n !== CACHE; })   /* older builds of this app only */
      .map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

function savedFirst(req, key) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(key).then(function (saved) {
      if (saved) return saved;
      return fetch(req).then(function (res) {
        if (res.ok) cache.put(key, res.clone());
        return res;
      });
    });
  });
}

function networkFirst(req, key) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(key).then(function (saved) {
      var live = fetch(req, req.mode === "navigate" ? undefined : { cache: "no-cache" }).then(function (res) {
        if (res.ok) cache.put(key, res.clone());
        return res;
      });
      if (!saved) return live;
      var giveUp = new Promise(function (resolve) { setTimeout(function () { resolve(saved); }, NETWORK_WAIT_MS); });
      /* a 5xx or a dead proxy gets the saved copy too, never an error page */
      return Promise.race([live.then(function (res) { return res.ok ? res : saved; }, function () { return saved; }), giveUp]);
    });
  });
}

function page(req, url) {
  return networkFirst(req, keyOf(url)).catch(function () {
    return caches.open(CACHE).then(function (cache) { return cache.match(SCOPE); }).then(function (res) {   /* e.g. .../index.html */
      return res || new Response(
        "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
        "<title>Offline</title><body style='font:16px/1.6 system-ui;padding:40px;max-width:520px;margin:auto'>" +
        "<h1>You are offline</h1><p>Markdown Editor Pro has not been saved on this device yet. " +
        "Connect once and reload the page.</p>",
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    });
  });
}

self.addEventListener("fetch", function (event) {
  var req = event.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.indexOf(BASE_PATH) !== 0) return;              /* outside the app (API...): the network decides */
  var rest = url.pathname.slice(BASE_PATH.length);
  if (rest === "sw.js") return;                                    /* the browser's own update check must see the real file */
  if (req.mode === "navigate") event.respondWith(page(req, url));
  else if (rest.indexOf("assets/") === 0) event.respondWith(savedFirst(req, keyOf(url)));
  else event.respondWith(networkFirst(req, keyOf(url)));
});
