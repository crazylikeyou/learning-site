/* ============================================================
   五十音学习站 · 交互逻辑
   纯静态实现：无需服务器、无需联网，双击 index.html 即可使用
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 基础工具 ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function el(tag, cls) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
  function elText(tag, cls, text) {
    const n = el(tag, cls);
    n.textContent = text;
    return n;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  const hiraToKata = (s) => String(s).replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60));

  const KANA_FONT = '"UD Digi Kyokasho NK-R","UD Digi Kyokasho N-R","UD デジタル教科書体 NK-R","Noto Sans JP","Yu Gothic","Meiryo",sans-serif';

  /* ---------------- 状态与存储 ---------------- */
  const STORE_KEY = 'gojuon.state.v1';
  const SEC_ORDER = ['seion', 'dakuon', 'yoon'];

  const STATE = {
    script: 'h',
    theme: 'light',
    rate: 0.9,
    voice: '',
    view: 'chart',
    mastered: { h: {}, k: {} }
  };

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s && typeof s === 'object') {
        STATE.script = s.script === 'k' ? 'k' : 'h';
        STATE.theme = s.theme === 'dark' ? 'dark' : 'light';
        if (typeof s.rate === 'number' && s.rate >= 0.5 && s.rate <= 1.4) STATE.rate = s.rate;
        if (typeof s.voice === 'string') STATE.voice = s.voice;
        if (s.mastered && s.mastered.h && s.mastered.k) {
          STATE.mastered.h = s.mastered.h;
          STATE.mastered.k = s.mastered.k;
        }
      }
    } catch (e) { /* 本地文件环境下 localStorage 可能被禁用，忽略即可 */ }
  }
  function saveState() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(STATE)); } catch (e) { }
  }

  /* ---------------- 建立索引 ---------------- */
  const SECTIONS = {};
  const ITEMS = [];
  const BY_KEY = {};
  const BASE_PAIRS = {};
  const baseH = {}, baseK = {};

  (function buildBaseAndIndex() {
    window.KANA.seion.rows.forEach((row) => row.cells.forEach((c) => {
      if (!c) return;
      BASE_PAIRS[c.h] = c.k;
      baseH[c.h] = c.sh;
      baseK[c.k] = c.sk;
    }));

    SEC_ORDER.forEach((secId) => {
      const src = window.KANA[secId];
      const sec = {
        id: secId, label: src.label, desc: src.desc, note: src.note || '',
        cols: src.cols.slice(), rows: []
      };
      src.rows.forEach((row, ri) => {
        const r = {
          name: row.name, romaji: row.romaji || '', note: row.note || '',
          special: !!row.special, items: []
        };
        row.cells.forEach((cell, ci) => {
          if (!cell) { r.items.push(null); return; }
          const it = {
            key: cell.h, h: cell.h, k: cell.k, romaji: cell.r,
            sec: secId, rowName: row.name, rowIndex: ri, colIndex: ci,
            note: cell.note || '', rare: !!cell.rare,
            exH: cell.exH || '', exHM: cell.exHM || '',
            exK: cell.exK || '', exKM: cell.exKM || '',
            _cell: cell
          };
          BY_KEY[it.key] = it;
          ITEMS.push(it);
          r.items.push(it);
        });
        sec.rows.push(r);
      });
      SECTIONS[secId] = sec;
    });
  })();

  function label(it, script) { return script === 'k' ? it.k : it.h; }
  function displayName(s) { return STATE.script === 'k' ? hiraToKata(s) : s; }

  function strokesOf(it, script) {
    const c = it._cell;
    if (c.sh && c.sk) return script === 'h' ? c.sh : c.sk;
    const isSmall = c.h.length > 1;                           // 拗音
    const extra = isSmall ? 1 : (c.handakuten ? 1 : 2);       // 小写假名 1 画；゛2 画；゜1 画
    return (script === 'h' ? baseH[c.base] : baseK[BASE_PAIRS[c.base]]) + extra;
  }
  function sectionTotal(secId) {
    let n = 0;
    SECTIONS[secId].rows.forEach((r) => r.items.forEach((i) => { if (i) n++; }));
    return n;
  }
  function isMastered(it, script) { return !!STATE.mastered[script][it.key]; }
  function setMastered(it, script, on) {
    if (on) STATE.mastered[script][it.key] = 1;
    else delete STATE.mastered[script][it.key];
    saveState();
  }
  function countMastered(script, secId) {
    let n = 0;
    ITEMS.forEach((it) => {
      if (secId && it.sec !== secId) return;
      if (STATE.mastered[script][it.key]) n++;
    });
    return n;
  }

  /* ---------------- 语音 ---------------- */
  const Speech = {
    voices: [], voice: null,
    init() {
      if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') {
        showTtsWarn('当前浏览器不支持语音合成，发音功能不可用。建议用 Chrome 或 Edge 打开本页。');
        return;
      }
      const pick = () => {
        const all = window.speechSynthesis.getVoices() || [];
        const ja = all.filter((v) => /^ja([-_]|$)/i.test(v.lang || '') || /japan/i.test(v.name || ''));
        this.voices = ja.slice().sort((a, b) => voiceScore(a) - voiceScore(b));
        this.fillSelect();
        this.applyVoice();
        if (this.voices.length) hideTtsWarn();
        else if (all.length) {
          showTtsWarn('没有检测到日语语音包，发音暂时无法播放。<br>解决办法：Windows「设置 → 时间和语言 → 语言和区域 → 添加语言」里添加<b>日语</b>并勾选语音包，然后重启浏览器；或者换用 Edge 打开本页。');
        }
      };
      const voiceScore = (v) => {
        const n = (v.name || '').toLowerCase();
        const order = ['nanami', 'haruka', 'ayumi', 'ichiro', 'sayaka', 'kyoko', 'google'];
        let s = 50;
        order.forEach((p, i) => { if (n.indexOf(p) >= 0) s = Math.min(s, i); });
        if (n.indexOf('desktop') >= 0) s += 20;
        return s;
      };
      pick();
      window.speechSynthesis.onvoiceschanged = pick;
      setTimeout(pick, 600);
      setTimeout(pick, 1800);
      document.addEventListener('click', function once() {
        document.removeEventListener('click', once);
        pick();
      });
    },
    fillSelect() {
      const sel = $('#voiceSelect');
      if (!sel || !this.voices.length) return;
      sel.innerHTML = '';
      this.voices.forEach((v) => {
        const o = document.createElement('option');
        o.value = v.name;
        o.textContent = (v.name || 'unknown')
          .replace('Microsoft ', '')
          .replace(' Desktop', '')
          .replace(/\s*-\s*Japanese\s*\(Japan\)/i, '');
        sel.appendChild(o);
      });
    },
    applyVoice() {
      if (!this.voices.length) return;
      let v = null;
      if (STATE.voice) v = this.voices.filter((x) => x.name === STATE.voice)[0];
      if (!v) v = this.voices[0];
      this.voice = v;
      STATE.voice = v.name;
      const sel = $('#voiceSelect');
      if (sel) sel.value = v.name;
      saveState();
    },
    speak(text) {
      if (!text || !('speechSynthesis' in window)) return;
      const syn = window.speechSynthesis;
      try { syn.cancel(); } catch (e) { }
      const u = new window.SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      u.rate = STATE.rate;
      u.pitch = 1;
      if (this.voice) u.voice = this.voice;
      try { syn.resume(); } catch (e) { }
      try { syn.speak(u); } catch (e) { }
    }
  };

  function showTtsWarn(html) {
    const w = $('#ttsWarn');
    w.innerHTML = html;
    w.hidden = false;
  }
  function hideTtsWarn() { $('#ttsWarn').hidden = true; }

  /* ---------------- 连读（行 / 段） ---------------- */
  let seqToken = 0;
  function flashCell(key, script) {
    const cells = $$('.kana-cell[data-key="' + key + '"]');
    cells.forEach((c) => c.classList.add('is-playing'));
    setTimeout(() => cells.forEach((c) => c.classList.remove('is-playing')), 560);
  }
  function speakSequence(items) {
    const token = ++seqToken;
    const step = (i) => {
      if (token !== seqToken || i >= items.length) return;
      const it = items[i];
      flashCell(it.key);
      Speech.speak(label(it, STATE.script));
      setTimeout(() => { if (token === seqToken) step(i + 1); }, 780);
    };
    step(0);
  }

  /* ---------------- 五十音图 ---------------- */
  const SEC_PROG = {};

  function renderChart() {
    const root = $('#chartRoot');
    root.innerHTML = '';
    SEC_ORDER.forEach((secId) => {
      const sec = SECTIONS[secId];
      const card = el('section', 'chart-card');

      const head = el('div', 'chart-head');
      head.appendChild(elText('h3', '', sec.label));
      head.appendChild(elText('span', 'count', sectionTotal(secId) + ' 音'));
      const prog = el('div', 'sec-progress');
      const txt = elText('span', 'sec-count', '');
      const bar = el('div', 'bar');
      const fill = el('i');
      bar.appendChild(fill);
      prog.appendChild(txt);
      prog.appendChild(bar);
      head.appendChild(prog);
      card.appendChild(head);
      SEC_PROG[secId] = { txt: txt, fill: fill };

      card.appendChild(elText('p', 'chart-desc', sec.desc));

      const wrap = el('div', 'grid-wrap');
      const grid = el('div', 'kana-grid');
      grid.style.setProperty('--cols', sec.cols.length);
      grid.appendChild(elText('div', 'corner', '点行 / 段标题可连读'));

      sec.cols.forEach((cLabel, ci) => {
        const b = elText('button', 'colhead', displayName(cLabel));
        b.type = 'button';
        b.title = '连读整段';
        b.addEventListener('click', () => {
          // 拨音「ん」不属于任何段，连读时跳过
          const list = sec.rows.filter((r) => !r.special).map((r) => r.items[ci]).filter(Boolean);
          speakSequence(list);
        });
        grid.appendChild(b);
      });

      sec.rows.forEach((row) => {
        const rl = el('button', 'rowhead');
        rl.type = 'button';
        rl.title = '连读整行';
        rl.appendChild(elText('span', '', displayName(row.name)));
        if (row.romaji) rl.appendChild(elText('small', '', row.romaji));
        rl.addEventListener('click', () => speakSequence(row.items.filter(Boolean)));
        grid.appendChild(rl);

        row.items.forEach((it) => {
          if (!it) { grid.appendChild(el('div', 'kana-cell empty')); return; }
          grid.appendChild(cellEl(it));
        });
        // 拨音行补齐空格，保持表形整齐
        if (row.special) {
          for (let k = row.items.length; k < sec.cols.length; k++) {
            grid.appendChild(el('div', 'kana-cell empty'));
          }
        }
      });

      wrap.appendChild(grid);
      card.appendChild(wrap);

      const notes = [];
      if (sec.note) notes.push(sec.note);
      sec.rows.forEach((r) => { if (r.note) notes.push(r.name + '：' + r.note); });
      if (notes.length) {
        card.appendChild(elText('p', 'section-note', notes.join('　')));
      }

      root.appendChild(card);
    });
    updateProgress();
  }

  function cellEl(it) {
    const script = STATE.script;
    const b = el('button', 'kana-cell');
    b.type = 'button';
    if (it.rare) b.classList.add('is-rare');
    if (isMastered(it, script)) b.classList.add('is-mastered');
    b.dataset.key = it.key;
    b.setAttribute('aria-label', label(it, script) + ' ' + it.romaji);
    b.appendChild(elText('span', 'kana', label(it, script)));
    b.appendChild(elText('span', 'romaji', it.romaji));
    b.addEventListener('click', () => {
      Speech.speak(label(it, script));
      openDetail(it);
    });
    return b;
  }

  function updateProgress() {
    const h = countMastered('h');
    const k = countMastered('k');
    $('#hiraMastered').textContent = h;
    $('#kataMastered').textContent = k;
    $('#totalMastered').textContent = h + k;
    $('#totalBar').style.width = ((h + k) / (ITEMS.length * 2) * 100) + '%';

    SEC_ORDER.forEach((secId) => {
      const total = sectionTotal(secId);
      const n = countMastered(STATE.script, secId);
      const p = SEC_PROG[secId];
      if (!p) return;
      p.txt.textContent = '已掌握 ' + n + ' / ' + total;
      p.fill.style.width = (total ? (n / total * 100) : 0) + '%';
    });

    $$('.kana-cell[data-key]').forEach((c) => {
      const it = BY_KEY[c.dataset.key];
      if (!it) return;
      c.classList.toggle('is-mastered', isMastered(it, STATE.script));
    });
  }

  /* ---------------- 详情面板 ---------------- */
  let detailItem = null;

  function exLine(kind, kana, meaning) {
    const line = el('div', 'ex-line');
    line.appendChild(elText('span', 'tag', kind));
    line.appendChild(elText('i', '', kana));
    line.appendChild(elText('em', '', meaning));
    const spoken = kana.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '');
    if (spoken && spoken !== '—') {
      line.title = '点击朗读';
      line.addEventListener('click', () => Speech.speak(spoken));
    }
    return line;
  }

  function openDetail(it) {
    detailItem = it;
    const d = $('#detail');
    $('#detailH').textContent = it.h;
    $('#detailK').textContent = it.k;
    $('#detailRomaji').textContent = it.romaji;
    $('#detailMeta').textContent = [
      SECTIONS[it.sec].label,
      displayName(it.rowName),
      displayName(SECTIONS[it.sec].cols[it.colIndex] || ''),
      strokesOf(it, 'h') + ' 画（平）/ ' + strokesOf(it, 'k') + ' 画（片）'
    ].filter(Boolean).join(' ・ ');

    const boxH = $('#detailExH');
    const boxK = $('#detailExK');
    boxH.innerHTML = '';
    boxK.innerHTML = '';
    if (it.exH) boxH.appendChild(exLine('平', it.exH, it.exHM));
    if (it.exK) boxK.appendChild(exLine('片', it.exK, it.exKM));

    const note = $('#detailNote');
    if (it.note) { note.textContent = '💡 ' + it.note; note.hidden = false; }
    else { note.textContent = ''; note.hidden = true; }

    refreshDetailMaster();
    d.classList.add('open');
  }

  function refreshDetailMaster() {
    const btn = $('#detailMaster');
    if (!detailItem) return;
    const on = isMastered(detailItem, STATE.script);
    btn.textContent = on ? '✓ 已掌握（点击取消）' : '标记已掌握';
    btn.classList.toggle('is-marked', on);
  }

  function closeDetail() {
    $('#detail').classList.remove('open');
  }

  /* ---------------- 卡片记忆 ---------------- */
  const Cards = {
    queue: [], idx: 0, flipped: false, builtFor: '',
    build() {
      const scope = $('#cardScope').value;
      const onlyUnmastered = $('#cardUnmastered').checked;
      const script = STATE.script;
      let pool = ITEMS.filter((it) => scope === 'all' || it.sec === scope);
      if (onlyUnmastered) pool = pool.filter((it) => !isMastered(it, script));
      if ($('#cardOrder').value === 'rand') pool = shuffle(pool);
      this.queue = pool;
      this.idx = 0;
      this.flipped = false;
      this.builtFor = script + '|' + scope + '|' + onlyUnmastered + '|' + $('#cardOrder').value;
      $('#flashcard').classList.remove('flipped');
      this.render();
    },
    current() { return this.queue[this.idx]; },
    flip() {
      if (!this.current()) return;
      this.flipped = !this.flipped;
      $('#flashcard').classList.toggle('flipped', this.flipped);
    },
    advance() {
      this.idx++;
      this.flipped = false;
      $('#flashcard').classList.remove('flipped');
      this.render();
    },
    again() {
      const it = this.current();
      if (it) this.queue.push(it);      // 放到队尾，稍后再考一次
      this.advance();
    },
    know() {
      const it = this.current();
      if (it) { setMastered(it, STATE.script, true); updateProgress(); }
      this.advance();
    },
    render() {
      const it = this.current();
      const done = $('#cardDone');
      const card = $('#flashcard');
      if (!it) {
        card.style.visibility = 'hidden';
        done.hidden = false;
        $('#cardMeta').textContent = '0 / 0';
        return;
      }
      card.style.visibility = 'visible';
      done.hidden = true;
      const script = STATE.script;
      $('#cardFrontKana').textContent = label(it, script);
      $('#cardRomaji').textContent = it.romaji;
      const box = $('#cardEx');
      box.innerHTML = '';
      const ex = script === 'k' ? [it.exK, it.exKM] : [it.exH, it.exHM];
      const other = script === 'k' ? [it.exH, it.exHM] : [it.exK, it.exKM];
      if (ex[0]) {
        const d1 = el('div');
        d1.appendChild(elText('span', 'k', ex[0]));
        d1.appendChild(document.createTextNode('　' + ex[1]));
        box.appendChild(d1);
      }
      if (other[0]) {
        const d2 = el('div');
        d2.appendChild(elText('span', 'k', other[0]));
        d2.appendChild(document.createTextNode('　' + other[1]));
        box.appendChild(d2);
      }
      box.appendChild(elText('div', '', '笔画：' + strokesOf(it, 'h') + ' 画（平）/ ' + strokesOf(it, 'k') + ' 画（片）'));
      $('#cardMeta').textContent = (this.idx + 1) + ' / ' + this.queue.length + '　·　' + SECTIONS[it.sec].label;
    }
  };

  /* ---------------- 闯关测验 ---------------- */
  /* 干扰项优先取「同一行」（同元音，如 さ/し/す/せ/そ），
     再取「同一段」（同辅音，如 か/さ/た/な…），这样练的是真正的辨音能力。 */
  function distractorPool(it) {
    const sameRow = [], sameCol = [], others = [];
    ITEMS.forEach((x) => {
      if (x.sec !== it.sec || x.key === it.key) return;
      if (x.rowIndex === it.rowIndex) sameRow.push(x);
      else if (x.colIndex === it.colIndex) sameCol.push(x);
      else others.push(x);
    });
    return shuffle(sameRow).concat(shuffle(sameCol), shuffle(others));
  }

  const Quiz = {
    qs: [], i: 0, right: 0, wrong: [], locked: false, timer: null,
    start(fromWrong) {
      const mode = $('#quizMode').value;
      const scope = $('#quizScope').value;
      const scriptMode = $('#quizScript').value;
      let pool;
      if (fromWrong && this.wrong.length) {
        this.qs = this.wrong.slice();
      } else {
        pool = ITEMS.filter((it) => scope === 'all' || it.sec === scope);
        pool = shuffle(pool).slice(0, 10);
        this.qs = pool.map((it) => ({
          it: it,
          script: scriptMode === 'mix' ? (Math.random() < 0.5 ? 'h' : 'k') : scriptMode
        }));
      }
      this.i = 0; this.right = 0; this.wrong = []; this.locked = false;
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      this.renderQuestion();
    },
    renderQuestion() {
      const stage = $('#quizStage');
      stage.innerHTML = '';
      const q = this.qs[this.i];
      const mode = $('#quizMode').value;
      const wrap = el('div', 'quiz-stage');

      const top = el('div', 'quiz-top');
      top.appendChild(elText('span', '', '第 ' + (this.i + 1) + ' / ' + this.qs.length + ' 题'));
      const bar = el('div', 'bar');
      const fill = el('i');
      fill.style.width = (this.i / this.qs.length * 100) + '%';
      bar.appendChild(fill);
      top.appendChild(bar);
      top.appendChild(elText('span', '', '正确 ' + this.right));
      wrap.appendChild(top);

      const prompt = el('div', 'quiz-prompt');
      if (mode === 'listen') {
        const btn = elText('button', 'btn primary', '🔊 再听一次');
        btn.type = 'button';
        btn.addEventListener('click', () => Speech.speak(label(q.it, q.script)));
        prompt.appendChild(btn);
        prompt.appendChild(elText('div', 'sub', '听发音，选出正确的假名'));
        Speech.speak(label(q.it, q.script));
      } else if (mode === 'k2r') {
        prompt.appendChild(elText('div', 'big-kana', label(q.it, q.script)));
        prompt.appendChild(elText('div', 'sub', SECTIONS[q.it.sec].label + ' · 选出这个假名的罗马音'));
      } else {
        prompt.appendChild(elText('div', 'big-romaji', q.it.romaji));
        const btn = elText('button', 'btn ghost', '🔊 听读音');
        btn.type = 'button';
        btn.addEventListener('click', () => Speech.speak(label(q.it, q.script)));
        prompt.appendChild(btn);
        prompt.appendChild(elText('div', 'sub', '选出对应的' + (q.script === 'k' ? '片假名' : '平假名')));
      }
      wrap.appendChild(prompt);

      const opts = el('div', 'options');
      const list = this.makeOptions(q, mode);
      list.forEach((o) => {
        const b = el('button', 'option' + (mode === 'k2r' ? ' romaji-opt' : ''));
        b.type = 'button';
        b.textContent = o.label;
        b.addEventListener('click', () => this.answer(o, b));
        opts.appendChild(b);
      });
      wrap.appendChild(opts);
      wrap.appendChild(el('div', 'quiz-feedback-slot'));
      stage.appendChild(wrap);
    },
    makeOptions(q, mode) {
      const it = q.it;
      const script = q.script;
      const pool = distractorPool(it);
      const out = [];
      if (mode === 'k2r') {
        const seen = {};
        seen[it.romaji] = 1;
        out.push({ label: it.romaji, right: true });
        pool.forEach((x) => {
          if (out.length >= 4 || seen[x.romaji]) return;
          seen[x.romaji] = 1;
          out.push({ label: x.romaji, right: false });
        });
      } else {
        const seen = {};
        seen[it.key] = 1;
        out.push({ label: label(it, script), right: true, key: it.key });
        pool.forEach((x) => {
          if (out.length >= 4 || seen[x.key]) return;
          seen[x.key] = 1;
          out.push({ label: label(x, script), right: false, key: x.key });
        });
      }
      return shuffle(out);
    },
    answer(opt, btn) {
      if (this.locked) return;
      this.locked = true;
      const q = this.qs[this.i];
      const btns = $$('#quizStage .option');
      const rightText = $('#quizMode').value === 'k2r' ? q.it.romaji : label(q.it, q.script);
      btns.forEach((b) => {
        b.disabled = true;
        if (b.textContent === rightText) b.classList.add('is-right');
      });

      const slot = $('#quizStage .quiz-feedback-slot');
      slot.innerHTML = '';
      const fb = el('div', 'quiz-feedback ' + (opt.right ? 'ok' : 'bad'));

      if (opt.right) {
        this.right++;
        fb.appendChild(elText('span', '', '✓ 答对了'));
        fb.appendChild(elText('span', 'note', label(q.it, 'h') + ' / ' + label(q.it, 'k') + '　' + q.it.romaji));
        slot.appendChild(fb);
        this.timer = setTimeout(() => { this.timer = null; this.next(); }, 850);
      } else {
        btn.classList.add('is-wrong');
        this.wrong.push(q);
        fb.appendChild(elText('span', '', '✗ 答案是 ' + rightText));
        if (q.it.note) fb.appendChild(elText('span', 'note', q.it.note));
        const cont = elText('button', 'btn ghost', '继续 →');
        cont.type = 'button';
        cont.addEventListener('click', () => this.next());
        fb.appendChild(cont);
        slot.appendChild(fb);
        Speech.speak(label(q.it, q.script));
      }
    },
    next() {
      this.i++;
      this.locked = false;
      if (this.i >= this.qs.length) this.finish();
      else this.renderQuestion();
    },
    finish() {
      const stage = $('#quizStage');
      stage.innerHTML = '';
      const wrap = el('div', 'quiz-stage quiz-result');
      const rate = this.qs.length ? Math.round(this.right / this.qs.length * 100) : 0;
      const total = this.qs.length;
      wrap.appendChild(elText('h3', '', rate >= 90 ? '太棒了，这一组可以过了！' : (rate >= 70 ? '不错，再巩固一下错题。' : '别急，先回到五十音图把这一组读熟。')));
      wrap.appendChild(elText('div', 'quiz-score', this.right + ' / ' + total));
      wrap.appendChild(elText('div', 'muted', '正确率 ' + rate + '%'));

      if (this.wrong.length) {
        const h = elText('h4', '', '错题回顾（点击可听发音）');
        h.style.marginTop = '20px';
        wrap.appendChild(h);
        const ul = el('ul', 'wrong-list');
        this.wrong.forEach((q) => {
          const li = el('li');
          li.appendChild(elText('b', '', label(q.it, q.script)));
          li.appendChild(elText('span', 'right', q.it.romaji));
          li.appendChild(elText('span', 'muted', label(q.it, 'h') + ' / ' + label(q.it, 'k')));
          li.addEventListener('click', () => Speech.speak(label(q.it, q.script)));
          ul.appendChild(li);
        });
        wrap.appendChild(ul);
      }

      const btns = el('div', 'card-btns');
      btns.style.marginTop = '20px';
      const again = elText('button', 'btn primary', '再来一组');
      again.type = 'button';
      again.addEventListener('click', () => this.start(false));
      btns.appendChild(again);
      if (this.wrong.length) {
        const only = elText('button', 'btn ok', '只练错题（' + this.wrong.length + '）');
        only.type = 'button';
        only.addEventListener('click', () => this.start(true));
        btns.appendChild(only);
      }
      wrap.appendChild(btns);
      stage.appendChild(wrap);
    }
  };

  /* ---------------- 书写练习 ---------------- */
  const Write = {
    items: [], current: null, strokes: [], drawing: false,

    init() {
      this.canvas = $('#writeCanvas');
      this.ctx = this.canvas.getContext('2d');
      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => this.down(e));
      c.addEventListener('pointermove', (e) => this.move(e));
      c.addEventListener('pointerup', (e) => this.up(e));
      c.addEventListener('pointerleave', (e) => this.up(e));
      c.addEventListener('pointercancel', (e) => this.up(e));

      $('#writeScope').addEventListener('change', () => this.buildPicker());
      $('#writeGuide').addEventListener('change', () => this.redraw());
      $('#writeGrid').addEventListener('change', () => this.redraw());
      $('#writeUndo').addEventListener('click', () => { this.strokes.pop(); this.redraw(); });
      $('#writeClear').addEventListener('click', () => { this.strokes = []; this.redraw(); });
      $('#writeNext').addEventListener('click', () => this.step(1));
      $('#writeSpeak').addEventListener('click', () => {
        if (this.current) Speech.speak(label(this.current, STATE.script));
      });

      let rt = null;
      window.addEventListener('resize', () => {
        clearTimeout(rt);
        rt = setTimeout(() => this.resizeCanvas(), 150);
      });

      this.buildPicker();
    },

    buildPicker() {
      const scope = $('#writeScope').value;
      this.items = ITEMS.filter((it) => it.sec === scope);
      const box = $('#kanaPicker');
      box.innerHTML = '';
      this.pickerBtns = {};
      this.items.forEach((it) => {
        const b = elText('button', '', label(it, STATE.script));
        b.type = 'button';
        b.title = it.romaji;
        b.addEventListener('click', () => this.select(it));
        box.appendChild(b);
        this.pickerBtns[it.key] = b;
      });
      this.select(this.current && this.items.indexOf(this.current) >= 0 ? this.current : this.items[0]);
    },

    select(it) {
      if (!it) return;
      this.current = it;
      this.strokes = [];
      $('#writeKana').textContent = label(it, STATE.script);
      $('#writeRomaji').textContent = it.romaji;
      $('#writeMeta').textContent = strokesOf(it, STATE.script) + ' 画 ・ ' + SECTIONS[it.sec].label;
      this.refreshPicker();
      this.resizeCanvas();
    },

    refreshPicker() {
      const cur = this.current;
      Object.keys(this.pickerBtns || {}).forEach((k) => {
        const b = this.pickerBtns[k];
        b.textContent = label(BY_KEY[k], STATE.script);
        b.classList.toggle('is-on', !!cur && k === cur.key);
        b.classList.toggle('is-mastered', isMastered(BY_KEY[k], STATE.script));
      });
    },

    step(dir) {
      if (!this.items.length) return;
      let i = this.items.indexOf(this.current);
      i = (i + dir + this.items.length) % this.items.length;
      this.select(this.items[i]);
    },

    resizeCanvas() {
      const c = this.canvas;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = Math.max(Math.round((rect.width || 480) * dpr), 320);
      if (Math.abs(c.width - size) > 2) { c.width = size; c.height = size; }
      this.redraw();
    },

    pos(e) {
      const c = this.canvas, r = c.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) / r.width,
        y: (e.clientY - r.top) / r.height
      };
    },
    down(e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      this.drawing = true;
      this.strokes.push([this.pos(e)]);
      try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { }
      this.redraw();
    },
    move(e) {
      if (!this.drawing) return;
      e.preventDefault();
      const s = this.strokes[this.strokes.length - 1];
      const p = this.pos(e);
      const last = s[s.length - 1];
      if (Math.abs(p.x - last.x) < 0.002 && Math.abs(p.y - last.y) < 0.002) return;
      s.push(p);
      this.redraw();
    },
    up() { this.drawing = false; },

    redraw() {
      const ctx = this.ctx, W = this.canvas.width;
      if (!ctx) return;
      ctx.clearRect(0, 0, W, W);
      ctx.fillStyle = '#fffdf9';
      ctx.fillRect(0, 0, W, W);
      if ($('#writeGrid').checked) drawGrid(ctx, W);
      if ($('#writeGuide').checked && this.current) {
        const txt = displayName(this.current.h);
        const size = txt.length > 1 ? W * 0.46 : W * 0.7;
        ctx.save();
        ctx.fillStyle = 'rgba(38,34,30,0.14)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = size + 'px ' + KANA_FONT;
        ctx.fillText(txt, W / 2, W / 2 + W * 0.015);
        ctx.restore();
      }
      drawInk(ctx, W, this.strokes);
    }
  };

  function drawGrid(ctx, W) {
    ctx.save();
    ctx.strokeStyle = 'rgba(200,64,45,0.30)';
    ctx.lineWidth = Math.max(2, W * 0.003);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, W - ctx.lineWidth);
    ctx.setLineDash([W * 0.022, W * 0.018]);
    ctx.strokeStyle = 'rgba(200,64,45,0.22)';
    ctx.beginPath();
    ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, W);
    ctx.moveTo(0, W / 2); ctx.lineTo(W, W / 2);
    ctx.moveTo(0, 0); ctx.lineTo(W, W);
    ctx.moveTo(W, 0); ctx.lineTo(0, W);
    ctx.stroke();
    ctx.restore();
  }

  function drawInk(ctx, W, strokes) {
    ctx.save();
    ctx.strokeStyle = '#23345c';
    ctx.fillStyle = '#23345c';
    ctx.lineWidth = W * 0.03;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokes.forEach((pts) => {
      if (!pts.length) return;
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x * W, pts[0].y * W, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0].x * W, pts[0].y * W);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2 * W;
        const my = (pts[i].y + pts[i + 1].y) / 2 * W;
        ctx.quadraticCurveTo(pts[i].x * W, pts[i].y * W, mx, my);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x * W, last.y * W);
      ctx.stroke();
    });
    ctx.restore();
  }

  /* ---------------- 发音要点 ---------------- */
  function renderGuide() {
    const root = $('#guideRoot');
    root.innerHTML = '';
    window.GUIDE.forEach((g) => {
      const card = el('section', 'guide-card');
      card.appendChild(elText('h3', '', g.title));
      const rows = el('div', 'guide-rows');
      g.items.forEach((pair) => {
        const row = el('div', 'guide-row');
        row.appendChild(elText('div', '', pair[0]));
        row.appendChild(elText('div', '', pair[1]));
        rows.appendChild(row);
      });
      card.appendChild(rows);
      if (g.tip) card.appendChild(elText('p', 'guide-tip', '💡 ' + g.tip));
      root.appendChild(card);
    });
  }

  /* ---------------- 视图切换 ---------------- */
  function setView(name) {
    STATE.view = name;
    saveState();
    $$('.tabs button').forEach((b) => b.classList.toggle('is-on', b.dataset.view === name));
    $$('.view').forEach((v) => v.classList.toggle('is-on', v.id === 'view-' + name));
    if (name === 'cards') {
      const want = STATE.script + '|' + $('#cardScope').value + '|' + $('#cardUnmastered').checked + '|' + $('#cardOrder').value;
      if (!Cards.queue.length || Cards.builtFor !== want) Cards.build();
      else Cards.render();
    }
    if (name === 'write') Write.resizeCanvas();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setScript(script) {
    STATE.script = script;
    saveState();
    $$('#scriptSwitch button').forEach((b) => b.classList.toggle('is-on', b.dataset.script === script));
    renderChart();
    if (STATE.view === 'cards') { Cards.queue = []; Cards.build(); }
    if (STATE.view === 'write') Write.buildPicker();
    // 面板若正开着，只刷新内容；关着就不要自己弹出来
    if (detailItem && $('#detail').classList.contains('open')) openDetail(detailItem);
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    loadState();

    document.documentElement.setAttribute('data-theme', STATE.theme);
    $('#rateRange').value = STATE.rate;
    $('#rateOut').textContent = STATE.rate.toFixed(2).replace(/0$/, '') + '×';
    $$('#scriptSwitch button').forEach((b) => b.classList.toggle('is-on', b.dataset.script === STATE.script));

    renderGuide();
    renderChart();
    Write.init();
    Speech.init();

    /* 标签页 */
    $('#tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-view]');
      if (b) setView(b.dataset.view);
    });

    /* 平假名 / 片假名 */
    $('#scriptSwitch').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-script]');
      if (b) setScript(b.dataset.script);
    });

    /* 语音设置 */
    $('#voiceSelect').addEventListener('change', (e) => {
      STATE.voice = e.target.value;
      Speech.applyVoice();
      Speech.speak('あ');
    });
    $('#rateRange').addEventListener('input', (e) => {
      STATE.rate = parseFloat(e.target.value);
      $('#rateOut').textContent = STATE.rate.toFixed(2).replace(/0$/, '') + '×';
      saveState();
    });
    $('#rateRange').addEventListener('change', () => Speech.speak('あいうえお'));
    $('#testSpeak').addEventListener('click', () => Speech.speak('こんにちは。日本語の勉強を始めましょう。'));

    /* 主题 */
    $('#themeBtn').addEventListener('click', () => {
      STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', STATE.theme);
      saveState();
      Write.redraw();
    });

    /* 重置进度 */
    $('#resetProgress').addEventListener('click', () => {
      if (!window.confirm('确定要清空所有「已掌握」记录吗？此操作不可撤销。')) return;
      STATE.mastered = { h: {}, k: {} };
      saveState();
      updateProgress();
      if (STATE.view === 'write') Write.buildPicker();
    });

    /* 详情面板 */
    $('#detailClose').addEventListener('click', closeDetail);
    $('#detailSpeak').addEventListener('click', () => {
      if (detailItem) Speech.speak(label(detailItem, STATE.script));
    });
    $('#detailMaster').addEventListener('click', () => {
      if (!detailItem) return;
      setMastered(detailItem, STATE.script, !isMastered(detailItem, STATE.script));
      refreshDetailMaster();
      updateProgress();
      Write.refreshPicker();
    });
    $('#detailWrite').addEventListener('click', () => {
      if (!detailItem) return;
      $('#writeScope').value = detailItem.sec;
      Write.buildPicker();
      Write.select(detailItem);
      setView('write');
    });

    /* 卡片 */
    $('#flashcard').addEventListener('click', () => Cards.flip());
    $('#flashcard').addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); Cards.flip(); }
    });
    $('#cardFlip').addEventListener('click', () => Cards.flip());
    $('#cardKnow').addEventListener('click', () => Cards.know());
    $('#cardAgain').addEventListener('click', () => Cards.again());
    $('#cardRestart').addEventListener('click', () => Cards.build());
    ['#cardScope', '#cardOrder', '#cardUnmastered'].forEach((s) => {
      $(s).addEventListener('change', () => Cards.build());
    });

    /* 测验 */
    $('#quizStart').addEventListener('click', () => Quiz.start(false));

    /* 键盘 */
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (e.key === 'Escape') closeDetail();
      if (STATE.view === 'cards' && Cards.current()) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); Cards.flip(); }
        if (e.key === 'ArrowRight') Cards.know();
        if (e.key === 'ArrowLeft') Cards.again();
      }
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => Write.redraw());
    }
    setTimeout(() => Write.resizeCanvas(), 260);

    setView(STATE.view || 'chart');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
