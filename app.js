/* Readability — classic English readability formulas plus Hemingway-style hints. All local. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$;

  // ---------- text analysis ----------
  var ABBR = new Set("mr mrs ms dr prof st jr sr vs etc eg ie no fig mt approx dept est inc ltd co jan feb mar apr jun jul aug sep sept oct nov dec".split(" "));
  var WORD = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

  var HAS_WORD = new RegExp(WORD.source, "u");
  // Sentences with offsets: end at . ! ? when the next word starts with a capital or digit (or at the end), and at line breaks.
  function sentences(text) {
    var out = [], start = 0, m, re = /[.!?…]+["'”’)\]]*(?=\s+["'“‘(\[]?[\p{Lu}\p{N}]|\s*$)|\n+/gu;
    while ((m = re.exec(text))) {
      if (m[0] === ".") {
        var prev = /([\p{L}.]+)$/u.exec(text.slice(start, m.index)), tok = prev ? prev[1].replace(/\./g, "") : "";
        if (prev && (ABBR.has(tok.toLowerCase()) || /^\p{Lu}$/u.test(tok))) continue; // Dr. Smith, J. K. Rowling
      }
      var end = m[0][0] === "\n" ? m.index : m.index + m[0].length;
      out.push({ start: start, end: end });
      start = m.index + m[0].length;
    }
    out.push({ start: start, end: text.length });
    return out.map(function (s) {
      while (s.start < s.end && /\s/.test(text[s.start])) s.start++;
      while (s.end > s.start && /\s/.test(text[s.end - 1])) s.end--;
      return s;
    }).filter(function (s) { return HAS_WORD.test(text.slice(s.start, s.end)); });
  }

  // English syllable estimate (no dictionary): vowel groups, minus silent endings.
  function syllables(word) {
    var w = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return 0;
    if (w.length <= 3) return 1;
    w = w.replace(/(?<=[^td])ed$/, "").replace(/(?<=[^laeiouysxzhc])es$/, "").replace(/(?<=[^laeiouy])e$/, "").replace(/^y/, "");
    var m = w.match(/[aeiouy]{1,2}/g);
    return Math.max(1, m ? m.length : 1);
  }

  function formulas(c) {
    var wps = c.words / c.sentences, spw = c.syllables / c.words;
    return {
      fre: 206.835 - 1.015 * wps - 84.6 * spw,
      fk: 0.39 * wps + 11.8 * spw - 15.59,
      fog: 0.4 * (wps + 100 * c.complex / c.words),
      smog: 1.043 * Math.sqrt(c.poly * 30 / c.sentences) + 3.1291,
      cli: 0.0588 * (c.letters / c.words * 100) - 0.296 * (c.sentences / c.words * 100) - 15.8,
      ari: 4.71 * (c.chars / c.words) + 0.5 * wps - 21.43
    };
  }

  var PASSIVE = /\b(am|is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?(\w+ed|known|done|made|seen|given|taken|written|shown|built|found|kept|left|said|told|thought|brought|bought|caught|taught|held|paid|sent|spent|won|led|put|set|cut|hit|hurt|begun|broken|chosen|driven|eaten|fallen|forgotten|gotten|hidden|ridden|spoken|stolen|thrown|worn|drawn|grown|flown|blown|sold|understood|felt|heard|met|meant|born|lost|run)\b/gi;
  var NOT_ADVERB = new Set("only family early reply supply apply july fly holy ugly belly bully daily friendly lovely lonely silly rely ally italy jelly rally lily bully holly folly costly elderly likely lowly orderly unlikely ugly assembly anomaly monopoly melancholy butterfly dragonfly firefly sly wily oily curly hilly chilly smelly jolly woolly comply multiply imply ply".split(" "));
  var ADVERB = /\b[A-Za-z]{2,}ly\b/g;

  function analyze(text) {
    var sents = sentences(text), all = text.match(WORD) || [];
    var c = { words: all.length, sentences: Math.max(1, sents.length), syllables: 0, complex: 0, poly: 0, letters: 0, chars: 0 };
    all.forEach(function (w) {
      var s = syllables(w);
      c.syllables += s;
      if (s >= 3) {
        c.poly++;
        // Gunning Fog leaves out words that only reach 3 syllables through -es, -ed or -ing.
        var stem = w.replace(/(es|ed|ing)$/i, "");
        if (stem === w || syllables(stem) >= 3) c.complex++;
      }
      c.letters += (w.match(/\p{L}/gu) || []).length;
      c.chars += (w.match(/[\p{L}\p{N}]/gu) || []).length;
    });
    var marks = [];
    sents.forEach(function (s) {
      var n = (text.slice(s.start, s.end).match(WORD) || []).length;
      s.words = n; s.level = n > 30 ? "vhard" : n > 20 ? "hard" : "";
    });
    var m;
    PASSIVE.lastIndex = 0;
    while ((m = PASSIVE.exec(text))) marks.push({ start: m.index, end: m.index + m[0].length, kind: "passive" });
    ADVERB.lastIndex = 0;
    while ((m = ADVERB.exec(text))) {
      if (NOT_ADVERB.has(m[0].toLowerCase())) continue;
      if (marks.some(function (x) { return m.index < x.end && m.index + m[0].length > x.start; })) continue;
      marks.push({ start: m.index, end: m.index + m[0].length, kind: "adverb" });
    }
    marks.sort(function (a, b) { return a.start - b.start; });
    var arabic = (text.match(/[؀-ۿ]/g) || []).length, latin = (text.match(/[A-Za-z]/g) || []).length;
    return { counts: c, sents: sents, marks: marks, scores: c.words ? formulas(c) : null, arabic: arabic > latin };
  }

  function verdict(fre) {
    if (fre >= 80) return ["Very easy", "ok", "Short sentences and everyday words. Almost anyone can follow it."];
    if (fre >= 70) return ["Easy", "ok", "Conversational. Comfortable for most readers."];
    if (fre >= 60) return ["Plain English", "ok", "Clear for most adults. A good target for the web."];
    if (fre >= 50) return ["Fairly difficult", "warn", "Readers need to concentrate. Shorter sentences would help."];
    if (fre >= 30) return ["Difficult", "warn", "Reads like a report or a paper. Split long sentences and swap long words for short ones."];
    return ["Very difficult", "bad", "Academic or legal level. Most readers will struggle."];
  }

  // ---------- UI ----------
  var input = $("#input"), scoresEl = $("#scores"), hl = $("#hl"), sumEl = $("#summary");
  var show = Object.assign({ hard: true, passive: true, adverb: true }, S3.store("read.show") || {});

  function fmt(n) { return isFinite(n) ? n.toFixed(1) : "—"; }
  function gradeText(g) {
    if (!isFinite(g)) return "";
    var r = Math.round(g);
    if (r <= 0) return "kindergarten";
    if (r > 16) return "post-graduate";
    if (r > 12) return "college (" + (r - 12) + (r - 12 === 1 ? "st" : r - 12 === 2 ? "nd" : r - 12 === 3 ? "rd" : "th") + " year)";
    return "grade " + r + " · age " + (r + 5) + "–" + (r + 6);
  }

  function paint(text, r) {
    hl.textContent = "";
    if (!text.trim()) { hl.appendChild(S3.h("div", { "class": "empty" }, [S3.h("b", { text: "Paste your text above" }), "Long sentences, passive voice and adverbs get highlighted here."])); return; }
    var pos = 0, mi = 0;
    function addRange(parent, from, to) {
      // inline marks inside [from, to)
      var p = from;
      while (mi < r.marks.length && r.marks[mi].start < to) {
        var mk = r.marks[mi];
        if (mk.start < p) { mi++; continue; }
        if (mk.end > to) break;
        parent.appendChild(document.createTextNode(text.slice(p, mk.start)));
        parent.appendChild(S3.h("mark", { "class": "m-" + mk.kind + (show[mk.kind] ? "" : " off"), title: mk.kind === "passive" ? "Passive voice" : "Adverb", text: text.slice(mk.start, mk.end) }));
        p = mk.end; mi++;
      }
      parent.appendChild(document.createTextNode(text.slice(p, to)));
    }
    r.sents.forEach(function (s) {
      addRange(hl, pos, s.start);
      if (s.level) {
        var span = S3.h("span", { "class": "s-" + s.level + (show.hard ? "" : " off"), title: s.words + " words: " + (s.level === "vhard" ? "very hard to read" : "hard to read") });
        addRange(span, s.start, s.end); hl.appendChild(span);
      } else addRange(hl, s.start, s.end);
      pos = s.end;
    });
    addRange(hl, pos, text.length);
  }

  function render() {
    var text = input.value, r = analyze(text);
    paint(text, r);
    var c = r.counts, hard = r.sents.filter(function (s) { return s.level === "hard"; }).length, vhard = r.sents.filter(function (s) { return s.level === "vhard"; }).length;
    var passive = r.marks.filter(function (m) { return m.kind === "passive"; }).length, adverbs = r.marks.length - passive;
    $("#cHard").textContent = hard + vhard; $("#cPassive").textContent = passive; $("#cAdverb").textContent = adverbs;
    scoresEl.textContent = ""; sumEl.textContent = "";
    if (!r.scores) {
      sumEl.appendChild(S3.h("div", { "class": "empty" }, [S3.h("b", { text: "No text yet" }), "Scores appear as soon as you type or paste."]));
      return;
    }
    var s = r.scores, v = verdict(s.fre), grades = [s.fk, s.fog, s.smog, s.cli, s.ari], avg = grades.reduce(function (a, b) { return a + b; }, 0) / grades.length;
    var tips = [];
    if (vhard) tips.push(vhard + " very long sentence" + (vhard > 1 ? "s" : "") + " (over 30 words)");
    if (hard) tips.push(hard + " long sentence" + (hard > 1 ? "s" : "") + " (over 20 words)");
    if (passive) tips.push(passive + " passive voice use" + (passive > 1 ? "s" : ""));
    if (adverbs > Math.max(2, c.words / 100 * 2)) tips.push(adverbs + " adverbs (try fewer)");
    sumEl.appendChild(S3.h("div", { "class": "rd-verdict" }, [
      S3.h("div", { "class": "rd-score " + v[1] }, [S3.h("b", { text: Math.round(Math.max(0, Math.min(100, s.fre))) + "" }), S3.h("span", { text: "reading ease" })]),
      S3.h("div", {}, [
        S3.h("h3", { text: v[0] }),
        S3.h("p", { "class": "muted", text: v[2] + " Average grade level " + fmt(avg) + " (" + gradeText(avg) + ")." }),
        S3.h("p", { "class": "faint", text: tips.length ? "To improve: " + tips.join(", ") + "." : "No long sentences, passive voice or extra adverbs found. Nice." })
      ])
    ]));
    if (r.arabic) sumEl.appendChild(S3.h("p", { "class": "chip warn rd-ar", text: "These formulas are built for English. Scores for Arabic text are not meaningful." }));
    if (r.sents.length < 30) sumEl.appendChild(S3.h("p", { "class": "faint rd-small", text: "SMOG is designed for 30+ sentences; with " + r.sents.length + " it is a rough estimate." }));
    var rows = [
      ["Flesch Reading Ease", fmt(s.fre), "0–100, higher is easier"],
      ["Flesch-Kincaid Grade", fmt(s.fk), gradeText(s.fk)],
      ["Gunning Fog", fmt(s.fog), gradeText(s.fog)],
      ["SMOG", fmt(s.smog), gradeText(s.smog)],
      ["Coleman-Liau", fmt(s.cli), gradeText(s.cli)],
      ["Automated Readability", fmt(s.ari), gradeText(s.ari)]
    ];
    var tb = S3.h("tbody");
    rows.forEach(function (row) { tb.appendChild(S3.h("tr", {}, [S3.h("td", { text: row[0] }), S3.h("td", { "class": "num", text: row[1] }), S3.h("td", { "class": "faint", text: row[2] })])); });
    scoresEl.appendChild(S3.h("div", { "class": "tbl-wrap" }, [S3.h("table", { "class": "tbl" }, [tb])]));
    var stats = [["words", c.words], ["sentences", r.sents.length], ["syllables / word", (c.syllables / c.words).toFixed(2)], ["words / sentence", (c.words / Math.max(1, r.sents.length)).toFixed(1)]];
    scoresEl.appendChild(S3.h("div", { "class": "stats mt" }, stats.map(function (p) { return S3.h("div", { "class": "stat" }, [S3.h("b", { text: String(p[1]) }), S3.h("span", { text: p[0] })]); })));
  }

  $$("[data-show]").forEach(function (b) {
    var k = b.dataset.show; b.setAttribute("aria-pressed", String(!!show[k]));
    b.addEventListener("click", function () { show[k] = !show[k]; b.setAttribute("aria-pressed", String(show[k])); S3.store("read.show", show); render(); });
  });
  var save = S3.debounce(function () { S3.store("read.text", input.value || undefined); }, 500);
  input.addEventListener("input", S3.debounce(function () { render(); save(); }, 200));
  $("#clear").addEventListener("click", function () { input.value = ""; S3.store("read.text", undefined); render(); input.focus(); });
  var SAMPLE = "The report was written by the committee after a long review. It is extremely important that every recommendation is carefully considered by all departments before the next financial year begins, because the consequences of inaction could be substantial and very difficult to reverse once the budget has been finalised.\n\n" +
    "Keep it short. Use plain words. Readers scan, so put the main point first and cut what they don't need.\n\nGood writing is clear writing.";
  $("#sample").addEventListener("click", function () { input.value = SAMPLE; render(); save(); S3.done(); });

  input.value = S3.store("read.text") || "";
  render();

  window.S3_DEMO = function () { input.value = SAMPLE; render(); };

  window.S3_SELFTEST = function () {
    var syl = { the: 1, cat: 1, make: 1, table: 2, people: 2, readability: 5, wanted: 2, jumped: 1, boxes: 2, makes: 1, simple: 2, computer: 3, yes: 1 };
    var sylOk = Object.keys(syl).every(function (w) { return syllables(w) === syl[w]; });
    var f = formulas({ words: 100, sentences: 5, syllables: 150, complex: 10, poly: 10, letters: 470, chars: 470 });
    function near(a, b) { return Math.abs(a - b) < 0.01; }
    var fOk = near(f.fre, 59.635) && near(f.fk, 9.91) && near(f.fog, 12) && near(f.smog, 11.208) && near(f.cli, 10.356) && near(f.ari, 10.707);
    var t = "Dr. Smith arrived at 3.30 p.m. today. He left! Did J. K. Rowling call? Yes";
    var ss = sentences(t).map(function (s) { return t.slice(s.start, s.end); });
    var sOk = ss.length === 4 && ss[0] === "Dr. Smith arrived at 3.30 p.m. today." && ss[2] === "Did J. K. Rowling call?" && ss[3] === "Yes";
    var a = analyze("The ball was thrown by the boy. The cake was quickly eaten. He really ran only daily.");
    var pOk = a.marks.filter(function (m) { return m.kind === "passive"; }).length === 2 && a.marks.filter(function (m) { return m.kind === "adverb"; }).length === 1;
    var long = analyze(new Array(26).join("word ") + "end.");
    var lOk = long.sents.length === 1 && long.sents[0].level === "hard" && verdict(65)[0] === "Plain English" && analyze("").scores === null;
    return sylOk && fOk && sOk && pOk && lOk;
  };
})();
