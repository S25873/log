/* 조판 · 로그 이미지 생성기
   ─ 편집 엔진(서식/말풍선/제목/인용/구분)과 저장 엔진(html2canvas + 꼬리·형광펜 직접 굽기)은
     원본에서 검증된 로직을 이식했다. UI 셸과 색 시스템, 테마, 반응형만 새로 짰다. */
(function(){
  'use strict';
  var $ = function(id){ return document.getElementById(id); };

  var canvas  = $('canvas');
  var editor  = $('editor');
  var nameEd  = $('name-ed');
  var currentAlign = 'justify';
  var sizeMode = 'width';
  var ratio = {w:4, h:5};
  var bgValue = '#ffffff';
  var photoOn = false;
  var photoData = null;

  /* 형광펜·강조색: 슬롯 1/2/3 (슬롯1은 기존 c-hl / c-em 을 그대로 사용) */
  var hlSlot = 1, emSlot = 1;
  function hlInput(slot){ return $(slot===1 ? 'c-hl' : 'c-hl'+slot); }
  function emInput(slot){ return $(slot===1 ? 'c-em' : 'c-em'+slot); }
  function hlTxt(slot){ return $((slot===1 ? 'c-hl' : 'c-hl'+slot)+'-txt'); }
  function emTxt(slot){ return $((slot===1 ? 'c-em' : 'c-em'+slot)+'-txt'); }
  function hlColorOf(slot){ var e=hlInput(slot); return e ? e.value : '#fff59d'; }
  function emColorOf(slot){ var e=emInput(slot); return e ? e.value : '#e23b3b'; }

  /* ============================================================
     테마 토글
     ============================================================ */
  var THEME_KEY = 'logmaker-theme';
  (function initTheme(){
    var saved = null;
    try{ saved = localStorage.getItem(THEME_KEY); }catch(e){}
    if(!saved){
      saved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    setTheme(saved, false);
  })();
  function setTheme(mode, save){
    document.documentElement.setAttribute('data-theme', mode);
    var sun = document.querySelector('.i-sun'), moon = document.querySelector('.i-moon');
    if(sun && moon){
      var dark = mode === 'dark';
      sun.style.display  = dark ? 'none' : '';
      moon.style.display = dark ? '' : 'none';
    }
    if(save !== false){ try{ localStorage.setItem(THEME_KEY, mode); }catch(e){} }
  }
  $('theme-toggle').addEventListener('click', function(){
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next, true);
  });

  /* ============================================================
     탭 전환
     ============================================================ */
  document.querySelectorAll('.tab').forEach(function(t){
    t.addEventListener('click', function(){
      document.querySelectorAll('.tab').forEach(function(x){ x.setAttribute('aria-selected','false'); });
      document.querySelectorAll('.panel').forEach(function(x){ x.classList.remove('is-active'); });
      t.setAttribute('aria-selected','true');
      var name = t.getAttribute('data-tab');
      document.querySelector('.panel[data-panel="'+name+'"]').classList.add('is-active');
      fitStage();
      if(typeof moveAllThumbs==='function'){ requestAnimationFrame(moveAllThumbs); }
    });
  });

  /* ============================================================
     프리셋 데이터 (모던 뉴트럴 톤)
     ============================================================ */
  var bgPresets = [
    {bg:'#ffffff', fg:'#2b2b2b', swatch:'#ffffff'},              // 화이트
    {bg:'#fbf7f0', fg:'#3a352d', swatch:'#fbf7f0'},              // 크림
    {bg:'#fdf0f2', fg:'#5c2b34', swatch:'#fdf0f2'},              // 로즈
    {bg:'#eef4fb', fg:'#233b52', swatch:'#eef4fb'},              // 스카이
    {bg:'#eef7f0', fg:'#264536', swatch:'#eef7f0'},              // 민트
    {bg:'#1a1a1a', fg:'#f0f0f0', swatch:'#1a1a1a'},              // 먹
    {bg:'linear-gradient(135deg,#ffecd2 0%,#fcb69f 100%)', fg:'#5a3a28', swatch:'linear-gradient(135deg,#ffecd2,#fcb69f)'}, // 선셋
    {bg:'linear-gradient(135deg,#a1c4fd 0%,#c2e9fb 100%)', fg:'#22364a', swatch:'linear-gradient(135deg,#a1c4fd,#c2e9fb)'}, // 오션
    {bg:'linear-gradient(135deg,#d4fc79 0%,#96e6a1 100%)', fg:'#28472e', swatch:'linear-gradient(135deg,#d4fc79,#96e6a1)'}, // 프레시
    {bg:'linear-gradient(160deg,#30cfd0 0%,#330867 100%)', fg:'#f0f0f0', swatch:'linear-gradient(160deg,#30cfd0,#330867)'}  // 미드나잇
  ];
  var hlPresets = [
    {c:'#f4b2ad', label:'코랄'}, {c:'#f8c9a6', label:'피치'}, {c:'#f9dea8', label:'버터'}, {c:'#e4e3a2', label:'라임옐로'},
    {c:'#c4e1ac', label:'세이지'}, {c:'#aededd', label:'민트'}, {c:'#b4d3ec', label:'스카이'}, {c:'#b9c7ec', label:'페리'},
    {c:'#c3c1eb', label:'인디고'}, {c:'#d0c2e8', label:'라벤더'}, {c:'#debee3', label:'바이올렛'}, {c:'#efbcd3', label:'로즈'},
    {c:'#e9d2c6', label:'클레이'}, {c:'#ddccbf', label:'코코아'}, {c:'#dadce0', label:'그레이'}, {c:'#e6e6e6', label:'페일'}
  ];
  var emPresets = [
    {c:'#c25b57', label:'브릭'}, {c:'#cf7b57', label:'테라코타'}, {c:'#c9995a', label:'오커'}, {c:'#9aa35c', label:'올리브'},
    {c:'#5e9b72', label:'그린'}, {c:'#4e9a98', label:'틸'}, {c:'#5b87a8', label:'스틸블루'}, {c:'#5d74a6', label:'데님'},
    {c:'#6e6fa6', label:'인디고'}, {c:'#8a6fa6', label:'라벤더'}, {c:'#9a5e8e', label:'플럼'}, {c:'#b05b78', label:'로즈우드'},
    {c:'#a9756a', label:'클레이'}, {c:'#7c6355', label:'코코아'}, {c:'#6b7280', label:'슬레이트'}, {c:'#3e4149', label:'잉크'}
  ];

  function toHex(c){ return String(c).indexOf('gradient') > -1 ? '#ffffff' : c; }

  /* 배경 프리셋 렌더 */
  var bgWrap = $('bg-presets');
  bgPresets.forEach(function(p){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip';
    b.style.background = p.swatch; b.style.color = p.fg; b.textContent = '가';
    b.title = '배경 프리셋 적용';
    b.addEventListener('click', function(){
      [].forEach.call(bgWrap.children, function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      bgValue = p.bg;
      $('c-fg').value = toHex(p.fg); $('c-fg-txt').value = p.fg; $('c-bg-txt').value = p.bg;
      if(p.bg.indexOf('gradient') === -1){ $('c-bg').value = p.bg; }
      render();
    });
    bgWrap.appendChild(b);
  });

  var hlWrap = $('hl-presets');
  hlPresets.forEach(function(p){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'dot'; b.title = p.label; b.setAttribute('aria-label', p.label);
    var i = document.createElement('i'); i.style.background = p.c; b.appendChild(i);
    b.addEventListener('click', function(){
      [].forEach.call(hlWrap.children, function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      var ci=hlInput(hlSlot), ti=hlTxt(hlSlot);
      if(ci) ci.value = p.c; if(ti) ti.value = p.c;
      if(hlSlot===1) updateEditorHl();
      render();
    });
    hlWrap.appendChild(b);
  });

  var emWrap = $('em-presets');
  emPresets.forEach(function(p){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'dot'; b.title = p.label; b.setAttribute('aria-label', p.label);
    var i = document.createElement('i'); i.style.background = p.c; b.appendChild(i);
    b.addEventListener('click', function(){
      [].forEach.call(emWrap.children, function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      var ci=emInput(emSlot), ti=emTxt(emSlot);
      if(ci) ci.value = p.c; if(ti) ti.value = p.c;
      render();
    });
    emWrap.appendChild(b);
  });

  /* 말풍선 프리셋 — recv배경/send배경/recv글자/send글자 */
  var bubPresets = [
    {label:'아이메시지', br:'#e9e9eb', bs:'#248bf5', bri:'#000000', bsi:'#ffffff'},
    {label:'그린',      br:'#e9e9eb', bs:'#34c759', bri:'#000000', bsi:'#ffffff'},
    {label:'카톡',      br:'#ffffff', bs:'#fee500', bri:'#000000', bsi:'#3c1e1e'},
    {label:'퍼플',      br:'#efeafc', bs:'#7c5cff', bri:'#2b1f52', bsi:'#ffffff'},
    {label:'로즈',      br:'#fdeef2', bs:'#ff5c8a', bri:'#5c2b3a', bsi:'#ffffff'},
    {label:'모노',      br:'#ececec', bs:'#2b2b2b', bri:'#1a1a1a', bsi:'#ffffff'}
  ];
  var bubWrap = $('bub-presets');
  if(bubWrap){
    bubPresets.forEach(function(p){
      var b=document.createElement('button'); b.type='button'; b.className='chip';
      b.title=p.label+' 말풍선'; b.setAttribute('aria-label', p.label);
      b.style.padding='0'; b.style.aspectRatio='auto'; b.style.height='52px';
      b.style.display='flex'; b.style.flexDirection='column'; b.style.gap='3px';
      b.style.alignItems='stretch'; b.style.justifyContent='center';
      b.style.background='var(--surface)'; b.style.padding='7px';
      var r=document.createElement('span');
      r.style.cssText='height:10px;width:60%;border-radius:6px 6px 6px 2px;align-self:flex-start;background:'+p.br;
      var s=document.createElement('span');
      s.style.cssText='height:10px;width:60%;border-radius:6px 6px 2px 6px;align-self:flex-end;background:'+p.bs;
      b.appendChild(r); b.appendChild(s);
      b.addEventListener('click', function(){
        [].forEach.call(bubWrap.children, function(x){ x.classList.remove('on'); });
        b.classList.add('on');
        function setC(id, v){ var c=$(id), t=$(id+'-txt'); if(c) c.value=v; if(t) t.value=v; }
        setC('c-brecv', p.br); setC('c-bsend', p.bs);
        setC('c-brecv-ink', p.bri); setC('c-bsend-ink', p.bsi);
        updateEditorBub(); render();
      });
      bubWrap.appendChild(b);
    });
  }

  /* ============================================================
     색상 인풋 연결
     ============================================================ */
  function updateEditorHl(){ editor.style.setProperty('--hl', $('c-hl').value); }
  function bubInkRecv(){ return $('c-brecv-ink').value; }
  function bubInkSend(){ return $('c-bsend-ink').value; }
  function updateEditorBub(){
    editor.style.setProperty('--bub-recv', $('c-brecv').value);
    editor.style.setProperty('--bub-send', $('c-bsend').value);
    editor.style.setProperty('--bub-recv-ink', bubInkRecv());
    editor.style.setProperty('--bub-send-ink', bubInkSend());
    editor.style.setProperty('--sub-color', $('c-sub').value);
    editor.style.setProperty('--title-color', $('c-title').value);
    editor.style.setProperty('--subtitle-color', $('c-subtitle').value);
    editor.style.setProperty('--quote-color', $('c-quote').value);
    editor.style.setProperty('--hr-color', $('c-hr').value);
    editor.style.setProperty('--bub-name-recv', $('c-brecv-name').value);
    editor.style.setProperty('--bub-name-send', $('c-bsend-name').value);
  }

  function linkColor(colorId, txtId, isBg, isHl, onChange){
    var c = $(colorId), t = $(txtId);
    if(!c || !t) return;
    c.addEventListener('input', function(){
      t.value = c.value; if(isBg) bgValue = c.value; if(isHl) updateEditorHl(); if(onChange) onChange(); render();
    });
    t.addEventListener('input', function(){
      var v = t.value.trim();
      if(isBg){ bgValue = v; if(v.indexOf('gradient') === -1 && /^#?[0-9a-fA-F]{3,8}$/.test(v)) c.value = v.charAt(0)==='#'?v:'#'+v; }
      else if(/^#?[0-9a-fA-F]{3,8}$/.test(v)){ c.value = v.charAt(0)==='#'?v:'#'+v; }
      if(isHl) updateEditorHl(); if(onChange) onChange(); render();
    });
  }
  linkColor('c-bg','c-bg-txt',true,false);
  linkColor('c-fg','c-fg-txt',false,false);
  linkColor('c-hl','c-hl-txt',false,true);
  linkColor('c-hl2','c-hl2-txt',false,false);
  linkColor('c-hl3','c-hl3-txt',false,false);
  linkColor('c-hl4','c-hl4-txt',false,false);
  linkColor('c-em','c-em-txt',false,false);
  linkColor('c-em2','c-em2-txt',false,false);
  linkColor('c-em3','c-em3-txt',false,false);
  linkColor('c-em4','c-em4-txt',false,false);
  linkColor('c-name','c-name-txt',false,false);
  linkColor('c-bar','c-bar-txt',false,false);
  linkColor('c-brecv','c-brecv-txt',false,false,updateEditorBub);
  linkColor('c-bsend','c-bsend-txt',false,false,updateEditorBub);
  linkColor('c-brecv-ink','c-brecv-ink-txt',false,false,updateEditorBub);
  linkColor('c-bsend-ink','c-bsend-ink-txt',false,false,updateEditorBub);
  linkColor('c-title','c-title-txt',false,false);
  linkColor('c-subtitle','c-subtitle-txt',false,false);
  linkColor('c-sub','c-sub-txt',false,false);
  linkColor('c-quote','c-quote-txt',false,false);
  linkColor('c-hr','c-hr-txt',false,false);
  linkColor('c-brecv-name','c-brecv-name-txt',false,false,updateEditorBub);
  linkColor('c-bsend-name','c-bsend-name-txt',false,false,updateEditorBub);

  /* ============================================================
     하단 정보 HTML화 (br만 허용)
     ============================================================ */
  function nameHtml(){
    if(!nameEd) return '';
    var src = nameEd.cloneNode(true), out = '';
    (function walk(node){
      for(var i=0;i<node.childNodes.length;i++){
        var ch = node.childNodes[i];
        if(ch.nodeType===3){ out += ch.nodeValue.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
        else if(ch.nodeType===1){
          if(ch.tagName==='BR'){ out += '<br>'; }
          else if(ch.tagName==='DIV' || ch.tagName==='P'){ if(out!=='' && !/<br>$/.test(out)) out+='<br>'; walk(ch); }
          else { walk(ch); }
        }
      }
    })(src);
    return out.replace(/(<br>)+$/,'');
  }
  function nameIsEmpty(){ return nameHtml().replace(/<br>/g,'').replace(/\u00a0/g,' ').trim() === ''; }

  // 제목/소제목 입력창(contenteditable) → 안전한 HTML (br만 허용)
  function edToHtml(el){
    if(!el) return '';
    var src = el.cloneNode(true), out = '';
    (function walk(node){
      for(var i=0;i<node.childNodes.length;i++){
        var ch = node.childNodes[i];
        if(ch.nodeType===3){ out += ch.nodeValue.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
        else if(ch.nodeType===1){
          if(ch.tagName==='BR'){ out += '<br>'; }
          else if(ch.tagName==='DIV' || ch.tagName==='P'){ if(out!=='' && !/<br>$/.test(out)) out+='<br>'; walk(ch); }
          else { walk(ch); }
        }
      }
    })(src);
    return out.replace(/\u200b/g,'').replace(/(<br>)+$/,'');
  }
  function titleIsEmpty(){ return edToHtml($('title-ed')).replace(/<br>/g,'').replace(/\u00a0/g,' ').trim()===''; }
  function subtitleIsEmpty(){ return edToHtml($('subtitle-ed')).replace(/<br>/g,'').replace(/\u00a0/g,' ').trim()===''; }

  /* ============================================================
     서식 유틸 (형광/강조/밑줄/서브 = mark 기반 union)
     ============================================================ */
  function rangeWithin(range, el){
    try{ return el.contains(range.startContainer) && el.contains(range.endContainer); }catch(e){ return false; }
  }
  function mergeAdjacentMarks(cls){
    var marks = editor.querySelectorAll('mark.'+cls);
    [].forEach.call(marks, function(mk){
      var next = mk.nextSibling;
      while(next && next.nodeType===1 && next.tagName==='MARK' && next.classList.contains(cls)){
        while(next.firstChild){ mk.appendChild(next.firstChild); }
        var after = next.nextSibling; next.parentNode.removeChild(next); next = after;
      }
    });
    editor.normalize();
  }
  function expandRangeOverMarks(range, cls){
    var marks = editor.querySelectorAll('mark.'+cls);
    [].forEach.call(marks, function(mk){
      var mr = document.createRange();
      try{ mr.selectNode(mk); }catch(e){ return; }
      var overlaps;
      try{ overlaps = range.compareBoundaryPoints(Range.END_TO_START, mr) < 0 && range.compareBoundaryPoints(Range.START_TO_END, mr) > 0; }
      catch(e){ overlaps = false; }
      if(!overlaps) return;
      try{ if(range.compareBoundaryPoints(Range.START_TO_START, mr) > 0){ range.setStartBefore(mk); } }catch(e){}
      try{ if(range.compareBoundaryPoints(Range.END_TO_END, mr) < 0){ range.setEndAfter(mk); } }catch(e){}
    });
  }
  function paintUnion(range, cls, colorVarName, colorValue){
    expandRangeOverMarks(range, cls);
    var startMark = document.createTextNode('\u200b'), endMark = document.createTextNode('\u200b');
    var endRange = range.cloneRange(); endRange.collapse(false); endRange.insertNode(endMark);
    var startRange = range.cloneRange(); startRange.collapse(true); startRange.insertNode(startMark);
    var work = document.createRange(); work.setStartAfter(startMark); work.setEndBefore(endMark);
    var toUnwrap = [];
    [].forEach.call(editor.querySelectorAll('mark.'+cls), function(mk){
      var hit;
      try{ var mr=document.createRange(); mr.selectNode(mk);
        hit = work.compareBoundaryPoints(Range.END_TO_START, mr) < 0 && work.compareBoundaryPoints(Range.START_TO_END, mr) > 0;
      }catch(e){ hit=false; }
      if(hit) toUnwrap.push(mk);
    });
    toUnwrap.forEach(function(mk){ var pr=mk.parentNode; if(!pr) return; while(mk.firstChild){ pr.insertBefore(mk.firstChild, mk); } pr.removeChild(mk); });
    var wrap = document.createRange(); wrap.setStartAfter(startMark); wrap.setEndBefore(endMark);
    var mm = document.createElement('mark'); mm.className = cls; if(colorVarName){ mm.style.setProperty(colorVarName, colorValue); }
    try{ wrap.surroundContents(mm); }
    catch(e){ var f=wrap.extractContents(); mm.appendChild(f); wrap.insertNode(mm); }
    if(startMark.parentNode) startMark.parentNode.removeChild(startMark);
    if(endMark.parentNode) endMark.parentNode.removeChild(endMark);
    mergeAdjacentMarks(cls);
  }

  /* 선택 영역과 겹치는 mark.cls 를 모두 풀어 서식(형광펜/강조)을 지운다 */
  function stripMarks(range, cls){
    var startMark = document.createTextNode('\u200b'), endMark = document.createTextNode('\u200b');
    var endRange = range.cloneRange(); endRange.collapse(false); endRange.insertNode(endMark);
    var startRange = range.cloneRange(); startRange.collapse(true); startRange.insertNode(startMark);
    var work = document.createRange(); work.setStartAfter(startMark); work.setEndBefore(endMark);
    var toUnwrap = [];
    [].forEach.call(editor.querySelectorAll('mark.'+cls), function(mk){
      var hit;
      try{ var mr=document.createRange(); mr.selectNode(mk);
        hit = work.compareBoundaryPoints(Range.END_TO_START, mr) < 0 && work.compareBoundaryPoints(Range.START_TO_END, mr) > 0;
      }catch(e){ hit=false; }
      if(hit) toUnwrap.push(mk);
    });
    toUnwrap.forEach(function(mk){ var pr=mk.parentNode; if(!pr) return; while(mk.firstChild){ pr.insertBefore(mk.firstChild, mk); } pr.removeChild(mk); });
    if(startMark.parentNode) startMark.parentNode.removeChild(startMark);
    if(endMark.parentNode) endMark.parentNode.removeChild(endMark);
  }

  /* ============================================================
     말풍선
     ============================================================ */
  var TAIL_SVG = '<svg class="g-tail" viewBox="0 0 16 20" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M16 0 L16 20 Q6 20 0.6 19.2 Q-0.9 19.0 0.5 18.2 Q6.2 15.0 8 10 Q9.2 5.6 9 0 Z"/></svg>';

  function closestBubble(node){
    var el = node && node.nodeType===3 ? node.parentNode : node;
    while(el && el!==editor && el.nodeType===1){
      if(el.classList && el.classList.contains('g-bub')) return el;
      el = el.parentNode;
    }
    return null;
  }
  function caretInBubble(){
    var sel = window.getSelection();
    if(!sel || !sel.rangeCount) return null;
    var r = sel.getRangeAt(0);
    if(!editor.contains(r.startContainer)) return null;
    return closestBubble(r.startContainer);
  }
  function exitBubble(bub){
    if(!bub) return false;
    var sel = window.getSelection();
    var after = bub.nextSibling;
    var anchor = document.createTextNode('\u200b');
    if(after){ bub.parentNode.insertBefore(anchor, after); } else { bub.parentNode.appendChild(anchor); }
    if(!anchor.nextSibling){ bub.parentNode.appendChild(document.createElement('br')); }
    var r = document.createRange(); r.setStart(anchor, anchor.nodeValue.length); r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);
    return true;
  }
  function bubNameBefore(bub){
    var prev = bub.previousSibling;
    while(prev && prev.nodeType===1 && prev.tagName==='BR'){ prev = prev.previousSibling; }
    if(prev && prev.nodeType===1 && prev.classList && prev.classList.contains('g-bub-name')) return prev;
    return null;
  }
  function ensureBubName(bub, kind){
    var nm = bubNameBefore(bub);
    if(nm){ nm.className = 'g-bub-name ' + kind; return nm; }
    nm = document.createElement('span'); nm.className = 'g-bub-name ' + kind;
    nm.appendChild(document.createTextNode('\u200b'));
    bub.parentNode.insertBefore(nm, bub);
    return nm;
  }
  function unwrapBubble(bub){
    if(!bub) return;
    var nm = bubNameBefore(bub);
    if(nm && nm.parentNode){
      var between = nm.nextSibling; nm.parentNode.removeChild(nm);
      if(between && between.nodeType===1 && between.tagName==='BR' && between!==bub && between.parentNode){ between.parentNode.removeChild(between); }
    }
    [].forEach.call(bub.querySelectorAll('svg.g-tail'), function(t){ if(t.parentNode) t.parentNode.removeChild(t); });
    var pr = bub.parentNode, first = bub.firstChild, prev = bub.previousSibling;
    if(prev && !(prev.nodeType===1 && prev.tagName==='BR')){ pr.insertBefore(document.createElement('br'), bub); }
    while(bub.firstChild){ pr.insertBefore(bub.firstChild, bub); }
    var next = bub.nextSibling;
    if(next && !(next.nodeType===1 && next.tagName==='BR')){ pr.insertBefore(document.createElement('br'), bub); }
    pr.removeChild(bub);
    if(first){ var sel=window.getSelection(), r=document.createRange(); r.setStartBefore(first); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
  }
  function bubClass(kind, tail){ return 'g-bub ' + kind + ' ' + (tail ? 'tail' : 'cont'); }
  function syncTails(root){
    if(!root) return;
    [].forEach.call(root.querySelectorAll('.g-bub'), function(b){
      var want = b.classList.contains('tail'), svg = null;
      for(var i=0;i<b.childNodes.length;i++){ var c=b.childNodes[i]; if(c.nodeType===1 && c.nodeName && c.nodeName.toLowerCase()==='svg'){ svg=c; break; } }
      if(want && !svg){ var tmp=document.createElement('div'); tmp.innerHTML=TAIL_SVG; var node=tmp.firstChild; node.setAttribute('contenteditable','false'); b.appendChild(node); }
      else if(!want && svg){ svg.parentNode.removeChild(svg); }
      else if(want && svg){ svg.setAttribute('contenteditable','false'); }
    });
  }
  function applyBubble(kind, tail, withName){
    var sel = window.getSelection();
    if(!sel || sel.rangeCount===0 || !editor.contains(sel.getRangeAt(0).startContainer)){
      editor.focus();
      var rEnd = document.createRange(); rEnd.selectNodeContents(editor); rEnd.collapse(false);
      sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(rEnd);
    }
    if(!sel || sel.rangeCount===0) return null;
    var range = sel.getRangeAt(0);
    if(!editor.contains(range.startContainer)) return null;
    var existing = closestBubble(range.startContainer) || closestBubble(range.endContainer);
    if(existing){
      existing.className = bubClass(kind, tail);
      if(withName){ var nmE=ensureBubName(existing,kind); var rn=document.createRange(); rn.selectNodeContents(nmE); rn.collapse(false); sel.removeAllRanges(); sel.addRange(rn); }
      else { var nmX=bubNameBefore(existing); if(nmX){ nmX.className='g-bub-name '+kind; } }
      return existing;
    }
    if(range.collapsed){
      var bubE = document.createElement('span'); bubE.className = bubClass(kind, tail);
      var anchorE = document.createTextNode('\u200b'); bubE.appendChild(anchorE); range.insertNode(bubE);
      if(withName){ var nmB=ensureBubName(bubE,kind); var rnb=document.createRange(); rnb.selectNodeContents(nmB); rnb.collapse(false); sel.removeAllRanges(); sel.addRange(rnb); }
      else { var r0=document.createRange(); r0.setStart(anchorE, anchorE.nodeValue.length); r0.collapse(true); sel.removeAllRanges(); sel.addRange(r0); }
      return bubE;
    }
    var frag = range.extractContents();
    [].forEach.call(frag.querySelectorAll('.g-bub'), function(b){ var p=b.parentNode; while(b.firstChild){ p.insertBefore(b.firstChild,b); } p.removeChild(b); });
    [].forEach.call(frag.querySelectorAll('.g-bub-name'), function(n){ if(n.parentNode) n.parentNode.removeChild(n); });
    [].forEach.call(frag.querySelectorAll('svg.g-tail'), function(t){ if(t.parentNode) t.parentNode.removeChild(t); });
    var bub = document.createElement('span'); bub.className = bubClass(kind, tail); bub.appendChild(frag);
    while(bub.firstChild && bub.firstChild.nodeType===1 && bub.firstChild.tagName==='BR'){ bub.removeChild(bub.firstChild); }
    while(bub.lastChild && bub.lastChild.nodeType===1 && bub.lastChild.tagName==='BR'){ bub.removeChild(bub.lastChild); }
    if(!bub.childNodes.length){ bub.appendChild(document.createTextNode('\u200b')); }
    range.insertNode(bub);
    if(withName){ var nmC=ensureBubName(bub,kind); var rnc=document.createRange(); rnc.selectNodeContents(nmC); rnc.collapse(false); sel.removeAllRanges(); sel.addRange(rnc); return bub; }
    var r = document.createRange(); r.selectNodeContents(bub); r.collapse(false); sel.removeAllRanges(); sel.addRange(r);
    return bub;
  }

  /* ============================================================
     제목 / 소제목
     ============================================================ */
  function findTitleBlock(){ return editor.querySelector('.g-title-blk'); }
  function applyTitle(withSub){
    editor.focus();
    var blk = findTitleBlock();
    if(!blk){
      blk = document.createElement('div'); blk.className='g-title-blk';
      var main = document.createElement('div'); main.className='g-title-main'; blk.appendChild(main);
      if(editor.firstChild){ editor.insertBefore(blk, editor.firstChild); } else { editor.appendChild(blk); }
    }
    var mainEl = blk.querySelector('.g-title-main');
    var subEl = blk.querySelector('.g-title-sub');
    if(withSub && !subEl){ subEl=document.createElement('div'); subEl.className='g-title-sub'; blk.appendChild(subEl); }
    else if(!withSub && subEl){ subEl.parentNode.removeChild(subEl); subEl=null; }
    var sel = window.getSelection(), r = document.createRange();
    r.selectNodeContents(mainEl); r.collapse(false); sel.removeAllRanges(); sel.addRange(r);
    cleanEditor(); render(); saveSel(); updateFormatButtons();
  }

  /* ============================================================
     인용선 (세로선)
     ============================================================ */
  function closestQuote(node){
    var el = node && node.nodeType===3 ? node.parentNode : node;
    while(el && el!==editor && el.nodeType===1){ if(el.classList && el.classList.contains('g-quote')) return el; el = el.parentNode; }
    return null;
  }
  function applyQuote(side){
    var sel = window.getSelection(); if(!sel || sel.rangeCount===0) return;
    var range = sel.getRangeAt(0); if(!editor.contains(range.startContainer)) return;
    var existing = closestQuote(range.startContainer) || closestQuote(range.endContainer);
    if(existing){
      if(existing.classList.contains(side)){
        var pr=existing.parentNode, prev=existing.previousSibling;
        if(prev && !(prev.nodeType===1 && prev.tagName==='BR')){ pr.insertBefore(document.createElement('br'), existing); }
        while(existing.firstChild){ pr.insertBefore(existing.firstChild, existing); }
        var nx=existing.nextSibling; if(nx && !(nx.nodeType===1 && nx.tagName==='BR')){ pr.insertBefore(document.createElement('br'), existing); }
        pr.removeChild(existing);
      } else { existing.className = 'g-quote ' + side; }
      return;
    }
    if(range.collapsed){
      var qE=document.createElement('div'); qE.className='g-quote '+side; qE.appendChild(document.createTextNode('\u200b'));
      range.insertNode(qE); var r0=document.createRange(); r0.selectNodeContents(qE); r0.collapse(false); sel.removeAllRanges(); sel.addRange(r0); return;
    }
    var frag = range.extractContents();
    [].forEach.call(frag.querySelectorAll('.g-quote'), function(b){ var p=b.parentNode; while(b.firstChild){ p.insertBefore(b.firstChild,b); } p.removeChild(b); });
    var q=document.createElement('div'); q.className='g-quote '+side; q.appendChild(frag);
    function edgeStrippable(n){ return (n.nodeType===1 && n.tagName==='BR') || (n.nodeType===3 && n.nodeValue.replace(/\u200b/g,'')===''); }
    while(q.firstChild && edgeStrippable(q.firstChild)){ q.removeChild(q.firstChild); }
    while(q.lastChild && edgeStrippable(q.lastChild)){ q.removeChild(q.lastChild); }
    if(!q.childNodes.length){ q.appendChild(document.createTextNode('\u200b')); }
    range.insertNode(q);
    var r=document.createRange(); r.selectNodeContents(q); r.collapse(false); sel.removeAllRanges(); sel.addRange(r);
  }

  /* ============================================================
     구분선 (가로선)
     ============================================================ */
  function applyHr(kind){
    editor.focus(); restoreSel();
    var sel = window.getSelection();
    var hr = document.createElement('div'); hr.className='g-hr '+(kind||'line'); hr.setAttribute('contenteditable','false');
    if(kind==='dots'){ hr.textContent='•  •  •'; } else { hr.textContent='\u200b'; }
    var anchor = document.createTextNode('\u200b');
    if(sel && sel.rangeCount && editor.contains(sel.getRangeAt(0).startContainer)){
      var range=sel.getRangeAt(0); range.collapse(false); range.insertNode(hr);
      if(hr.nextSibling){ hr.parentNode.insertBefore(anchor, hr.nextSibling); } else { hr.parentNode.appendChild(anchor); }
    } else {
      editor.appendChild(hr); editor.appendChild(anchor);
    }
    var r=document.createRange(); r.setStart(anchor, anchor.length); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
    cleanEditor(); render(); saveSel(); updateFormatButtons();
  }

  /* ============================================================
     구분선(g-hr) 선택 · 삭제
     — 클릭하면 선택 표시(✕)가 뜨고, ✕를 누르거나 Backspace/Delete로 삭제.
       커서가 구분선 바로 뒤에 있을 때 Backspace로도 삭제된다.
     ============================================================ */
  var _selHr = null;
  function clearHrSel(){
    [].forEach.call(editor.querySelectorAll('.g-hr.is-sel'), function(x){ x.classList.remove('is-sel'); });
    _selHr = null;
  }
  function selectHr(hr){ clearHrSel(); if(hr){ hr.classList.add('is-sel'); _selHr = hr; } }
  function removeHr(hr){
    if(!hr || !hr.parentNode) return;
    var nx = hr.nextSibling, pv = hr.previousSibling;
    hr.parentNode.removeChild(hr);
    if(nx && nx.nodeType===1 && nx.tagName==='BR' && nx.parentNode){ nx.parentNode.removeChild(nx); }
    else if(pv && pv.nodeType===1 && pv.tagName==='BR' && pv.parentNode){ pv.parentNode.removeChild(pv); }
    _selHr = null;
    cleanEditor(); render(); saveSel(); updateFormatButtons();
    editor.focus();
  }
  function hrBeforeCaret(range){
    var n=range.startContainer, o=range.startOffset, prev=null, up;
    if(n.nodeType===3){
      if(n.nodeValue.slice(0,o).replace(/\u200b/g,'').length>0) return null;
      prev=n.previousSibling; up=n;
      while(!prev && up.parentNode && up!==editor){ up=up.parentNode; if(up===editor) break; prev=up.previousSibling; }
    } else {
      if(o>0){ prev=n.childNodes[o-1]; }
      else { up=n; while(!prev && up.parentNode && up!==editor){ prev=up.previousSibling; if(prev) break; up=up.parentNode; } }
    }
    if(prev && prev.nodeType===1 && prev.tagName==='BR'){ prev=prev.previousSibling; }
    while(prev && prev.nodeType===3 && prev.nodeValue.replace(/\u200b/g,'')===''){ prev=prev.previousSibling; }
    return (prev && prev.nodeType===1 && prev.classList && prev.classList.contains('g-hr')) ? prev : null;
  }
  editor.addEventListener('click', function(e){
    var t=e.target, hr = (t && t.closest) ? t.closest('.g-hr') : null;
    if(hr && editor.contains(hr)){
      e.preventDefault();
      var rect=hr.getBoundingClientRect();
      if(hr.classList.contains('is-sel') && e.clientX >= rect.right - 34){ removeHr(hr); }
      else { selectHr(hr); }
      return;
    }
    clearHrSel();
  });
  editor.addEventListener('keydown', function(e){
    if((e.key==='Backspace' || e.key==='Delete') && _selHr && editor.contains(_selHr)){
      e.preventDefault(); removeHr(_selHr); return;
    }
    if(e.key==='Backspace' && !e.isComposing && e.keyCode!==229){
      var sel=window.getSelection();
      if(sel && sel.rangeCount && sel.isCollapsed){
        var hrPrev=hrBeforeCaret(sel.getRangeAt(0));
        if(hrPrev){ e.preventDefault(); removeHr(hrPrev); return; }
      }
    }
  });
  editor.addEventListener('input', clearHrSel);

  /* ============================================================
     서식 적용 라우터
     ============================================================ */
  function applyFormat(fmt, tail, side, withName, color){
    var sel0 = window.getSelection();
    var saved = (sel0 && sel0.rangeCount && editor.contains(sel0.getRangeAt(0).startContainer)) ? sel0.getRangeAt(0).cloneRange() : null;
    if(!saved && _savedRange && editor.contains(_savedRange.startContainer)){ saved = _savedRange.cloneRange(); }
    editor.focus();
    var sel = window.getSelection();
    if((!sel || sel.rangeCount===0) && saved){ sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(saved); }
    if(!sel || sel.rangeCount===0) return;
    if(saved){ var cur=sel.getRangeAt(0); if(!editor.contains(cur.startContainer) || (cur.collapsed && !saved.collapsed)){ sel.removeAllRanges(); sel.addRange(saved); } }
    try{ document.execCommand('styleWithCSS', false, false); }catch(e){}

    if(fmt==='bold'){ document.execCommand('bold'); }
    else if(fmt==='italic'){ document.execCommand('italic'); }
    else if(fmt==='strike'){ document.execCommand('strikeThrough'); }
    else if(fmt==='underline'){
      var rangeU=sel.getRangeAt(0); if(rangeU.collapsed) return;
      var ancU=sel.anchorNode, nodeU=ancU&&ancU.nodeType===3?ancU.parentNode:ancU;
      var existingU=nodeU&&nodeU.closest?nodeU.closest('mark.ul'):null;
      if(existingU && rangeWithin(rangeU, existingU)){ var prU=existingU.parentNode; while(existingU.firstChild){prU.insertBefore(existingU.firstChild,existingU);} prU.removeChild(existingU); }
      else { paintUnion(rangeU, 'ul', null, null); }
    }
    else if(fmt==='hl'){
      var range=sel.getRangeAt(0); if(range.collapsed) return;
      if(color==='__remove__'){ stripMarks(range, 'hl'); }
      else { paintUnion(range, 'hl', '--hl', color || hlColorOf(hlSlot)); }
    }
    else if(fmt==='emph'){
      var range2=sel.getRangeAt(0); if(range2.collapsed) return;
      if(color==='__remove__'){ stripMarks(range2, 'em'); }
      else { paintUnion(range2, 'em', '--em', color || emColorOf(emSlot)); }
    }
    else if(fmt==='sub'){
      var rangeS=sel.getRangeAt(0); if(rangeS.collapsed) return;
      var ancS=sel.anchorNode, nodeS=ancS&&ancS.nodeType===3?ancS.parentNode:ancS;
      var existingS=nodeS&&nodeS.closest?nodeS.closest('mark.sub'):null;
      if(existingS && rangeWithin(rangeS, existingS)){ var prS=existingS.parentNode; while(existingS.firstChild){prS.insertBefore(existingS.firstChild,existingS);} prS.removeChild(existingS); }
      else { paintUnion(rangeS, 'sub', null, null); }
    }
    else if(fmt==='quote'){ applyQuote(side==='right'?'right':'left'); }
    else if(fmt==='bub-recv' || fmt==='bub-send'){
      var newBub = applyBubble(fmt==='bub-send'?'send':'recv', !!tail, !!withName);
      cleanEditor(); render();
      // 삽입한 말풍선(또는 이름칸) 안으로 커서를 되돌려 바로 타이핑 가능하게
      if(newBub && editor.contains(newBub)){
        editor.focus();
        var target = newBub;
        if(withName){ var nm=bubNameBefore(newBub); if(nm) target=nm; }
        var rr=document.createRange(); rr.selectNodeContents(target); rr.collapse(false);
        var ss=window.getSelection(); ss.removeAllRanges(); ss.addRange(rr);
        saveSel();
      }
      updateFormatButtons();
      return;
    }

    cleanEditor(); render(); updateFormatButtons();
  }

  /* ============================================================
     선택 위치 저장/복원 + iOS 터치 처리
     ============================================================ */
  var _savedRange = null;
  function saveSel(){
    var sel = window.getSelection();
    if(sel && sel.rangeCount && editor.contains(sel.getRangeAt(0).startContainer)){ _savedRange = sel.getRangeAt(0).cloneRange(); }
  }
  function restoreSel(){
    if(!_savedRange) return false;
    if(!editor.contains(_savedRange.startContainer)){ _savedRange = null; return false; }
    var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(_savedRange); return true;
  }
  editor.addEventListener('keyup', saveSel);
  editor.addEventListener('mouseup', saveSel);
  editor.addEventListener('touchend', saveSel);
  editor.addEventListener('input', saveSel);
  document.addEventListener('selectionchange', function(){ if(document.activeElement===editor){ saveSel(); } });

  function bindTap(btn, run){
    if(!btn) return;
    btn.addEventListener('mousedown', function(e){ e.preventDefault(); });
    var swallow = false;
    btn.addEventListener('touchend', function(e){ swallow=true; run(e); setTimeout(function(){ swallow=false; }, 350); }, {passive:false});
    btn.addEventListener('click', function(e){ if(swallow){ swallow=false; e.preventDefault(); e.stopPropagation(); return; } run(e); });
  }

  // 서식 버튼: 직접 적용형 (data-fmt) — 말풍선 제외(말풍선은 시트로)
  document.querySelectorAll('.fmt .fbtn[data-fmt]').forEach(function(btn){
    var fmt = btn.getAttribute('data-fmt');
    bindTap(btn, function(e){ if(e){ e.preventDefault(); e.stopPropagation(); } applyFormat(fmt); });
  });

  /* ===== 바텀시트 (인용/구분/말풍선 선택) ===== */
  var tailSvg = '<svg viewBox="0 0 16 20" preserveAspectRatio="none"><path d="M16 0 L16 20 Q6 20 0.6 19.2 Q-0.9 19.0 0.5 18.2 Q6.2 15.0 8 10 Q9.2 5.6 9 0 Z"></path></svg>';
  function swatchHtml(color){
    return '<span class="s-preview"><i style="display:block;width:20px;height:20px;border-radius:50%;background:'+color+';box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)"></i></span>';
  }
  var removeSwatchHtml = '<span class="s-preview"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><line x1="6.5" y1="17.5" x2="17.5" y2="6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>';
  var SHEETS = {
    hl: { title: '형광펜', options: [
      { label: '형광펜 1', preview: function(){ return swatchHtml(hlColorOf(1)); }, run: function(){ applyFormat('hl', null, null, false, hlColorOf(1)); } },
      { label: '형광펜 2', preview: function(){ return swatchHtml(hlColorOf(2)); }, run: function(){ applyFormat('hl', null, null, false, hlColorOf(2)); } },
      { label: '형광펜 3', preview: function(){ return swatchHtml(hlColorOf(3)); }, run: function(){ applyFormat('hl', null, null, false, hlColorOf(3)); } },
      { label: '형광펜 4', preview: function(){ return swatchHtml(hlColorOf(4)); }, run: function(){ applyFormat('hl', null, null, false, hlColorOf(4)); } },
      { label: '형광펜 지우기', preview: removeSwatchHtml, run: function(){ applyFormat('hl', null, null, false, '__remove__'); } }
    ]},
    em: { title: '강조색', options: [
      { label: '강조 1', preview: function(){ return swatchHtml(emColorOf(1)); }, run: function(){ applyFormat('emph', null, null, false, emColorOf(1)); } },
      { label: '강조 2', preview: function(){ return swatchHtml(emColorOf(2)); }, run: function(){ applyFormat('emph', null, null, false, emColorOf(2)); } },
      { label: '강조 3', preview: function(){ return swatchHtml(emColorOf(3)); }, run: function(){ applyFormat('emph', null, null, false, emColorOf(3)); } },
      { label: '강조 4', preview: function(){ return swatchHtml(emColorOf(4)); }, run: function(){ applyFormat('emph', null, null, false, emColorOf(4)); } },
      { label: '강조 지우기', preview: removeSwatchHtml, run: function(){ applyFormat('emph', null, null, false, '__remove__'); } }
    ]},
    quote: { title: '인용선', options: [
      { label: '왼쪽 인용선', preview: '<span class="s-preview"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="2.4" height="16" rx="1.2" fill="currentColor"/><line x1="10" y1="8" x2="20" y2="8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="10" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="10" y1="16" x2="17" y2="16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>', run: function(){ applyFormat('quote', null, 'left'); } },
      { label: '오른쪽 인용선', preview: '<span class="s-preview"><svg viewBox="0 0 24 24" fill="none"><rect x="17.6" y="4" width="2.4" height="16" rx="1.2" fill="currentColor"/><line x1="4" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="4" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="7" y1="16" x2="14" y2="16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>', run: function(){ applyFormat('quote', null, 'right'); } }
    ]},
    hr: { title: '구분선', options: [
      { label: '가로 구분선', preview: '<span class="s-preview"><svg viewBox="0 0 24 24" fill="none"><line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>', run: function(){ applyHr('line'); } },
      { label: '점 세 개', preview: '<span class="s-preview"><svg viewBox="0 0 24 24" fill="none"><circle cx="7" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="17" cy="12" r="1.5" fill="currentColor"/></svg></span>', run: function(){ applyHr('dots'); } },
      { label: '짧은 중앙선', preview: '<span class="s-preview"><svg viewBox="0 0 24 24" fill="none"><line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>', run: function(){ applyHr('short'); } }
    ]},
    'bub-recv': { title: '왼쪽 말풍선 (상대)', options: [
      { label: '연속 (꼬리 없음)', preview: '<span class="pk-ic pk-recv"></span>', run: function(){ applyFormat('bub-recv', false, null, false); } },
      { label: '이름 + 연속', preview: '<span class="pk-ic pk-recv"></span>', run: function(){ applyFormat('bub-recv', false, null, true); } },
      { label: '마지막 (꼬리 있음)', preview: '<span class="pk-ic pk-recv">'+tailSvg+'</span>', run: function(){ applyFormat('bub-recv', true, null, false); } },
      { label: '이름 + 마지막', preview: '<span class="pk-ic pk-recv">'+tailSvg+'</span>', run: function(){ applyFormat('bub-recv', true, null, true); } }
    ]},
    'bub-send': { title: '오른쪽 말풍선 (나)', options: [
      { label: '연속 (꼬리 없음)', preview: '<span class="pk-ic pk-send"></span>', run: function(){ applyFormat('bub-send', false, null, false); } },
      { label: '이름 + 연속', preview: '<span class="pk-ic pk-send"></span>', run: function(){ applyFormat('bub-send', false, null, true); } },
      { label: '마지막 (꼬리 있음)', preview: '<span class="pk-ic pk-send">'+tailSvg+'</span>', run: function(){ applyFormat('bub-send', true, null, false); } },
      { label: '이름 + 마지막', preview: '<span class="pk-ic pk-send">'+tailSvg+'</span>', run: function(){ applyFormat('bub-send', true, null, true); } }
    ]}
  };
  var sheetOverlay = $('sheet-overlay'), sheetEl = $('sheet'),
      sheetTitle = $('sheet-title'), sheetList = $('sheet-list'), sheetCancel = $('sheet-cancel');
  var _sheetSavedRange = null;
  function openSheet(key){
    var def = SHEETS[key]; if(!def || !sheetOverlay) return;
    // 현재 에디터 선택을 보존 (시트 여는 동안 포커스 이동해도 복원)
    var sel = window.getSelection();
    _sheetSavedRange = (sel && sel.rangeCount && editor.contains(sel.getRangeAt(0).startContainer)) ? sel.getRangeAt(0).cloneRange() : (_savedRange ? _savedRange.cloneRange() : null);
    sheetTitle.textContent = def.title;
    sheetList.innerHTML = '';
    def.options.forEach(function(opt){
      var b = document.createElement('button'); b.type='button';
      var pv = (typeof opt.preview==='function') ? opt.preview() : (opt.preview||'');
      b.innerHTML = pv + '<span>'+opt.label+'</span>';
      b.addEventListener('click', function(ev){
        ev.preventDefault(); ev.stopPropagation();
        closeSheet();
        // 보존한 선택을 복원한 뒤 서식 적용
        if(_sheetSavedRange && editor.contains(_sheetSavedRange.startContainer)){
          editor.focus();
          var s=window.getSelection(); s.removeAllRanges(); s.addRange(_sheetSavedRange);
        }
        opt.run();
      });
      sheetList.appendChild(b);
    });
    sheetOverlay.hidden = false;
    requestAnimationFrame(function(){ sheetOverlay.classList.add('is-open'); });
  }
  function closeSheet(){
    if(!sheetOverlay) return;
    sheetOverlay.classList.remove('is-open');
    setTimeout(function(){ sheetOverlay.hidden = true; }, 260);
  }
  document.querySelectorAll('[data-sheet]').forEach(function(btn){
    bindTap(btn, function(e){ if(e){ e.preventDefault(); e.stopPropagation(); } openSheet(btn.getAttribute('data-sheet')); });
  });
  if(sheetCancel){ sheetCancel.addEventListener('click', closeSheet); }
  if(sheetOverlay){ sheetOverlay.addEventListener('click', function(e){ if(e.target===sheetOverlay){ closeSheet(); } }); }
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && sheetOverlay && !sheetOverlay.hidden){ closeSheet(); } });

  function bindBubTool(btn, action){
    bindTap(btn, function(e){
      if(e){ e.preventDefault(); e.stopPropagation(); }
      editor.focus(); restoreSel();
      var b = caretInBubble();
      if(b){ action(b); cleanEditor(); render(); saveSel(); }
      updateFormatButtons();
    });
  }
  bindBubTool($('bub-exit'), exitBubble);
  bindBubTool($('bub-del'), unwrapBubble);
  bindBubTool($('bub-exit-2'), exitBubble);
  bindBubTool($('bub-del-2'), unwrapBubble);

  // 제목 삭제/나가기 (confirm 없이 단순 처리)
  function bindSimple(btn, run){
    if(!btn) return;
    var swallow = false;
    btn.addEventListener('touchend', function(e){ swallow=true; run(e); setTimeout(function(){ swallow=false; }, 400); }, {passive:false});
    btn.addEventListener('click', function(e){ if(swallow){ swallow=false; e.preventDefault(); e.stopPropagation(); return; } run(e); });
  }
  bindSimple($('title-del'), function(e){
    if(e){ e.preventDefault(); e.stopPropagation(); }
    var blocks = editor.querySelectorAll('.g-title-blk'); if(!blocks.length) return;
    [].forEach.call(blocks, function(blk){
      var parent=blk.parentNode, nx=blk.nextSibling;
      if(parent){ parent.removeChild(blk); }
      if(nx && nx.nodeType===1 && nx.tagName==='BR' && nx.parentNode){ nx.parentNode.removeChild(nx); }
    });
    cleanEditor(); render(); updateFormatButtons();
  });
  bindSimple($('title-exit'), function(e){
    if(e){ e.preventDefault(); e.stopPropagation(); }
    var blk = findTitleBlock(); if(!blk) return;
    editor.focus();
    var anchor=document.createTextNode('\u200b'), after=blk.nextSibling;
    if(after){ blk.parentNode.insertBefore(anchor, after); } else { blk.parentNode.appendChild(anchor); }
    if(!anchor.nextSibling){ blk.parentNode.appendChild(document.createElement('br')); }
    var sel=window.getSelection(), r=document.createRange(); r.setStart(anchor, anchor.nodeValue.length); r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r); saveSel(); updateFormatButtons();
  });

  /* ============================================================
     서식 버튼 활성 상태
     ============================================================ */
  function hasFormat(node, fmt){
    var el = node && node.nodeType===3 ? node.parentNode : node;
    while(el && el!==editor && el.nodeType===1){
      var tag = el.tagName;
      if(fmt==='bold' && (tag==='B'||tag==='STRONG')) return true;
      if(fmt==='italic' && (tag==='I'||tag==='EM')) return true;
      if(fmt==='underline' && tag==='MARK' && el.classList.contains('ul')) return true;
      if(fmt==='sub' && tag==='MARK' && el.classList.contains('sub')) return true;
      if(fmt==='strike' && (tag==='S'||tag==='STRIKE')) return true;
      if(fmt==='hl' && tag==='MARK' && el.classList.contains('hl')) return true;
      if(fmt==='emph' && tag==='MARK' && el.classList.contains('em')) return true;
      if(fmt==='bub-recv' && el.classList && el.classList.contains('g-bub') && el.classList.contains('recv')) return true;
      if(fmt==='bub-send' && el.classList && el.classList.contains('g-bub') && el.classList.contains('send')) return true;
      if(fmt==='bold'){ var fw=el.style.fontWeight; if(fw==='bold'||fw==='700'||(+fw>=600)) return true; }
      if(fmt==='italic' && el.style.fontStyle==='italic') return true;
      el = el.parentNode;
    }
    return false;
  }
  function updateFormatButtons(){
    var sel = window.getSelection(), node = null;
    if(sel && sel.rangeCount>0){ var r=sel.getRangeAt(0); if(editor.contains(r.startContainer)){ node=r.startContainer; } }
    if(!node && _savedRange && editor.contains(_savedRange.startContainer)){ node=_savedRange.startContainer; }
    document.querySelectorAll('.fmt .fbtn[data-fmt]').forEach(function(btn){
      var fmt = btn.getAttribute('data-fmt');
      btn.classList.toggle('is-active', node ? hasFormat(node, fmt) : false);
    });
    var bubShown = !!(node && closestBubble(node));
    var titleShown = !!findTitleBlock();
    // 에디터 고정 영역: 제목/말풍선 공용 lowtools
    var subtools = document.querySelector('.editor-fixed .subtools');
    if(subtools){ subtools.hidden = !bubShown; }
    var tdel = $('title-del'); if(tdel){ tdel.hidden = !titleShown; }
    var texit = $('title-exit'); if(texit){ texit.hidden = !titleShown; }
    var low = document.querySelector('.editor-fixed .lowtools');
    if(low){ low.hidden = !(bubShown || titleShown); }
    // 말풍선 탭: 전용 lowtools
    var bubLow = $('bub-lowtools'); if(bubLow){ bubLow.hidden = !bubShown; }
  }
  editor.addEventListener('keyup', updateFormatButtons);
  editor.addEventListener('mouseup', updateFormatButtons);
  editor.addEventListener('focus', updateFormatButtons);
  editor.addEventListener('input', updateFormatButtons);
  document.addEventListener('selectionchange', function(){ if(document.activeElement===editor){ updateFormatButtons(); } });

  /* ============================================================
     에디터 정리
     ============================================================ */
  function isSpecialBlock(el){
    return el && el.nodeType===1 && el.classList && (
      el.classList.contains('g-title-blk') || el.classList.contains('g-title-main') ||
      el.classList.contains('g-title-sub') || el.classList.contains('g-quote') || el.classList.contains('g-hr'));
  }
  function insideSpecialBlock(el){ var p=el; while(p && p!==editor){ if(isSpecialBlock(p)) return true; p=p.parentNode; } return false; }
  function normalizeBlocks(){
    var arr = Array.prototype.slice.call(editor.querySelectorAll('div, p')).reverse();
    arr.forEach(function(el){
      if(isSpecialBlock(el) || insideSpecialBlock(el)) return;
      var parent=el.parentNode; if(!parent) return;
      var prev=el.previousSibling, next=el.nextSibling;
      var prevIsBr = prev && prev.nodeType===1 && prev.tagName==='BR';
      var isEmpty = el.childNodes.length===0;
      if(prev && !prevIsBr){ parent.insertBefore(document.createElement('br'), el); }
      while(el.firstChild){ parent.insertBefore(el.firstChild, el); }
      if(next && !(next.nodeType===1 && next.tagName==='BR') && !isEmpty){ parent.insertBefore(document.createElement('br'), el); }
      parent.removeChild(el);
    });
  }
  function cleanEditor(){
    editor.querySelectorAll('[style]').forEach(function(el){
      el.style.removeProperty('font-size'); el.style.removeProperty('font-family');
      el.style.removeProperty('line-height'); el.style.removeProperty('letter-spacing');
      if(!el.classList.contains('hl')){ el.style.removeProperty('background'); el.style.removeProperty('background-image'); }
      if(el.getAttribute('style')===''){ el.removeAttribute('style'); }
    });
    var tw = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
    var sel = window.getSelection();
    var caretNode = (sel && sel.rangeCount && editor.contains(sel.getRangeAt(0).startContainer)) ? sel.getRangeAt(0).startContainer : null;
    var zwsp = [];
    while(tw.nextNode()){ if(tw.currentNode.nodeValue.indexOf('\u200b')!==-1){ zwsp.push(tw.currentNode); } }
    zwsp.forEach(function(n){ if(n===caretNode) return; n.nodeValue=n.nodeValue.replace(/\u200b/g,''); if(n.nodeValue==='' && n.parentNode){ n.parentNode.removeChild(n); } });
    normalizeBlocks(); syncTails(editor); updateEmptyBubbles();
  }
  function updateEmptyBubbles(){
    [].forEach.call(editor.querySelectorAll('.g-bub'), function(b){
      var txt = b.textContent.replace(/\u200b/g,'').trim();
      var empty = txt==='' && !b.querySelector('img');
      b.classList.toggle('is-empty', empty);
      if(empty){
        var hasText=false;
        for(var i=0;i<b.childNodes.length;i++){ if(b.childNodes[i].nodeType===3){ hasText=true; break; } }
        if(!hasText){ b.appendChild(document.createTextNode('\u200b')); }
      }
    });
  }

  /* ============================================================
     Enter / paste
     ============================================================ */
  var _lineBreakGuard = false;
  function doLineBreak(){
    var inBub = caretInBubble();
    var sel=window.getSelection(); if(!sel || sel.rangeCount===0) return false;
    var range=sel.getRangeAt(0);
    if(!editor.contains(range.startContainer)) return false;
    range.deleteContents();
    var br=document.createElement('br'); range.insertNode(br);
    // br 바로 뒤 위치는 브라우저가 이전 텍스트로 병합시켜 줄바꿈이 씹히므로,
    // 커서가 안착할 텍스트 노드를 br 뒤에 명시적으로 만든다.
    var anchor = document.createTextNode('\u200b');
    if(br.nextSibling){ br.parentNode.insertBefore(anchor, br.nextSibling); }
    else { br.parentNode.appendChild(anchor); }
    var r2=document.createRange();
    r2.setStart(anchor, anchor.nodeValue.length); r2.collapse(true);
    sel.removeAllRanges(); sel.addRange(r2);
    saveSel();
    render();
    return true;
  }
  // 이벤트 순서: keydown → beforeinput → input
  // 데스크톱/일반: keydown에서 처리하고 가드를 세워 beforeinput 중복을 막는다.
  // 모바일 IME: keydown이 keyCode 229로 와서 건너뛰고, beforeinput이 처리한다.
  editor.addEventListener('keydown', function(e){
    if(e.key==='Enter' && !e.isComposing && e.keyCode!==229){
      e.preventDefault();
      _lineBreakGuard = true;
      setTimeout(function(){ _lineBreakGuard = false; }, 0);
      doLineBreak();
    }
  });
  editor.addEventListener('beforeinput', function(e){
    if(e.inputType==='insertLineBreak' || e.inputType==='insertParagraph'){
      e.preventDefault();
      if(_lineBreakGuard){ return; }   // keydown이 이미 처리함
      doLineBreak();
    }
  });
  editor.addEventListener('paste', function(e){
    e.preventDefault();
    var text = ((e.originalEvent||e).clipboardData || window.clipboardData).getData('text/plain');
    insertPlainText(text); render();
  });
  function insertPlainText(text){
    editor.focus();
    var sel = window.getSelection();
    if(!sel.rangeCount){ editor.appendChild(document.createTextNode(text)); return; }
    sel.deleteFromDocument();
    var range = sel.getRangeAt(0);
    var lines = text.replace(/\r\n/g,'\n').split('\n');
    var frag = document.createDocumentFragment();
    lines.forEach(function(line, i){ if(i>0) frag.appendChild(document.createElement('br')); frag.appendChild(document.createTextNode(line)); });
    range.insertNode(frag); sel.collapseToEnd();
  }

  /* ============================================================
     정렬 / 크기 모드 / 비율
     ============================================================ */
  /* 세그먼트 슬라이딩 썸: 활성 버튼 위치로 이동 */
  function moveThumb(seg){
    if(!seg) return;
    var thumb = seg.querySelector('.seg__thumb');
    if(!thumb) return;
    var active = seg.querySelector('button[aria-pressed="true"]');
    if(!active){ thumb.style.opacity='0'; return; }
    thumb.style.opacity='1';
    var segRect = seg.getBoundingClientRect();
    var aRect = active.getBoundingClientRect();
    if(segRect.width===0){ return; } // 숨겨진 상태면 스킵
    var pad = 3;
    thumb.style.width = aRect.width + 'px';
    thumb.style.transform = 'translateX(' + (aRect.left - segRect.left - pad) + 'px)';
  }
  function moveAllThumbs(){ moveThumb($('align-seg')); moveThumb($('size-seg')); moveThumb($('ratio-seg')); moveThumb($('hl-slot-seg')); moveThumb($('em-slot-seg')); }

  document.querySelectorAll('#align-seg button').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('#align-seg button').forEach(function(b){ b.setAttribute('aria-pressed','false'); });
      btn.setAttribute('aria-pressed','true');
      currentAlign = btn.getAttribute('data-align'); moveThumb($('align-seg')); render();
    });
  });
  document.querySelectorAll('#size-seg button').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('#size-seg button').forEach(function(b){ b.setAttribute('aria-pressed','false'); });
      btn.setAttribute('aria-pressed','true');
      sizeMode = btn.getAttribute('data-mode');
      $('width-row').style.display = sizeMode==='width' ? '' : 'none';
      $('ratio-row').style.display = sizeMode==='ratio' ? '' : 'none';
      moveThumb($('size-seg'));
      requestAnimationFrame(function(){ moveThumb($('ratio-seg')); });
      render();
    });
  });
  /* 형광펜/강조색 슬롯 토글 (1/2/3) — 프리셋이 들어갈 활성 슬롯 선택 */
  document.querySelectorAll('#hl-slot-seg button').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('#hl-slot-seg button').forEach(function(b){ b.setAttribute('aria-pressed','false'); });
      btn.setAttribute('aria-pressed','true');
      hlSlot = parseInt(btn.getAttribute('data-slot'),10) || 1;
      var lbl=$('hl-slot-val'); if(lbl){ lbl.textContent = '형광펜 '+hlSlot; }
      moveThumb($('hl-slot-seg'));
      markDot(hlWrap, hlPresets, hlColorOf(hlSlot));
    });
  });
  document.querySelectorAll('#em-slot-seg button').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('#em-slot-seg button').forEach(function(b){ b.setAttribute('aria-pressed','false'); });
      btn.setAttribute('aria-pressed','true');
      emSlot = parseInt(btn.getAttribute('data-slot'),10) || 1;
      var lbl=$('em-slot-val'); if(lbl){ lbl.textContent = '강조 '+emSlot; }
      moveThumb($('em-slot-seg'));
      markDot(emWrap, emPresets, emColorOf(emSlot));
    });
  });

  /* 폴드가 열릴 때 세그 thumb 재배치 (숨겨진 동안엔 폭이 0이라 위치를 못 잡음) */
  var _foldEmph=$('fold-emph'), _foldHl=$('fold-hl');
  if(_foldEmph){ _foldEmph.addEventListener('toggle', function(){ if(_foldEmph.open){ requestAnimationFrame(function(){ moveThumb($('em-slot-seg')); }); } }); }
  if(_foldHl){ _foldHl.addEventListener('toggle', function(){ if(_foldHl.open){ requestAnimationFrame(function(){ moveThumb($('hl-slot-seg')); }); } }); }

  var ratios = [
    {w:1,h:1,label:'1:1',rw:1080}, {w:4,h:5,label:'4:5',rw:1080},
    {w:3,h:4,label:'3:4',rw:1200}, {w:9,h:16,label:'9:16',rw:1080}
  ];
  var rSeg = $('ratio-seg');
  ratios.forEach(function(p, idx){
    var b=document.createElement('button'); b.type='button'; b.textContent=p.label;
    b.setAttribute('aria-pressed', idx===1 ? 'true' : 'false');
    b.addEventListener('click', function(){
      [].forEach.call(rSeg.querySelectorAll('button'), function(x){ x.setAttribute('aria-pressed','false'); });
      b.setAttribute('aria-pressed','true');
      ratio={w:p.w,h:p.h}; if(p.rw){ $('ratio-w').value=p.rw; } moveThumb(rSeg); render();
    });
    rSeg.appendChild(b);
  });
  // ratio-seg thumb 요소 추가 (동적 생성 후)
  var rThumb=document.createElement('span'); rThumb.className='seg__thumb'; rSeg.appendChild(rThumb);

  function baseW(){
    if(sizeMode==='ratio') return parseFloat($('ratio-w').value) || 1080;
    return parseFloat($('base-w').value) || 1200;
  }

  /* ============================================================
     형광펜 색 합성
     ============================================================ */
  function hlMixColor(fg){
    var c=(fg||'').trim().replace('#',''); if(c.length===3){ c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2]; }
    if(!/^[0-9a-fA-F]{6}$/.test(c)) return '#ffffff';
    var r=parseInt(c.slice(0,2),16), g=parseInt(c.slice(2,4),16), b=parseInt(c.slice(4,6),16);
    return ((0.299*r+0.587*g+0.114*b)/255) < 0.5 ? '#ffffff' : '#3a3a3a';
  }
  function hlMixRatio(fg){
    var c=(fg||'').trim().replace('#',''); if(c.length===3){ c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2]; }
    if(!/^[0-9a-fA-F]{6}$/.test(c)) return 0.72;
    var r=parseInt(c.slice(0,2),16), g=parseInt(c.slice(2,4),16), b=parseInt(c.slice(4,6),16);
    return ((0.299*r+0.587*g+0.114*b)/255) < 0.5 ? 0.72 : 0.92;
  }
  function hlToRgba(c, alpha, bg){
    function parseHex(v){ v=(v||'').trim(); var m=v.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/); if(!m) return null;
      var hex=m[1]; if(hex.length===3){ hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]; }
      return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)]; }
    var fg=parseHex(c), bgc=parseHex(bg)||[255,255,255];
    if(!fg) return c || '#eaeaea';
    var a = (alpha==null?0.72:alpha);
    function h2(n){ return ('0'+n.toString(16)).slice(-2); }
    return '#'+h2(Math.round(fg[0]*a+bgc[0]*(1-a)))+h2(Math.round(fg[1]*a+bgc[1]*(1-a)))+h2(Math.round(fg[2]*a+bgc[2]*(1-a)));
  }
  function applyHlSolid(root){
    var fg=$('c-fg').value, mixC=hlMixColor(fg), mixR=hlMixRatio(fg);
    [].forEach.call(root.querySelectorAll('mark.hl'), function(mk){
      var hl = mk.style.getPropertyValue('--hl') || $('c-hl').value || '#eaeaea'; hl=(hl&&hl.trim())||'#eaeaea';
      mk.style.setProperty('--hl-solid', hlToRgba(hl, mixR, mixC));
    });
  }

  /* ============================================================
     캔버스 스타일 적용
     ============================================================ */
  function styleCanvas(el){
    var fs = parseFloat($('font-size').value);
    var pad = parseFloat($('pad').value);
    var ls = parseFloat($('letter-spacing').value);
    var mode = $('break-mode').value;
    var w = baseW();
    el.style.width = w+'px';
    el.style.background = bgValue;
    el.style.setProperty('--bub-recv', $('c-brecv').value);
    el.style.setProperty('--bub-send', $('c-bsend').value);
    el.style.setProperty('--bub-recv-ink', bubInkRecv());
    el.style.setProperty('--bub-send-ink', bubInkSend());
    el.style.setProperty('--title-color', $('c-title').value);
    el.style.setProperty('--subtitle-color', $('c-subtitle').value);
    var tsz=$('title-size'), ssz=$('subtitle-size'), nsz=$('name-size');
    if(tsz){ el.style.setProperty('--title-size', parseFloat(tsz.value)+'px'); }
    if(ssz){ el.style.setProperty('--subtitle-size', parseFloat(ssz.value)+'px'); }
    if(nsz){ el.style.setProperty('--name-size', parseFloat(nsz.value)+'px'); }
    var tf=$('title-font'), nf=$('name-font');
    el.style.setProperty('--title-font', (tf && tf.value) ? tf.value : $('font').value);
    el.style.setProperty('--name-font', (nf && nf.value) ? nf.value : $('font').value);
    el.style.setProperty('--sub-color', $('c-sub').value);
    el.style.setProperty('--quote-color', $('c-quote').value);
    el.style.setProperty('--hr-color', $('c-hr').value);
    el.style.setProperty('--bub-name-recv', $('c-brecv-name').value);
    el.style.setProperty('--bub-name-send', $('c-bsend-name').value);
    el.style.color = $('c-fg').value;
    el.style.fontFamily = $('font').value;
    el.style.fontSize = fs+'px';
    el.style.letterSpacing = ls+'px';
    el.style.lineHeight = String((parseFloat($('line-height').value)/10).toFixed(2));
    el.style.padding = pad+'px';
    el.style.textAlign = currentAlign;
    el.style.wordBreak = (mode==='word') ? 'keep-all' : 'break-all';
    var inner = el.querySelector('.g-inner'); if(inner){ inner.style.width='100%'; }
    var layer = el.querySelector('.g-bg-layer');
    if(photoOn && photoData){
      if(!layer){ layer=document.createElement('div'); layer.className='g-bg-layer'; el.insertBefore(layer, el.firstChild); }
      var op = parseFloat($('opacity').value); if(isNaN(op)) op=100;
      var br = parseFloat($('bright').value) || 100;
      layer.style.setProperty('background-image','url("'+photoData+'")','important');
      layer.style.setProperty('background-size','cover','important');
      layer.style.setProperty('background-position','center','important');
      layer.style.setProperty('filter','brightness('+(br/100)+')','important');
      layer.style.setProperty('opacity', String(op/100), 'important');
      layer.style.setProperty('inset','0','important');
    } else if(layer){ layer.parentNode.removeChild(layer); }
    if(sizeMode==='ratio' && ratio){
      el.style.height = (w*ratio.h/ratio.w)+'px';
      el.style.display='flex'; el.style.flexDirection='column'; el.style.justifyContent='center';
    } else { el.style.height=''; el.style.display=''; el.style.justifyContent=''; }
  }

  /* ============================================================
     sanitize (저장 HTML 정리 + 옛 저장본 마이그레이션)
     ============================================================ */
  function sanitize(root){
    var allowed = {B:1,STRONG:1,I:1,EM:1,S:1,STRIKE:1,BR:1,MARK:1,U:1,SPAN:1};
    function specialBlockClass(ch){
      if(!ch.classList) return '';
      if(ch.classList.contains('g-title-blk')) return 'g-title-blk';
      if(ch.classList.contains('g-title-main')) return 'g-title-main';
      if(ch.classList.contains('g-title-sub')) return 'g-title-sub';
      if(ch.classList.contains('g-hr')){ var k=ch.classList.contains('dots')?'dots':(ch.classList.contains('short')?'short':'line'); return 'g-hr '+k; }
      if(ch.classList.contains('g-quote')){ var s=ch.classList.contains('right')?'right':'left'; return 'g-quote '+s; }
      return '';
    }
    function walk(node){
      Array.prototype.slice.call(node.childNodes).forEach(function(ch){
        if(ch.nodeType!==1) return;
        if(ch.nodeName && ch.nodeName.toLowerCase()==='svg') return;
        var tag = ch.tagName;
        var isBub = tag==='SPAN' && ch.classList.contains('g-bub');
        var isBubName = tag==='SPAN' && ch.classList.contains('g-bub-name');
        var spBlk = (tag==='DIV') ? specialBlockClass(ch) : '';
        if(spBlk){
          var isHrBlk = spBlk.indexOf('g-hr')===0;
          for(var k=ch.attributes.length-1;k>=0;k--){ ch.removeAttribute(ch.attributes[k].name); }
          ch.className = spBlk;
          if(isHrBlk){ ch.setAttribute('contenteditable','false'); if(spBlk.indexOf('dots')>-1 && ch.textContent.replace(/\u200b/g,'').trim()===''){ ch.textContent='•  •  •'; } }
          walk(ch); return;
        }
        if(!allowed[tag] || (tag==='SPAN' && !isBub && !isBubName)){
          walk(ch);
          var parent = ch.parentNode;
          if(tag==='DIV' || tag==='P'){
            var had = ch.childNodes.length>0, prevSib=ch.previousSibling;
            var prevIsBr = prevSib && prevSib.nodeType===1 && prevSib.tagName==='BR';
            while(ch.firstChild){ parent.insertBefore(ch.firstChild, ch); }
            if(had && !prevIsBr){ parent.insertBefore(document.createElement('br'), ch); }
          } else { while(ch.firstChild){ parent.insertBefore(ch.firstChild, ch); } }
          parent.removeChild(ch);
        } else {
          var isHl=(tag==='MARK'||tag==='U') && ch.classList.contains('hl');
          var isEm=(tag==='MARK') && ch.classList.contains('em');
          var isUl=(tag==='MARK') && ch.classList.contains('ul');
          var isSub=(tag==='MARK') && ch.classList.contains('sub');
          var bubKind = isBub ? (ch.classList.contains('send')?'send':'recv') : '';
          var nameKind = isBubName ? (ch.classList.contains('send')?'send':'recv') : '';
          var bubTail = isBub ? !ch.classList.contains('cont') : false;
          var hlColor = isHl ? ch.style.getPropertyValue('--hl') : '';
          var emColor = isEm ? ch.style.getPropertyValue('--em') : '';
          for(var i=ch.attributes.length-1;i>=0;i--){ ch.removeAttribute(ch.attributes[i].name); }
          if(isBub){ ch.className='g-bub '+bubKind+' '+(bubTail?'tail':'cont'); }
          else if(isBubName){ ch.className='g-bub-name '+nameKind; }
          else if(isHl){
            if(tag==='U'){ var m=document.createElement('mark'); m.className='hl'; if(hlColor) m.style.setProperty('--hl', hlColor); while(ch.firstChild){ m.appendChild(ch.firstChild); } ch.parentNode.replaceChild(m, ch); ch=m; }
            else { ch.className='hl'; if(hlColor) ch.style.setProperty('--hl', hlColor); }
          }
          else if(isEm){ ch.className='em'; if(emColor) ch.style.setProperty('--em', emColor); }
          else if(isUl){ ch.className='ul'; }
          else if(isSub){ ch.className='sub'; }
          walk(ch);
        }
      });
    }
    walk(root);
  }

  function buildHtml(){
    var tmp = document.createElement('div');
    for(var i=0;i<editor.childNodes.length;i++){ tmp.appendChild(editor.childNodes[i].cloneNode(true)); }
    sanitize(tmp);
    var tw = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT, null, false), zs=[];
    while(tw.nextNode()){ if(tw.currentNode.nodeValue.indexOf('\u200b')!==-1){ zs.push(tw.currentNode); } }
    zs.forEach(function(n){ n.nodeValue=n.nodeValue.replace(/\u200b/g,''); });
    [].forEach.call(tmp.querySelectorAll('.g-bub'), function(b){ if(b.textContent.trim()==='' && !b.querySelector('img')){ if(b.parentNode) b.parentNode.removeChild(b); } });
    [].forEach.call(tmp.querySelectorAll('.g-bub-name'), function(n){ if(n.textContent.replace(/\u200b/g,'').trim()===''){ if(n.parentNode) n.parentNode.removeChild(n); } });
    syncTails(tmp);
    var html = tmp.innerHTML;
    // 제목/소제목 (별도 입력창) → 맨 앞
    var tEmpty = titleIsEmpty(), sEmpty = subtitleIsEmpty();
    if(!tEmpty || !sEmpty){
      var titleBlk = '<div class="g-title-blk">';
      if(!tEmpty){ titleBlk += '<div class="g-title-main">'+ edToHtml($('title-ed')) +'</div>'; }
      if(!sEmpty){ titleBlk += '<div class="g-title-sub">'+ edToHtml($('subtitle-ed')) +'</div>'; }
      titleBlk += '</div>';
      html = titleBlk + html;
    }
    if(!nameIsEmpty()){
      var opt = $('name-pos').value || 'plain-left';
      var parts = opt.split('-'), style=parts[0]||'plain', align=parts[1]||'left';
      var nameColor = $('c-name').value || '#737373', barColor = $('c-bar').value || '#d1d1d1';
      html += '<span class="g-name s-'+style+' '+align+'" style="--name-color:'+nameColor+';--bar-color:'+barColor+';">'+ nameHtml() +'</span>';
    }
    return html;
  }

  /* ============================================================
     렌더 + 스케일링
     ============================================================ */
  function setVal(sliderId, text){
    var s=$(sliderId); if(!s) return;
    var wrap=s.closest('.rangewrap'); var lbl=wrap?wrap.previousElementSibling:null;
    var span=lbl?lbl.querySelector('.val'):null; if(span) span.textContent=text;
  }
  function render(){
    updateEmptyBubbles();
    canvas.innerHTML = '<div class="g-inner">' + buildHtml() + '</div>';
    styleCanvas(canvas); applyHlSolid(canvas); fitStage();
    setVal('font-size', $('font-size').value+'px');
    setVal('letter-spacing', parseFloat($('letter-spacing').value).toFixed(1));
    setVal('line-height', (parseFloat($('line-height').value)/10).toFixed(1));
    setVal('pad', $('pad').value+'px');
    setVal('base-w', $('base-w').value+'px');
    setVal('ratio-w', $('ratio-w').value+'px');
    setVal('opacity', $('opacity').value+'%');
    setVal('bright', $('bright').value+'%');
    var meta = $('preview-meta');
    if(meta){
      var w = baseW();
      meta.textContent = (sizeMode==='ratio') ? (w+' × '+Math.round(w*ratio.h/ratio.w)+' px') : (w+' px');
    }
    saveState();
  }
  var _fr;
  function fitStage(){
    if(_fr) cancelAnimationFrame(_fr);
    _fr = requestAnimationFrame(function(){
      var stage=$('stage'), inner=$('stage-in'); if(!stage || !inner) return;
      var avail=stage.clientWidth; if(!avail) return;
      inner.style.width = baseW()+'px';
      var scale = avail/baseW(); inner.style.transform='scale('+scale+')';
      stage.style.height = (canvas.offsetHeight*scale)+'px';
    });
  }
  if(window.ResizeObserver){ new ResizeObserver(fitStage).observe(document.querySelector('.preview__scroll')); }
  window.addEventListener('resize', fitStage);
  editor.addEventListener('input', render);

  if(nameEd){
    nameEd.addEventListener('input', render);
    function nameLineBreak(){
      var sel=window.getSelection(); if(!sel || sel.rangeCount===0) return false;
      var range=sel.getRangeAt(0);
      if(!nameEd.contains(range.startContainer)) return false;
      range.deleteContents();
      var br=document.createElement('br'); range.insertNode(br);
      var needTrailing=!br.nextSibling || (br.nextSibling.nodeType===1 && br.nextSibling.tagName==='BR' && !br.nextSibling.nextSibling);
      if(needTrailing){ var extra=document.createElement('br'); br.parentNode.insertBefore(extra, br.nextSibling); }
      range.setStartAfter(br); range.collapse(true); sel.removeAllRanges(); sel.addRange(range); render();
      return true;
    }
    nameEd.addEventListener('beforeinput', function(e){
      if(e.inputType==='insertLineBreak' || e.inputType==='insertParagraph'){ e.preventDefault(); nameLineBreak(); }
    });
    nameEd.addEventListener('keydown', function(e){
      if(e.key==='Enter' && !e.isComposing && e.keyCode!==229){ e.preventDefault(); nameLineBreak(); }
    });
    nameEd.addEventListener('paste', function(e){
      e.preventDefault();
      var text=((e.originalEvent||e).clipboardData||window.clipboardData).getData('text/plain');
      nameEd.focus();
      var sel=window.getSelection();
      if(!sel.rangeCount){ nameEd.appendChild(document.createTextNode(text)); render(); return; }
      sel.deleteFromDocument();
      var range=sel.getRangeAt(0), lines=text.replace(/\r\n/g,'\n').split('\n'), frag=document.createDocumentFragment();
      lines.forEach(function(line,i){ if(i>0) frag.appendChild(document.createElement('br')); frag.appendChild(document.createTextNode(line)); });
      range.insertNode(frag); sel.collapseToEnd(); render();
    });
  }

  // 제목/소제목 입력창(간단 편집: 줄바꿈 + 붙여넣기 평문화)
  function bindSimpleEditor(el){
    if(!el) return;
    el.addEventListener('input', render);
    function lineBreak(){
      var sel=window.getSelection(); if(!sel || sel.rangeCount===0) return;
      var range=sel.getRangeAt(0);
      if(!el.contains(range.startContainer)) return;
      range.deleteContents();
      var br=document.createElement('br'); range.insertNode(br);
      var needTrailing=!br.nextSibling || (br.nextSibling.nodeType===1 && br.nextSibling.tagName==='BR' && !br.nextSibling.nextSibling);
      if(needTrailing){ var extra=document.createElement('br'); br.parentNode.insertBefore(extra, br.nextSibling); }
      range.setStartAfter(br); range.collapse(true); sel.removeAllRanges(); sel.addRange(range); render();
    }
    el.addEventListener('beforeinput', function(e){
      if(e.inputType==='insertLineBreak' || e.inputType==='insertParagraph'){ e.preventDefault(); lineBreak(); }
    });
    el.addEventListener('keydown', function(e){
      if(e.key==='Enter' && !e.isComposing && e.keyCode!==229){ e.preventDefault(); lineBreak(); }
    });
    el.addEventListener('paste', function(e){
      e.preventDefault();
      var text=((e.originalEvent||e).clipboardData||window.clipboardData).getData('text/plain');
      el.focus();
      var sel=window.getSelection();
      if(!sel.rangeCount){ el.appendChild(document.createTextNode(text)); render(); return; }
      sel.deleteFromDocument();
      var range=sel.getRangeAt(0), lines=text.replace(/\r\n/g,'\n').split('\n'), frag=document.createDocumentFragment();
      lines.forEach(function(line,i){ if(i>0) frag.appendChild(document.createElement('br')); frag.appendChild(document.createTextNode(line)); });
      range.insertNode(frag); sel.collapseToEnd(); render();
    });
  }
  bindSimpleEditor($('title-ed'));
  bindSimpleEditor($('subtitle-ed'));

  // 제목/소제목 크기 슬라이더 + 글꼴 select
  function updateTitleSizeLabels(){
    var t=$('title-size'), s=$('subtitle-size'), n=$('name-size');
    if(t){ var tv=$('title-size-val'); if(tv) tv.textContent=parseFloat(t.value)+'px'; }
    if(s){ var sv=$('subtitle-size-val'); if(sv) sv.textContent=parseFloat(s.value)+'px'; }
    if(n){ var nv=$('name-size-val'); if(nv) nv.textContent=parseFloat(n.value)+'px'; }
  }
  ['title-size','subtitle-size','name-size','title-font','name-font'].forEach(function(id){
    var e=$(id); if(e){ e.addEventListener('input', function(){ updateTitleSizeLabels(); render(); }); e.addEventListener('change', function(){ updateTitleSizeLabels(); render(); }); }
  });

  ['name-pos','font','font-size','letter-spacing','line-height','pad','break-mode','base-w','ratio-w','opacity','bright'].forEach(function(id){
    var e=$(id); if(e){ e.addEventListener('input', render); e.addEventListener('change', render); }
  });

  /* ============================================================
     사진 배경
     ============================================================ */
  function updatePhotoUI(){
    $('photo-controls').hidden = !photoOn;
    $('photo-on').checked = photoOn;
    var pick=$('photo-pick'); if(pick){ pick.textContent = photoData ? '🖼 사진 변경' : '🖼 사진 선택'; }
  }
  $('photo-on').addEventListener('change', function(){
    photoOn = $('photo-on').checked;
    if(photoOn && !photoData){ $('photo-file').click(); }
    updatePhotoUI(); render();
  });
  $('photo-pick').addEventListener('click', function(){ $('photo-file').click(); });
  $('photo-file').addEventListener('change', function(e){
    var file=e.target.files && e.target.files[0]; if(!file) return;
    var reader=new FileReader();
    reader.onload=function(ev){ photoData=ev.target.result; photoOn=true; updatePhotoUI(); render(); };
    reader.readAsDataURL(file); e.target.value='';
  });

  /* ============================================================
     배경 굽기 (저장용)
     ============================================================ */
  function paintBackground(ctx, W, H, bgv, type){
    bgv=(bgv||'').trim();
    if(bgv.indexOf('gradient')>-1){ var g=parseLinearGradient(ctx,bgv,W,H); if(g){ ctx.fillStyle=g; ctx.fillRect(0,0,W,H); return; } ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H); return; }
    if(!bgv || bgv==='transparent'){ if(type==='image/jpeg'){ ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H); } return; }
    ctx.fillStyle=bgv; ctx.fillRect(0,0,W,H);
  }
  function parseLinearGradient(ctx, str, W, H){
    try{
      var inner=str.substring(str.indexOf('(')+1, str.lastIndexOf(')'));
      var parts=inner.split(',').map(function(s){ return s.trim(); });
      var angle=135; if(/deg\s*$/.test(parts[0])){ angle=parseFloat(parts[0]); parts.shift(); }
      var rad=(angle-90)*Math.PI/180, cx=W/2, cy=H/2;
      var len=Math.abs(W*Math.cos(rad))+Math.abs(H*Math.sin(rad));
      var dx=Math.cos(rad)*len/2, dy=Math.sin(rad)*len/2;
      var grad=ctx.createLinearGradient(cx-dx, cy-dy, cx+dx, cy+dy);
      parts.forEach(function(p,i){
        var mColor=p.match(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-zA-Z]+)/); var color=mColor?mColor[1]:p;
        var mPos=p.match(/(\d+(?:\.\d+)?)%/); var pos=mPos?parseFloat(mPos[1])/100:(i/(parts.length-1||1));
        pos=Math.max(0,Math.min(1,pos)); grad.addColorStop(pos, color);
      });
      return grad;
    }catch(e){ return null; }
  }
  function bakePhoto(srcData, opacityPct, brightPct, targetW, targetH, baseColor, type, cb){
    var img=new Image();
    img.onload=function(){
      var cw=targetW, ch=targetH;
      var cnv=document.createElement('canvas'); cnv.width=cw; cnv.height=ch;
      var cx=cnv.getContext('2d');
      var needBright=(brightPct!==100);
      var op=(opacityPct==null?100:opacityPct)/100; if(op<0)op=0; if(op>1)op=1;
      if(op<1){ paintBackground(cx, cw, ch, baseColor, type); }
      var ir=img.width/img.height, tr=cw/ch, dw, dh, dx, dy;
      if(ir>tr){ dh=ch; dw=ch*ir; dx=(cw-dw)/2; dy=0; } else { dw=cw; dh=cw/ir; dx=0; dy=(ch-dh)/2; }
      cx.save(); cx.globalAlpha=op; cx.drawImage(img, dx, dy, dw, dh); cx.restore();
      if(needBright){
        try{ var d=cx.getImageData(0,0,cw,ch), p=d.data, f=brightPct/100;
          for(var i=0;i<p.length;i+=4){ p[i]=Math.min(255,p[i]*f); p[i+1]=Math.min(255,p[i+1]*f); p[i+2]=Math.min(255,p[i+2]*f); }
          cx.putImageData(d,0,0);
        }catch(e){}
      }
      cb(cnv.toDataURL('image/png'));
    };
    img.onerror=function(){ cb(null); };
    img.src=srcData;
  }

  /* 꼬리 패스 (2D 캔버스에 직접) */
  function traceTailPath(ctx, x, y, w, h, flip){
    var sx=w/16, sy=h/20;
    function X(u){ return x + (flip ? (16-u) : u)*sx; }
    function Y(v){ return y + v*sy; }
    ctx.beginPath();
    ctx.moveTo(X(16),Y(0)); ctx.lineTo(X(16),Y(20));
    ctx.quadraticCurveTo(X(6),Y(20),X(0.6),Y(19.2));
    ctx.quadraticCurveTo(X(-0.9),Y(19.0),X(0.5),Y(18.2));
    ctx.quadraticCurveTo(X(6.2),Y(15.0),X(8),Y(10));
    ctx.quadraticCurveTo(X(9.2),Y(5.6),X(9),Y(0));
    ctx.closePath();
  }
  function collectTailRects(root){
    var rootRect=root.getBoundingClientRect(), out=[];
    [].forEach.call(root.querySelectorAll('.g-bub'), function(bub){
      var svg=null;
      for(var i=0;i<bub.childNodes.length;i++){ var c=bub.childNodes[i]; if(c.nodeType===1 && c.nodeName && c.nodeName.toLowerCase()==='svg'){ svg=c; break; } }
      if(!svg) return;
      var r=svg.getBoundingClientRect(); if(r.width<=0||r.height<=0) return;
      var isSend=bub.classList.contains('send');
      out.push({ x:r.left-rootRect.left, y:r.top-rootRect.top, w:r.width, h:r.height, flip:isSend, color:isSend?$('c-bsend').value:$('c-brecv').value });
    });
    return out;
  }
  function hideTails(root){
    var backup=[];
    [].forEach.call(root.querySelectorAll('svg.g-tail'), function(t){ backup.push([t, t.style.display]); t.style.display='none'; });
    return function(){ backup.forEach(function(p){ if(p[1]) p[0].style.display=p[1]; else p[0].style.removeProperty('display'); }); };
  }

  /* ============================================================
     이미지 내보내기
     ============================================================ */
  var _isIOS = (function(){
    var ua=navigator.userAgent||'';
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document!=='undefined' && 'ontouchend' in document);
  })();
  function canvasToBlob(cnv, type, quality){
    return new Promise(function(resolve, reject){
      if(cnv.toBlob){ cnv.toBlob(function(b){ b?resolve(b):reject(new Error('toBlob failed')); }, type, quality); }
      else { try{ var parts=cnv.toDataURL(type,quality).split(','), bin=atob(parts[1]), arr=new Uint8Array(bin.length);
        for(var i=0;i<bin.length;i++){ arr[i]=bin.charCodeAt(i); } resolve(new Blob([arr],{type:type})); }catch(e){ reject(e); } }
    });
  }
  function downloadBlob(blob, filename){
    var url=URL.createObjectURL(blob), link=document.createElement('a');
    link.download=filename; link.href=url; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 10000);
  }
  function deliverImage(cnv, type, done){
    var isJpg=(type==='image/jpeg'), filename=isJpg?'로그.jpg':'로그.png', quality=isJpg?0.95:undefined;
    canvasToBlob(cnv, type, quality).then(function(blob){
      var file=null; try{ file=new File([blob], filename, {type:type}); }catch(e){ file=null; }
      var canShare = _isIOS && file && navigator.share && navigator.canShare && navigator.canShare({files:[file]});
      if(canShare){
        navigator.share({files:[file]}).then(function(){ done(); }).catch(function(err){
          if(err && (err.name==='AbortError'||err.name==='NotAllowedError')){ done(); return; }
          try{ downloadBlob(blob, filename); }catch(e){} done();
        });
        return;
      }
      downloadBlob(blob, filename); done();
    }).catch(function(){ done(); });
  }

  var _busy=false;
  function doSave(type){
    if(_busy) return;
    _busy=true;
    var btns = document.querySelectorAll('#save-png,#save-jpg');
    [].forEach.call(btns, function(b){ b.disabled=true; });
    var isJpg=(type==='image/jpeg');
    var actBtns = document.querySelectorAll(isJpg ? '#save-jpg' : '#save-png');
    var origs=[]; [].forEach.call(actBtns, function(b){ origs.push([b, b.textContent]); b.textContent='저장 중…'; });
    function finish(){ _busy=false; [].forEach.call(btns, function(b){ b.disabled=false; }); origs.forEach(function(p){ p[0].textContent=p[1]; }); }
    var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    fontsReady.then(function(){ requestAnimationFrame(function(){ requestAnimationFrame(function(){
      try{ runSave(type, finish); }catch(e){ finish(); }
    }); }); });
  }

  function runSave(type, finish){
    render();
    var w = baseW();
    var stageIn=$('stage-in'), stage=$('stage');
    var prevTransform=stageIn.style.transform, prevStageH=stage.style.height;
    stageIn.style.transform='none'; stageIn.style.width=w+'px';
    var prevShadow=canvas.style.boxShadow, prevRadius=canvas.style.borderRadius;
    canvas.style.boxShadow='none'; canvas.style.borderRadius='0';
    var layer=canvas.querySelector('.g-bg-layer');

    function doCapture(){
      var h=canvas.offsetHeight, outW=w*2, outH=h*2;
      var canvasRect=canvas.getBoundingClientRect();
      var hlRects=[], marks=canvas.querySelectorAll('mark.hl');
      [].forEach.call(marks, function(mk){
        var color=mk.style.getPropertyValue('--hl-solid') || hlToRgba((mk.style.getPropertyValue('--hl')||$('c-hl').value||'#eaeaea').trim(), hlMixRatio($('c-fg').value), hlMixColor($('c-fg').value));
        var rects=mk.getClientRects();
        for(var i=0;i<rects.length;i++){ var r=rects[i]; if(r.width<=0||r.height<=0) continue;
          hlRects.push({ x:r.left-canvasRect.left, y:r.top-canvasRect.top, w:r.width, h:r.height, color:color }); }
      });
      var markBackup=[];
      [].forEach.call(marks, function(mk){
        markBackup.push([mk, mk.getAttribute('style')]);
        mk.style.setProperty('background','transparent','important');
        mk.style.setProperty('background-color','transparent','important');
        mk.style.setProperty('background-image','none','important');
      });
      var tailRects=collectTailRects(canvas);
      var restoreTails=hideTails(canvas);
      var hrRects=[];
      [].forEach.call(canvas.querySelectorAll('.g-hr.line, .g-hr.short'), function(hr){
        var r=hr.getBoundingClientRect(); if(r.width<=0||r.height<=0) return;
        var isShort=hr.classList.contains('short'), lineH=2, fullW=r.width, lineW=isShort?(fullW*0.12):fullW;
        var cx=(r.left-canvasRect.left)+fullW/2, cy=(r.top-canvasRect.top)+r.height/2;
        hrRects.push({ x:cx-lineW/2, y:cy-lineH/2, w:lineW, h:lineH, color:$('c-hr').value||'#d1d1d1' });
      });
      var hrBackup=[];
      [].forEach.call(canvas.querySelectorAll('.g-hr.line, .g-hr.short'), function(hr){ hrBackup.push([hr, hr.style.visibility]); hr.style.visibility='hidden'; });
      function restoreHrs(){ hrBackup.forEach(function(p){ if(p[1]) p[0].style.visibility=p[1]; else p[0].style.removeProperty('visibility'); }); }
      function restoreMarks(){ markBackup.forEach(function(pair){ if(pair[1]===null) pair[0].removeAttribute('style'); else pair[0].setAttribute('style', pair[1]); }); }

      var prevBg=canvas.style.background, prevBgColor=canvas.style.backgroundColor;
      canvas.style.setProperty('background','transparent','important');
      canvas.style.setProperty('background-color','transparent','important');
      var hlLayer=canvas.querySelector('.g-bg-layer'), prevLayerDisplay=null;
      if(hlLayer){ prevLayerDisplay=hlLayer.style.display; hlLayer.style.display='none'; }
      function restoreCanvasBg(){
        if(prevBg) canvas.style.background=prevBg; else canvas.style.removeProperty('background');
        if(prevBgColor) canvas.style.backgroundColor=prevBgColor; else canvas.style.removeProperty('background-color');
        styleCanvas(canvas); applyHlSolid(canvas);
        if(hlLayer && prevLayerDisplay!==null){ hlLayer.style.display=prevLayerDisplay; }
      }

      html2canvas(canvas, { scale:2, backgroundColor:null, useCORS:true, logging:false, width:w, height:h, scrollX:0, scrollY:0, x:0, y:0, windowWidth:w, windowHeight:h })
      .then(function(textCanvas){
        restoreMarks(); restoreTails(); restoreHrs(); restoreCanvasBg();
        prepareBackground(function(bakedPhotoImg){
          var out=document.createElement('canvas'); out.width=outW; out.height=outH;
          var ctx=out.getContext('2d');
          if(photoOn && photoData && bakedPhotoImg){ ctx.drawImage(bakedPhotoImg, 0, 0, outW, outH); }
          else { paintBackground(ctx, outW, outH, bgValue, type); }
          hlRects.forEach(function(rc){ ctx.fillStyle=rc.color; ctx.fillRect(rc.x*2, rc.y*2, rc.w*2, rc.h*2); });
          hrRects.forEach(function(rc){ ctx.fillStyle=rc.color; ctx.fillRect(rc.x*2, rc.y*2, rc.w*2, rc.h*2); });
          tailRects.forEach(function(t){ ctx.save(); ctx.fillStyle=t.color; traceTailPath(ctx, t.x*2, t.y*2, t.w*2, t.h*2, t.flip); ctx.fill(); ctx.restore(); });
          ctx.drawImage(textCanvas, 0, 0, outW, outH);
          deliverImage(out, type, cleanup);
        });
      }).catch(function(){ restoreMarks(); restoreTails(); restoreHrs(); restoreCanvasBg(); cleanup(); });
    }

    function prepareBackground(cb){
      if(photoOn && photoData && layer){
        var op=parseFloat($('opacity').value); if(isNaN(op)) op=100;
        var br=parseFloat($('bright').value)||100;
        bakePhoto(photoData, op, br, w*2, canvas.offsetHeight*2, bgValue, type, function(baked){
          if(baked){ var im=new Image(); im.onload=function(){ cb(im); }; im.onerror=function(){ cb(null); }; im.src=baked; }
          else { cb(null); }
        });
      } else { cb(null); }
    }
    function cleanup(){
      canvas.style.boxShadow=prevShadow; canvas.style.borderRadius=prevRadius;
      stageIn.style.transform=prevTransform; stage.style.height=prevStageH;
      fitStage(); finish();
    }
    doCapture();
  }

  ['save-png'].forEach(function(id){ var b=$(id); if(b) b.addEventListener('click', function(){ doSave('image/png'); }); });
  ['save-jpg'].forEach(function(id){ var b=$(id); if(b) b.addEventListener('click', function(){ doSave('image/jpeg'); }); });

  /* ============================================================
     텍스트 변환 도구
     ============================================================ */
  function transformTextNodes(fn){
    var walker=document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false), nodes=[];
    while(walker.nextNode()){ nodes.push(walker.currentNode); }
    nodes.forEach(function(n){ n.nodeValue=fn(n.nodeValue); });
    cleanEditor(); render(); editor.focus();
  }
  $('t-clear').addEventListener('click', function(){ if(!confirm('로그 내용을 모두 비울까요?')) return; editor.innerHTML=''; render(); });
  $('t-star').addEventListener('click', function(){ transformTextNodes(function(t){ return t.replace(/\*/g,''); }); });
  $('t-quote').addEventListener('click', function(){ transformTextNodes(function(t){ return t.replace(/[\u201C\u201D\u201E\u201F\u2033]/g,'"').replace(/[\u2018\u2019\u201A\u201B\u2032]/g,"'"); }); });
  $('t-dots').addEventListener('click', function(){ transformTextNodes(function(t){ return t.replace(/\u2026/g,'\u22EF').replace(/\u00B7\u00B7\u00B7/g,'\u22EF').replace(/\.{3,}/g,'\u22EF'); }); });
  $('t-paren').addEventListener('click', function(){
    var walker=document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false), nodes=[];
    while(walker.nextNode()){ nodes.push(walker.currentNode); }
    var re=/\([^()\n]*\)/g;
    nodes.forEach(function(tn){
      var text=tn.nodeValue; if(!text || text.indexOf('(')===-1 || text.indexOf(')')===-1) return;
      if(!re.test(text)) return; re.lastIndex=0;
      var p=tn.parentNode; while(p && p!==editor){ if(p.nodeType===1 && (p.tagName==='I'||p.tagName==='EM')) return; p=p.parentNode; }
      var frag=document.createDocumentFragment(), last=0, m; re.lastIndex=0;
      while((m=re.exec(text))!==null){
        if(m.index>last){ frag.appendChild(document.createTextNode(text.slice(last, m.index))); }
        var it=document.createElement('i'); it.textContent=m[0]; frag.appendChild(it); last=m.index+m[0].length;
      }
      if(last<text.length){ frag.appendChild(document.createTextNode(text.slice(last))); }
      tn.parentNode.replaceChild(frag, tn);
    });
    cleanEditor(); render(); editor.focus();
  });

  /* ============================================================
     상태 저장/복원/초기화
     ============================================================ */
  var STORE_KEY = 'logmaker-state-v1';
  var TEXT_IDS = ['name-pos','font','title-font','name-font','title-size','subtitle-size','name-size','font-size','letter-spacing','line-height','pad','break-mode','base-w','ratio-w',
    'c-bg','c-bg-txt','c-fg','c-fg-txt','c-hl','c-hl-txt','c-hl2','c-hl2-txt','c-hl3','c-hl3-txt','c-hl4','c-hl4-txt','c-em','c-em-txt','c-em2','c-em2-txt','c-em3','c-em3-txt','c-em4','c-em4-txt','c-name','c-name-txt','c-bar','c-bar-txt',
    'c-brecv','c-brecv-txt','c-bsend','c-bsend-txt','c-brecv-ink','c-brecv-ink-txt','c-bsend-ink','c-bsend-ink-txt',
    'c-title','c-title-txt','c-subtitle','c-subtitle-txt','c-sub','c-sub-txt','c-quote','c-quote-txt','c-hr','c-hr-txt',
    'c-brecv-name','c-brecv-name-txt','c-bsend-name','c-bsend-name-txt','opacity','bright'];
  var _restoring=false;

  function saveState(){
    if(_restoring) return;
    try{
      var vals={}; TEXT_IDS.forEach(function(id){ var e=$(id); if(e) vals[id]=e.value; });
      var data={ vals:vals, editorHtml:editor.innerHTML, nameHtml:nameEd?nameEd.innerHTML:'',
        titleHtml:($('title-ed')?$('title-ed').innerHTML:''), subtitleHtml:($('subtitle-ed')?$('subtitle-ed').innerHTML:''),
        bgValue:bgValue, align:currentAlign, sizeMode:sizeMode, ratio:ratio, photoOn:photoOn, photoData:photoData };
      try{ localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
      catch(e){ try{ data.photoData=null; localStorage.setItem(STORE_KEY, JSON.stringify(data)); }catch(e2){} }
    }catch(e){}
  }
  function safeRestoreValue(id, val){
    var e=$(id); if(!e) return;
    if(e.type==='range'){
      var n=parseFloat(val), min=parseFloat(e.min), max=parseFloat(e.max), def=parseFloat(e.getAttribute('value'));
      if(isNaN(n) || (!isNaN(min)&&n<min) || (!isNaN(max)&&n>max)){ e.value=isNaN(def)?e.value:def; } else { e.value=n; }
      return;
    }
    e.value=val;
  }
  function ensureFontValid(){
    var sel=$('font'); if(!sel) return; var ok=false;
    for(var i=0;i<sel.options.length;i++){ if(sel.options[i].value===sel.value){ ok=true; break; } }
    if(!ok){ sel.value=sel.options[0].value; }
  }
  function restoreState(){
    var raw; try{ raw=localStorage.getItem(STORE_KEY); }catch(e){ return; } if(!raw) return;
    var data; try{ data=JSON.parse(raw); }catch(e){ return; }
    _restoring=true;
    try{
      if(data.vals){ TEXT_IDS.forEach(function(id){ if(data.vals[id]!=null){ safeRestoreValue(id, data.vals[id]); } }); }
      ensureFontValid();
      if(typeof data.editorHtml==='string'){ editor.innerHTML=data.editorHtml; syncTails(editor); clearHrSel(); }
      if(nameEd && typeof data.nameHtml==='string'){ nameEd.innerHTML=data.nameHtml; }
      if($('title-ed') && typeof data.titleHtml==='string'){ $('title-ed').innerHTML=data.titleHtml; }
      if($('subtitle-ed') && typeof data.subtitleHtml==='string'){ $('subtitle-ed').innerHTML=data.subtitleHtml; }
      updateTitleSizeLabels();
      // 제목/하단에 내용이 있으면 해당 토글을 펼쳐 둔다
      if($('fold-title') && (!titleIsEmpty() || !subtitleIsEmpty())){ $('fold-title').open = true; }
      if($('fold-name') && !nameIsEmpty()){ $('fold-name').open = true; }
      bgValue = data.bgValue || $('c-bg').value;
      updateEditorHl(); updateEditorBub();
      if(data.align){ currentAlign=data.align;
        document.querySelectorAll('#align-seg button').forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-align')===currentAlign?'true':'false'); }); }
      sizeMode = data.sizeMode || 'width';
      document.querySelectorAll('#size-seg button').forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-mode')===sizeMode?'true':'false'); });
      $('width-row').style.display = sizeMode==='width' ? '' : 'none';
      $('ratio-row').style.display = sizeMode==='ratio' ? '' : 'none';
      if(data.ratio){ ratio=data.ratio;
        [].forEach.call(rSeg.querySelectorAll('button'), function(x, idx){ x.setAttribute('aria-pressed', (ratios[idx] && ratios[idx].w===ratio.w && ratios[idx].h===ratio.h)?'true':'false'); }); }
      [].forEach.call(bgWrap.children, function(x){ x.classList.remove('on'); });
      photoData = (typeof data.photoData==='string') ? data.photoData : null;
      photoOn = !!data.photoOn && !!photoData;
      updatePhotoUI();
    }catch(e){}
    _restoring=false;
  }
  $('t-reset').addEventListener('click', function(){
    if(!confirm('모든 설정과 입력 내용을 기본값으로 되돌릴까요?')) return;
    try{ localStorage.removeItem(STORE_KEY); }catch(e){}
    location.reload();
  });

  /* ============================================================
     내 프리셋
     ============================================================ */
  var PRESET_KEY = 'logmaker-presets-v1';
  function captureSettings(){
    var vals={}; TEXT_IDS.forEach(function(id){ var e=$(id); if(e) vals[id]=e.value; });
    return { vals:vals, bgValue:bgValue, align:currentAlign, sizeMode:sizeMode, ratio:ratio };
  }
  function applySettings(s){
    if(!s) return;
    if(s.vals){ TEXT_IDS.forEach(function(id){ if(s.vals[id]!=null){ safeRestoreValue(id, s.vals[id]); } }); }
    ensureFontValid();
    bgValue = s.bgValue || $('c-bg').value;
    updateEditorHl(); updateEditorBub();
    if(s.align){ currentAlign=s.align;
      document.querySelectorAll('#align-seg button').forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-align')===currentAlign?'true':'false'); }); }
    sizeMode = s.sizeMode || 'width';
    document.querySelectorAll('#size-seg button').forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-mode')===sizeMode?'true':'false'); });
    $('width-row').style.display = sizeMode==='width' ? '' : 'none';
    $('ratio-row').style.display = sizeMode==='ratio' ? '' : 'none';
    if(s.ratio){ ratio=s.ratio;
      [].forEach.call(rSeg.querySelectorAll('button'), function(x, idx){ x.setAttribute('aria-pressed', (ratios[idx] && ratios[idx].w===ratio.w && ratios[idx].h===ratio.h)?'true':'false'); }); }
    ['c-bg','c-fg','c-hl','c-hl2','c-hl3','c-hl4','c-em','c-em2','c-em3','c-em4','c-name','c-bar','c-brecv','c-bsend','c-brecv-ink','c-bsend-ink','c-title','c-subtitle','c-sub','c-quote','c-hr','c-brecv-name','c-bsend-name'].forEach(function(cid){
      var t=$(cid+'-txt'); if(t){ var v=t.value.trim(); if(v.indexOf('gradient')===-1 && /^#?[0-9a-fA-F]{3,8}$/.test(v)){ $(cid).value = v.charAt(0)==='#'?v:'#'+v; } }
    });
    if(typeof moveAllThumbs==='function'){ requestAnimationFrame(moveAllThumbs); }
    if(typeof updateTitleSizeLabels==='function'){ updateTitleSizeLabels(); }
    render();
  }
  function loadMyPresets(){ try{ var raw=localStorage.getItem(PRESET_KEY); return raw?JSON.parse(raw):[]; }catch(e){ return []; } }
  function saveMyPresets(list){ try{ localStorage.setItem(PRESET_KEY, JSON.stringify(list)); }catch(e){} }
  function renderMyPresets(){
    var wrap=$('my-presets'), list=loadMyPresets(); wrap.innerHTML='';
    if(!list.length){ return; }
    list.forEach(function(p, idx){
      var chip=document.createElement('div'); chip.className='mychip'; chip.title='클릭하면 이 설정을 적용합니다';
      var label=document.createElement('span'); label.textContent=p.name; chip.appendChild(label);
      var x=document.createElement('span'); x.className='mychip__x'; x.textContent='×'; x.title='삭제'; chip.appendChild(x);
      label.addEventListener('click', function(){ applySettings(p.data); });
      chip.addEventListener('click', function(e){ if(e.target===chip){ applySettings(p.data); } });
      x.addEventListener('click', function(e){ e.stopPropagation(); if(!confirm('"'+p.name+'" 프리셋을 삭제할까요?')) return; var cur=loadMyPresets(); cur.splice(idx,1); saveMyPresets(cur); renderMyPresets(); });
      wrap.appendChild(chip);
    });
  }
  $('preset-save').addEventListener('click', function(){
    var name=prompt('프리셋 이름을 입력하세요.', '내 프리셋 '+(loadMyPresets().length+1)); if(name==null) return;
    name=name.trim(); if(!name) return;
    var list=loadMyPresets(); list.push({ name:name, data:captureSettings() }); saveMyPresets(list); renderMyPresets();
  });

  /* ============================================================
     프리셋 칩 선택표시
     ============================================================ */
  function markDot(wrap, list, value){
    var v=(value||'').trim().toLowerCase();
    [].forEach.call(wrap.children, function(el, i){ var c=list[i] && list[i].c ? list[i].c.toLowerCase() : ''; el.classList.toggle('on', c===v); });
  }
  function syncPresetChips(){
    markDot(hlWrap, hlPresets, hlColorOf(hlSlot));
    markDot(emWrap, emPresets, emColorOf(emSlot));
    var bgv=(bgValue||'').trim().toLowerCase();
    [].forEach.call(bgWrap.children, function(el, i){ var b=bgPresets[i]?String(bgPresets[i].bg).toLowerCase():''; el.classList.toggle('on', b===bgv); });
  }

  /* ============================================================
     초기화
     ============================================================ */
  restoreState();
  renderMyPresets();
  syncPresetChips();
  updateEditorHl();
  updateEditorBub();
  render();
  updateFormatButtons();
  requestAnimationFrame(function(){ if(typeof moveAllThumbs==='function') moveAllThumbs(); });
  window.addEventListener('resize', function(){ if(typeof moveAllThumbs==='function') moveAllThumbs(); });
})();
